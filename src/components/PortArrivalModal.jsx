import React from 'react';
import { Anchor, ArrowRight, Coins, Droplets, Package, ShieldCheck, X } from 'lucide-react';

export default function PortArrivalModal({ port, state, onOpenTradeShop, onClose }) {
  if (!port) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl border-2 border-emerald-400/70 bg-gradient-to-b from-slate-900 via-[#0d2224] to-slate-950 p-4 shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-3.5 my-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-0.5 text-[11px] font-black text-emerald-300">
              <Anchor className="w-3.5 h-3.5" />
              기항지 입항 완료
            </div>
            <h3 className="text-lg font-black text-white mt-1">
              {port.name} ({port.region}) 도착!
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dedicated Harbor Arrival SVG Illustration */}
        <div className="rounded-2xl border border-emerald-400/35 bg-slate-950 overflow-hidden shadow-inner">
          <svg viewBox="0 0 360 140" className="w-full h-auto block">
            <defs>
              <linearGradient id="harborSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f2942" />
                <stop offset="65%" stopColor="#1d5f7a" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="harborSea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e7490" />
                <stop offset="100%" stopColor="#082f49" />
              </linearGradient>
            </defs>

            {/* Warm Sunset Harbor Sky & Sea */}
            <rect width="360" height="92" fill="url(#harborSky)" />
            <circle cx="292" cy="48" r="20" fill="#fde68a" opacity="0.88" />
            <rect y="92" width="360" height="48" fill="url(#harborSea)" />

            {/* Coastal Hills */}
            <path d="M 0 92 Q 55 56 125 92 Z" fill="#1e3a2f" opacity="0.85" />
            <path d="M 215 92 Q 280 58 360 88 L 360 92 Z" fill="#2d4a35" opacity="0.9" />

            {/* Harbor Lighthouse with Light Beam */}
            <polygon points="48,42 205,22 205,64" fill="#fef08a" opacity="0.16" />
            <g transform="translate(46, 36)">
              <rect x="-5" y="10" width="10" height="44" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
              <rect x="-5" y="22" width="10" height="8" fill="#e11d48" />
              <rect x="-5" y="38" width="10" height="8" fill="#e11d48" />
              <rect x="-7" y="4" width="14" height="7" fill="#1e293b" />
              <circle cx="0" cy="7" r="3.5" fill="#fef08a" />
              <polygon points="-7,4 0,-4 7,4" fill="#b91c1c" />
            </g>

            {/* Stone Pier & Port Market Stalls */}
            <rect x="0" y="90" width="150" height="16" fill="#78716c" />
            <rect x="0" y="90" width="150" height="4" fill="#a8a29e" />
            <g transform="translate(76, 68)">
              <rect x="0" y="6" width="44" height="16" fill="#fef3c7" stroke="#78350f" strokeWidth="1" />
              <polygon points="-4,6 22,-4 48,6" fill="#dc2626" />
              <rect x="16" y="11" width="12" height="11" fill="#78350f" />
            </g>
            {/* Cargo Crates & Barrels */}
            <g transform="translate(124, 78)" fill="#b45309" stroke="#78350f" strokeWidth="1">
              <rect x="0" y="3" width="11" height="9" />
              <rect x="12" y="4" width="10" height="8" fill="#d97706" />
            </g>

            {/* Anchored Galleon in Harbor (Furled Sails) */}
            <g transform="translate(230, 80)">
              {/* Hull */}
              <path d="M -38 8 L -28 24 L 30 24 L 44 6 Z" fill="#5b3419" stroke="#92400e" strokeWidth="1.2" />
              <rect x="-32" y="12" width="66" height="3.5" fill="#fbbf24" opacity="0.7" />
              {/* Mast & Furled Sails */}
              <rect x="-2" y="-34" width="3.5" height="42" fill="#451a03" />
              <line x1="-22" y1="-22" x2="18" y2="-22" stroke="#78350f" strokeWidth="2.5" />
              <path d="M -20 -21 Q 0 -14 16 -21 Q 0 -24 -20 -21 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
              {/* Flag */}
              <polygon points="1,-34 17,-30 1,-26" fill="#10b981" />
              {/* Anchor rope */}
              <line x1="-30" y1="12" x2="-38" y2="30" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="2 1" />
            </g>

            {/* Water ripples */}
            <g stroke="#bae6fd" strokeWidth="1.1" opacity="0.45">
              <line x1="168" y1="112" x2="205" y2="112" />
              <line x1="255" y1="118" x2="310" y2="118" />
              <line x1="80" y1="124" x2="145" y2="124" />
            </g>
          </svg>
        </div>

        {/* Dock Benefits Checklist */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-2.5 py-2 flex items-center gap-2 text-emerald-200">
            <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <div className="font-black">식수 부패 초기화</div>
              <div className="text-[10px] text-emerald-300/80">정상 소모 복구 완료</div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-2.5 py-2 flex items-center gap-2 text-amber-100">
            {port.specialty ? (
              <Package className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-black truncate">
                {port.specialty ? `특산품: ${port.specialty}` : '보급 · 선박 수리 가능'}
              </div>
              <div className="text-[10px] text-amber-300/80">
                보유 식량 {state?.food ?? 0} · 금화 {state?.gold ?? 0}G
              </div>
            </div>
          </div>
        </div>

        {/* High-Visibility Trade Shop CTA */}
        <div className="space-y-2 pt-0.5">
          <button
            type="button"
            onClick={onOpenTradeShop}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:brightness-110 active:scale-[0.99] py-3.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(16,185,129,0.5)] cursor-pointer transition"
          >
            <Coins className="w-4 h-4" />
            <span>교역소 바로 열기 (보급·수리·특산품)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2 text-xs font-bold text-slate-300 cursor-pointer"
          >
            항해 화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
