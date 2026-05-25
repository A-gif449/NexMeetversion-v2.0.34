// src/components/MeetingAdOverlay.jsx
// FIXES:
//   1. onComplete is now GUARANTEED to fire — a hard 62s safety timeout calls
//      finish() even if the ad SDK crashes, hangs, or never loads. Previously
//      if initVideoAd() threw silently or adContainerRef.current was null on
//      mount, the overlay would block the room forever.
//
//   2. adContainerRef null-guard — initVideoAd now waits for the ref to be
//      populated via a requestAnimationFrame loop instead of reading it
//      synchronously in the IMA script onload, which can fire before React
//      has painted the DOM.
//
//   3. Removed the double-timer pattern — one single setInterval drives the
//      countdown. The old code had the interval in useEffect plus the IMA
//      ALL_ADS_COMPLETED event both able to call finish(), with the interval
//      also calling finish() at 0 — triple-fire risk on slow connections.
//
//   4. finish() now uses a ref guard AND clears both timers before calling
//      onComplete, preventing any double-invocation.
//
//   5. AD_DURATION skip timer is now inside the same effect as the countdown
//      so both are cleaned up together on unmount.

import { useEffect, useRef, useState, useCallback } from 'react'

const AD_SKIP_AFTER = 15   // seconds until skip button appears
const AD_MAX        = 45   // hard cap — overlay always closes by this time
const SAFETY_BUFFER = 3    // extra seconds before the safety net fires

const ADSENSE_CLIENT = 'ca-pub-9796445469181375'
const ADSENSE_SLOT   = '5311646393'

const VIDEO_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?' +
  'iu=/21775744923/external/single_ad_samples&sz=640x480' +
  '&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90' +
  '&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator='

