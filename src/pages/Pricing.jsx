// src/pages/Pricing.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

// ─────────────────────────────────────────────
// Replace RAZORPAY_KEY_ID with your actual key.
// For Stripe: swap the loadRazorpay logic for
// Stripe's loadStripe() from @stripe/stripe-js.
// ─────────────────────────────────────────────
const RAZORPAY_KEY_ID = 'rzp_test_YOUR_KEY_HERE'

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    price:    { monthly: 0,   yearly: 0 },
    badge:    null,
    accent:   false,
    cta:      'Get started free',
    sub:      'Perfect for personal use',
    features: [
      { label: 'Up to 5 participants',         ok: true },
      { label: '40-min meeting limit',         ok: true },
      { label: 'HD video (720p)',              ok: true },
      { label: 'Screen sharing',              ok: true },
      { label: 'Basic chat',                  ok: true },
      { label: 'AI transcription',            ok: false },
      { label: 'Cloud recording',             ok: false },
      { label: 'Custom branding',             ok: false },
      { label: 'Analytics dashboard',         ok: false },
      { label: 'Priority support',            ok: false },
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    { monthly: 799,  yearly: 599 },   // in INR (paise × 100 for Razorpay)
    badge:    'Most Popular',
    accent:   true,
    cta:      'Start Pro',
    sub:      'For professionals & freelancers',
    features: [
      { label: 'Up to 50 participants',       ok: true },
      { label: 'Unlimited meeting duration',  ok: true },
      { label: '4K video',                    ok: true },
      { label: 'Screen sharing + annotation', ok: true },
      { label: 'Chat + file sharing',         ok: true },
      { label: 'AI transcription & summary',  ok: true },
      { label: 'Cloud recording (10 GB)',     ok: true },
      { label: 'Custom branding',             ok: false },
      { label: 'Analytics dashboard',         ok: false },
      { label: 'Priority support',            ok: false },
    ],
  },
  {
    id:       'team',
    name:     'Team',
    price:    { monthly: 2499, yearly: 1999 },
    badge:    'Best Value',
    accent:   false,
    cta:      'Start Team',
    sub:      'For growing teams & companies',
    features: [
      { label: 'Up to 300 participants',      ok: true },
      { label: 'Unlimited meeting duration',  ok: true },
      { label: '4K video + noise cancel',     ok: true },
      { label: 'Screen sharing + whiteboard', ok: true },
      { label: 'Chat, files & reactions',     ok: true },
      { label: 'AI transcription & summary',  ok: true },
      { label: 'Cloud recording (100 GB)',    ok: true },
      { label: 'Custom branding & domain',   ok: true },
      { label: 'Advanced analytics',         ok: true },
      { label: '24/7 priority support',      ok: true },
    ],
  },
]

const ADD_ONS = [
  { icon: '🎙️', name: 'AI Meeting Assistant', desc: 'Real-time answers & action items', price: '₹299/mo' },
  { icon: '🖥️', name: 'Extra Cloud Storage',  desc: '100 GB additional recording space', price: '₹199/mo' },
  { icon: '🌐', name: 'Custom Domain',         desc: 'Host meetings on your own domain', price: '₹499/mo' },
  { icon: '📊', name: 'Advanced Analytics',    desc: 'Engagement, talk-time & more',     price: '₹399/mo' },
]

