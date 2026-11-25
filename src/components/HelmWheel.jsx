import React, { useRef, useState } from 'react';
import { Wind } from 'lucide-react';
import { normalizeDeg } from '../data/windZones.js';

function getCardinalLabel(deg) {
  const dirs = [
    '북(N)',
    '북북동(NNE)',
    '북동(NE)',
    '동북동(ENE)',
    '동(E)',
    '동남동(ESE)',
    '남동(SE)',
    '남남동(SSE)',
    '남(S)',
    '남남서(SSW)',
    '남서(SW)',
    '서남서(WSW)',
    '서(W)',
    '서북서(WNW)',
    '북서(NW)',
    '북북서(NNW)',
  ];
  const idx = Math.round(normalizeDeg(deg) / 22.5) % 16;
  return dirs[idx];
}

const BADGE_STYLES = {
  emerald: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
  sky: 'bg-sky-500/20 border-sky-400/40 text-sky-300',
  amber: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
  rose: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
};

export default function HelmWheel({
  headingDeg,
  onChangeHeading,
  windEval,
  disabled,
}) {
  const wheelRef = useRef(null);
  const dragStateRef = useRef({ active: false, lastAngle: 0, accHeading: headingDeg });
  const [isDragging, setIsDragging] = useState(false);

  const getPointerAngle = (clientX, clientY) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI;
  };

  const handlePointerDown = (e) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const angle = getPointerAngle(e.clientX, e.clientY);
    dragStateRef.current = {
      active: true,
      lastAngle: angle,
      accHeading: headingDeg,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragStateRef.current.active || disabled) return;
    const angle = getPointerAngle(e.clientX, e.clientY);
    let delta = angle - dragStateRef.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    dragStateRef.current.lastAngle = angle;
    dragStateRef.current.accHeading += delta;
    onChangeHeading(Math.round(normalizeDeg(dragStateRef.current.accHeading)));
  };

  const handlePointerUp = (e) => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  const nudgeHeading = (delta) => {
    if (disabled) return;
    onChangeHeading(normalizeDeg(headingDeg + delta));
  };

  const badgeStyle = BADGE_STYLES[windEval.windClass.color] || BADGE_STYLES.amber;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 shadow-lg">
      {/* Header: Current Wind & Heading Summary */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            <span>
              해역 바람: <strong className="text-slate-200">{windEval.beltName}</strong> (
              {String(windEval.windToDeg).padStart(3, '0')}° 방향)
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight tabular-nums text-amber-300">
              {String(headingDeg).padStart(3, '0')}°
            </span>
            <span className="text-xs font-semibold text-slate-300">
              {getCardinalLabel(headingDeg)}
            </span>
          </div>
        </div>

        <div className={`rounded-xl border px-2.5 py-1.5 text-right ${badgeStyle}`}>
          <div className="text-[11px] font-bold">{windEval.windClass.label}</div>
          <div className="text-base font-black tabular-nums">
            자로 {(windEval.effectiveCm ?? windEval.moveCm).toFixed(1)} cm
          </div>
        </div>
      </div>

      {/* Interactive 360° Steering Wheel */}
      <div className="flex flex-col items-center my-1">
        <div
          ref={wheelRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-52 h-52 select-none touch-none ${
            disabled ? 'opacity-60 cursor-not-allowed' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          aria-label="360도 타륜"
        >
          <svg viewBox="0 0 220 220" className="w-full h-full">
            {/* Outer Compass Ring */}
            <circle
              cx="110"
              cy="110"
              r="98"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            {/* Degree Ticks */}
            {Array.from({ length: 36 }).map((_, idx) => {
              const deg = idx * 10;
              const isMajor = deg % 30 === 0;
              return (
                <line
                  key={deg}
                  x1="110"
                  y1={isMajor ? 14 : 17}
                  x2="110"
                  y2="22"
                  stroke={isMajor ? '#fbbf24' : '#475569'}
                  strokeWidth={isMajor ? 2 : 1}
                  transform={`rotate(${deg} 110 110)`}
                />
              );
            })}

            {/* Cardinal Letters */}
            <g fill="#94a3b8" fontSize="10" fontWeight="700" textAnchor="middle">
              <text x="110" y="34" fill="#fbbf24">N 0°</text>
              <text x="191" y="114">E</text>
              <text x="110" y="195">S</text>
              <text x="29" y="114">W</text>
            </g>

            {/* Prevailing Wind Vector Arrow on Outer Ring */}
            <g transform={`rotate(${windEval.windToDeg} 110 110)`}>
              <line
                x1="110"
                y1="42"
                x2="110"
                y2="24"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <polygon points="110,16 104,27 116,27" fill="#38bdf8" />
            </g>

            {/* Rotating Ship Helm Wheel */}
            <g transform={`rotate(${headingDeg} 110 110)`}>
              {/* 8 Spokes & Handles */}
              {Array.from({ length: 8 }).map((_, idx) => {
                const deg = idx * 45;
                const isTopSpoke = idx === 0;
                return (
                  <g key={deg} transform={`rotate(${deg} 110 110)`}>
                    <line
                      x1="110"
                      y1="110"
                      x2="110"
                      y2="37"
                      stroke={isTopSpoke ? '#f59e0b' : '#92400e'}
                      strokeWidth={isTopSpoke ? 5 : 4}
                      strokeLinecap="round"
                    />
                    <circle
                      cx="110"
                      cy="37"
                      r={isTopSpoke ? 5.5 : 4}
                      fill={isTopSpoke ? '#fbbf24' : '#b45309'}
                      stroke="#451a03"
                      strokeWidth="1.2"
                    />
                  </g>
                );
              })}

              {/* Wooden Rim */}
              <circle
                cx="110"
                cy="110"
                r="56"
                fill="none"
                stroke="#b45309"
                strokeWidth="10"
              />
              <circle
                cx="110"
                cy="110"
                r="56"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
              />

              {/* Heading Pointer Arrow */}
              <polygon points="110,43 105,54 115,54" fill="#fef3c7" />

              {/* Center Hub */}
              <circle
                cx="110"
                cy="110"
                r="17"
                fill="#78350f"
                stroke="#fbbf24"
                strokeWidth="2.5"
              />
              <circle cx="110" cy="110" r="6" fill="#fbbf24" />
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
            노란 핸들: 조타 방위
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" />
            파란 화살표: 바람 방향
          </span>
        </div>
      </div>

      {/* Fine Adjustment Buttons */}
      <div className="grid grid-cols-4 gap-2 mt-2.5">
        {[-10, -1, 1, 10].map((delta) => (
          <button
            key={delta}
            type="button"
            disabled={disabled}
            onClick={() => nudgeHeading(delta)}
            className="rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 active:scale-95 py-2 text-xs font-bold text-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            {delta > 0 ? `+${delta}°` : `${delta}°`}
          </button>
        ))}
      </div>
    </section>
  );
}
