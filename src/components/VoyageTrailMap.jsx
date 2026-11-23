import React, { useMemo, useState } from 'react';
import { Compass, Map, Maximize2, Minimize2 } from 'lucide-react';
import { LAND_POLYGONS } from '../data/worldCoastlines.js';
import { PORTS, getPortById } from '../data/ports.js';

function formatCoord(lat, lon) {
  const latStr = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const lonStr = lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return `${latStr}, ${lonStr}`;
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

export default function VoyageTrailMap({ state }) {
  const [expanded, setExpanded] = useState(false);

  const trail = state?.trail || [];
  const segments = useMemo(() => buildTrailSegments(trail), [trail]);
  const visitedNames = useMemo(
    () =>
      (state?.visitedPorts || [])
        .map((id) => getPortById(id)?.name)
        .filter(Boolean),
    [state?.visitedPorts],
  );

  const isSuccess = state?.status === 'returned';
  const lastPoint = trail[trail.length - 1] || { lat: state?.lat ?? 38.7, lon: state?.lon ?? -9.1 };

  return (
    <div className="rounded-xl border border-amber-500/35 bg-slate-950/90 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/90">
        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
          <Map className="w-3.5 h-3.5" />
          내 항해 경로 vs B4 항해도 비교
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-200 cursor-pointer"
        >
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          <span>{expanded ? '축소' : '크게 보기'}</span>
        </button>
      </div>

      {/* B4 Square-Grid Chart SVG */}
      <div className={`relative w-full bg-[#e8f1f5] ${expanded ? 'aspect-[340/170]' : 'aspect-[340/140]'}`}>
        <svg viewBox="-170 -75 340 140" className="w-full h-full block">
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
                  strokeWidth={lon === 0 ? 0.6 : 0.25}
                />
                {lon % 60 === 0 && (
                  <text
                    x={lon + 1}
                    y={63}
                    fontSize="3.2"
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
                  strokeWidth={lat === 0 ? 0.65 : 0.25}
                />
                {lat % 20 === 0 && (
                  <text
                    x={-168}
                    y={y - 1.2}
                    fontSize="3.2"
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
                  r={isStar ? 2.0 : 1.3}
                  fill={isStar ? '#dc2626' : '#1d4ed8'}
                  stroke="#ffffff"
                  strokeWidth="0.35"
                />
                <text x="2.2" y="1" fontSize="3.2" fontWeight="700" fill="#334155">
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
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Turn Waypoint Markers */}
          {trail.map((pt, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === trail.length - 1;
            return (
              <g key={`wp-${idx}`} transform={`translate(${pt.lon}, ${-pt.lat})`}>
                <circle
                  r={isFirst || isLast ? 2.3 : 1.15}
                  fill={isFirst ? '#10b981' : isLast ? (isSuccess ? '#10b981' : '#f43f5e') : '#f59e0b'}
                  stroke="#ffffff"
                  strokeWidth="0.45"
                />
                {!isFirst && !isLast && (idx % 3 === 0 || trail.length <= 10) && (
                  <text
                    x="1.8"
                    y="-1.5"
                    fontSize="3.0"
                    fontWeight="800"
                    fill="#9f1239"
                    stroke="#ffffff"
                    strokeWidth="0.5"
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
              r="4.2"
              fill="none"
              stroke={isSuccess ? '#10b981' : '#e11d48'}
              strokeWidth="0.7"
              strokeDasharray="1.5 1.2"
            />
          </g>
        </svg>
      </div>

      {/* Route Summary Footer */}
      <div className="px-3 py-2 text-[11px] text-slate-300 space-y-1 bg-slate-950/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-sky-300 font-bold tabular-nums">
            <Compass className="w-3.5 h-3.5" />
            최종 위치: {formatCoord(lastPoint.lat, lastPoint.lon)}
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
}