export default function Pricing() {
  const [billing, setBilling] = useState('monthly') // 'monthly' | 'yearly'
  const [loadingPlan, setLoadingPlan] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  const handlePurchase = async (plan) => {
    if (plan.id === 'free') { navigate(user ? '/rooms' : '/login'); return }
    if (!user) { navigate('/login?tab=signup'); return }

    setLoadingPlan(plan.id)
    try {
      await loadRazorpay()

      const amountINR = billing === 'yearly' ? plan.price.yearly : plan.price.monthly
      const amountPaise = amountINR * 100

      // In production: call your backend to create an order and get order_id
      // const { orderId } = await fetch('/api/create-order', { method:'POST', body: JSON.stringify({ amount: amountPaise, planId: plan.id }) }).then(r=>r.json())

      const options = {
        key:         RAZORPAY_KEY_ID,
        amount:      amountPaise,
        currency:    'INR',
        name:        'NexMeet',
        description: `${plan.name} Plan — ${billing}`,
        // order_id: orderId,     // uncomment when using backend order
        prefill: {
          name:  user.displayName || '',
          email: user.email || '',
        },
        theme: { color: '#7c5cfc' },
        handler: function(response) {
          // response.razorpay_payment_id
          // In production: verify payment on backend, then update Firestore
          alert(`✓ Payment successful! ID: ${response.razorpay_payment_id}`)
          navigate('/rooms')
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error('Payment error:', err)
      alert('Payment failed. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 60, position: 'relative' }}>
      <div className="grid-bg" />
      <div className="orb orb-purple" style={{ width: 500, height: 500, top: 0, left: '50%', transform: 'translateX(-50%)', opacity: 0.3 }} />
      <Navbar />

      {/* Load Razorpay SDK */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="container" style={{ paddingTop: '3.5rem', paddingBottom: '5rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="fade-up">
          <span className="badge badge-purple" style={{ marginBottom: 16 }}>Pricing</span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '2.8rem',
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
            color: 'var(--text-1)', marginBottom: '1rem',
          }}>
            Simple, transparent<br />
            <span style={{
              background: 'linear-gradient(90deg, var(--purple), var(--blue))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>pricing.</span>
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-3)', maxWidth: 460, margin: '0 auto 1.75rem' }}>
            No hidden fees. No surprises. Cancel or upgrade any time.
          </p>

          {/* Billing toggle */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-card)', borderRadius: 100, padding: '5px 6px',
            border: '0.5px solid var(--border)',
          }}>
            {['monthly','yearly'].map(b => (
              <button key={b} onClick={() => setBilling(b)} style={{
                padding: '6px 18px', borderRadius: 100,
                background: billing === b ? 'var(--purple)' : 'transparent',
                color: billing === b ? '#fff' : 'var(--text-3)',
                border: 'none', fontSize: '0.82rem', fontWeight: 500,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: billing === b ? '0 0 16px var(--purple-glow)' : 'none',
              }}>
                {b.charAt(0).toUpperCase() + b.slice(1)}
                {b === 'yearly' && billing !== 'yearly' && (
                  <span style={{
                    marginLeft: 6, fontSize: '0.65rem', color: 'var(--teal)',
                    background: 'rgba(45,212,191,0.15)', padding: '1px 6px',
                    borderRadius: 100,
                  }}>-25%</span>
                )}
              </button>
            ))}
          </div>
          {billing === 'yearly' && (
            <p style={{ fontSize: '0.78rem', color: 'var(--teal)', marginTop: 10 }}>
              🎉 You're saving up to 25% with yearly billing
            </p>
          )}
        </div>

        {/* Pricing cards */}
        <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.25rem', marginBottom: '3.5rem' }}>
          {PLANS.map(plan => {
            const price = billing === 'yearly' ? plan.price.yearly : plan.price.monthly
            const isLoading = loadingPlan === plan.id
            return (
              <div key={plan.id} style={{
                background: plan.accent ? 'linear-gradient(170deg, rgba(124,92,252,0.12) 0%, var(--bg-card) 60%)' : 'var(--bg-card)',
                border: plan.accent ? '1px solid var(--border-purple)' : '0.5px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: '1.75rem',
                position: 'relative', overflow: 'hidden',
                boxShadow: plan.accent ? '0 0 40px rgba(124,92,252,0.15)' : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                {plan.accent && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, var(--purple), var(--blue))',
                  }} />
                )}

                {plan.badge && (
                  <span className={`badge ${plan.accent ? 'badge-purple' : 'badge-teal'}`} style={{ marginBottom: 14, alignSelf: 'flex-start' }}>
                    {plan.badge}
                  </span>
                )}

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{plan.sub}</div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-1)' }}>
                      {price === 0 ? 'Free' : `₹${price}`}
                    </span>
                    {price > 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-4)' }}>
                        /{billing === 'yearly' ? 'mo, billed yearly' : 'month'}
                      </span>
                    )}
                  </div>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem', flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f.label} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 0',
                      borderBottom: '0.5px solid var(--border)',
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: f.ok ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.04)',
                        fontSize: '0.65rem',
                        color: f.ok ? 'var(--teal)' : 'var(--text-4)',
                      }}>
                        {f.ok ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: f.ok ? 'var(--text-2)' : 'var(--text-4)' }}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`btn btn-full ${plan.accent ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handlePurchase(plan)}
                  disabled={isLoading}
                  style={{ padding: '12px', fontSize: '0.875rem' }}>
                  {isLoading ? <span className="spinner" /> : plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Add-ons */}
        <div className="fade-up-2">
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>
              Power-ups & Add-ons
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>Supercharge any plan with optional extras.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
            {ADD_ONS.map(a => (
              <div key={a.name} style={{
                background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-purple)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>{a.icon}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{a.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.5 }}>{a.desc}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--purple)', fontWeight: 600 }}>{a.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ teaser + trust */}
        <div className="fade-up-3" style={{ marginTop: '4rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', gap: '2.5rem', flexWrap: 'wrap', justifyContent: 'center',
            background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
            border: '0.5px solid var(--border)', padding: '1.5rem 2.5rem',
          }}>
            {[
              ['🔒', 'Secure Payments', 'via Razorpay'],
              ['🔄', 'Cancel Anytime',   'No lock-in'],
              ['⚡', 'Instant Access',   'Upgrade in seconds'],
              ['🛟', '24/7 Support',     'For Pro & Team'],
            ].map(([icon, title, sub]) => (
              <div key={title} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>{title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}

// Dynamically load Razorpay checkout script
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = resolve
    s.onerror = () => reject(new Error('Failed to load Razorpay'))
    document.head.appendChild(s)
  })
}
