// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'

const spinnerStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');

  @keyframes pr-rotate1 { to { transform: rotate(360deg); } }
  @keyframes pr-rotate2 { to { transform: rotate(-360deg); } }
  @keyframes pr-pulse   { 0%,100% { opacity:.4; transform:scale(.85); } 50% { opacity:1; transform:scale(1); } }
  @keyframes pr-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pr-dots    { 0%,20%{content:'.'} 40%{content:'..'} 60%,100%{content:'...'} }

  .pr-overlay {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #000;
    gap: 28px;
    animation: pr-fade-in .4s ease forwards;
  }

  .pr-ring-wrap {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pr-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid transparent;
  }

  .pr-ring-outer {
    width: 80px; height: 80px;
    border-top-color: #00ffe7;
    border-right-color: #00ffe7;
    box-shadow: 0 0 14px #00ffe7;
    animation: pr-rotate1 1.4s linear infinite;
  }

  .pr-ring-mid {
    width: 56px; height: 56px;
    border-bottom-color: #7f5af0;
    border-left-color: #7f5af0;
    box-shadow: 0 0 10px #7f5af0;
    animation: pr-rotate2 1s linear infinite;
  }

  .pr-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #00ffe7;
    box-shadow: 0 0 10px #00ffe7, 0 0 24px #00ffe7;
    animation: pr-pulse 1.4s ease-in-out infinite;
  }

  .pr-label {
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .25em;
    color: rgba(255,255,255,.55);
    text-transform: uppercase;
  }

  .pr-label::after {
    content: '';
    animation: pr-dots 1.2s steps(1) infinite;
  }
`

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <>
        <style>{spinnerStyles}</style>
        <div className="pr-overlay">
          <div className="pr-ring-wrap">
            <div className="pr-ring pr-ring-outer" />
            <div className="pr-ring pr-ring-mid" />
            <div className="pr-dot" />
          </div>
          <span className="pr-label">Authenticating</span>
        </div>
      </>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}