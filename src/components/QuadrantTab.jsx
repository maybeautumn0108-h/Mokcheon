import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CloudRain,
  Compass,
  Crosshair,
  Droplets,
  Lock,
  Sparkles,
  Sun,
} from 'lucide-react';
import { TURN_CALENDAR, getTurnInfo } from '../data/calendar.js';
import { getWeatherById } from '../data/weather.js';
import {
  BACKGROUND_STARS,
  BIG_DIPPER_STARS,
  CASSIOPEIA_STARS,
  POLARIS_POS,
  computeSouthLatitude,
  computeWeatherSway,
  evaluateQuadrantShot,
  getCelestialTarget,
} from '../engine/quadrant.js';

function randomSkyStart() {
  const sx = Math.random() > 0.5 ? 1 : -1;
  const sy = Math.random() > 0.5 ? 1 : -1;
  return {
    x: sx * (24 + Math.round(Math.random() * 18)),
    y: sy * (18 + Math.round(Math.random() * 14)),
  };
}

function randomSunStart(trueAlt) {
  const dir = trueAlt > 45 ? -1 : 1;
  const offset = 14 + Math.round(Math.random() * 18);
  return Math.max(5, Math.min(85, Math.round(trueAlt + dir * offset)));
}

const REMEASURE_FOOD_COST = 5;

