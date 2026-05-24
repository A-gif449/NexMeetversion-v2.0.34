// src/components/MeetingAdOverlay.jsx
// Shows a 30-60 sec ad overlay for free users when joining a meeting.
// Uses Google AdSense display ad + Google IMA SDK video ad (both free).
// Pro users never see this component (gated in Room.jsx).

import { useEffect, useRef, useState, useCallback } from 'react'

const AD_DURATION = 45          // seconds before skip is allowed
const AD_TOTAL   = 60           // total seconds before forced close

// ── Google AdSense publisher ID — replace with your real one ──────────────
// Get it free at: https://adsense.google.com
const ADSENSE_CLIENT = 'ca-pub-9796445469181375'
const ADSENSE_SLOT   = '5311646393'

// ── Google IMA SDK video ad tag (free) ───────────────────────────────────
// Replace with your own VAST tag from Google Ad Manager (free account):
// https://admanager.google.com  →  Inventory → Ad units → Generate tag
const VIDEO_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?' +
  'iu=/21775744923/external/single_ad_samples&sz=640x480' +
  '&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90' +
  '&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator='

export default function MeetingAdOverlay({ onComplete }) {
  const [secondsLeft,  setSecondsLeft]  = useState(AD_TOTAL)
  const [canSkip,      setCanSkip]      = useState(false)
  const [adType,       setAdType]       = useState('loading') // 'video' | 'display' | 'loading'
  const [videoFailed,  setVideoFailed]  = useState(false)
  const [adError,      setAdError]      = useState(false)

  const videoRef      = useRef(null)
  const adContainerRef = useRef(null)
  const imaLoaderRef  = useRef(null)
  const adsManagerRef = useRef(null)
  const timerRef      = useRef(null)
  const doneRef       = useRef(false)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    clearInterval(timerRef.current)
    adsManagerRef.current?.destroy()
    onComplete?.()
  }, [onComplete])

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { finish(); return 0 }
        return s - 1
      })
    }, 1000)

    const skipTimer = setTimeout(() => setCanSkip(true), AD_DURATION * 1000)

    return () => {
      clearInterval(timerRef.current)
      clearTimeout(skipTimer)
    }
  }, [finish])

  // ── Load Google IMA SDK for video ad ─────────────────────────────────────
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js'
    script.async = true
    script.onload = () => initVideoAd()
    script.onerror = () => {
      // IMA SDK blocked (ad blocker) — fall back to display ad
      setAdType('display')
      setVideoFailed(true)
      loadDisplayAd()
    }
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
      adsManagerRef.current?.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function initVideoAd() {
    if (!window.google?.ima) { setAdType('display'); loadDisplayAd(); return }

    try {
      const adDisplayContainer = new window.google.ima.AdDisplayContainer(
        adContainerRef.current,
        videoRef.current
      )
      adDisplayContainer.initialize()

      const loader = new window.google.ima.AdsLoader(adDisplayContainer)
      imaLoaderRef.current = loader

      loader.addEventListener(
        window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (e) => onAdsManagerLoaded(e, adDisplayContainer),
        false
      )
      loader.addEventListener(
        window.google.ima.AdErrorEvent.Type.AD_ERROR,
        () => { setAdType('display'); loadDisplayAd() },
        false
      )

      const req = new window.google.ima.AdsRequest()
      req.adTagUrl = VIDEO_AD_TAG + Date.now()
      req.linearAdSlotWidth  = adContainerRef.current?.clientWidth  || 640
      req.linearAdSlotHeight = adContainerRef.current?.clientHeight || 360
      req.nonLinearAdSlotWidth  = 640
      req.nonLinearAdSlotHeight = 150

      loader.requestAds(req)
      setAdType('video')
    } catch {
      setAdType('display')
      loadDisplayAd()
    }
  }

  function onAdsManagerLoaded(event, adDisplayContainer) {
    try {
      const settings = new window.google.ima.AdsRenderingSettings()
      settings.restoreCustomPlaybackStateOnAdBreakComplete = true
      const mgr = event.getAdsManager(videoRef.current, settings)
      adsManagerRef.current = mgr

      mgr.addEventListener(window.google.ima.AdEvent.Type.ALL_ADS_COMPLETED, finish)
      mgr.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, () => {
        setAdType('display')
        loadDisplayAd()
      })

      mgr.init(
        adContainerRef.current?.clientWidth  || 640,
        adContainerRef.current?.clientHeight || 360,
        window.google.ima.ViewMode.NORMAL
      )
      mgr.start()
    } catch {
      setAdType('display')
      loadDisplayAd()
    }
  }

  function loadDisplayAd() {
    // Inject AdSense display ad script if not already loaded
    if (!document.querySelector(`script[src*="adsbygoogle"]`)) {
      const s = document.createElement('script')
      s.async = true
      s.crossOrigin = 'anonymous'
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
      s.onerror = () => setAdError(true)
      document.head.appendChild(s)
    }
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      setAdError(true)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
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
              : <span style={styles.timerText}>Skip in {secondsLeft - (AD_TOTAL - AD_DURATION)}s</span>
            }
            <span style={styles.totalTimer}>{secondsLeft}s</span>
          </div>
        </div>

        {/* Ad area */}
        <div ref={adContainerRef} style={styles.adArea}>

          {/* Video element for IMA SDK */}
          <video
            ref={videoRef}
            style={{
              ...styles.video,
              display: adType === 'video' ? 'block' : 'none',
            }}
            playsInline
          />

          {/* Display ad (AdSense) */}
          {(adType === 'display' || videoFailed) && !adError && (
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

          {/* Fallback when both ad types fail (e.g. ad blocker) */}
          {adError && (
            <div style={styles.fallback}>
              <div style={styles.fallbackIcon}>📺</div>
              <p style={styles.fallbackTitle}>Ad blocked</p>
              <p style={styles.fallbackSub}>
                NexMeet is free thanks to ads.<br />
                Consider disabling your ad blocker to support us.
              </p>
              <div style={styles.progressBarWrap}>
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${((AD_TOTAL - secondsLeft) / AD_TOTAL) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Loading state */}
          {adType === 'loading' && (
            <div style={styles.loading}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Loading ad…</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${((AD_TOTAL - secondsLeft) / AD_TOTAL) * 100}%`,
            }}
          />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            🔒 Upgrade to <strong>NexMeet Pro</strong> for an ad-free experience
          </span>
          <a
            href="/pricing"
            style={styles.upgradeLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade →
          </a>
        </div>
      </div>

      <style>{`
        @keyframes nm-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nm-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    backdropFilter: 'blur(4px)',
  },
  card: {
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 680,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#facc15',
    animation: 'nm-pulse 2s infinite',
    display: 'inline-block',
  },
  headerText: {
    fontSize: 12,
    color: '#a1a1aa',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  timer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  timerText: {
    fontSize: 12,
    color: '#71717a',
  },
  totalTimer: {
    fontSize: 13,
    color: '#a1a1aa',
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.06)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 100,
    padding: '2px 10px',
  },
  skipBtn: {
    background: '#7c3aed',
    border: 'none',
    color: '#fff',
    borderRadius: 100,
    padding: '5px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  adArea: {
    width: '100%',
    aspectRatio: '16/9',
    background: '#09090b',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#000',
    position: 'absolute',
    inset: 0,
  },
  displayAdWrap: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
  },
  fallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    textAlign: 'center',
  },
  fallbackIcon: {
    fontSize: 48,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#e4e4e7',
    margin: 0,
  },
  fallbackSub: {
    fontSize: 14,
    color: '#71717a',
    lineHeight: 1.6,
    margin: 0,
  },
  progressBarWrap: {
    width: '100%',
    maxWidth: 300,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    background: '#7c3aed',
    borderRadius: 100,
    transition: 'width 1s linear',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTop: '2px solid #7c3aed',
    borderRadius: '50%',
    animation: 'nm-spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 13,
    color: '#52525b',
    margin: 0,
  },
  progressTrack: {
    height: 3,
    background: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    transition: 'width 1s linear',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.02)',
    borderTop: '0.5px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#52525b',
  },
  upgradeLink: {
    fontSize: 12,
    color: '#a78bfa',
    textDecoration: 'none',
    fontWeight: 600,
    padding: '4px 12px',
    border: '0.5px solid rgba(124,58,237,0.4)',
    borderRadius: 100,
    background: 'rgba(124,58,237,0.08)',
  },
}