// src/utils/meetingPersistence.js
// Feature 1: Meeting Persistence + Rejoin Recovery

const STORAGE_KEY = 'nexmeet_session';
const HISTORY_KEY = 'nexmeet_history';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const MeetingPersistence = {
  saveSession(roomId, userId, displayName, mediaState = { audio: true, video: true }) {
    const session = {
      roomId,
      userId,
      displayName,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      mediaState,
      reconnectAttempts: 0,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('[NexMeet] Could not persist session:', e);
    }
    return session;
  },

  updateSession(updates = {}) {
    const session = this.getSession();
    if (!session) return null;
    const updated = { ...session, ...updates, lastSeen: Date.now() };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    return updated;
  },

  getSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() - session.lastSeen > SESSION_TTL) {
        this.clearSession();
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  },

  canRejoin(roomId) {
    const session = this.getSession();
    return session && session.roomId === roomId;
  },

  incrementReconnectAttempts() {
    const session = this.getSession();
    if (!session) return 0;
    const attempts = (session.reconnectAttempts || 0) + 1;
    this.updateSession({ reconnectAttempts: attempts });
    return attempts;
  },

  resetReconnectAttempts() {
    this.updateSession({ reconnectAttempts: 0 });
  },

  clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  },

  saveMeetingToHistory(roomId, displayName, durationMs) {
    try {
      const history = this.getMeetingHistory();
      history.unshift({
        roomId,
        displayName,
        date: new Date().toISOString(),
        duration: durationMs,
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (e) {}
  },

  getMeetingHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  },
};

export class ReconnectManager {
  constructor(onReconnect, options = {}) {
    this.onReconnect = onReconnect;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelay = options.baseDelay ?? 1500;
    this.maxDelay = options.maxDelay ?? 30000;
    this.attempt = 0;
    this._timer = null;
    this._aborted = false;
  }

  start() {
    this._aborted = false;
    this._schedule();
  }

  _schedule() {
    if (this._aborted || this.attempt >= this.maxAttempts) {
      if (this.onGiveUp) this.onGiveUp(this.attempt);
      return;
    }
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt) + Math.random() * 500,
      this.maxDelay,
    );
    this.attempt++;
    MeetingPersistence.incrementReconnectAttempts();
    this._timer = setTimeout(async () => {
      if (this._aborted) return;
      try {
        await this.onReconnect(this.attempt);
        MeetingPersistence.resetReconnectAttempts();
        this.stop();
      } catch (err) {
        console.warn(`[NexMeet] Reconnect attempt ${this.attempt} failed:`, err);
        this._schedule();
      }
    }, delay);
  }

  stop() {
    this._aborted = true;
    clearTimeout(this._timer);
  }

  reset() {
    this.stop();
    this.attempt = 0;
    this._aborted = false;
  }
}

import { useState, useEffect, useCallback, useRef } from 'react';

export function useMeetingPersistence(roomId, user) {
  const [session, setSession]       = useState(null);
  const [rejoinData, setRejoinData] = useState(null);

  // FIX: Track whether we've already handled the session init for this
  // roomId+user combo. Without this, re-renders (e.g. when waitingStatus
  // changes to 'admitted') caused the effect to re-run, find the session
  // we just saved, and incorrectly show the rejoin banner mid-meeting.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!roomId || !user) return;
    if (initializedRef.current) return;   // already initialized — don't re-run
    initializedRef.current = true;

    if (MeetingPersistence.canRejoin(roomId)) {
      const existing = MeetingPersistence.getSession();
      // FIX: Only offer rejoin if the session is from a *different* tab visit,
      // i.e. there's a meaningful gap since lastSeen (>5 seconds).
      // This prevents the banner from showing when the component simply
      // re-mounts during the same page load (admitted guest transition).
      const ageMs = Date.now() - (existing?.lastSeen ?? 0);
      if (ageMs > 5000) {
        setRejoinData(existing);
        return;
      }
      // Session is fresh (same page load) — treat as active, skip banner
      setSession(existing);
    } else {
      // No existing session — start fresh
      const s = MeetingPersistence.saveSession(
        roomId, user.uid, user.displayName || 'Guest'
      );
      setSession(s);
    }

    // Heartbeat every 10s
    const heartbeat = setInterval(() => {
      MeetingPersistence.updateSession({ lastSeen: Date.now() });
    }, 10_000);

    return () => clearInterval(heartbeat);
  }, [roomId, user]);

  const confirmRejoin = useCallback(() => {
    setSession(rejoinData);
    setRejoinData(null);
    MeetingPersistence.resetReconnectAttempts();
  }, [rejoinData]);

  const clearRejoin = useCallback(() => {
    MeetingPersistence.clearSession();
    setRejoinData(null);
    if (roomId && user) {
      const s = MeetingPersistence.saveSession(
        roomId, user.uid, user.displayName || 'Guest'
      );
      setSession(s);
    }
  }, [roomId, user]);

  const updateMediaState = useCallback((mediaState) => {
    MeetingPersistence.updateSession({ mediaState });
    setSession((prev) => prev ? { ...prev, mediaState } : prev);
  }, []);

  const endSession = useCallback((durationMs) => {
    MeetingPersistence.saveMeetingToHistory(
      roomId, user?.displayName || 'Guest', durationMs
    );
    MeetingPersistence.clearSession();
    setSession(null);
    initializedRef.current = false;   // allow fresh session on next room join
  }, [roomId, user]);

  return { session, rejoinData, confirmRejoin, clearRejoin, updateMediaState, endSession };
}