// src/utils/webrtc.js — WebRTC Peer Connection Manager
// ═══════════════════════════════════════════════════════════════════════════
// ROOT-CAUSE FIX: Double-offer "glare" collision
//
// THE BUG:
//   When peer B joins a room where peer A already exists, the server sends:
//     • 'room-joined'  → to B, listing A in existingPeers  → B calls callPeer(A)
//     • 'peer-joined'  → to A                              → A calls callPeer(B)
//   Both fire nearly simultaneously, so BOTH peers create offers before either
//   has a PC for the other. The _createPeer idempotency guard doesn't help
//   because neither PC exists yet when both callPeer() calls start.
//   Result: both end up in 'have-local-offer', one receives an answer while
//   already in 'stable' state → "unexpected signalingState stable" → ICE fails.
//
// THE FIX — Polite Negotiation (RFC 8829 §5.3 "Glare Handling"):
//   Only ONE side should send the initial offer. We decide who by comparing
//   socket IDs lexicographically: the peer with the HIGHER socket ID is the
//   "impolite" peer and makes the offer. The lower-ID peer is "polite" and
//   waits for the offer to arrive.
//
//   In Room.jsx:
//     • 'room-joined'  handler: B calls callPeer(A) only if B.id > A.id
//     • 'peer-joined'  handler: A calls callPeer(B) only if A.id > B.id
//   Exactly one of the two comparisons will be true → exactly one offer.
//
//   PeerConnectionManager exposes:  shouldMakeOffer(myId, theirId)
//   Room.jsx uses it before calling callPeer().
// ═══════════════════════════════════════════════════════════════════════════

import { SDPOptimizer, ConnectionHealthMonitor } from './peerOptimizer'
import { AdaptiveQualityManager } from './adaptiveQuality'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Add your TURN server here for production:
    // { urls: 'turn:YOUR_HOST:3478', username: 'USER', credential: 'PASS' },
  ],
  iceCandidatePoolSize: 2,
  bundlePolicy:    'max-bundle',
  rtcpMuxPolicy:   'require',
  sdpSemantics:    'unified-plan',
}

const ICE_TIMEOUT_MS = 8000

export class PeerConnectionManager {
  constructor({ socket, localStream, onTrack, onConnectionStateChange, onHealthChange, onQualityChange, e2eManager }) {
    this.socket                  = socket
    this.localStream             = localStream
    this.onTrack                 = onTrack
    this.onConnectionStateChange = onConnectionStateChange
    this.onHealthChange          = onHealthChange
    this.onQualityChange         = onQualityChange
    this.e2eManager              = e2eManager || null

    this.peers             = new Map()
    this.pendingCandidates = new Map()
    this.healthMonitors    = new Map()
    this.qualityManagers   = new Map()
    this.iceTimers         = new Map()
  }

  // ── Glare resolution helper ───────────────────────────────────────────────
  // Returns true if THIS peer (myId) should be the one to send the offer.
  // The peer with the lexicographically higher socket ID makes the offer.
  // This gives a consistent, deterministic result on both sides without
  // any extra signaling.
  static shouldMakeOffer(myId, theirId) {
    return myId > theirId
  }

