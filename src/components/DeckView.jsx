import React, { useMemo } from 'react';
import { Anchor, CloudRain, Compass, Navigation, Radio } from 'lucide-react';
import { getCoastalSightings } from '../data/worldCoastlines.js';
import { getWeatherById } from '../data/weather.js';
import { COAST_SIGHT_RADIUS_DEG, FLEET_RADAR_RADIUS_DEG } from '../engine/navigation.js';

const FOV_HALF_DEG = 72;

function buildCliffPath(sectors) {
  const forward = sectors
    .filter((s) => Math.abs(s.relBearing) <= FOV_HALF_DEG)
    .sort((a, b) => a.relBearing - b.relBearing);

  if (forward.length === 0) return [];

  const groups = [];
  let current = [forward[0]];
  for (let i = 1; i < forward.length; i++) {
    if (forward[i].relBearing - forward[i - 1].relBearing <= 11) {
      current.push(forward[i]);
    } else {
      groups.push(current);
      current = [forward[i]];
    }
  }
  groups.push(current);

  return groups.map((grp, idx) => {
    const points = grp.map((s) => {
      const x = ((s.relBearing + FOV_HALF_DEG) / (2 * FOV_HALF_DEG)) * 360;
      const closeness = Math.max(0.15, 1 - s.distDeg / COAST_SIGHT_RADIUS_DEG);
      const ridgeNoise = ((Math.abs(Math.round(s.absBearing * 3)) % 7) - 3) * 1.4;
      const height = 10 + closeness * 28 + ridgeNoise;
      return { x, y: 92 - height, foamY: 92 + closeness * 3.5, closeness };
    });

    const firstX = Math.max(0, points[0].x - 8);
    const lastX = Math.min(360, points[points.length - 1].x + 8);
    const d = [
      `M ${firstX.toFixed(1)} 93`,
      ...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
      `L ${lastX.toFixed(1)} 93 Z`,
    ].join(' ');

    const foamD = [
      `M ${firstX.toFixed(1)} 93.5`,
      ...points.map((p) => `L ${p.x.toFixed(1)} ${p.foamY.toFixed(1)}`),
      `L ${lastX.toFixed(1)} 93.5`,
    ].join(' ');

    const avgCloseness =
      points.reduce((sum, p) => sum + p.closeness, 0) / points.length;

    return { id: idx, d, foamD, avgCloseness };
  });
}

