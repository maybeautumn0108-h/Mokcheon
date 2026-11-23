import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FastForward,
  Monitor,
  Play,
  RefreshCw,
  RotateCcw,
  Ship,
} from 'lucide-react';
import { LAND_POLYGONS } from '../data/worldCoastlines.js';
import { PORTS } from '../data/ports.js';

const FLEET_COLORS = ['#ef4444', '#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export default function TeacherModeView({
  roomCode,
  roomMeta,
  fleets,
  onBackToStudent,
  onStartVoyage,
  onForceOpenActivity,
  onForceNextTurn,
  onResetToWaiting,
  onClearRoom,
}) {
  const [hideMap, setHideMap] = useState(false);

  const realFleets = fleets.filter((f) => !f.isDemo);
  const currentTurn = roomMeta?.currentTurn ?? 1;
  const phase = roomMeta?.phase ?? 'waiting';
  const turnPhase = roomMeta?.turnPhase ?? 'sail_card';
  const cardsReadyCount = realFleets.filter(
    (f) => f.status !== 'active' || (f.cardCompletedTurn ?? 0) >= currentTurn,
  ).length;
  const readyCount = realFleets.filter(
    (f) => f.status !== 'active' || (f.completedTurn ?? 0) >= currentTurn,
  ).length;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-3 sm:p-5">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Top Teacher Control Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-slate-900 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToStudent}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              학생/대기실 화면
            </button>
            <div>
              <h1 className="text-base font-black text-amber-300 flex items-center gap-1.5">
                <Monitor className="w-4 h-4" />
                교사용 전 세계 선단 관제 모드
              </h1>
              <div className="text-xs text-slate-400">
                수업방: <strong className="text-slate-200">{roomCode}</strong> · 상태:{' '}
                <strong className="text-emerald-300">
                  {phase === 'waiting'
                    ? '대기실'
                    : phase === 'finished'
                      ? '항해 종료'
                      : turnPhase === 'sail_card'
                        ? `제${currentTurn}턴 항해·카드 (${cardsReadyCount}/${realFleets.length}팀)`
                        : `제${currentTurn}턴 주변활동 (${readyCount}/${realFleets.length}팀)`}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {phase === 'waiting' && (
              <button
                type="button"
                onClick={onStartVoyage}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-black text-slate-950 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                전원 출항 시작 (1턴)
              </button>
            )}

            {phase === 'playing' && turnPhase === 'sail_card' && (
              <button
                type="button"
                onClick={onForceOpenActivity}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 px-3.5 py-2 text-xs font-black text-sky-200 cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
                강제 3단계(주변활동) 열기
              </button>
            )}

            {phase === 'playing' && (
              <button
                type="button"
                onClick={onForceNextTurn}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-2 text-xs font-black text-amber-200 cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
                강제 다음 턴 ({Math.min(30, currentTurn + 1)}턴)
              </button>
            )}

            <button
              type="button"
              onClick={onResetToWaiting}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              대기방 리셋
            </button>

            <button
              type="button"
              onClick={() => setHideMap((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black border transition cursor-pointer ${
                hideMap
                  ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400 text-slate-950'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50 text-rose-200'
              }`}
            >
              {hideMap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>{hideMap ? '전체 공개하기' : '지도 가리기'}</span>
            </button>

            <button
              type="button"
              onClick={onClearRoom}
              title="방 선단 기록 비우기"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              방 비우기
            </button>
          </div>
        </header>

        {/* World Square-Grid Map (170°W ~ 170°E, 75°N ~ 65°S) */}
        <section className="relative rounded-2xl border border-amber-500/30 bg-[#f6edd9] overflow-hidden shadow-2xl">
          <div className="bg-slate-900/95 text-xs text-slate-300 px-4 py-2 flex items-center justify-between border-b border-amber-500/20">
            <span>B4 전 세계 정방형 항해도 실시간 관제 (10° 격자 = 1.0 cm)</span>
            <span className="text-amber-300 font-bold">170°W ~ 170°E · 75°N ~ 65°S</span>
          </div>

          <div className="relative w-full aspect-[340/140]">
            <svg viewBox="-170 -75 340 140" className="w-full h-full block bg-[#e8f1f5]">
              {/* 10° Grid Lines */}
              {Array.from({ length: 35 }).map((_, i) => {
                const lon = -170 + i * 10;
                return (
                  <line
                    key={`lon-${lon}`}
                    x1={lon}
                    y1={-75}
                    x2={lon}
                    y2={65}
                    stroke={lon === 0 ? '#94a3b8' : '#cbd5e1'}
                    strokeWidth={lon === 0 ? 0.6 : 0.25}
                  />
                );
              })}
              {Array.from({ length: 15 }).map((_, i) => {
                const lat = -65 + i * 10;
                const y = -lat;
                return (
                  <g key={`lat-${lat}`}>
                    <line
                      x1={-170}
                      y1={y}
                      x2={170}
                      y2={y}
                      stroke={lat === 0 ? '#dc2626' : '#cbd5e1'}
                      strokeWidth={lat === 0 ? 0.6 : 0.25}
                    />
                    {lat % 20 === 0 && (
                      <text
                        x={-168}
                        y={y - 1.2}
                        fontSize="3.4"
                        fontWeight="700"
                        fill={lat === 0 ? '#dc2626' : '#64748b'}
                      >
                        {lat === 0 ? '0° 적도' : lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Landmasses */}
              {LAND_POLYGONS.map((poly, idx) => {
                const pts = poly.ring.map(([lon, lat]) => `${lon},${-lat}`).join(' ');
                return (
                  <polygon
                    key={`land-${idx}`}
                    points={pts}
                    fill="#d6c198"
                    stroke="#8c734b"
                    strokeWidth="0.45"
                  />
                );
              })}

              {/* Ports */}
              {PORTS.map((port) => {
                const isStar = port.isHomePort || port.isGoalPort;
                return (
                  <g key={port.id} transform={`translate(${port.lon}, ${-port.lat})`}>
                    <circle
                      r={isStar ? 2.1 : 1.4}
                      fill={isStar ? '#dc2626' : '#1d4ed8'}
                      stroke="#ffffff"
                      strokeWidth="0.4"
                    />
                    <text
                      x="2.4"
                      y="1"
                      fontSize="3.5"
                      fontWeight="700"
                      fill="#1e293b"
                    >
                      {port.name}
                    </text>
                  </g>
                );
              })}

              {/* Student Fleet Trails & Markers */}
              {fleets.map((fleet, idx) => {
                const color = FLEET_COLORS[idx % FLEET_COLORS.length];
                const trailPts = (fleet.trail || [])
                  .map((pt) => `${pt.lon},${-pt.lat}`)
                  .join(' ');
                return (
                  <g key={fleet.clientId}>
                    {trailPts && (
                      <polyline
                        points={trailPts}
                        fill="none"
                        stroke={color}
                        strokeWidth="0.9"
                        strokeDasharray="1.8 1.2"
                        opacity="0.85"
                      />
                    )}
                    <g transform={`translate(${fleet.lon}, ${-fleet.lat})`}>
                      <circle r="3.1" fill={color} opacity="0.28" />
                      <circle r="1.8" fill={color} stroke="#ffffff" strokeWidth="0.55" />
                      <text
                        x="2.8"
                        y="-2.2"
                        fontSize="3.8"
                        fontWeight="800"
                        fill="#0f172a"
                        stroke="#ffffff"
                        strokeWidth="0.6"
                        paintOrder="stroke"
                      >
                        {fleet.teamName}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {hideMap && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center">
                <EyeOff className="w-12 h-12 text-amber-400 mb-3" />
                <h2 className="text-xl font-black text-white">수업 중 지도 가림 활성화됨</h2>
                <p className="text-sm text-slate-300 mt-1 max-w-md">
                  교실 대형 화면을 통해 학생들이 자신의 좌표를 베끼지 않도록 세계 지도를 가렸습니다.
                  상단의 <strong>[전체 공개하기]</strong> 버튼으로 언제든 다시 볼 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Live Fleet Status Table */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5 mb-3">
            <Ship className="w-4 h-4" />
            실시간 선단 관제 현황 ({fleets.length}척)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {fleets.map((fleet, idx) => {
              const color = FLEET_COLORS[idx % FLEET_COLORS.length];
              const isDoneThisTurn =
                fleet.status !== 'active' ||
                (turnPhase === 'sail_card'
                  ? (fleet.cardCompletedTurn ?? 0) >= currentTurn
                  : (fleet.completedTurn ?? 0) >= currentTurn);

              return (
                <div
                  key={fleet.clientId}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-white flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {fleet.teamName}
                    </span>
                    {!fleet.isDemo && phase === 'playing' && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          isDoneThisTurn
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                            : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                        }`}
                      >
                        {isDoneThisTurn ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            {currentTurn}턴 완료
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            진행 중
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    금화 {fleet.gold}G · 식량 {fleet.food} · 내구도 {fleet.hull} · 특산품{' '}
                    {fleet.cargoCount || 0}종
                  </div>
                  {!hideMap && (
                    <div className="text-[11px] text-sky-300 tabular-nums">
                      관제 좌표:{' '}
                      {fleet.lat >= 0
                        ? `${fleet.lat.toFixed(1)}°N`
                        : `${Math.abs(fleet.lat).toFixed(1)}°S`}
                      ,{' '}
                      {fleet.lon >= 0
                        ? `${fleet.lon.toFixed(1)}°E`
                        : `${Math.abs(fleet.lon).toFixed(1)}°W`}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-300">{fleet.lastEvent}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
