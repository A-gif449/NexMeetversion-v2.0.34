// src/pages/Support.jsx — Static FAQ + How-to Guide (no API, completely free)

import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const FAQS = [
  {
    category: 'Getting Started',
    icon: '🚀',
    items: [
      {
        q: 'What is NexMeet?',
        a: 'NexMeet is a next-generation video conferencing platform built on WebRTC peer-to-peer technology. It offers HD/4K video, end-to-end encryption, AI transcription, screen sharing, chat, reactions, hand raise, and waiting rooms — all in your browser, no downloads required.',
      },
      {
        q: 'Do I need an account to join a meeting?',
        a: 'You need an account to create or host a room. To join a room someone else created, you just need the Room ID they share with you.',
      },
      {
        q: 'What browsers are supported?',
        a: 'NexMeet works best on Chrome, Edge, and Firefox (latest versions). Safari is supported but may have limited screen-sharing capabilities. Always use the latest version for best performance.',
      },
    ],
  },
  {
    category: 'Rooms',
    icon: '🏠',
    items: [
      {
        q: 'What is a Public Room?',
        a: 'A Public Room is open to anyone who has the Room ID. Anyone can join instantly without waiting for the host to approve them. Great for open team standups, webinars, or community calls.',
      },
      {
        q: 'What is a Private Room?',
        a: 'A Private Room has a Waiting Room enabled. Participants who join must wait until the host admits them one by one. This gives you full control over who enters — ideal for interviews, client calls, or confidential meetings.',
      },
      {
        q: 'How do I create a room?',
        a: 'After signing in, go to the Rooms page and click "New Room". Choose Public or Private, give it a name, and share the generated Room ID with participants.',
      },
      {
        q: 'How many people can join a room?',
        a: 'Free plan: up to 5 participants. Pro plan: up to 50 participants. Team plan: up to 300 participants.',
      },
      {
        q: 'What is Meeting Persistence?',
        a: 'Meeting Persistence means your room stays alive even if the host temporarily disconnects. Participants remain connected and the host can rejoin without the meeting ending. Available on Pro and Team plans.',
      },
    ],
  },
  {
    category: 'Audio & Video',
    icon: '🎙️',
    items: [
      {
        q: 'My camera or microphone isn\'t working. What do I do?',
        a: '1. Check that your browser has permission to access camera/mic (click the lock icon in the address bar). 2. Close other apps that might be using your camera (Zoom, Teams, etc.). 3. Refresh the page. 4. Try a different browser. 5. Restart your browser if the issue persists.',
      },
      {
        q: 'Why is my video quality poor?',
        a: 'NexMeet uses Adaptive Quality — it automatically lowers resolution when your connection is weak to keep the call smooth. You can also manually adjust quality in the in-room settings panel. Make sure you\'re on a stable Wi-Fi or wired connection.',
      },
      {
        q: 'I hear echo or feedback. How do I fix it?',
        a: 'Echo is usually caused by your speaker audio being picked up by your mic. Use headphones or earbuds to eliminate this. Also mute yourself when you\'re not speaking.',
      },
      {
        q: 'How does AI Transcription work?',
        a: 'AI Transcription (Pro/Team) automatically generates a live text transcript of your meeting. It captures who said what in real-time. After the meeting, the transcript is saved to your account and can be exported as a text file.',
      },
    ],
  },
  {
    category: 'Screen Sharing',
    icon: '🖥️',
    items: [
      {
        q: 'How do I share my screen?',
        a: 'Click the Screen Share button in the meeting toolbar. Your browser will ask you to choose what to share — your entire screen, a specific window, or a browser tab. Select your choice and click Share.',
      },
      {
        q: 'Screen sharing isn\'t working. What do I do?',
        a: '1. Make sure you\'re on Chrome or Edge (best support). 2. Allow screen capture permission when prompted. 3. On macOS, go to System Preferences → Security & Privacy → Screen Recording and enable your browser. 4. Try sharing a specific tab instead of your whole screen.',
      },
    ],
  },
  {
    category: 'Account & Billing',
    icon: '💳',
    items: [
      {
        q: 'What plans does NexMeet offer?',
        a: 'Free (always free, 5 participants), Pro ($12/month or $99/year — 50 participants, AI transcription, cloud recording, custom branding), and Team ($29/month or $249/year — 300 participants, everything in Pro plus admin dashboard).',
      },
      {
        q: 'How do I upgrade to Pro or Team?',
        a: 'Go to the Pricing page and click the plan you want. You\'ll be taken to a secure Stripe checkout. We accept cards, UPI, and PayPal. Your plan activates immediately after payment.',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes — no contracts, cancel anytime from your account settings. You\'ll keep your plan until the end of the billing period. We also offer a 7-day money-back guarantee.',
      },
      {
        q: 'How do I reset my password?',
        a: 'Go to the Login page and click "Forgot Password". Enter your email and we\'ll send you a reset link within a few minutes. Check your spam folder if you don\'t see it.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Email support@nexmeet.app with the subject line "Delete Account" from your registered email address. We\'ll process it within 24 hours.',
      },
    ],
  },
  {
    category: 'Security & Privacy',
    icon: '🔒',
    items: [
      {
        q: 'Is NexMeet secure?',
        a: 'Yes. All video and audio is encrypted end-to-end using WebRTC\'s built-in DTLS-SRTP encryption. Your conversations cannot be intercepted or recorded by NexMeet servers. Private room conversations are not stored or linked to your account.',
      },
      {
        q: 'Does NexMeet record my meetings?',
        a: 'NexMeet does not record meetings by default. Cloud Recording is an optional Pro/Team feature that you must explicitly enable. When active, a recording indicator is shown to all participants.',
      },
    ],
  },
]