export default function QuadrantTab({
  lat,
  currentTurn,
  weatherId = 'clear',
  food = 0,
  isLocked = false,
  lockedRecord = null,
  onRecordObservation,
  onUnlockQuadrant,
}) {
  const turnInfo = getTurnInfo(currentTurn);
  const weather = useMemo(() => getWeatherById(weatherId), [weatherId]);
  const isStormBlocked = weather.id === 'storm';
  const target = useMemo(
    () => getCelestialTarget(lat, turnInfo.declination),
    [lat, turnInfo.declination],
  );

  const [skyOffset, setSkyOffset] = useState(() => randomSkyStart());
  const [aimElevation, setAimElevation] = useState(() =>
    randomSunStart(target.trueAltitudeDeg),
  );
  const [showConstellations, setShowConstellations] = useState(false);
  const [frameState, setFrameState] = useState(() =>
    computeWeatherSway(weatherId, 0),
  );
  const [measurement, setMeasurement] = useState(() => lockedRecord);
  const [aimWarning, setAimWarning] = useState(null);

  const [inputH, setInputH] = useState(() =>
    lockedRecord?.hemisphere === 'south' ? String(lockedRecord.measuredDeg) : '',
  );
  const [inputDelta, setInputDelta] = useState(String(turnInfo.declination));

  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const shownMeasurement = isLocked ? lockedRecord || measurement : measurement;

  useEffect(() => {
    setInputDelta(String(turnInfo.declination));
  }, [turnInfo.declination]);

  // Reset starting offsets on turn change so every turn requires fresh aiming
  useEffect(() => {
    if (!isLocked) {
      setSkyOffset(randomSkyStart());
      setAimElevation(randomSunStart(target.trueAltitudeDeg));
    }
    setAimWarning(null);
  }, [currentTurn, target.trueAltitudeDeg, isLocked]);

  // Real-time 2-axis wave sway loop (paused cleanly when locked or storm-blocked)
  useEffect(() => {
    if (isLocked || isStormBlocked) {
      setFrameState(computeWeatherSway(weatherId, 0));
      return undefined;
    }
    let rafId;
    const start = performance.now();
    const tick = (now) => {
      const tSec = (now - start) / 1000;
      setFrameState(computeWeatherSway(weatherId, tSec));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [weatherId, isLocked, isStormBlocked]);

  const handleSkyPointerDown = (e) => {
    if (isLocked || isStormBlocked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handleNorthPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = (e.clientX - dragRef.current.lastX) * 0.42;
    const dy = (e.clientY - dragRef.current.lastY) * 0.42;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setSkyOffset((prev) => ({
      x: Math.max(-68, Math.min(68, prev.x + dx)),
      y: Math.max(-48, Math.min(48, prev.y + dy)),
    }));
  };

  const handleSouthPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dy = (e.clientY - dragRef.current.lastY) * 0.28;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setAimElevation((prev) =>
      Math.max(0, Math.min(90, Number((prev - dy).toFixed(1)))),
    );
  };

  const handlePointerUp = (e) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleMeasureNorth = () => {
    const polarisScreenX = POLARIS_POS.x + skyOffset.x;
    const polarisScreenY = POLARIS_POS.y + skyOffset.y;
    const distFromReticle = Math.hypot(
      polarisScreenX - frameState.swayX,
      polarisScreenY - frameState.swayY,
    );

    const outcome = evaluateQuadrantShot({
      trueAltitudeDeg: target.trueAltitudeDeg,
      weatherId,
      distFromReticle,
      swayX: frameState.swayX,
      swayY: frameState.swayY,
      isOccluded: frameState.isOccluded,
    });

    if (!outcome.ok) {
      setAimWarning(outcome.message);
      return;
    }

    setAimWarning(null);
    const record = {
      hemisphere: 'north',
      turn: currentTurn,
      dateLabel: turnInfo.label,
      weatherName: weather.name,
      measuredDeg: outcome.measuredDeg,
      precisionLabel: outcome.precisionLabel,
    };
    setMeasurement(record);
    onRecordObservation?.(record);
  };

  // Southern hemisphere sun screen offset relative to horizon crosshair (0, 0)
  const sunScreenX = frameState.swayX;
  const sunScreenY = (aimElevation - target.trueAltitudeDeg) * 1.45 + frameState.swayY;

  const handleMeasureSouth = () => {
    const distFromReticle = Math.hypot(sunScreenX, sunScreenY);
    const outcome = evaluateQuadrantShot({
      trueAltitudeDeg: target.trueAltitudeDeg,
      weatherId,
      distFromReticle,
      swayX: frameState.swayX,
      swayY: frameState.swayY,
      isOccluded: frameState.isOccluded,
    });

    if (!outcome.ok) {
      setAimWarning(outcome.message);
      return;
    }

    setAimWarning(null);
    const record = {
      hemisphere: 'south',
      turn: currentTurn,
      dateLabel: turnInfo.label,
      weatherName: weather.name,
      measuredDeg: outcome.measuredDeg,
      declination: turnInfo.declination,
      precisionLabel: outcome.precisionLabel,
    };
    setMeasurement(record);
    setInputH(String(outcome.measuredDeg));
    setInputDelta(String(turnInfo.declination));
    onRecordObservation?.(record);
  };

  const calculatedSouthLat = useMemo(() => {
    const hVal = Number.parseFloat(inputH);
    const dVal = Number.parseFloat(inputDelta);
    if (Number.isNaN(hVal) || Number.isNaN(dVal)) return null;
    return computeSouthLatitude(hVal, dVal);
  }, [inputH, inputDelta]);

  return (
    <div className="space-y-3">
      {/* Weather & Difficulty Status Card */}
      <section
        className={`rounded-2xl border p-3.5 shadow-lg ${
          weatherId === 'storm'
            ? 'border-purple-400/60 bg-purple-950/35'
            : weatherId === 'squall'
              ? 'border-rose-400/50 bg-rose-950/30'
              : 'border-amber-500/30 bg-slate-900/95'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-white">
            <CloudRain
              className={`w-4 h-4 ${
                weatherId === 'storm'
                  ? 'text-purple-300 animate-pulse'
                  : weatherId === 'squall'
                    ? 'text-rose-300'
                    : 'text-sky-300'
              }`}
            />
            <span>해상 기상: {weather.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5 text-amber-300">
              허용 오차 ±{weather.toleranceDeg}°
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 ${
                isStormBlocked
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                  : isLocked
                    ? 'bg-amber-950/80 border-amber-400/50 text-amber-200'
                    : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              }`}
            >
              {isStormBlocked ? '측량 불가' : isLocked ? '측정 잠금' : '측량 가능'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-300 leading-snug">{weather.description}</p>
        {isStormBlocked && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-purple-950/80 border border-purple-400/40 px-2.5 py-1.5 text-[11px] font-bold text-purple-200">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span>폭풍우 경보: 폭풍우로 인해 이번 턴 천체 측량이 불가능합니다!</span>
          </div>
        )}
      </section>

      {/* Main Quadrant Instrument */}
      <section className="rounded-2xl border border-amber-500/30 bg-slate-900/95 p-3.5 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            {target.hemisphere === 'north'
              ? '북반구 · 북극성 고도 측정'
              : '남반구 · 정오 태양 수평선 정렬'}
          </h2>
          <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
            {turnInfo.turn}턴 · 적위 {turnInfo.declination > 0 ? `+${turnInfo.declination}°` : `${turnInfo.declination}°`}
          </span>
        </div>

        {target.hemisphere === 'north' ? (
          <>
            <p className="text-xs text-slate-300 mb-2 leading-relaxed">
              밤하늘을 드래그해 <strong>북두칠성</strong>(국자 끝 두 별의 5배 연장선)과{' '}
              <strong>카시오페이아(W자)</strong>로 북극성을 찾고, 흔들리는 조준원이 겹치는 순간
              측정하세요.
            </p>

            {/* Unlabeled Night Sky Viewport */}
            <div
              onPointerDown={handleSkyPointerDown}
              onPointerMove={handleNorthPointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 touch-none ${
                isLocked || isStormBlocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
              }`}
            >
              <svg viewBox="-80 -58 160 116" className="w-full h-full block">
                <defs>
                  <radialGradient id="nightSkyBg" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#0f1d3a" />
                    <stop offset="100%" stopColor="#020617" />
                  </radialGradient>
                </defs>
                <rect x="-80" y="-58" width="160" height="116" fill="url(#nightSkyBg)" />

                <g transform={`translate(${skyOffset.x}, ${skyOffset.y})`}>
                  {/* Optional constellation shape lines ONLY (no arrow pointing to Polaris!) */}
                  {showConstellations && (
                    <g opacity="0.4">
                      <polyline
                        points={BIG_DIPPER_STARS.map((s) => `${s.x},${s.y}`).join(' ')}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="0.6"
                      />
                      <polyline
                        points={CASSIOPEIA_STARS.map((s) => `${s.x},${s.y}`).join(' ')}
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="0.6"
                      />
                    </g>
                  )}

                  {BACKGROUND_STARS.map((s, idx) => (
                    <circle
                      key={`bg-${idx}`}
                      cx={s.x}
                      cy={s.y}
                      r={s.r * 0.72}
                      fill="#e2e8f0"
                      opacity="0.65"
                    />
                  ))}

                  {BIG_DIPPER_STARS.map((s, idx) => (
                    <circle
                      key={`bd-${idx}`}
                      cx={s.x}
                      cy={s.y}
                      r={idx < 2 ? 1.45 : 1.25}
                      fill="#f1f5f9"
                    />
                  ))}

                  {CASSIOPEIA_STARS.map((s, idx) => (
                    <circle
                      key={`cas-${idx}`}
                      cx={s.x}
                      cy={s.y}
                      r={1.25}
                      fill="#f1f5f9"
                    />
                  ))}

                  {/* Polaris blends naturally with same cool white starlight */}
                  <circle cx={POLARIS_POS.x} cy={POLARIS_POS.y} r="1.5" fill="#f8fafc" />
                </g>

                {/* Storm-only Blocker Overlay (fog/cloud occlusion removed) */}
                {isStormBlocked && (
                  <g>
                    <rect x="-80" y="-58" width="160" height="116" fill="#090d16" opacity="0.88" />
                    <text x="0" y="-4" textAnchor="middle" fontSize="8" fontWeight="900" fill="#e9d5ff">
                      ⛈️ 폭풍우로 측량 불가
                    </text>
                    <text x="0" y="9" textAnchor="middle" fontSize="5" fontWeight="700" fill="#cbd5e1">
                      폭풍우가 지나간 다음 턴에 다시 관측하세요
                    </text>
                  </g>
                )}

                {/* 2-Axis Swaying Quadrant Reticle (radius = toleranceDeg) */}
                <g transform={`translate(${frameState.swayX}, ${frameState.swayY})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r={weather.toleranceDeg}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="0.85"
                    strokeDasharray="2 1.2"
                  />
                  <line
                    x1={-weather.toleranceDeg - 4}
                    y1="0"
                    x2={-weather.toleranceDeg + 1}
                    y2="0"
                    stroke="#fbbf24"
                    strokeWidth="0.75"
                  />
                  <line
                    x1={weather.toleranceDeg - 1}
                    y1="0"
                    x2={weather.toleranceDeg + 4}
                    y2="0"
                    stroke="#fbbf24"
                    strokeWidth="0.75"
                  />
                  <line
                    x1="0"
                    y1={-weather.toleranceDeg - 4}
                    x2="0"
                    y2={-weather.toleranceDeg + 1}
                    stroke="#fbbf24"
                    strokeWidth="0.75"
                  />
                  <line
                    x1="0"
                    y1={weather.toleranceDeg - 1}
                    x2="0"
                    y2={weather.toleranceDeg + 4}
                    stroke="#fbbf24"
                    strokeWidth="0.75"
                  />
                </g>
              </svg>

              <button
                type="button"
                onClick={() => setShowConstellations((v) => !v)}
                className="absolute bottom-2 right-2 rounded-lg bg-slate-900/85 border border-slate-700 px-2 py-1 text-[10px] font-bold text-sky-300 hover:border-sky-400 cursor-pointer"
              >
                {showConstellations ? '성좌 선 숨기기' : '성좌 모양 선'}
              </button>
            </div>

            {aimWarning && (
              <div className="mt-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                {aimWarning}
              </div>
            )}

            <button
              type="button"
              disabled={isLocked || isStormBlocked}
              onClick={handleMeasureNorth}
              className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 active:scale-[0.99] py-2.5 text-sm font-black text-slate-950 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Crosshair className="w-4 h-4" />}
              {isStormBlocked
                ? '폭풍우로 측량 불가'
                : isLocked
                  ? '측정 완료 (고정됨)'
                  : '북극성 고도 측정 (추 고정)'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-amber-200/90 mb-2 leading-relaxed">
              화면을 위아래로 드래그하거나 버튼으로 사분의 눈금을 조절해{' '}
              <strong>흔들리는 태양을 수평선 조준원</strong>에 맞추어 측정하세요.
            </p>

            {/* Southern Hemisphere Noon Sun Horizon Alignment Viewport */}
            <div
              onPointerDown={handleSkyPointerDown}
              onPointerMove={handleSouthPointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-amber-500/30 bg-slate-950 touch-none ${
                isLocked || isStormBlocked ? 'cursor-not-allowed' : 'cursor-ns-resize'
              }`}
            >
              <svg viewBox="-80 -58 160 116" className="w-full h-full block">
                <defs>
                  <linearGradient id="noonSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={weatherId === 'storm' ? '#1e293b' : '#0284c7'} />
                    <stop offset="70%" stopColor={weatherId === 'storm' ? '#475569' : '#7dd3fc'} />
                    <stop offset="100%" stopColor={weatherId === 'storm' ? '#64748b' : '#fef3c7'} />
                  </linearGradient>
                </defs>
                {/* Sky above horizon (y=0) */}
                <rect x="-80" y="-58" width="160" height="58" fill="url(#noonSky)" />
                {/* Sea below horizon (y=0) */}
                <rect x="-80" y="0" width="160" height="58" fill="#082f49" />
                <line x1="-80" y1="0" x2="80" y2="0" stroke="#e0f2fe" strokeWidth="0.6" opacity="0.7" />

                {/* Swaying Noon Sun */}
                <g transform={`translate(${sunScreenX}, ${sunScreenY})`}>
                  <circle cx="0" cy="0" r="10" fill="#fde047" opacity="0.28" />
                  <circle cx="0" cy="0" r="4.5" fill="#fef08a" />
                </g>

                {/* Storm-only Blocker Overlay (fog/cloud occlusion removed) */}
                {isStormBlocked && (
                  <g>
                    <rect x="-80" y="-58" width="160" height="116" fill="#090d16" opacity="0.88" />
                    <text x="0" y="-4" textAnchor="middle" fontSize="8" fontWeight="900" fill="#e9d5ff">
                      ⛈️ 폭풍우로 측량 불가
                    </text>
                    <text x="0" y="9" textAnchor="middle" fontSize="5" fontWeight="700" fill="#cbd5e1">
                      폭풍우가 지나간 다음 턴에 다시 관측하세요
                    </text>
                  </g>
                )}

                {/* Fixed Horizon Reticle at (0, 0) */}
                <circle
                  cx="0"
                  cy="0"
                  r={weather.toleranceDeg}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="2 1.2"
                />
                <line x1="-14" y1="0" x2="-4" y2="0" stroke="#fbbf24" strokeWidth="0.9" />
                <line x1="4" y1="0" x2="14" y2="0" stroke="#fbbf24" strokeWidth="0.9" />
                <line x1="0" y1="-12" x2="0" y2="-4" stroke="#fbbf24" strokeWidth="0.9" />
                <line x1="0" y1="4" x2="0" y2="12" stroke="#fbbf24" strokeWidth="0.9" />
              </svg>

              <div className="absolute top-2 left-2 rounded-lg bg-slate-950/80 border border-slate-700 px-2 py-1 text-[10px] font-bold text-amber-300 tabular-nums">
                사분의 조준 각도: {aimElevation.toFixed(1)}°
              </div>
            </div>

            {/* Quadrant Arm Angle Controls */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  disabled={isLocked || isStormBlocked}
                  onClick={() =>
                    setAimElevation((prev) =>
                      Math.max(0, Math.min(90, Number((prev + delta).toFixed(1)))),
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 py-1.5 text-xs font-bold text-slate-200 cursor-pointer disabled:cursor-not-allowed"
                >
                  {delta > 0 ? `+${delta}°` : `${delta}°`}
                </button>
              ))}
            </div>

            {aimWarning && (
              <div className="mt-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                {aimWarning}
              </div>
            )}

            <button
              type="button"
              disabled={isLocked || isStormBlocked}
              onClick={handleMeasureSouth}
              className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 active:scale-[0.99] py-2.5 text-sm font-black text-slate-950 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {isStormBlocked
                ? '폭풍우로 측량 불가'
                : isLocked
                  ? '측정 완료 (고정됨)'
                  : '정오 태양 고도(h) 측정'}
            </button>
          </>
        )}

        {/* Measurement Result Banner & Paid Re-measure Control */}
        {shownMeasurement && (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-300">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  제{shownMeasurement.turn}턴 관측 성공 ({shownMeasurement.weatherName} · {shownMeasurement.precisionLabel})
                </span>
                <span>{shownMeasurement.dateLabel}</span>
              </div>
              {shownMeasurement.hemisphere === 'north' ? (
                <div className="text-sm font-black text-white">
                  측정된 북극성 고도 = 북위 {shownMeasurement.measuredDeg.toFixed(1)}°N
                </div>
              ) : (
                <div className="text-sm font-black text-white">
                  관측된 정오 태양 고도(h) = {shownMeasurement.measuredDeg.toFixed(1)}°
                </div>
              )}
            </div>

            {isLocked && onUnlockQuadrant && (
              <div className="pt-1 border-t border-emerald-500/25 flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={food < REMEASURE_FOOD_COST || isStormBlocked}
                  onClick={() => {
                    setMeasurement(null);
                    setAimWarning(null);
                    onUnlockQuadrant(REMEASURE_FOOD_COST);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-45 py-2 text-xs font-black text-sky-200 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <Droplets className="w-3.5 h-3.5 text-sky-300" />
                  <span>
                    식량·식수 {REMEASURE_FOOD_COST} 사용하여 다시 측정하기 (보유: {food})
                  </span>
                </button>
                {food < REMEASURE_FOOD_COST && (
                  <div className="text-[10px] text-rose-300 text-center">
                    보유 식량·식수가 {REMEASURE_FOOD_COST} 미만이어서 재측정할 수 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Southern Hemisphere Latitude Calculator */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
        <h3 className="text-xs font-bold text-sky-300 flex items-center gap-1.5 mb-2">
          <Calculator className="w-4 h-4" />
          적도 이남 남위 계산기 (남위 °S = 90° − h − δ)
        </h3>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">태양 고도 (h)</label>
            <input
              type="number"
              step="0.1"
              value={inputH}
              onChange={(e) => setInputH(e.target.value)}
              placeholder="측정 후 자동입력"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 font-bold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">태양 적위 (δ)</label>
            <input
              type="number"
              step="0.5"
              value={inputDelta}
              onChange={(e) => setInputDelta(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 font-bold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">계산 결과</label>
            <div className="w-full rounded-lg border border-amber-500/40 bg-amber-950/30 px-2 py-1.5 font-black text-amber-300 tabular-nums text-center">
              {calculatedSouthLat !== null
                ? calculatedSouthLat >= 0
                  ? `${calculatedSouthLat.toFixed(1)}°S`
                  : `${Math.abs(calculatedSouthLat).toFixed(1)}°N`
                : '-'}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          * 15~30턴 음수 적위는 &ldquo;빼기 음수 → 더해짐&rdquo; (예: 90 − h − (−23.5) = 90 − h + 23.5)
        </p>
      </section>

      {/* 30-Turn Solar Declination Reference Table */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2.5">
          <Eye className="w-4 h-4 text-amber-400" />
          30턴 태양 적위(δ) 보정표
        </h3>
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          {TURN_CALENDAR.map((item) => {
            const isCurrent = item.turn === currentTurn;
            return (
              <div
                key={item.turn}
                className={`flex items-center justify-between rounded-lg border px-2 py-1.5 tabular-nums ${
                  isCurrent
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 font-bold'
                    : 'bg-slate-950/60 border-slate-800/90 text-slate-300'
                }`}
              >
                <span>
                  {item.turn}턴({item.shortLabel})
                </span>
                <span className={item.declination >= 0 ? 'text-sky-300' : 'text-rose-300'}>
                  {item.declination > 0
                    ? `+${item.declination.toFixed(1)}°`
                    : `${item.declination.toFixed(1)}°`}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
