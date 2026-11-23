import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  LogOut,
  Monitor,
  Radio,
  Ship,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';

const TEACHER_PIN = (import.meta.env?.VITE_TEACHER_PIN || '1492').trim();

export default function FleetTab({
  roomCode,
  roomMeta,
  playMode,
  onChangeRoomCode,
  teamName,
  onChangeTeamName,
  showDemoRivals,
  onToggleDemoRivals,
  allFleets,
  nearbyFleets,
  myClientId,
  isOnlineSync,
  onLeaveToLobby,
  onOpenTeacherMode,
}) {
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.trim() === TEACHER_PIN) {
      setShowPinPrompt(false);
      setPinInput('');
      setPinError(false);
      onOpenTeacherMode();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="space-y-3">
      {/* Room & Team Setup */}
      <section className="rounded-2xl border border-amber-500/25 bg-slate-900/95 p-3.5 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            수업방 접속 & 선단 설정
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowPinPrompt((v) => !v);
              setPinError(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/15 hover:bg-sky-500/25 px-2.5 py-1 text-[11px] font-black text-sky-200 transition cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            교사용 모드
          </button>
        </div>

        {/* Online Sync Indicator */}
        <div
          className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
            playMode === 'solo'
              ? 'border-slate-700/80 bg-slate-950/60 text-slate-300'
              : isOnlineSync
                ? 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
                : 'border-slate-700/80 bg-slate-950/60 text-slate-400'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {isOnlineSync && playMode === 'online' ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
            )}
            {playMode === 'solo'
              ? '혼자 연습 모드 (동시 턴 대기 없음)'
              : isOnlineSync
                ? `동시 턴 온라인 연동 (제${roomMeta?.currentTurn ?? 1}턴)`
                : '로컬 모드 (동일 브라우저 탭 간 연동)'}
          </span>
          <button
            type="button"
            onClick={onLeaveToLobby}
            className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            대기실
          </button>
        </div>

        {/* Teacher PIN Prompt */}
        {showPinPrompt && (
          <form
            onSubmit={handlePinSubmit}
            className="rounded-xl border border-sky-500/40 bg-slate-950/90 p-3 space-y-2"
          >
            <div className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-sky-400" />
              교사 전용 관제 비밀번호 입력
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="비밀번호 4자리"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-sky-500 hover:bg-sky-400 px-3 py-1.5 text-xs font-black text-slate-950 cursor-pointer"
              >
                입장
              </button>
            </div>
            {pinError && (
              <div className="text-[11px] text-rose-300">
                비밀번호가 일치하지 않습니다.
              </div>
            )}
          </form>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">수업방 코드</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => onChangeRoomCode(e.target.value.toUpperCase())}
              placeholder="HIST-101"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-bold text-slate-100 uppercase"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">내 조 / 선단명</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => onChangeTeamName(e.target.value)}
              placeholder="1조 콜럼버스"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-bold text-slate-100"
            />
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs cursor-pointer">
          <span className="text-slate-300">데모 경쟁 선단(2·3조) 함께 보기</span>
          <input
            type="checkbox"
            checked={showDemoRivals}
            onChange={onToggleDemoRivals}
            className="accent-amber-500 w-4 h-4"
          />
        </label>
      </section>

      {/* Nearby Radar (<= 2.5 cm / 25°) */}
      <section className="rounded-2xl border border-sky-500/30 bg-slate-900/90 p-3.5">
        <h3 className="text-xs font-bold text-sky-300 flex items-center gap-1.5 mb-2">
          <Radio className="w-4 h-4" />
          근접 선단 레이더 (반경 2.5 cm / 25° 이내)
        </h3>
        {nearbyFleets.length === 0 ? (
          <div className="text-xs text-slate-400">
            현재 반경 2.5 cm 이내에 포착된 다른 선단이 없습니다.
          </div>
        ) : (
          <div className="space-y-1.5">
            {nearbyFleets.map((peer) => (
              <div
                key={peer.clientId}
                className="flex items-center justify-between rounded-xl border border-sky-500/35 bg-sky-950/40 px-3 py-2 text-xs"
              >
                <span className="font-bold text-sky-200">{peer.teamName}</span>
                <span className="text-sky-300 font-semibold tabular-nums">
                  {peer.sectorLabel} · {peer.distCm.toFixed(1)} cm
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live Class Race Feed (No coordinates leaked to students!) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2.5">
          <Ship className="w-4 h-4 text-amber-400" />
          학급 전체 선단 레이스 피드 ({allFleets.length}척)
        </h3>
        <div className="space-y-2">
          {allFleets.map((fleet) => {
            const isMe = fleet.clientId === myClientId;
            const currentTurn = roomMeta?.currentTurn ?? 1;
            const isDone =
              fleet.status !== 'active' || (fleet.completedTurn ?? 0) >= currentTurn;
            return (
              <div
                key={fleet.clientId}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isMe
                    ? 'border-amber-400/50 bg-amber-500/10'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-100">
                    {fleet.teamName} {isMe && <span className="text-amber-300">(나)</span>}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {playMode === 'online' && !fleet.isDemo && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            완료
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            진행중
                          </>
                        )}
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-amber-300 tabular-nums">
                      {fleet.turn}/30턴 · {fleet.gold}G
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>{fleet.lastEvent || '항해 중'}</span>
                  <span className="tabular-nums">
                    특산품 {fleet.cargoCount || 0}종 · 식량 {fleet.food}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
