import React, { useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { LAND_POLYGONS } from '../data/worldCoastlines.js';
import { PORTS, getPortById } from '../data/ports.js';
import { getMissionById } from '../data/missions.js';

const BASE_X = -170;
const BASE_Y = -75;
const BASE_W = 340;
const BASE_H = 140;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
// Event A4 chart region center (85°W ~ 30°E => cx -27.5, 50°N ~ 40°S => cy -5) at 2.4x zoom
const A4_EVENT_VIEW = { zoom: 2.35, cx: -27.5, cy: -5 };

function formatCoord(lat, lon) {
  const latStr = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const lonStr = lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return `${latStr}, ${lonStr}`;
}

function clampView(zoom, cx, cy) {
  const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const vw = BASE_W / z;
  const vh = BASE_H / z;
  const minCx = BASE_X + vw / 2;
  const maxCx = BASE_X + BASE_W - vw / 2;
  const minCy = BASE_Y + vh / 2;
  const maxCy = BASE_Y + BASE_H - vh / 2;
  return {
    zoom: z,
    cx: Math.max(minCx, Math.min(maxCx, cx)),
    cy: Math.max(minCy, Math.min(maxCy, cy)),
  };
}

/**
 * Split trail into continuous SVG polyline segments so crossing ±180° doesn't draw a line across the map.
 */
function buildTrailSegments(trail) {
  if (!trail || trail.length === 0) return [];
  const segments = [];
  let current = [trail[0]];

  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1];
    const curr = trail[i];
    if (Math.abs(curr.lon - prev.lon) > 180) {
      segments.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  segments.push(current);
  return segments;
}

export default function VoyageTrailMap({
  state,
  title,
  coordLabel = '최종 위치',
  defaultExpanded = false,
}) {
  const mission = getMissionById(state?.missionId);
  const isA4Event = mission?.chartDegPerCm === 5;
  const resolvedTitle =
    title || (isA4Event ? '내 항해 경로 vs A4 행사 항해도 비교' : '내 항해 경로 vs B4 항해도 비교');
  const [isFullscreen, setIsFullscreen] = useState(defaultExpanded);
  const trail = state?.trail || [];
  const lastPoint = trail[trail.length - 1] || {
    lat: state?.lat ?? 38.7,
    lon: state?.lon ?? -9.1,
  };

  const [view, setView] = useState(() =>
    isA4Event ? clampView(A4_EVENT_VIEW.zoom, A4_EVENT_VIEW.cx, A4_EVENT_VIEW.cy) : clampView(1, 0, -5),
  );
  const dragRef = useRef(null);

  const segments = useMemo(() => buildTrailSegments(trail), [trail]);
  const visitedNames = useMemo(
    () =>
      (state?.visitedPorts || [])
        .map((id) => getPortById(id)?.name)
        .filter(Boolean),
    [state?.visitedPorts],
  );

  const isSuccess = state?.status === 'returned';

  const zoomAt = (factor, targetCx = view.cx, targetCy = view.cy) => {
    setView((prev) => clampView(prev.zoom * factor, targetCx, targetCy));
  };

  const focusShip = (targetZoom = 3.2) => {
    setView(clampView(Math.max(view.zoom, targetZoom), lastPoint.lon, -lastPoint.lat));
  };

  const resetView = () => {
    setView(clampView(1, 0, -5));
  };

  const vw = BASE_W / view.zoom;
  const vh = BASE_H / view.zoom;
  const vx = view.cx - vw / 2;
  const vy = view.cy - vh / 2;
  const scaleInv = 1 / Math.sqrt(view.zoom);

  const handlePointerDown = (e) => {
    if (view.zoom <= 1 && !isFullscreen) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      rectW: rect.width || 1,
      rectH: rect.height || 1,
      origCx: view.cx,
      origCy: view.cy,
    };
  };

  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    const dxWorld = (dxPx / d.rectW) * vw;
    const dyWorld = (dyPx / d.rectH) * vh;
    setView((prev) => clampView(prev.zoom, d.origCx - dxWorld, d.origCy - dyWorld));
  };

  const handlePointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.3 : 1 / 1.3;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / (rect.height || 1)));
    const focusX = vx + relX * vw;
    const focusY = vy + relY * vh;
    setView((prev) => {
      const nextZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
      const nextVw = BASE_W / nextZ;
      const nextVh = BASE_H / nextZ;
      const nextCx = focusX - (relX - 0.5) * nextVw;
      const nextCy = focusY - (relY - 0.5) * nextVh;
      return clampView(nextZ, nextCx, nextCy);
    });
  };

  const renderChartBody = (fullscreenMode) => (
    <div className="rounded-xl border border-amber-500/35 bg-slate-950/95 overflow-hidden flex flex-col">
      {/* Header Toolbar with Zoom & Focus Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-2 border-b border-slate-800 bg-slate-900/95">
        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 min-w-0 truncate">
          <MapIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{resolvedTitle}</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => focusShip(3.2)}
            title="내 배 위치 중심으로 확대"
            className="inline-flex items-center gap-1 rounded-md border border-sky-500/45 bg-sky-500/15 hover:bg-sky-500/25 px-2 py-1 text-[10px] font-bold text-sky-200 cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            <span>내 배 확대</span>
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1.45)}
            disabled={view.zoom >= MAX_ZOOM - 0.05}
            title="지도 확대"
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-1 text-slate-200 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1 / 1.45)}
            disabled={view.zoom <= MIN_ZOOM + 0.01}
            title="지도 축소"
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-1 text-slate-200 cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          {view.zoom > 1.05 && (
            <button
              type="button"
              onClick={resetView}
              title="전체 지도 보기"
              className="inline-flex items-center gap-0.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 px-1.5 py-1 text-[10px] font-bold text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>전체</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={fullscreenMode ? '닫기' : '큰 화면으로 보기'}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-1 text-[10px] font-bold text-amber-200 cursor-pointer"
          >
            {fullscreenMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span>{fullscreenMode ? '축소' : '큰 화면'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Zoomable & Pannable B4 Chart SVG */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={`relative w-full bg-[#e8f1f5] select-none ${
          fullscreenMode ? 'h-[64dvh] min-h-[300px]' : 'aspect-[340/155]'
        } ${view.zoom > 1 ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
      >
        <svg
          viewBox={`${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`}
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 10° Square Grid (1.0 cm) */}
          {Array.from({ length: 35 }).map((_, i) => {
            const lon = -170 + i * 10;
            return (
              <g key={`lon-${lon}`}>
                <line
                  x1={lon}
                  y1={-75}
                  x2={lon}
                  y2={65}
                  stroke={lon === 0 ? '#94a3b8' : '#cbd5e1'}
                  strokeWidth={(lon === 0 ? 0.6 : 0.25) * scaleInv}
                />
                {(lon % 60 === 0 || (view.zoom >= 2.2 && lon % 20 === 0)) && (
                  <text
                    x={lon + 0.8 * scaleInv}
                    y={63}
                    fontSize={3.2 * scaleInv}
                    fontWeight="700"
                    fill="#64748b"
                  >
                    {lon === 0 ? '0°' : lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`}
                  </text>
                )}
              </g>
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
                  strokeWidth={(lat === 0 ? 0.65 : 0.25) * scaleInv}
                />
                {(lat % 20 === 0 || view.zoom >= 2.2) && (
                  <text
                    x={-168}
                    y={y - 1.0 * scaleInv}
                    fontSize={3.2 * scaleInv}
                    fontWeight="700"
                    fill={lat === 0 ? '#dc2626' : '#64748b'}
                  >
                    {lat === 0 ? '0° 적도' : lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`}
                  </text>
                )}
              </g>
            );
          })}

          {/* Continents */}
          {LAND_POLYGONS.map((poly, idx) => {
            const pts = poly.ring.map(([lon, lat]) => `${lon},${-lat}`).join(' ');
            return (
              <polygon
                key={`land-${idx}`}
                points={pts}
                fill="#d6c198"
                stroke="#8c734b"
                strokeWidth={0.45 * scaleInv}
              />
            );
          })}

          {/* Ports */}
          {PORTS.map((port) => {
            const isStar = port.isHomePort || port.isGoalPort;
            return (
              <g key={port.id} transform={`translate(${port.lon}, ${-port.lat})`}>
                <circle
                  r={(isStar ? 2.0 : 1.3) * scaleInv}
                  fill={isStar ? '#dc2626' : '#1d4ed8'}
                  stroke="#ffffff"
                  strokeWidth={0.35 * scaleInv}
                />
                <text
                  x={2.1 * scaleInv}
                  y={1.0 * scaleInv}
                  fontSize={3.1 * scaleInv}
                  fontWeight="700"
                  fill="#1e293b"
                >
                  {port.name}
                </text>
              </g>
            );
          })}

          {/* Student Voyage Polyline Segments */}
          {segments.map((seg, sIdx) => {
            const pts = seg.map((pt) => `${pt.lon},${-pt.lat}`).join(' ');
            return (
              <polyline
                key={`seg-${sIdx}`}
                points={pts}
                fill="none"
                stroke="#e11d48"
                strokeWidth={1.55 * scaleInv}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Turn Waypoint Markers */}
          {trail.map((pt, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === trail.length - 1;
            const showLabel =
              !isFirst && !isLast && (view.zoom >= 2.0 || idx % 3 === 0 || trail.length <= 10);
            return (
              <g key={`wp-${idx}`} transform={`translate(${pt.lon}, ${-pt.lat})`}>
                <circle
                  r={(isFirst || isLast ? 2.3 : 1.15) * scaleInv}
                  fill={
                    isFirst ? '#10b981' : isLast ? (isSuccess ? '#10b981' : '#f43f5e') : '#f59e0b'
                  }
                  stroke="#ffffff"
                  strokeWidth={0.45 * scaleInv}
                />
                {showLabel && (
                  <text
                    x={1.7 * scaleInv}
                    y={-1.4 * scaleInv}
                    fontSize={3.0 * scaleInv}
                    fontWeight="800"
                    fill="#9f1239"
                    stroke="#ffffff"
                    strokeWidth={0.5 * scaleInv}
                    paintOrder="stroke"
                  >
                    {pt.turn}
                  </text>
                )}
              </g>
            );
          })}

          {/* Final Location Ping */}
          <g transform={`translate(${lastPoint.lon}, ${-lastPoint.lat})`}>
            <circle
              r={4.2 * scaleInv}
              fill="none"
              stroke={isSuccess ? '#10b981' : '#e11d48'}
              strokeWidth={0.75 * scaleInv}
              strokeDasharray={`${1.5 * scaleInv} ${1.2 * scaleInv}`}
            />
          </g>
        </svg>

        {/* Bottom-right live zoom badge */}
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-slate-950/75 border border-slate-700/70 px-1.5 py-0.5 text-[10px] font-bold text-slate-200 tabular-nums">
          {view.zoom.toFixed(1)}x {view.zoom > 1 ? '· 드래그 이동' : '· [+]/내 배 확대'}
        </div>
      </div>

      {/* Route Summary Footer */}
      <div className="px-3 py-2 text-[11px] text-slate-300 space-y-1 bg-slate-950/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-sky-300 font-bold tabular-nums">
            <Compass className="w-3.5 h-3.5" />
            {coordLabel}: {formatCoord(lastPoint.lat, lastPoint.lon)}
          </span>
          <span className="text-slate-400">총 {Math.max(0, trail.length - 1)}회 이동 기록</span>
        </div>
        {visitedNames.length > 0 && (
          <div className="text-[10px] text-emerald-300/90">
            방문 기항지: {visitedNames.join(' → ')}
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        {renderChartBody(false)}
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/92 backdrop-blur-sm p-3">
          <div className="w-full max-w-4xl space-y-2">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>확대 창 닫기</span>
              </button>
            </div>
            {renderChartBody(true)}
          </div>
        </div>
      </>
    );
  }

  return renderChartBody(false);
}
