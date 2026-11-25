import React, { useState } from 'react';
import {
  Lock,
  LogOut,
  Monitor,
  Settings,
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
      <section className="rounded-2xl border border-amber-500/25 bg-slate-900/95 p-3.5 shadow-lg space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
            <Settings className="w-4 h-4" />
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
          <span className="text-slate-300">연습용 라이벌/해적 선단 활성화</span>
          <input
            type="checkbox"
            checked={showDemoRivals}
            onChange={onToggleDemoRivals}
            className="accent-amber-500 w-4 h-4"
          />
        </label>
      </section>
    </div>
  );
}