export default function DeckView({
  lat,
  lon,
  headingDeg,
  windToDeg,
  isSailing,
  nearbyPort,
  nearbyFleets = [],
  weatherId = 'clear',
}) {
  const weather = useMemo(() => getWeatherById(weatherId), [weatherId]);
  const isStormy = weatherId === 'storm' || weatherId === 'squall';
  const sightings = useMemo(
    () => getCoastalSightings(lat, lon, headingDeg, COAST_SIGHT_RADIUS_DEG),
    [lat, lon, headingDeg],
  );

  const cliffGroups = useMemo(() => buildCliffPath(sightings), [sightings]);

  const proximitySummary = useMemo(() => {
    if (sightings.length === 0) return null;
    let portMin = Infinity;
    let aheadMin = Infinity;
    let stbdMin = Infinity;

    for (const s of sightings) {
      if (Math.abs(s.relBearing) <= 30) {
        if (s.distDeg < aheadMin) aheadMin = s.distDeg;
      } else if (s.relBearing < -30 && s.relBearing >= -135) {
        if (s.distDeg < portMin) portMin = s.distDeg;
      } else if (s.relBearing > 30 && s.relBearing <= 135) {
        if (s.distDeg < stbdMin) stbdMin = s.distDeg;
      }
    }

    const parts = [];
    if (portMin < Infinity) parts.push(`좌현 ${(portMin / 10).toFixed(1)}cm`);
    if (aheadMin < Infinity) parts.push(`정면 ${(aheadMin / 10).toFixed(1)}cm`);
    if (stbdMin < Infinity) parts.push(`우현 ${(stbdMin / 10).toFixed(1)}cm`);
    if (parts.length === 0) {
      const minAll = Math.min(...sightings.map((s) => s.distDeg));
      parts.push(`후방 ${(minAll / 10).toFixed(1)}cm`);
    }
    return parts.join(' · ');
  }, [sightings]);

  const visibleRivalShips = useMemo(
    () =>
      nearbyFleets
        .filter((f) => Math.abs(f.relBearing) <= FOV_HALF_DEG)
        .map((f) => {
          const x = ((f.relBearing + FOV_HALF_DEG) / (2 * FOV_HALF_DEG)) * 360;
          const closeness = Math.max(0.2, 1 - f.distDeg / FLEET_RADAR_RADIUS_DEG);
          const scale = 0.45 + closeness * 0.75;
          const y = 93 + closeness * 10;
          return { ...f, x, y, scale };
        }),
    [nearbyFleets],
  );

  const closestRival = nearbyFleets[0] || null;
  const relWindDeg = ((windToDeg - headingDeg) % 360 + 360) % 360;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-slate-900 shadow-lg">
      {/* Top Viewport Overlay Badges */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 backdrop-blur-sm border border-slate-700/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>선수 {String(headingDeg).padStart(3, '0')}°</span>
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-full backdrop-blur-sm border px-2 py-1 text-[10px] font-bold ${
              weatherId === 'storm'
                ? 'bg-purple-950/90 border-purple-400/60 text-purple-200 animate-pulse'
                : isStormy
                  ? 'bg-rose-950/85 border-rose-400/50 text-rose-200'
                  : 'bg-slate-950/75 border-slate-700/70 text-slate-300'
            }`}
          >
            <CloudRain className="w-3 h-3" />
            <span>{weather.name}</span>
          </div>
        </div>

        {nearbyPort ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-950/85 backdrop-blur-sm border border-emerald-400/50 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
            <Anchor className="w-3 h-3" />
            <span>기항지 반경 포착</span>
          </div>
        ) : proximitySummary ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-amber-950/85 backdrop-blur-sm border border-amber-400/50 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
            <span>미지의 연안: {proximitySummary}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-950/65 backdrop-blur-sm border border-slate-700/50 px-2.5 py-1 text-[11px] text-sky-300/90">
            <span>망망대해 시계 양호</span>
          </div>
        )}
      </div>

      {/* Nearby Rival Fleet Radar Alert (<= 2.5 cm / 25°) */}
      {closestRival && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 pointer-events-none flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-950/90 backdrop-blur-sm border border-sky-400/50 px-3 py-1 text-[11px] font-bold text-sky-200 shadow-lg">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>
              {closestRival.sectorLabel} {closestRival.distCm.toFixed(1)} cm 거리에 [{closestRival.teamName}] 선단 포착!
            </span>
          </div>
        </div>
      )}

      {/* 1st-Person Horizon SVG */}
      <div className={`relative w-full aspect-[16/9] ${isSailing ? 'animate-ship-pitch' : ''}`}>
        <svg
          viewBox="0 0 360 202"
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={weatherId === 'storm' ? '#090d1a' : isStormy ? '#111827' : '#0c1e38'} />
              <stop offset="55%" stopColor={weatherId === 'storm' ? '#1e293b' : isStormy ? '#334155' : '#1e4976'} />
              <stop offset="100%" stopColor={weatherId === 'storm' ? '#475569' : weatherId === 'fog' ? '#94a3b8' : '#7db4d8'} />
            </linearGradient>
            <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#124e78" />
              <stop offset="45%" stopColor="#0a3556" />
              <stop offset="100%" stopColor="#051c30" />
            </linearGradient>
            <linearGradient id="cliffGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5c4a38" />
              <stop offset="70%" stopColor="#3a2f24" />
              <stop offset="100%" stopColor="#261f18" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="360" height="94" fill="url(#skyGrad)" />
          {weatherId === 'clear' && (
            <>
              <circle cx="290" cy="34" r="16" fill="#fde68a" opacity="0.22" />
              <circle cx="290" cy="34" r="8" fill="#fef3c7" opacity="0.7" />
            </>
          )}
          {isStormy && (
            <g stroke="#cbd5e1" strokeWidth="0.7" opacity={weatherId === 'storm' ? 0.5 : 0.3}>
              <line x1="40" y1="5" x2="26" y2="65" />
              <line x1="95" y1="12" x2="81" y2="72" />
              <line x1="155" y1="3" x2="141" y2="63" />
              <line x1="220" y1="8" x2="206" y2="68" />
              <line x1="280" y1="15" x2="266" y2="75" />
              <line x1="330" y1="4" x2="316" y2="64" />
            </g>
          )}

          {/* Coastal Cliffs within 6.0° */}
          {cliffGroups.map((cliff) => (
            <g key={cliff.id}>
              <path
                d={cliff.d}
                fill="url(#cliffGrad)"
                stroke="#786148"
                strokeWidth="0.9"
                opacity={0.55 + cliff.avgCloseness * 0.45}
              />
              <path
                d={cliff.foamD}
                fill="none"
                stroke="#e0f2fe"
                strokeWidth={1.2 + cliff.avgCloseness * 1.4}
                strokeLinecap="round"
                opacity={0.55 + cliff.avgCloseness * 0.4}
              />
            </g>
          ))}

          {/* Ocean Surface */}
          <rect x="0" y="92" width="360" height="110" fill="url(#seaGrad)" />

          {/* Other Student Ships on Horizon (within 2.5 cm / 25°) */}
          {visibleRivalShips.map((ship) => (
            <g
              key={ship.clientId}
              transform={`translate(${ship.x.toFixed(1)}, ${ship.y.toFixed(1)}) scale(${ship.scale.toFixed(2)})`}
            >
              {/* Hull */}
              <path d="M -10 0 L 10 0 L 7 4 L -7 4 Z" fill="#451a03" stroke="#d97706" strokeWidth="0.6" />
              {/* Mast & Sail */}
              <line x1="0" y1="0" x2="0" y2="-16" stroke="#78350f" strokeWidth="1" />
              <path d="M -7 -14 Q 0 -10 7 -14 L 6 -3 Q 0 -1 -6 -3 Z" fill="#fef3c7" opacity="0.95" />
              {/* Pennant */}
              <polygon points="0,-16 5,-15 0,-14" fill="#38bdf8" />
            </g>
          ))}

          {/* Animated Wave Crest Lines */}
          <g className={isSailing ? 'animate-wave-sway' : ''}>
            <path
              d="M -20 105 Q 30 102 80 105 T 180 105 T 280 105 T 380 105"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1"
              opacity="0.25"
            />
            <path
              d="M -10 120 Q 45 116 100 120 T 210 120 T 320 120 T 400 120"
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="1.2"
              opacity="0.3"
            />
            <path
              d="M -30 138 Q 35 134 95 138 T 215 138 T 335 138 T 410 138"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="1.4"
              opacity="0.25"
            />
          </g>

          {isSailing && (
            <g opacity="0.75">
              <path
                d="M 162 152 L 105 198 M 198 152 L 255 198"
                stroke="#e0f2fe"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
            </g>
          )}

          {/* Bow Railing & Bowsprit */}
          <path
            d="M 0 176 L 135 154 L 225 154 L 360 176 L 360 202 L 0 202 Z"
            fill="#452715"
            stroke="#7c4a26"
            strokeWidth="1.5"
          />
          <path
            d="M 18 179 L 138 158 L 222 158 L 342 179"
            fill="none"
            stroke="#9a6338"
            strokeWidth="2"
          />
          <polygon points="175,155 185,155 181,126 179,126" fill="#6b3e1f" />

          {/* Main Mast & Billowing Sail */}
          <rect x="177.5" y="24" width="5" height="134" fill="#5b3419" />
          <line x1="126" y1="48" x2="234" y2="48" stroke="#6b3e1f" strokeWidth="3.5" />
          <g
            style={{ transformOrigin: '180px 80px' }}
            className={isSailing ? 'animate-sail-billow' : ''}
          >
            <path
              d="M 128 50 Q 180 62 232 50 L 224 114 Q 180 124 136 114 Z"
              fill="#f5ebd6"
              stroke="#c9b48c"
              strokeWidth="1.5"
              opacity="0.92"
            />
            <path
              d="M 180 69 L 180 99 M 168 82 L 192 82"
              stroke="#b91c1c"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>

          {/* Wind Pennant */}
          <g transform="translate(180, 24)">
            <circle cx="0" cy="0" r="2.5" fill="#fbbf24" />
            <g transform={`rotate(${relWindDeg - 90})`}>
              <path d="M 2 -2 L 24 0 L 2 2 Z" fill="#f59e0b" />
            </g>
          </g>

          <g fill="#e2e8f0" fontSize="7" opacity="0.7" textAnchor="middle">
            <text x="30" y="102">좌현</text>
            <text x="180" y="102">정면</text>
            <text x="330" y="102">우현</text>
          </g>
        </svg>

        {isSailing && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/35 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-slate-950/90 border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 shadow-xl">
              <Navigation className="w-4 h-4 animate-spin" />
              <span>돛을 올리고 항해 중...</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
