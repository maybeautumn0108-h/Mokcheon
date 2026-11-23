import React from 'react';

export default function PlankDuelStage({
  myWins,
  peerWins,
  status,
  iWon,
  roundCount,
  myTeamName,
  peerName,
}) {
  // Shift the duel position along the boarding plank (-26..+26 px) based on score lead
  const lead = myWins - peerWins;
  const centerShift = Math.max(-24, Math.min(24, lead * 14));
  const isFinished = status === 'completed';

  const leftDropY = isFinished && !iWon ? 32 : 0;
  const rightDropY = isFinished && iWon ? 32 : 0;

  return (
    <div
      key={`plank-${roundCount}-${status}`}
      className={`relative w-full overflow-hidden rounded-xl border border-amber-500/35 bg-slate-950 ${
        roundCount > 0 ? 'animate-duel-shake' : ''
      }`}
    >
      <svg viewBox="0 0 360 150" className="w-full h-full block">
        <defs>
          <linearGradient id="duelSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="65%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="duelSea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>

        {/* Stormy Sky & Moon */}
        <rect x="0" y="0" width="360" height="108" fill="url(#duelSky)" />
        <circle cx="180" cy="28" r="14" fill="#fef3c7" opacity="0.18" />
        <circle cx="180" cy="28" r="8" fill="#fde68a" opacity="0.45" />

        {/* Left Ship Hull (Our Fleet) */}
        <g className="animate-duel-bob">
          <path d="M 0 65 L 68 78 L 58 118 L 0 118 Z" fill="#451a03" stroke="#92400e" strokeWidth="1.5" />
          <rect x="18" y="10" width="5" height="65" fill="#78350f" />
          <path d="M 4 20 Q 25 28 45 20 L 40 55 Q 20 60 4 55 Z" fill="#e2e8f0" opacity="0.85" />
          <line x1="0" y1="74" x2="66" y2="83" stroke="#d97706" strokeWidth="2" />
        </g>

        {/* Right Ship Hull (Opponent Fleet) */}
        <g className="animate-duel-bob">
          <path d="M 360 65 L 292 78 L 302 118 L 360 118 Z" fill="#3b0764" stroke="#a855f7" strokeWidth="1.2" />
          <rect x="337" y="10" width="5" height="65" fill="#581c87" />
          <path d="M 315 20 Q 335 28 356 20 L 356 55 Q 338 60 320 55 Z" fill="#fecdd3" opacity="0.85" />
          <line x1="294" y1="83" x2="360" y2="74" stroke="#f43f5e" strokeWidth="2" />
        </g>

        {/* Wooden Boarding Plank (널빤지) */}
        <g transform="translate(0, 88)">
          <rect
            x="56"
            y="0"
            width="248"
            height="9"
            rx="2"
            fill="#92400e"
            stroke="#d97706"
            strokeWidth="1.2"
          />
          <line x1="65" y1="4.5" x2="295" y2="4.5" stroke="#451a03" strokeWidth="0.8" strokeDasharray="16 6" />
        </g>

        {/* Left Duelist (Our Captain - Blue/Gold Coat) */}
        <g
          transform={`translate(${162 + centerShift}, ${64 + leftDropY})`}
          opacity={isFinished && !iWon ? 0.55 : 1}
        >
          <g className={!isFinished ? 'animate-duel-clash-left' : ''}>
            {/* Legs */}
            <line x1="-3" y1="15" x2="-5" y2="25" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            <line x1="3" y1="15" x2="6" y2="25" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            {/* Coat */}
            <path d="M -7 2 L 7 2 L 9 17 L -8 17 Z" fill="#0284c7" stroke="#bae6fd" strokeWidth="0.8" />
            {/* Head & Tricorn Hat */}
            <circle cx="0" cy="-4" r="5" fill="#fde68a" />
            <path d="M -9 -6 Q 0 -14 9 -6 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
            {/* Raised Cutlass */}
            <path d="M 6 6 L 20 -5" stroke="#e2e8f0" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="4" y1="4" x2="9" y2="9" stroke="#fbbf24" strokeWidth="2" />
          </g>
        </g>

        {/* Right Duelist (Opponent Captain - Crimson Coat) */}
        <g
          transform={`translate(${198 + centerShift}, ${64 + rightDropY})`}
          opacity={isFinished && iWon ? 0.55 : 1}
        >
          <g className={!isFinished ? 'animate-duel-clash-right' : ''}>
            {/* Legs */}
            <line x1="-3" y1="15" x2="-6" y2="25" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            <line x1="3" y1="15" x2="5" y2="25" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            {/* Coat */}
            <path d="M -7 2 L 7 2 L 8 17 L -9 17 Z" fill="#be123c" stroke="#fda4af" strokeWidth="0.8" />
            {/* Head & Pirate Hat */}
            <circle cx="0" cy="-4" r="5" fill="#fde68a" />
            <path d="M -9 -6 Q 0 -14 9 -6 Z" fill="#0f172a" stroke="#f43f5e" strokeWidth="0.8" />
            {/* Raised Cutlass */}
            <path d="M -6 6 L -20 -5" stroke="#e2e8f0" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="-4" y1="4" x2="-9" y2="9" stroke="#fbbf24" strokeWidth="2" />
          </g>
        </g>

        {/* Clash Sparks between crossed blades */}
        {!isFinished && (
          <g transform={`translate(${180 + centerShift}, 60)`}>
            <g className="animate-clash-spark">
              <line x1="-7" y1="-7" x2="7" y2="7" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
              <line x1="7" y1="-7" x2="-7" y2="7" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
              <circle cx="0" cy="0" r="3" fill="#fef9c3" />
            </g>
          </g>
        )}

        {/* Water Splash on Knockoff */}
        {isFinished && (
          <g transform={`translate(${iWon ? 198 + centerShift : 162 + centerShift}, 105)`}>
            <path
              d="M -16 4 Q -8 -10 0 0 Q 8 -12 16 4"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Ocean Waves Foreground */}
        <rect x="0" y="106" width="360" height="44" fill="url(#duelSea)" />
        <g className="animate-wave-sway">
          <path
            d="M -20 112 Q 25 106 70 112 T 160 112 T 250 112 T 340 112 T 420 112"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.6"
            opacity="0.55"
          />
          <path
            d="M -10 126 Q 35 120 80 126 T 180 126 T 280 126 T 380 126"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="1.2"
            opacity="0.35"
          />
        </g>

        {/* Team Labels */}
        <g fontSize="8" fontWeight="800">
          <text x="10" y="142" fill="#7dd3fc">{myTeamName || '우리 선단'}</text>
          <text x="350" y="142" fill="#fda4af" textAnchor="end">{peerName}</text>
        </g>
      </svg>
    </div>
  );
}
