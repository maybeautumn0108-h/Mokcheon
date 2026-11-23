import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FastForward,
  Layers,
  Monitor,
  Play,
  Plus,
  RotateCcw,
  Ship,
  Trash2,
  UserX,
} from 'lucide-react';
import { LAND_POLYGONS } from '../data/worldCoastlines.js';
import { PORTS } from '../data/ports.js';
import { isFleetOffline } from '../engine/fleetSync.js';

const FLEET_COLORS = ['#ef4444', '#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export default function TeacherModeView({
  activeRoomCode,
  allRooms,
  allFleetsByRoom,
  onBackToStudent,
  onCreateBatchRooms,
  onBatchStartWaiting,
  onStartRoom,
  onForceOpenActivityRoom,
  onForceNextTurnRoom,
  onResetRoom,
  onKickFleet,
  onDeleteRoom,
}) {
  const [hideMap, setHideMap] = useState(false);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL');
  const [newRoomsInput, setNewRoomsInput] = useState('');

  // Ensure activeRoomCode is always included even if rooms list is loading
  const roomsList = useMemo(() => {
    const map = new Map();
    for (const r of allRooms || []) {
      map.set(r.roomCode, r);
    }
    if (activeRoomCode && !map.has(activeRoomCode)) {
      map.set(activeRoomCode, {
        roomCode: activeRoomCode,
        phase: 'waiting',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
    }
    // Also include any rooms that have fleets in allFleetsByRoom
    for (const rc of Object.keys(allFleetsByRoom || {})) {
      if (!map.has(rc)) {
        map.set(rc, {
          roomCode: rc,
          phase: 'waiting',
          currentTurn: 1,
          turnPhase: 'sail_card',
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.roomCode.localeCompare(b.roomCode, 'ko'),
    );
  }, [allRooms, allFleetsByRoom, activeRoomCode]);

  const mapFleets = useMemo(() => {
    const list = [];
    for (const r of roomsList) {
      if (selectedRoomFilter !== 'ALL' && r.roomCode !== selectedRoomFilter) continue;
      const roomMap = allFleetsByRoom?.[r.roomCode] || {};
      for (const f of Object.values(roomMap)) {
        list.push({ ...f, roomCode: r.roomCode });
      }
    }
    return list;
  }, [roomsList, allFleetsByRoom, selectedRoomFilter]);

  const totalOnlineCount = useMemo(() => {
    let count = 0;
    for (const r of roomsList) {
      const roomMap = allFleetsByRoom?.[r.roomCode] || {};
      for (const f of Object.values(roomMap)) {
        if (!isFleetOffline(f)) count += 1;
      }
    }
    return count;
  }, [roomsList, allFleetsByRoom]);

  const waitingRoomsCount = roomsList.filter((r) => r.phase === 'waiting').length;

  const handleAddRoomsSubmit = (e) => {
    e.preventDefault();
    const codes = newRoomsInput
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length === 0) return;
    onCreateBatchRooms(codes);
    setNewRoomsInput('');
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-3 sm:p-5">
      <div className="max-w-7xl mx-auto space-y-4">
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
                교사용 다중 게임방 통합 관제
              </h1>
              <div className="text-xs text-slate-400">
                활성 게임방 <strong className="text-slate-200">{roomsList.length}개</strong> · 접속 중인
                선단 총 <strong className="text-sky-300">{totalOnlineCount}척</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {waitingRoomsCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  onBatchStartWaiting(
                    roomsList.filter((r) => r.phase === 'waiting').map((r) => r.roomCode),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-black text-slate-950 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                대기 중인 방 모두 출항 ({waitingRoomsCount}개)
              </button>
            )}

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
              <span>{hideMap ? '지도 전체 공개' : '지도 가리기'}</span>
            </button>
          </div>
        </header>

        {/* Batch Room Creation Bar */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleAddRoomsSubmit} className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            <Layers className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={newRoomsInput}
              onChange={(e) => setNewRoomsInput(e.target.value)}
              placeholder="새 게임방 코드 (쉼표로 여러 개 입력: 1조, 2조, 3조)"
              className="flex-1 min-w-[200px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              방 추가
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-400 mr-1">빠른 조별 방 생성:</span>
            {[3, 4, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() =>
                  onCreateBatchRooms(Array.from({ length: n }, (_, i) => `${i + 1}조`))
                }
                className="rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 px-2.5 py-1 text-[11px] font-bold text-sky-200 cursor-pointer"
              >
                1~{n}조 일괄 생성
              </button>
            ))}
          </div>
        </section>

        {/* Multi-Room Management Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roomsList.map((room) => {
            const roomFleets = Object.values(allFleetsByRoom?.[room.roomCode] || {});
            const onlineFleets = roomFleets.filter((f) => !isFleetOffline(f));
            const currentTurn = room.currentTurn ?? 1;
            const phase = room.phase ?? 'waiting';
            const turnPhase = room.turnPhase ?? 'sail_card';

            const cardsReadyCount = onlineFleets.filter(
              (f) =>
                f.status !== 'active' ||
                (f.cardCompletedTurn ?? 0) >= currentTurn ||
                (f.completedTurn ?? 0) >= currentTurn,
            ).length;
            const readyCount = onlineFleets.filter(
              (f) => f.status !== 'active' || (f.completedTurn ?? 0) >= currentTurn,
            ).length;

            const isFocusedOnMap = selectedRoomFilter === room.roomCode;

            return (
              <div
                key={room.roomCode}
                className={`rounded-2xl border p-3.5 space-y-2.5 shadow-lg ${
                  isFocusedOnMap
                    ? 'border-amber-400 bg-slate-900'
                    : 'border-slate-800 bg-slate-900/90'
                }`}
              >
                {/* Room Card Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-sm font-black text-amber-300">
                      {room.roomCode}
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      {onlineFleets.length}명 접속
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      phase === 'waiting'
                        ? 'border-slate-600 bg-slate-800 text-slate-300'
                        : phase === 'finished'
                          ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                          : turnPhase === 'sail_card'
                            ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                            : 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {phase === 'waiting'
                      ? '대기실'
                      : phase === 'finished'
                        ? '종료'
                        : turnPhase === 'sail_card'
                          ? `${currentTurn}턴 항해·카드 (${cardsReadyCount}/${onlineFleets.length})`
                          : `${currentTurn}턴 주변활동 (${readyCount}/${onlineFleets.length})`}
                  </span>
                </div>

                {/* Members Inside This Room */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 space-y-1.5 max-h-40 overflow-y-auto">
                  {roomFleets.length === 0 ? (
                    <div className="text-[11px] text-slate-500">아직 접속한 학생이 없습니다.</div>
                  ) : (
                    roomFleets.map((f) => {
                      const offline = isFleetOffline(f);
                      const isDone =
                        f.status !== 'active' ||
                        (turnPhase === 'sail_card'
                          ? (f.cardCompletedTurn ?? 0) >= currentTurn ||
                            (f.completedTurn ?? 0) >= currentTurn
                          : (f.completedTurn ?? 0) >= currentTurn);

                      return (
                        <div
                          key={f.clientId}
                          className={`flex items-center justify-between gap-2 text-xs ${
                            offline ? 'opacity-50' : ''
                          }`}
                        >
                          <span className="font-bold text-slate-200 truncate">
                            {f.teamName}
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({f.gold}G · 식량{f.food})
                            </span>
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {offline ? (
                              <span className="text-[10px] text-rose-300 font-bold">이탈</span>
                            ) : phase === 'playing' ? (
                              isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                              )
                            ) : (
                              <span className="text-[10px] text-emerald-300">대기</span>
                            )}
                            <button
                              type="button"
                              onClick={() => onKickFleet(room.roomCode, f.clientId)}
                              title="방에서 제외"
                              className="rounded p-0.5 text-slate-500 hover:text-rose-300 cursor-pointer"
                            >
                              <UserX className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Per-Room Action Controls */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {phase === 'waiting' && (
                    <button
                      type="button"
                      onClick={() => onStartRoom(room.roomCode)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1.5 text-[11px] font-black text-slate-950 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      출항 시작
                    </button>
                  )}

                  {phase === 'playing' && turnPhase === 'sail_card' && (
                    <button
                      type="button"
                      onClick={() => onForceOpenActivityRoom(room.roomCode)}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 px-2 py-1.5 text-[11px] font-bold text-sky-200 cursor-pointer"
                    >
                      <FastForward className="w-3 h-3" />
                      3단계 열기
                    </button>
                  )}

                  {phase === 'playing' && (
                    <button
                      type="button"
                      onClick={() => onForceNextTurnRoom(room.roomCode, currentTurn)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1.5 text-[11px] font-bold text-amber-200 cursor-pointer"
                    >
                      <FastForward className="w-3 h-3" />
                      다음 턴
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRoomFilter((cur) =>
                        cur === room.roomCode ? 'ALL' : room.roomCode,
                      )
                    }
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold cursor-pointer ${
                      isFocusedOnMap
                        ? 'border-amber-400 bg-amber-500 text-slate-950'
                        : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Ship className="w-3 h-3" />
                    {isFocusedOnMap ? '지도 선택됨' : '지도 보기'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onResetRoom(room.roomCode)}
                    title="대기방으로 리셋"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 text-[11px] font-bold text-slate-300 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    리셋
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRoom(room.roomCode)}
                    title="이 방 삭제"
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/30 hover:bg-rose-950/60 px-2 py-1.5 text-[11px] font-bold text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* World Square-Grid Map (Filterable by All Rooms or Specific Room) */}
        <section className="relative rounded-2xl border border-amber-500/30 bg-[#f6edd9] overflow-hidden shadow-2xl">
          <div className="bg-slate-900/95 text-xs text-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-amber-300 mr-2">관제 지도 표시:</span>
              <button
                type="button"
                onClick={() => setSelectedRoomFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  selectedRoomFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                전체 방 보기
              </button>
              {roomsList.map((r) => (
                <button
                  key={r.roomCode}
                  type="button"
                  onClick={() => setSelectedRoomFilter(r.roomCode)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                    selectedRoomFilter === r.roomCode
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {r.roomCode}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400">10° 격자 = 1.0 cm</span>
          </div>

          <div className="relative w-full aspect-[340/140]">
            <svg viewBox="-170 -75 340 140" className="w-full h-full block bg-[#e8f1f5]">
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
                    <text x="2.4" y="1" fontSize="3.5" fontWeight="700" fill="#1e293b">
                      {port.name}
                    </text>
                  </g>
                );
              })}

              {mapFleets.map((fleet, idx) => {
                const color = FLEET_COLORS[idx % FLEET_COLORS.length];
                const trailPts = (fleet.trail || [])
                  .map((pt) => `${pt.lon},${-pt.lat}`)
                  .join(' ');
                const offline = isFleetOffline(fleet);
                return (
                  <g key={`${fleet.roomCode}-${fleet.clientId}`} opacity={offline ? 0.35 : 1}>
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
                        fontSize="3.6"
                        fontWeight="800"
                        fill="#0f172a"
                        stroke="#ffffff"
                        strokeWidth="0.6"
                        paintOrder="stroke"
                      >
                        {selectedRoomFilter === 'ALL'
                          ? `[${fleet.roomCode}] ${fleet.teamName}`
                          : fleet.teamName}
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
                  상단의 <strong>[지도 전체 공개]</strong> 버튼으로 언제든 다시 볼 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