  // ── Create a new RTCPeerConnection ────────────────────────────────────────
  _createPeer(socketId) {
    if (this.peers.has(socketId)) return this.peers.get(socketId)

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.peers.set(socketId, pc)
    this.pendingCandidates.set(socketId, [])

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream)
      })
    }

    if (this.e2eManager?.isEnabled) {
      pc.getSenders().forEach(sender => {
        this.e2eManager.attachSenderEncryption(sender, socketId)
      })
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.socket.emit('ice-candidate', { to: socketId, candidate })
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.log(`[NexMeet] ICE ${socketId}: ${state}`)

      if (state === 'checking') {
        const t = setTimeout(() => {
          if (pc.iceConnectionState === 'checking') {
            console.warn(
              `[NexMeet] ICE still checking after ${ICE_TIMEOUT_MS}ms for ${socketId}. ` +
              'Likely symmetric NAT — add a TURN server to fix this.'
            )
          }
        }, ICE_TIMEOUT_MS)
        this.iceTimers.set(socketId, t)
      } else {
        clearTimeout(this.iceTimers.get(socketId))
        this.iceTimers.delete(socketId)
      }

      if (state === 'failed') {
        console.warn(`[NexMeet] ICE failed for ${socketId} — attempting restart`)
        pc.restartIce()
      }
      if (state === 'connected' || state === 'completed') {
        console.log(`[NexMeet] ✅ ICE connected for ${socketId}`)
      }
    }

    pc.ontrack = ({ streams }) => {
      if (streams && streams[0]) {
        if (this.e2eManager?.isEnabled) {
          pc.getReceivers().forEach(receiver => {
            this.e2eManager.attachReceiverDecryption(receiver, socketId)
          })
        }
        this.onTrack(socketId, streams[0])
        this._startQualityManager(socketId, pc)
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log(`[NexMeet] Connection ${socketId}: ${state}`)
      this.onConnectionStateChange?.(socketId, state)
    }

    // ── onnegotiationneeded: handle renegotiation (e.g. track replace) ──────
    // Only fires AFTER initial setup when the browser decides a new offer is
    // needed. We guard on signalingState to avoid re-offering during setup.
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return
      if (!pc._isOfferer) return   // polite peer never initiates renegotiation
      try {
        const rawOffer = await pc.createOffer()
        if (pc.signalingState !== 'stable') return  // state changed while awaiting
        const offer = SDPOptimizer.optimize(rawOffer)
        await pc.setLocalDescription(offer)
        this.socket.emit('offer', { to: socketId, offer })
        console.log(`[NexMeet] Renegotiation offer sent to ${socketId}`)
      } catch (err) {
        console.error(`[NexMeet] onnegotiationneeded failed for ${socketId}:`, err)
      }
    }

    this._startHealthMonitor(socketId, pc)
    return pc
  }

  _startHealthMonitor(socketId, pc) {
    const monitor = new ConnectionHealthMonitor(pc)
    monitor
      .on('stats',     (data) => this.onHealthChange?.(socketId, data.health, data))
      .on('degraded',  (data) => this.onHealthChange?.(socketId, 'degraded', data))
      .on('poor',      (data) => this.onHealthChange?.(socketId, 'poor', data))
      .on('recovered', (data) => this.onHealthChange?.(socketId, 'good', data))
    monitor.start()
    this.healthMonitors.set(socketId, monitor)
  }

  _startQualityManager(socketId, pc) {
    if (this.qualityManagers.has(socketId)) return
    const mgr = new AdaptiveQualityManager(pc, this.localStream, {
      onQualityChange: (level, preset, reason) => {
        this.onQualityChange?.(socketId, level, preset, reason)
      },
    })
    mgr.start()
    this.qualityManagers.set(socketId, mgr)
  }

  // ── Initiator: create and send offer ─────────────────────────────────────
  // Only call this when shouldMakeOffer(myId, theirId) is true.
  async callPeer(socketId) {
    const existing = this.peers.get(socketId)
    if (existing && existing.signalingState !== 'closed') {
      console.log(`[NexMeet] callPeer: PC already exists for ${socketId}, skipping`)
      return
    }

    const pc = this._createPeer(socketId)
    pc._isOfferer = true   // mark so onnegotiationneeded knows this side offers

    try {
      const rawOffer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      const offer = SDPOptimizer.optimize(rawOffer)
      await pc.setLocalDescription(offer)
      this.socket.emit('offer', { to: socketId, offer })
      console.log(`[NexMeet] Offer sent to ${socketId}`)
    } catch (err) {
      console.error(`[NexMeet] callPeer failed for ${socketId}:`, err)
    }
  }

  // ── Responder: handle incoming offer ─────────────────────────────────────
  async handleOffer(socketId, offer) {
    // If we somehow already sent an offer to this peer (glare escaped the
    // shouldMakeOffer guard), roll back our local offer before accepting theirs.
    let pc = this.peers.get(socketId)

    if (pc && pc.signalingState === 'have-local-offer') {
      console.warn(`[NexMeet] Glare detected for ${socketId} — rolling back local offer`)
      try {
        await pc.setLocalDescription({ type: 'rollback' })
      } catch (rollbackErr) {
        // Browser doesn't support rollback — close and recreate
        console.warn(`[NexMeet] Rollback unsupported, recreating PC for ${socketId}`)
        pc.close()
        this.peers.delete(socketId)
        pc = null
      }
    }

    pc = pc || this._createPeer(socketId)
    pc._isOfferer = false   // we are the answerer

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Flush buffered ICE candidates
      const pending = this.pendingCandidates.get(socketId) || []
      for (const c of pending) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
      }
      this.pendingCandidates.set(socketId, [])

      const rawAnswer = await pc.createAnswer()
      const answer = SDPOptimizer.optimize(rawAnswer)
      await pc.setLocalDescription(answer)
      this.socket.emit('answer', { to: socketId, answer })
      console.log(`[NexMeet] Answer sent to ${socketId}`)
    } catch (err) {
      console.error(`[NexMeet] handleOffer failed for ${socketId}:`, err)
    }
  }

  // ── Handle incoming answer ────────────────────────────────────────────────
  async handleAnswer(socketId, answer) {
    const pc = this.peers.get(socketId)
    if (!pc) {
      console.warn(`[NexMeet] handleAnswer: no PC for ${socketId}`)
      return
    }
    if (pc.signalingState !== 'have-local-offer') {
      // This is the "unexpected signalingState stable" warning from the bug.
      // With shouldMakeOffer() in place this should never fire. Log it clearly.
      console.warn(
        `[NexMeet] handleAnswer: ignoring answer from ${socketId} — ` +
        `signalingState is '${pc.signalingState}', expected 'have-local-offer'. ` +
        `This indicates a glare collision that shouldMakeOffer() should have prevented.`
      )
      return
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))

      // Flush any ICE candidates that arrived before the answer
      const pending = this.pendingCandidates.get(socketId) || []
      for (const c of pending) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
      }
      this.pendingCandidates.set(socketId, [])
    } catch (err) {
      console.error(`[NexMeet] handleAnswer failed for ${socketId}:`, err)
    }
  }

  // ── Handle ICE candidate ──────────────────────────────────────────────────
  async handleIceCandidate(socketId, candidate) {
    const pc = this.peers.get(socketId)
    if (!pc) return
    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        const pending = this.pendingCandidates.get(socketId) || []
        pending.push(candidate)
        this.pendingCandidates.set(socketId, pending)
      }
    } catch (err) {
      console.warn(`[NexMeet] addIceCandidate error for ${socketId}:`, err.message)
    }
  }

  // ── Replace local stream tracks (screen share / camera toggle) ────────────
  async replaceTrack(kind, newTrack) {
    for (const [, pc] of this.peers) {
      const sender = pc.getSenders().find(s => s.track?.kind === kind)
      if (sender) await sender.replaceTrack(newTrack)
    }
  }

  setQualityForAll(level) {
    for (const [, mgr] of this.qualityManagers) mgr.setManualQuality(level)
  }

  enableAutoQualityForAll() {
    for (const [, mgr] of this.qualityManagers) mgr.enableAutoQuality()
  }

  async addE2EPeer(socketId, publicKey) {
    if (!this.e2eManager) return
    await this.e2eManager.addPeer(socketId, publicKey)
    const pc = this.peers.get(socketId)
    if (pc) {
      pc.getSenders().forEach(s => this.e2eManager.attachSenderEncryption(s, socketId))
      pc.getReceivers().forEach(r => this.e2eManager.attachReceiverDecryption(r, socketId))
    }
  }

  removePeer(socketId) {
    clearTimeout(this.iceTimers.get(socketId))
    this.iceTimers.delete(socketId)
    const pc = this.peers.get(socketId)
    if (pc) { pc.close(); this.peers.delete(socketId) }
    this.pendingCandidates.delete(socketId)
    this.healthMonitors.get(socketId)?.stop()
    this.healthMonitors.delete(socketId)
    this.qualityManagers.get(socketId)?.stop()
    this.qualityManagers.delete(socketId)
    this.e2eManager?.removePeer(socketId)
  }

  closeAll() {
    for (const [, t] of this.iceTimers) clearTimeout(t)
    this.iceTimers.clear()
    for (const [, pc] of this.peers) pc.close()
    this.peers.clear()
    this.pendingCandidates.clear()
    for (const [, m] of this.healthMonitors) m.stop()
    this.healthMonitors.clear()
    for (const [, m] of this.qualityManagers) m.stop()
    this.qualityManagers.clear()
  }
}