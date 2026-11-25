import React, { useMemo } from 'react';
import { Anchor, Compass, MapPin, ScrollText, X } from 'lucide-react';
import { LAND_POLYGONS } from '../data/worldCoastlines.js';
import { getMissionById } from '../data/missions.js';

function projX(lon) {
  return ((lon + 180) / 360) * 360;
}

function projY(lat) {
  return ((78 - lat) / 146) * 180;
}

function pointsToSvgPath(pts) {
  return pts
    .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'} ${projX(lon).toFixed(1)} ${projY(lat).toFixed(1)}`)
    .join(' ');
}

export default function MissionBriefingModal({ missionId = 'mission_1', onClose }) {
  const mission = getMissionById(missionId);

  const landmassPaths = useMemo(
    () =>
      LAND_POLYGONS.map((poly, idx) => {
        const d = poly.ring
          .map(
            ([lon, lat], i) =>
              `${i === 0 ? 'M' : 'L'} ${projX(lon).toFixed(1)} ${projY(lat).toFixed(1)}`,
          )
          .join(' ');
        return { id: idx, d: `${d} Z` };
      }),
    [],
  );

  // Route segments split at ±180° antimeridian where applicable
  const routeVisual = useMemo(() => {
    if (mission.id === 'mission_event_cape') {
      return {
        paths: [
          pointsToSvgPath([
            [-9.1, 38.7],
            [-18, 22],
            [-23.6, 15],
            [-14, -10],
            [6, -32],
            [18.5, -34.5],
          ]),
        ],
        target: { lon: 18.5, lat: -34.5, label: '목표: 희망봉 (15턴 단방향!)' },
        blockedCape: false,
      };
    }

    if (mission.id === 'mission_1') {
      return {
        paths: [
          pointsToSvgPath([
            [-9.1, 38.7],
            [-20, 12],
            [18.5, -38],
            [56, 4],
            [74.7, 10],
            [102.2, 2.2],
            [127.5, -1.5],
          ]),
        ],
        target: { lon: 127.5, lat: -1.5, label: '목표: 향료제도(말루쿠)' },
        blockedCape: false,
      };
    }

    if (mission.id === 'mission_2') {
      return {
        paths: [
          pointsToSvgPath([
            [-9.1, 38.7],
            [-36, -15],
            [-67, -55],
            [-92, -25],
            [-135, 8],
            [-180, 14],
          ]),
          pointsToSvgPath([
            [180, 14],
            [144.8, 13.5],
            [122, 18],
            [113.8, 21.8],
          ]),
        ],
        target: { lon: 113.8, lat: 21.8, label: '목표: 명나라(마카오·광저우)' },
        blockedCape: true,
      };
    }

    // Mission 3: Global westward circumnavigation loop
    return {
      paths: [
        pointsToSvgPath([
          [-9.1, 38.7],
          [-36, -15],
          [-67, -55],
          [-95, -25],
          [-140, 8],
          [-180, 14],
        ]),
        pointsToSvgPath([
          [180, 14],
          [144.8, 13.5],
          [127.5, -1.5],
          [102.2, 2.2],
          [74.7, 10],
          [18.5, -38],
          [-18, 8],
          [-9.1, 38.7],
        ]),
      ],
      target: { lon: -67.0, lat: -52.5, label: '서반구 → 태평양 → 동반구 → 리스본' },
      blockedCape: false,
    };
  }, [mission.id]);

  const lisbonX = projX(-9.1);
  const lisbonY = projY(38.7);
  const targetX = projX(routeVisual.target.lon);
  const targetY = projY(routeVisual.target.lat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl border-2 border-[#7a5226] bg-gradient-to-b from-[#f7ead0] via-[#efe0ba] to-[#e4ca92] text-[#2b1b0d] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-[#b8894c]/50">
        {/* Inner decorative aged-parchment border */}
        <div className="rounded-xl border border-[#8e6231]/55 p-3 space-y-3 bg-[#f5e7c9]/45">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="rounded-lg border border-[#7a5226]/50 bg-[#7a5226]/15 p-2 text-[#693d12] shrink-0">
                <ScrollText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black tracking-widest uppercase text-[#7b4d1d]">
                  왕실 항해 칙령서 · {mission.badgeText}
                </div>
                <h2 className="text-base font-black text-[#261608] leading-snug">
                  {mission.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-lg p-1 text-[#6e4921] hover:bg-[#7a5226]/15 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Antique Parchment World Navigation Chart */}
          <div className="relative rounded-xl border-2 border-[#8c6131] bg-[#edd7a7] overflow-hidden shadow-inner">
            <svg viewBox="0 0 360 180" className="w-full h-auto block">
              <defs>
                <radialGradient id="parchmentSea" cx="50%" cy="48%" r="70%">
                  <stop offset="0%" stopColor="#f6e7c1" />
                  <stop offset="70%" stopColor="#ead09b" />
                  <stop offset="100%" stopColor="#d8b574" />
                </radialGradient>
              </defs>

              <rect x="0" y="0" width="360" height="180" fill="url(#parchmentSea)" />

              {/* B4-style parchment coordinate grid */}
              {[-60, -30, 0, 30, 60].map((latLine) => (
                <line
                  key={`lat-${latLine}`}
                  x1="0"
                  y1={projY(latLine)}
                  x2="360"
                  y2={projY(latLine)}
                  stroke={latLine === 0 ? '#8c5327' : '#a87d4a'}
                  strokeWidth={latLine === 0 ? '0.8' : '0.45'}
                  strokeDasharray={latLine === 0 ? undefined : '2 2'}
                  opacity="0.55"
                />
              ))}
              {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lonLine) => (
                <line
                  key={`lon-${lonLine}`}
                  x1={projX(lonLine)}
                  y1="0"
                  x2={projX(lonLine)}
                  y2="180"
                  stroke={lonLine === 0 ? '#8c5327' : '#a87d4a'}
                  strokeWidth={lonLine === 0 ? '0.7' : '0.4'}
                  strokeDasharray={lonLine === 0 ? undefined : '2 2'}
                  opacity="0.45"
                />
              ))}

              {/* World Landmasses in Sepia Ink */}
              {landmassPaths.map((lm) => (
                <path
                  key={lm.id}
                  d={lm.d}
                  fill="#cfa96e"
                  stroke="#6f471c"
                  strokeWidth="0.7"
                  opacity="0.92"
                />
              ))}

              {/* Compass Rose Ornament */}
              <g transform="translate(28, 148)" opacity="0.68" stroke="#5d3812" fill="none">
                <circle cx="0" cy="0" r="12" strokeWidth="0.8" />
                <path d="M 0 -14 L 2.5 -2.5 L 14 0 L 2.5 2.5 L 0 14 L -2.5 2.5 L -14 0 L -2.5 -2.5 Z" fill="#8b5a2b" strokeWidth="0.6" />
                <text x="0" y="-16" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#4f2d0b" stroke="none">N</text>
              </g>

              {/* Strategic Mission Route Curves */}
              {routeVisual.paths.map((d, idx) => (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke="#991b1b"
                  strokeWidth="2.1"
                  strokeDasharray="4.5 3"
                  strokeLinecap="round"
                  opacity="0.88"
                />
              ))}

              {/* Mission 2 Eastern Blockade Marker */}
              {routeVisual.blockedCape && (
                <g transform={`translate(${projX(22).toFixed(1)}, ${projY(-34).toFixed(1)})`}>
                  <circle cx="0" cy="0" r="7.5" fill="#7f1d1d" opacity="0.22" />
                  <line x1="-5" y1="-5" x2="5" y2="5" stroke="#991b1b" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="5" y1="-5" x2="-5" y2="5" stroke="#991b1b" strokeWidth="2.2" strokeLinecap="round" />
                  <text x="9" y="3" fontSize="6.5" fontWeight="bold" fill="#7f1d1d">
                    동쪽 직행 불가
                  </text>
                </g>
              )}

              {/* Lisbon Start Pin */}
              <g transform={`translate(${lisbonX.toFixed(1)}, ${lisbonY.toFixed(1)})`}>
                <circle cx="0" cy="0" r="4.2" fill="#1e3a8a" stroke="#fef3c7" strokeWidth="1.2" />
                <text
                  x="-5"
                  y="-6"
                  textAnchor="end"
                  fontSize="7"
                  fontWeight="bold"
                  fill="#1e293b"
                >
                  출발: 리스본
                </text>
              </g>

              {/* Mission Target Seal */}
              <g transform={`translate(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`}>
                <circle cx="0" cy="0" r="10" fill="#b91c1c" opacity="0.18" />
                <circle cx="0" cy="0" r="5" fill="#b91c1c" stroke="#fef3c7" strokeWidth="1.3" />
                <text
                  x={mission.id === 'mission_3' || mission.id === 'mission_event_cape' ? 8 : -8}
                  y={mission.id === 'mission_3' ? -7 : -8}
                  textAnchor={mission.id === 'mission_3' || mission.id === 'mission_event_cape' ? 'start' : 'end'}
                  fontSize="6.8"
                  fontWeight="bold"
                  fill="#7f1d1d"
                >
                  {routeVisual.target.label}
                </text>
              </g>
            </svg>

            <div className="border-t border-[#8c6131]/50 bg-[#e6cb91]/90 px-2.5 py-1 flex items-center justify-between text-[10px] font-bold text-[#5a3712]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#991b1b]" />
                {mission.rulesNote}
              </span>
              <span>모눈 1 cm = 10°</span>
            </div>
          </div>

          {/* Concise Mission Briefing & Tutorial */}
          <div className="rounded-xl border border-[#8e6231]/50 bg-[#fbf1da]/75 p-2.5 text-xs space-y-2 text-[#33200f]">
            <p className="font-bold leading-relaxed text-[#4f2d0d]">
              {mission.summary}
            </p>
            <div className="border-t border-[#8e6231]/30 pt-1.5 space-y-1 text-[11px] leading-relaxed">
              <div className="flex items-start gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#7a4b1e] shrink-0 mt-0.5" />
                <span>
                  <strong>1. 조타·작도:</strong> 방위와 바람({mission.moveScale ? `${Math.round(mission.moveScale * 100)}% 속도` : '1~4 cm'})에 맞춰 항해한 뒤 B4 지도에 기록하세요. <strong>{mission.positionCheckInterval || 3}턴마다 지도로 현재 위치</strong>가 공개되며, 빈 땅 상륙 시 원주민을 만날 수 있습니다!
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Anchor className="w-3.5 h-3.5 text-[#7a4b1e] shrink-0 mt-0.5" />
                <span>
                  <strong>2. 보급·부패 주의:</strong> 식량·식수 <strong>{mission.initialFood || 140}</strong>으로 시작하며(턴당 기본 -10), <strong>8턴</strong> 연속 미기항 시 부패(1.5배 소모)하니 중간 기항지를 활용하세요!
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-[#7f1d1d] via-[#991b1b] to-[#7f1d1d] hover:brightness-110 active:scale-[0.99] border border-[#f5d08a]/50 py-2.5 text-sm font-black text-[#fef3c7] shadow-lg transition cursor-pointer"
          >
            칙령 확인 · 닻을 올리고 출항하기
          </button>
        </div>
      </div>
    </div>
  );
}
