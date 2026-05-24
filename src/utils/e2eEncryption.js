// src/utils/e2eEncryption.js
// Feature 4: End-to-End Encryption 🔐
// Uses WebCrypto API (built into all modern browsers — zero dependencies)
// Encrypts data channel messages AND video/audio frames via Insertable Streams

// ─── E2EEncryptionManager ─────────────────────────────────────────────────────
// Handles key generation, exchange, and frame-level encryption.
//
// ARCHITECTURE:
//   1. Each participant generates an ECDH key pair on join.
//   2. Public keys are exchanged via your existing signalling channel (Firebase).
//   3. A shared AES-GCM key is derived per peer pair using ECDH.
//   4. RTCRtpSender/Receiver Insertable Streams encrypt/decrypt every frame.
//   5. Data channel messages use the same AES-GCM key.

export class E2EEncryptionManager {
  constructor() {
    this._keyPair = null;           // ECDH key pair (this user)
    this._sharedKeys = new Map();   // peerId → CryptoKey (AES-GCM)
    this._enabled = false;
  }

  get isEnabled() { return this._enabled; }

  // ── Step 1: Generate this user's ECDH key pair ────────────────────────────
  async initialize() {
    this._keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,    // exportable
      ['deriveKey'],
    );
    this._enabled = true;
    console.log('[NexMeet] 🔐 E2E Encryption initialized');
    return this._keyPair;
  }

  // ── Step 2: Export public key to share via signalling ─────────────────────
  async exportPublicKey() {
    if (!this._keyPair) throw new Error('Call initialize() first');
    const raw = await crypto.subtle.exportKey('raw', this._keyPair.publicKey);
    // Base64-encode for safe transport through Firebase
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  }

  // ── Step 3: Import a remote peer's public key & derive shared secret ──────
  async addPeer(peerId, base64PublicKey) {
    const raw = Uint8Array.from(atob(base64PublicKey), (c) => c.charCodeAt(0));
    const remotePublicKey = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    // Derive 256-bit AES-GCM key from ECDH shared secret
    const sharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: remotePublicKey },
      this._keyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );

    this._sharedKeys.set(peerId, sharedKey);
    console.log(`[NexMeet] 🔐 Shared key derived for peer: ${peerId}`);
    return sharedKey;
  }

  removePeer(peerId) {
    this._sharedKeys.delete(peerId);
  }

  // ── Step 4a: Encrypt a data channel message ───────────────────────────────
  async encryptMessage(peerId, plaintext) {
    const key = this._sharedKeys.get(peerId);
    if (!key) throw new Error(`No shared key for peer: ${peerId}`);

    const iv = crypto.getRandomValues(new Uint8Array(12));   // 96-bit IV
    const encoded = new TextEncoder().encode(JSON.stringify(plaintext));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded,
    );

    // Pack: [12 bytes IV][ciphertext] → Base64
    const packed = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), 12);
    return btoa(String.fromCharCode(...packed));
  }

  // ── Step 4b: Decrypt a data channel message ───────────────────────────────
  async decryptMessage(peerId, base64payload) {
    const key = this._sharedKeys.get(peerId);
    if (!key) throw new Error(`No shared key for peer: ${peerId}`);

    const packed = Uint8Array.from(atob(base64payload), (c) => c.charCodeAt(0));
    const iv = packed.slice(0, 12);
    const ciphertext = packed.slice(12);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  // ── Step 5a: Attach frame encryption to an RTCRtpSender ──────────────────
  // Call AFTER adding tracks, before exchanging offer/answer.
  // Requires: RTCRtpSender.createEncodedStreams() (Chrome 86+, Firefox 117+)
  attachSenderEncryption(sender, peerId) {
    if (!sender.createEncodedStreams) {
      console.warn('[NexMeet] Insertable Streams not supported — frame encryption skipped');
      return false;
    }
    const key = this._sharedKeys.get(peerId);
    if (!key) {
      console.warn(`[NexMeet] No key for ${peerId} — cannot encrypt sender`);
      return false;
    }

    const { readable, writable } = sender.createEncodedStreams();
    const encryptStream = new TransformStream({
      transform: (frame, controller) => {
        this._encryptFrame(frame, key)
          .then((encrypted) => controller.enqueue(encrypted))
          .catch(() => controller.enqueue(frame)); // fail open — keep call alive
      },
    });
    readable.pipeThrough(encryptStream).pipeTo(writable);
    return true;
  }

  // ── Step 5b: Attach frame decryption to an RTCRtpReceiver ────────────────
  attachReceiverDecryption(receiver, peerId) {
    if (!receiver.createEncodedStreams) return false;
    const key = this._sharedKeys.get(peerId);
    if (!key) return false;

    const { readable, writable } = receiver.createEncodedStreams();
    const decryptStream = new TransformStream({
      transform: (frame, controller) => {
        this._decryptFrame(frame, key)
          .then((decrypted) => controller.enqueue(decrypted))
          .catch(() => controller.enqueue(frame)); // fail open
      },
    });
    readable.pipeThrough(decryptStream).pipeTo(writable);
    return true;
  }

  // ── Internal: encrypt a single encoded frame ──────────────────────────────
  // Frame layout: [original data] → encrypt → [12-byte IV][tag][ciphertext]
  async _encryptFrame(frame, key) {
    const data = new Uint8Array(frame.data);
    // Preserve first 4 bytes unencrypted (needed for keyframe detection by browser)
    const headerBytes = 4;
    const header = data.slice(0, headerBytes);
    const payload = data.slice(headerBytes);

    if (payload.byteLength === 0) return frame;

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      payload,
    );

    const combined = new Uint8Array(headerBytes + 12 + encrypted.byteLength);
    combined.set(header, 0);
    combined.set(iv, headerBytes);
    combined.set(new Uint8Array(encrypted), headerBytes + 12);
    frame.data = combined.buffer;
    return frame;
  }

  async _decryptFrame(frame, key) {
    const data = new Uint8Array(frame.data);
    const headerBytes = 4;
    if (data.byteLength <= headerBytes + 12) return frame;

    const header = data.slice(0, headerBytes);
    const iv = data.slice(headerBytes, headerBytes + 12);
    const ciphertext = data.slice(headerBytes + 12);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext,
      );
      const combined = new Uint8Array(headerBytes + decrypted.byteLength);
      combined.set(header, 0);
      combined.set(new Uint8Array(decrypted), headerBytes);
      frame.data = combined.buffer;
    } catch (e) {
      // Decryption failure can happen on the first frame — not fatal
      console.debug('[NexMeet] Frame decryption failed (may be first frame)');
    }
    return frame;
  }

  // ── Utility: verify encryption is active ─────────────────────────────────
  getEncryptionStatus() {
    return {
      enabled: this._enabled,
      keyPairReady: !!this._keyPair,
      peersEncrypted: this._sharedKeys.size,
      algorithm: 'AES-GCM-256 via ECDH P-256',
    };
  }
}

