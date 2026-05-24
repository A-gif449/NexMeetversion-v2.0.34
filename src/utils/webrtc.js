// src/utils/webrtc.js — WebRTC Peer Connection Manager
// Updated: Peer Connection Optimization + Adaptive Quality support

import { SDPOptimizer, ConnectionHealthMonitor } from './peerOptimizer'
import { AdaptiveQualityManager } from './adaptiveQuality'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  // ✅ Optimization: bundle all media into one transport, pre-gather candidates
  iceCandidatePoolSize: 4,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan',
}

export class PeerConnectionManager {
  constructor({ socket, localStream, onTrack, onConnectionStateChange, onHealthChange, onQualityChange, e2eManager }) {
    this.socket               = socket
    this.localStream          = localStream
    this.onTrack              = onTrack
    this.onConnectionStateChange = onConnectionStateChange
    this.onHealthChange       = onHealthChange    // (socketId, health, stats) => void
    this.onQualityChange      = onQualityChange   // (socketId, level, preset) => void
    this.e2eManager           = e2eManager || null // E2EEncryptionManager instance or null

    this.peers             = new Map() // socketId -> RTCPeerConnection
    this.pendingCandidates = new Map() // socketId -> []
    this.healthMonitors    = new Map() // socketId -> ConnectionHealthMonitor
    this.qualityManagers   = new Map() // socketId -> AdaptiveQualityManager
  }

  // ── Create a new RTCPeerConnection for a remote peer ──────────────────────
  _createPeer(socketId) {
    if (this.peers.has(socketId)) return this.peers.get(socketId)

    // ✅ Use optimized config instead of bare ICE_SERVERS
    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.peers.set(socketId, pc)
    this.pendingCandidates.set(socketId, [])

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream)
      })
    }

    // ✅ E2E: attach sender encryption once keys are exchanged
    if (this.e2eManager?.isEnabled) {
      pc.getSenders().forEach(sender => {
        this.e2eManager.attachSenderEncryption(sender, socketId)
      })
    }

    // ICE candidate handler
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.socket.emit('ice-candidate', { to: socketId, candidate })
      }
    }

    // ✅ ICE restart on failure
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[NexMeet] ICE failed for ${socketId} — restarting`)
        pc.restartIce()
      }
    }

    // Remote track received
    pc.ontrack = ({ streams }) => {
      if (streams && streams[0]) {
        // ✅ E2E: attach receiver decryption
        if (this.e2eManager?.isEnabled) {
          pc.getReceivers().forEach(receiver => {
            this.e2eManager.attachReceiverDecryption(receiver, socketId)
          })
        }
        this.onTrack(socketId, streams[0])

        // ✅ Start adaptive quality once remote track arrives
        this._startQualityManager(socketId, pc)
      }
    }

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(socketId, pc.connectionState)
    }

    // ✅ Start health monitor for this peer
    this._startHealthMonitor(socketId, pc)

    return pc
  }

  // ✅ Health monitor per peer
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

  // ✅ Adaptive quality manager per peer
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

  // ── Initiator: create offer ───────────────────────────────────────────────
  async callPeer(socketId) {
    const pc = this._createPeer(socketId)
    const rawOffer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    // ✅ Optimize SDP: prefer VP9, enable DTX, set audio bitrate
    const offer = SDPOptimizer.optimize(rawOffer)
    await pc.setLocalDescription(offer)
    this.socket.emit('offer', { to: socketId, offer })
  }

  // ── Responder: handle incoming offer ─────────────────────────────────────
  async handleOffer(socketId, offer) {
    const pc = this._createPeer(socketId)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    // Flush pending ICE candidates
    const pending = this.pendingCandidates.get(socketId) || []
    for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c))
    this.pendingCandidates.set(socketId, [])

    const rawAnswer = await pc.createAnswer()
    // ✅ Optimize answer SDP too
    const answer = SDPOptimizer.optimize(rawAnswer)
    await pc.setLocalDescription(answer)
    this.socket.emit('answer', { to: socketId, answer })
  }

  // ── Handle incoming answer ────────────────────────────────────────────────
  async handleAnswer(socketId, answer) {
    const pc = this.peers.get(socketId)
    if (!pc) return
    if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }

  // ── Handle ICE candidate ──────────────────────────────────────────────────
  async handleIceCandidate(socketId, candidate) {
    const pc = this.peers.get(socketId)
    if (!pc) return
    if (pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } else {
      const pending = this.pendingCandidates.get(socketId) || []
      pending.push(candidate)
      this.pendingCandidates.set(socketId, pending)
    }
  }

  // ── Replace local stream tracks (e.g. toggling camera / screen share) ─────
  async replaceTrack(kind, newTrack) {
    for (const [, pc] of this.peers) {
      const sender = pc.getSenders().find(s => s.track?.kind === kind)
      if (sender) await sender.replaceTrack(newTrack)
    }
  }

  // ✅ Manually set quality for all peers (called from UI quality selector)
  setQualityForAll(level) {
    for (const [, mgr] of this.qualityManagers) {
      mgr.setManualQuality(level)
    }
  }

  enableAutoQualityForAll() {
    for (const [, mgr] of this.qualityManagers) {
      mgr.enableAutoQuality()
    }
  }

  // ✅ Add E2E peer key after key exchange signal arrives
  async addE2EPeer(socketId, publicKey) {
    if (!this.e2eManager) return
    await this.e2eManager.addPeer(socketId, publicKey)
    const pc = this.peers.get(socketId)
    if (pc) {
      pc.getSenders().forEach(s => this.e2eManager.attachSenderEncryption(s, socketId))
      pc.getReceivers().forEach(r => this.e2eManager.attachReceiverDecryption(r, socketId))
    }
  }

  // ── Remove a peer (they left) ─────────────────────────────────────────────
  removePeer(socketId) {
    const pc = this.peers.get(socketId)
    if (pc) {
      pc.close()
      this.peers.delete(socketId)
      this.pendingCandidates.delete(socketId)
    }
    this.healthMonitors.get(socketId)?.stop()
    this.healthMonitors.delete(socketId)
    this.qualityManagers.get(socketId)?.stop()
    this.qualityManagers.delete(socketId)
    this.e2eManager?.removePeer(socketId)
  }

  // ── Close all connections ─────────────────────────────────────────────────
  closeAll() {
    for (const [, pc] of this.peers) pc.close()
    this.peers.clear()
    this.pendingCandidates.clear()
    for (const [, m] of this.healthMonitors) m.stop()
    this.healthMonitors.clear()
    for (const [, m] of this.qualityManagers) m.stop()
    this.qualityManagers.clear()
  }
}