export default function MeetingAdOverlay({ onComplete }) {
  const [secondsLeft, setSecondsLeft] = useState(AD_MAX)
  const [canSkip,     setCanSkip]     = useState(false)
  const [adType,      setAdType]      = useState('loading')
  const [adError,     setAdError]     = useState(false)

  const videoRef       = useRef(null)
  const adContainerRef = useRef(null)
  const adsManagerRef  = useRef(null)
  const doneRef        = useRef(false)
  const countdownRef   = useRef(null)
  const safetyRef      = useRef(null)
  const skipTimerRef   = useRef(null)

  // ── finish: guaranteed single-fire ───────────────────────────────────────
  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    clearInterval(countdownRef.current)
    clearTimeout(safetyRef.current)
    clearTimeout(skipTimerRef.current)
    try { adsManagerRef.current?.destroy() } catch {}
    onComplete?.()
  }, [onComplete])

  // ── Single countdown + skip timer + SAFETY NET ───────────────────────────
  useEffect(() => {
    // Countdown
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          finish()
          return 0
        }
        return s - 1
      })
    }, 1000)

    // Skip button
    skipTimerRef.current = setTimeout(() => setCanSkip(true), AD_SKIP_AFTER * 1000)

    // FIX 1: Hard safety net — overlay ALWAYS closes, no matter what the ad SDK does
    safetyRef.current = setTimeout(() => {
      console.warn('[NexMeet] Ad safety timeout fired — forcing room entry')
      finish()
    }, (AD_MAX + SAFETY_BUFFER) * 1000)

    return () => {
      clearInterval(countdownRef.current)
      clearTimeout(safetyRef.current)
      clearTimeout(skipTimerRef.current)
    }
  }, [finish])

  // ── Load IMA SDK ──────────────────────────────────────────────────────────
  useEffect(() => {
    // If already loaded (e.g. hot reload), go straight to init
    if (window.google?.ima) {
      waitForRefThenInit()
      return
    }

    const script = document.createElement('script')
    script.src   = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js'
    script.async = true

    script.onload = () => {
      waitForRefThenInit()
    }
    script.onerror = () => {
      // Ad blocker or network error — fall to display ad immediately
      console.warn('[NexMeet] IMA SDK blocked — falling back to display ad')
      setAdType('display')
      loadDisplayAd()
    }

    document.head.appendChild(script)
    return () => {
      try { document.head.removeChild(script) } catch {}
      try { adsManagerRef.current?.destroy() } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FIX 2: Wait for adContainerRef to be populated before calling IMA APIs.
  // The IMA script onload can fire synchronously before React finishes painting
  // the DOM, so adContainerRef.current is null. We poll with rAF (max 20 frames).
  function waitForRefThenInit(attempts = 0) {
    if (doneRef.current) return
    if (adContainerRef.current && videoRef.current) {
      initVideoAd()
      return
    }
    if (attempts > 20) {
      // Ref never populated — fall to display ad
      console.warn('[NexMeet] adContainerRef never populated — falling back')
      setAdType('display')
      loadDisplayAd()
      return
    }
    requestAnimationFrame(() => waitForRefThenInit(attempts + 1))
  }

  function initVideoAd() {
    if (doneRef.current) return
    if (!window.google?.ima) {
      setAdType('display')
      loadDisplayAd()
      return
    }

    try {
      const adDisplayContainer = new window.google.ima.AdDisplayContainer(
        adContainerRef.current,
        videoRef.current
      )
      adDisplayContainer.initialize()

      const loader = new window.google.ima.AdsLoader(adDisplayContainer)

      loader.addEventListener(
        window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (e) => onAdsManagerLoaded(e),
        false
      )
      loader.addEventListener(
        window.google.ima.AdErrorEvent.Type.AD_ERROR,
        (err) => {
          console.warn('[NexMeet] IMA ad error — falling back to display ad:', err?.getError?.()?.getMessage?.())
          setAdType('display')
          loadDisplayAd()
        },
        false
      )

      const req = new window.google.ima.AdsRequest()
      req.adTagUrl = VIDEO_AD_TAG + Date.now()
      req.linearAdSlotWidth  = adContainerRef.current.clientWidth  || 640
      req.linearAdSlotHeight = adContainerRef.current.clientHeight || 360
      req.nonLinearAdSlotWidth  = 640
      req.nonLinearAdSlotHeight = 150

      loader.requestAds(req)
      setAdType('video')
    } catch (err) {
      console.warn('[NexMeet] initVideoAd threw:', err)
      setAdType('display')
      loadDisplayAd()
    }
  }

  function onAdsManagerLoaded(event) {
    if (doneRef.current) return
    try {
      const settings = new window.google.ima.AdsRenderingSettings()
      settings.restoreCustomPlaybackStateOnAdBreakComplete = true

      const mgr = event.getAdsManager(videoRef.current, settings)
      adsManagerRef.current = mgr

      // FIX 3: ALL_ADS_COMPLETED → finish. This is the only IMA-triggered path.
      mgr.addEventListener(window.google.ima.AdEvent.Type.ALL_ADS_COMPLETED, finish)
      mgr.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, () => {
        console.warn('[NexMeet] AdsManager error — falling to display ad')
        setAdType('display')
        loadDisplayAd()
      })

      mgr.init(
        adContainerRef.current.clientWidth  || 640,
        adContainerRef.current.clientHeight || 360,
        window.google.ima.ViewMode.NORMAL
      )
      mgr.start()
    } catch (err) {
      console.warn('[NexMeet] onAdsManagerLoaded threw:', err)
      setAdType('display')
      loadDisplayAd()
    }
  }

  function loadDisplayAd() {
    if (doneRef.current) return
    if (!document.querySelector(`script[src*="adsbygoogle"]`)) {
      const s = document.createElement('script')
      s.async       = true
      s.crossOrigin = 'anonymous'
      s.src         = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
      s.onerror     = () => setAdError(true)
      document.head.appendChild(s)
    }
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      setAdError(true)
    }
  }

  const skipCountdown = Math.max(0, secondsLeft - (AD_MAX - AD_SKIP_AFTER))

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.dot} />
            <span style={styles.headerText}>Ad — supports free NexMeet</span>
          </div>
          <div style={styles.timer}>
            {canSkip
              ? <button style={styles.skipBtn} onClick={finish}>Skip ad ›</button>
              : <span style={styles.timerText}>Skip in {skipCountdown}s</span>
            }
            <span style={styles.totalTimer}>{secondsLeft}s</span>
          </div>
        </div>

        {/* Ad area */}
        <div ref={adContainerRef} style={styles.adArea}>
          <video
            ref={videoRef}
            style={{ ...styles.video, display: adType === 'video' ? 'block' : 'none' }}
            playsInline
          />

          {adType === 'display' && !adError && (
            <div style={styles.displayAdWrap}>
              <ins
                className="adsbygoogle"
                style={{ display: 'block', width: '100%', height: '100%' }}
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={ADSENSE_SLOT}
                data-ad-format="auto"
                data-full-width-responsive="true"
              />
            </div>
          )}

          {adError && (
            <div style={styles.fallback}>
              <div style={styles.fallbackIcon}>📺</div>
              <p style={styles.fallbackTitle}>Ad blocked</p>
              <p style={styles.fallbackSub}>
                NexMeet is free thanks to ads.<br />
                Consider disabling your ad blocker to support us.
              </p>
              <div style={styles.progressBarWrap}>
                <div style={{ ...styles.progressBar, width: `${((AD_MAX - secondsLeft) / AD_MAX) * 100}%` }} />
              </div>
            </div>
          )}

          {adType === 'loading' && (
            <div style={styles.loading}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Loading ad…</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${((AD_MAX - secondsLeft) / AD_MAX) * 100}%` }} />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            🔒 Upgrade to <strong>NexMeet Pro</strong> for an ad-free experience
          </span>
          <a href="/pricing" style={styles.upgradeLink} target="_blank" rel="noopener noreferrer">
            Upgrade →
          </a>
        </div>
      </div>

      <style>{`
        @keyframes nm-spin { to { transform: rotate(360deg); } }
        @keyframes nm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99999, backdropFilter: 'blur(4px)',
  },
  card: {
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, width: '100%', maxWidth: 680, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: {
    width: 8, height: 8, borderRadius: '50%', background: '#facc15',
    animation: 'nm-pulse 2s infinite', display: 'inline-block',
  },
  headerText: { fontSize: 12, color: '#a1a1aa', letterSpacing: '0.04em', textTransform: 'uppercase' },
  timer: { display: 'flex', alignItems: 'center', gap: 10 },
  timerText: { fontSize: 12, color: '#71717a' },
  totalTimer: {
    fontSize: 13, color: '#a1a1aa', fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 100, padding: '2px 10px',
  },
  skipBtn: {
    background: '#7c3aed', border: 'none', color: '#fff',
    borderRadius: 100, padding: '5px 14px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  adArea: {
    width: '100%', aspectRatio: '16/9', background: '#09090b',
    position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 240,
  },
  video: {
    width: '100%', height: '100%', objectFit: 'contain',
    background: '#000', position: 'absolute', inset: 0,
  },
  displayAdWrap: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, boxSizing: 'border-box',
  },
  fallback: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
  },
  fallbackIcon: { fontSize: 48 },
  fallbackTitle: { fontSize: 18, fontWeight: 600, color: '#e4e4e7', margin: 0 },
  fallbackSub: { fontSize: 14, color: '#71717a', lineHeight: 1.6, margin: 0 },
  progressBarWrap: {
    width: '100%', maxWidth: 300, height: 4,
    background: 'rgba(255,255,255,0.1)', borderRadius: 100, overflow: 'hidden', marginTop: 8,
  },
  progressBar: { height: '100%', background: '#7c3aed', borderRadius: 100, transition: 'width 1s linear' },
  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  spinner: {
    width: 32, height: 32,
    border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #7c3aed',
    borderRadius: '50%', animation: 'nm-spin 0.8s linear infinite',
  },
  loadingText: { fontSize: 13, color: '#52525b', margin: 0 },
  progressTrack: { height: 3, background: 'rgba(255,255,255,0.06)' },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    transition: 'width 1s linear',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: 'rgba(255,255,255,0.02)',
    borderTop: '0.5px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap', gap: 8,
  },
  footerText: { fontSize: 12, color: '#52525b' },
  upgradeLink: {
    fontSize: 12, color: '#a78bfa', textDecoration: 'none', fontWeight: 600,
    padding: '4px 12px', border: '0.5px solid rgba(124,58,237,0.4)',
    borderRadius: 100, background: 'rgba(124,58,237,0.08)',
  },
}