export default function Support() {
  const [openItems, setOpenItems] = useState({})
  const [search, setSearch] = useState('')

  const toggle = (key) => setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))

  const filtered = search.trim().length < 2
    ? FAQS
    : FAQS.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(cat => cat.items.length > 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFloat1 {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(30px,-20px); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(-20px,30px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50%      { box-shadow: 0 0 0 8px rgba(124,58,237,0); }
        }
        @keyframes accordionOpen {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sp-root {
          min-height: 100vh;
          background: #04040a;
          font-family: 'DM Sans', sans-serif;
          color: #e4e4f7;
          position: relative;
          overflow-x: hidden;
        }

        .sp-orb {
          position: fixed; border-radius: 50%;
          pointer-events: none; z-index: 0; filter: blur(90px);
        }
        .sp-orb-1 {
          width: 700px; height: 700px; top: -250px; left: -200px;
          background: radial-gradient(circle, rgba(124,58,237,0.13) 0%, transparent 70%);
          animation: orbFloat1 22s ease-in-out infinite;
        }
        .sp-orb-2 {
          width: 500px; height: 500px; bottom: -150px; right: -150px;
          background: radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%);
          animation: orbFloat2 28s ease-in-out infinite;
        }
        .sp-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 0M-5 5L5-5M35 45L45 35' stroke='rgba(124,58,237,0.035)' stroke-width='0.5'/%3E%3C/svg%3E");
          background-size: 40px 40px;
        }

        .sp-wrap {
          position: relative; z-index: 1;
          max-width: 860px; margin: 0 auto;
          padding: 0 1.25rem 4rem;
        }

        /* Hero */
        .sp-hero {
          text-align: center;
          padding: 4rem 1rem 2.5rem;
          animation: fadeUp 0.5s ease both;
        }
        .sp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(124,58,237,0.1);
          border: 0.5px solid rgba(124,58,237,0.3);
          border-radius: 100px; padding: 5px 16px;
          font-size: 0.7rem; font-weight: 600;
          color: #a78bfa; letter-spacing: 0.09em; text-transform: uppercase;
          margin-bottom: 1.25rem;
        }
        .sp-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #a78bfa; box-shadow: 0 0 6px #a78bfa;
          animation: pulse 2s infinite;
        }
        .sp-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 800; letter-spacing: -0.03em; line-height: 1.1;
          color: #f0eeff; margin-bottom: 0.85rem;
        }
        .sp-title span {
          background: linear-gradient(90deg, #a78bfa, #60a5fa, #a78bfa);
          background-size: 200%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
        .sp-sub {
          font-size: 0.92rem; color: rgba(167,139,250,0.5);
          max-width: 440px; margin: 0 auto 2rem; line-height: 1.65;
        }

        /* Search */
        .sp-search-wrap {
          position: relative; max-width: 520px; margin: 0 auto;
        }
        .sp-search-icon {
          position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          color: rgba(167,139,250,0.35); pointer-events: none;
        }
        .sp-search {
          width: 100%; padding: 13px 18px 13px 44px;
          background: rgba(124,58,237,0.06);
          border: 0.5px solid rgba(124,58,237,0.25);
          border-radius: 14px; outline: none;
          color: #e4e4f7; font-size: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .sp-search:focus {
          border-color: rgba(124,58,237,0.55);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        .sp-search::placeholder { color: rgba(167,139,250,0.3); }

        /* How-to banner */
        .sp-howto {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 14px;
          margin: 2.5rem 0;
          animation: fadeUp 0.5s 0.1s ease both;
        }
        .sp-howto-card {
          background: rgba(8,5,20,0.75);
          border: 0.5px solid rgba(124,58,237,0.2);
          border-radius: 18px; padding: 1.25rem 1.2rem;
          backdrop-filter: blur(16px);
          transition: border-color 0.2s, transform 0.2s;
        }
        .sp-howto-card:hover {
          border-color: rgba(167,139,250,0.4);
          transform: translateY(-3px);
        }
        .sp-howto-icon { font-size: 1.5rem; margin-bottom: 10px; }
        .sp-howto-title {
          font-family: 'Syne', sans-serif;
          font-size: 0.85rem; font-weight: 700;
          color: #c4b5fd; margin-bottom: 6px;
        }
        .sp-howto-desc {
          font-size: 0.75rem; color: rgba(167,139,250,0.45); line-height: 1.6;
        }

        /* Section label */
        .sp-section-label {
          display: flex; align-items: center; gap: 10px;
          margin: 2.25rem 0 1rem;
          animation: fadeUp 0.4s ease both;
        }
        .sp-section-icon {
          width: 34px; height: 34px; border-radius: 10px;
          background: rgba(124,58,237,0.12);
          border: 0.5px solid rgba(124,58,237,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; flex-shrink: 0;
        }
        .sp-section-title {
          font-family: 'Syne', sans-serif;
          font-size: 1rem; font-weight: 700; color: #c4b5fd;
        }

        /* Accordion */
        .sp-accordion {
          display: flex; flex-direction: column; gap: 8px;
          animation: fadeUp 0.4s 0.05s ease both;
        }
        .sp-item {
          background: rgba(8,5,20,0.7);
          border: 0.5px solid rgba(124,58,237,0.16);
          border-radius: 14px; overflow: hidden;
          backdrop-filter: blur(12px);
          transition: border-color 0.2s;
        }
        .sp-item:hover { border-color: rgba(124,58,237,0.32); }
        .sp-item.open  { border-color: rgba(124,58,237,0.4); }

        .sp-question {
          width: 100%; display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          padding: 16px 18px;
          background: none; border: none; cursor: pointer;
          text-align: left; color: #e4e4f7;
          font-size: 0.875rem; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.2s;
        }
        .sp-question:hover { color: #c4b5fd; }
        .sp-item.open .sp-question { color: #c4b5fd; }

        .sp-chevron {
          flex-shrink: 0; width: 18px; height: 18px;
          border-radius: 6px;
          background: rgba(124,58,237,0.1);
          border: 0.5px solid rgba(124,58,237,0.2);
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.25s, background 0.2s;
          color: rgba(167,139,250,0.6);
        }
        .sp-item.open .sp-chevron {
          transform: rotate(180deg);
          background: rgba(124,58,237,0.2);
          color: #a78bfa;
        }

        .sp-answer {
          padding: 0 18px 16px;
          font-size: 0.83rem;
          color: rgba(167,139,250,0.65);
          line-height: 1.75;
          border-top: 0.5px solid rgba(124,58,237,0.1);
          padding-top: 12px;
          animation: accordionOpen 0.25s ease;
          white-space: pre-line;
        }

        /* No results */
        .sp-empty {
          text-align: center; padding: 3rem 1rem;
          color: rgba(167,139,250,0.35); font-size: 0.875rem;
        }

        /* Contact strip */
        .sp-contact {
          margin-top: 3rem;
          background: rgba(124,58,237,0.07);
          border: 0.5px solid rgba(124,58,237,0.22);
          border-radius: 20px; padding: 1.75rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 1rem;
          animation: fadeUp 0.4s 0.15s ease both;
        }
        .sp-contact-left { display: flex; align-items: center; gap: 14px; }
        .sp-contact-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: 1rem; color: #fff;
          box-shadow: 0 0 16px rgba(124,58,237,0.4);
          border: 1px solid rgba(124,58,237,0.4);
          flex-shrink: 0;
        }
        .sp-contact-title {
          font-family: 'Syne', sans-serif;
          font-size: 0.9rem; font-weight: 700; color: #e4e4f7; margin-bottom: 3px;
        }
        .sp-contact-sub { font-size: 0.75rem; color: rgba(167,139,250,0.4); }
        .sp-contact-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 20px; border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border: none; color: #fff; cursor: pointer;
          font-size: 0.82rem; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(124,58,237,0.35);
          transition: all 0.2s;
          white-space: nowrap;
        }
        .sp-contact-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(124,58,237,0.5);
        }

        @media (max-width: 640px) {
          .sp-howto { grid-template-columns: 1fr; }
          .sp-contact { flex-direction: column; align-items: flex-start; }
          .sp-title { font-size: 1.9rem; }
        }
      `}</style>

      <div className="sp-root">
        <div className="sp-orb sp-orb-1" />
        <div className="sp-orb sp-orb-2" />
        <div className="sp-grid" />

        <Navbar />

        <div className="sp-wrap" style={{ paddingTop: 72 }}>

          {/* Hero */}
          <div className="sp-hero">
            <div className="sp-badge">
              <span className="sp-badge-dot" />
              Help Center
            </div>
            <h1 className="sp-title">Everything you need to<br /><span>use NexMeet</span></h1>
            <p className="sp-sub">Guides, FAQs, and answers about rooms, billing, and features — all in one place.</p>

            {/* Search */}
            <div className="sp-search-wrap">
              <svg className="sp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="sp-search"
                type="text"
                placeholder="Search questions…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* How-to cards */}
          {!search && (
            <div className="sp-howto">
              <div className="sp-howto-card">
                <div className="sp-howto-icon">🏠</div>
                <div className="sp-howto-title">Public Room</div>
                <div className="sp-howto-desc">Anyone with the Room ID can join instantly — no waiting, no approval needed. Perfect for open team calls or community events.</div>
              </div>
              <div className="sp-howto-card">
                <div className="sp-howto-icon">🔐</div>
                <div className="sp-howto-title">Private Room</div>
                <div className="sp-howto-desc">Participants land in a Waiting Room and the host admits them one by one. Full control over who enters — ideal for interviews or confidential meetings.</div>
              </div>
              <div className="sp-howto-card">
                <div className="sp-howto-icon">⚡</div>
                <div className="sp-howto-title">How to get started</div>
                <div className="sp-howto-desc">Sign up → go to Rooms → click "New Room" → choose Public or Private → share your Room ID with participants. That's it.</div>
              </div>
            </div>
          )}

          {/* FAQ sections */}
          {filtered.length === 0 ? (
            <div className="sp-empty">No results for "{search}" — try different keywords.</div>
          ) : (
            filtered.map(cat => (
              <div key={cat.category}>
                <div className="sp-section-label">
                  <div className="sp-section-icon">{cat.icon}</div>
                  <div className="sp-section-title">{cat.category}</div>
                </div>
                <div className="sp-accordion">
                  {cat.items.map((item, i) => {
                    const key = `${cat.category}-${i}`
                    const isOpen = !!openItems[key]
                    return (
                      <div key={key} className={`sp-item${isOpen ? ' open' : ''}`}>
                        <button className="sp-question" onClick={() => toggle(key)}>
                          <span>{item.q}</span>
                          <span className="sp-chevron">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2,3 5,7 8,3"/>
                            </svg>
                          </span>
                        </button>
                        {isOpen && (
                          <div className="sp-answer">{item.a}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}

          {/* Contact strip */}
          <div className="sp-contact">
            <div className="sp-contact-left">
              <div className="sp-contact-avatar">N</div>
              <div>
                <div className="sp-contact-title">Still need help?</div>
                <div className="sp-contact-sub">Our team responds in &lt;2h for Pro/Team · &lt;24h for Free</div>
              </div>
            </div>
            <a href="mailto:support@nexmeet.app" className="sp-contact-btn">
              ✉ Email support@nexmeet.app
            </a>
          </div>

        </div>

        <Footer />
      </div>
    </>
  )
}