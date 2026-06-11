import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { CEV_LOGO, FIVB_LOGO } from '../assets/logos'

const NAVY = '#2D3270'
const ORANGE = '#E85D26'

// Loads a local logo from /public/logos; falls back to a clean wordmark if absent.
function CircuitLogo({ src, wordmark, color }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div className="font-display font-bold leading-none" style={{ fontSize: 38, color, letterSpacing: '.04em' }}>
        {wordmark}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`${wordmark} logo`}
      className="max-h-full max-w-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function BelgianMark() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[58px] h-[40px] rounded-md overflow-hidden flex shadow">
        <span className="flex-1 h-full" style={{ background: '#000000' }} />
        <span className="flex-1 h-full" style={{ background: '#FAE042' }} />
        <span className="flex-1 h-full" style={{ background: '#ED2939' }} />
      </div>
      <div className="font-display font-bold uppercase tracking-wide text-sm" style={{ color: NAVY }}>
        Beach Belgium
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-5 py-5">
      {/* Brand */}
      <div className="text-center mb-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: ORANGE }}>
          Referee Coach
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide mt-0.5" style={{ color: NAVY }}>
          Beach Volleyball Hub
        </h1>
        <p className="text-gray-500 text-xs mt-1">Select a circuit</p>
      </div>

      {/* Tiles */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* CEV — coming soon (black tile, colourful mark) */}
        <div className="relative rounded-2xl px-4 py-4 flex flex-col items-center text-center min-h-[160px] sm:min-h-[215px]" style={{ background: '#000000', border: '1px solid #1d1d20' }}>
          <div className="h-16 sm:h-20 flex items-center justify-center">
            <CircuitLogo src={CEV_LOGO} wordmark="CEV" color="#ffffff" />
          </div>
          <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,.6)' }}>European circuit</div>
          <div className="mt-auto pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wide rounded-full px-4 py-1.5" style={{ color: 'rgba(255,255,255,.75)', background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.2)' }}>
              Coming soon
            </span>
          </div>
        </div>

        {/* Belgian Tour — active (white tile, flag) */}
        <button
          onClick={() => navigate('/dashboard')}
          className="relative bg-white rounded-2xl px-4 py-4 flex flex-col items-center text-center min-h-[180px] sm:min-h-[215px] transition-transform active:scale-[.99] hover:-translate-y-0.5"
          style={{ border: `2px solid ${NAVY}`, boxShadow: '0 6px 22px rgba(45,50,112,.10)' }}
        >
          <div className="h-16 sm:h-20 flex items-center justify-center">
            <BelgianMark />
          </div>
          <h2 className="font-display text-lg font-bold uppercase mt-2" style={{ color: NAVY }}>Belgian Tour</h2>
          <div className="text-xs text-gray-500 mt-0.5">BBT 2026 · active</div>
          <div className="mt-auto pt-3">
            <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white px-5 py-2.5 rounded-full" style={{ background: ORANGE }}>
              Open <ArrowRight size={16} />
            </span>
          </div>
        </button>

        {/* FIVB — coming soon (blue tile, white logo) */}
        <div className="relative rounded-2xl px-4 py-4 flex flex-col items-center text-center min-h-[160px] sm:min-h-[215px]" style={{ background: '#2531D3', border: '1px solid #1c26a8' }}>
          <div className="h-16 sm:h-20 flex items-center justify-center">
            <CircuitLogo src={FIVB_LOGO} wordmark="FIVB" color="#ffffff" />
          </div>
          <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,.7)' }}>World circuit</div>
          <div className="mt-auto pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wide rounded-full px-4 py-1.5" style={{ color: '#fff', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)' }}>
              Coming soon
            </span>
          </div>
        </div>

      </div>

      <p className="text-gray-400 text-xs text-center mt-5 max-w-md leading-relaxed">
        Only Belgian Tour is active for now. CEV and FIVB will open when those tournaments begin.
      </p>
    </div>
  )
}