// ─── Encrypted Data Channel ───────────────────────────────────────────────────
// Wraps RTCDataChannel with transparent encrypt/decrypt.
//
// Usage:
//   const channel = new EncryptedDataChannel(rawDataChannel, e2eManager, peerId);
//   channel.send({ type: 'chat', text: 'hello' });
//   channel.onmessage = (data) => console.log(data);

export class EncryptedDataChannel {
  constructor(dataChannel, e2eManager, peerId) {
    this._channel = dataChannel;
    this._e2e = e2eManager;
    this._peerId = peerId;
    this.onmessage = null;
    this.onopen = null;
    this.onclose = null;

    dataChannel.onopen = () => this.onopen?.();
    dataChannel.onclose = () => this.onclose?.();
    dataChannel.onmessage = async (event) => {
      try {
        const data = this._e2e.isEnabled
          ? await this._e2e.decryptMessage(this._peerId, event.data)
          : JSON.parse(event.data);
        this.onmessage?.(data);
      } catch (e) {
        console.warn('[NexMeet] Failed to decrypt message:', e);
      }
    };
  }

  async send(data) {
    const payload = this._e2e.isEnabled
      ? await this._e2e.encryptMessage(this._peerId, data)
      : JSON.stringify(data);
    if (this._channel.readyState === 'open') {
      this._channel.send(payload);
    }
  }

  close() { this._channel.close(); }
  get readyState() { return this._channel.readyState; }
}

// ─── React Hook ───────────────────────────────────────────────────────────────
// Usage inside Room.jsx:
//   const { e2e, encryptionStatus, initEncryption } = useE2EEncryption();

import { useState, useRef, useCallback } from 'react';

export function useE2EEncryption() {
  const [encryptionStatus, setEncryptionStatus] = useState({
    enabled: false,
    keyPairReady: false,
    peersEncrypted: 0,
    algorithm: '',
  });
  const e2eRef = useRef(null);

  const initEncryption = useCallback(async () => {
    const mgr = new E2EEncryptionManager();
    await mgr.initialize();
    e2eRef.current = mgr;
    setEncryptionStatus(mgr.getEncryptionStatus());
    return mgr;
  }, []);

  const addPeer = useCallback(async (peerId, publicKey) => {
    if (!e2eRef.current) throw new Error('E2E not initialized');
    await e2eRef.current.addPeer(peerId, publicKey);
    setEncryptionStatus(e2eRef.current.getEncryptionStatus());
  }, []);

  const exportPublicKey = useCallback(async () => {
    return e2eRef.current?.exportPublicKey();
  }, []);

  return {
    e2e: e2eRef.current,
    encryptionStatus,
    initEncryption,
    addPeer,
    exportPublicKey,
  };
}