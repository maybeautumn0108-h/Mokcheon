import React, { useState } from 'react';
import {
  Anchor,
  Compass,
  Crown,
  Lock,
  LogOut,
  Monitor,
  Play,
  Ship,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';

const TEACHER_PIN = (import.meta.env?.VITE_TEACHER_PIN || '1492').trim();

export default function LobbyView({
  roomCode,
  onChangeRoomCode,
  teamName,
  onChangeTeamName,
  joinedRoom,
  roomMeta,
  realFleets,
  myClientId,
  isOnlineSync,
  onJoinOnlineRoom,
  onJoinAsTeacherHost,
  onStartSoloPractice,
  onLeaveRoom,
  onHostStartVoyage,
  onKickFleet,
  onOpenTeacherMode,
}) {
  const [showPinBox, setShowPinBox] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const isHost = roomMeta?.hostClientId === myClientId;

  const handleTeacherPinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.trim() === TEACHER_PIN) {
      setShowPinBox(false);
      setPinInput('');
      setPinError(false);
      onJoinAsTeacherHost();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex justify-center">
      <div className="w-full max-w-md min-h-dvh flex flex-col justify-between bg-slate-950 border-x border-slate-900 px-4 py-6 shadow-2xl">
        <div className="space-y-4">
          {/* Header Banner */}
          <header className="rounded-2xl border border-amber-500/35 bg-gradient-to-b from-slate-900 to-slate-950 p-4 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 mb-2">
              <Compass className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-black text-amber-300">
              대항해시대 항해 시뮬레이터
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              향료제도를 찾아서 · B4 항해도 &amp; 동시 턴 학급 시뮬레이션
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-[11px] font-semibold">
              {isOnlineSync ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Supabase 실시간 온라인 연결 준비됨</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">로컬 브라우저 모드</span>
                </>
              )}
            </div>
          </header>

          {!joinedRoom ? (
            /* Step 1: Room & Team Entry */
            <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3.5 shadow-lg">
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    수업방 코드
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => onChangeRoomCode(e.target.value.toUpperCase())}
                    placeholder="예: HIST-101"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-black text-amber-300 uppercase tracking-wide"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    우리 조 / 선단 이름
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => onChangeTeamName(e.target.value)}
                    placeholder="예: 1조 콜럼버스"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-bold text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={onJoinOnlineRoom}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] py-3 text-sm font-black text-slate-950 shadow-lg transition cursor-pointer"
              >
                <Users className="w-4 h-4" />
                접속 대기방 입장하기
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinBox((v) => !v);
                    setPinError(false);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 py-2.5 text-xs font-bold text-sky-200 transition cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  교사(방장) 입장
                </button>

                <button
                  type="button"
                  onClick={onStartSoloPractice}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  <Anchor className="w-3.5 h-3.5" />
                  혼자 연습하기
                </button>
              </div>

              {showPinBox && (
                <form
                  onSubmit={handleTeacherPinSubmit}
                  className="rounded-xl border border-sky-500/40 bg-slate-950/90 p-3 space-y-2"
                >
                  <div className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-sky-400" />
                    교사(방장) 비밀번호 입력
                  </div>
                  <div className="flex gap-2">
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
                      확인
                    </button>
                  </div>
                  {pinError && (
                    <div className="text-[11px] text-rose-300">
                      비밀번호가 일치하지 않습니다.
                    </div>
                  )}
                </form>
              )}
            </section>
          ) : (
            /* Step 2: Synchronized Waiting Room */
            <section className="rounded-2xl border border-amber-500/35 bg-slate-900/95 p-4 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] text-slate-400">수업방 대기실</div>
                  <h2 className="text-base font-black text-amber-300 flex items-center gap-1.5">
                    <span>방 코드: {roomCode}</span>
                    {isHost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 text-[10px] text-amber-200">
                        <Crown className="w-3 h-3" />
                        방장
                      </span>
                    )}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  나가기
                </button>
              </div>

              {/* Joined Teams List */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Ship className="w-4 h-4 text-sky-400" />
                    접속 중인 선단 ({realFleets.length}팀)
                  </span>
                  <span className="text-[11px] text-emerald-300">리스본 항구 집결 중</span>
                </div>

                {realFleets.length === 0 ? (
                  <div className="text-xs text-slate-500 py-2">
                    참가자 정보를 불러오는 중...
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {realFleets.map((f) => {
                      const isMe = f.clientId === myClientId;
                      const isFleetHost = roomMeta?.hostClientId === f.clientId;
                      return (
                        <div
                          key={f.clientId}
                          className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs ${
                            isMe
                              ? 'border-amber-400/50 bg-amber-500/10 text-amber-100'
                              : 'border-slate-800 bg-slate-900/70 text-slate-200'
                          }`}
                        >
                          <span className="font-bold flex items-center gap-1.5">
                            {f.teamName}
                            {isMe && <span className="text-[10px] text-amber-300">(나)</span>}
                            {isFleetHost && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/20 border border-sky-400/40 px-1.5 py-0.5 text-[9px] font-black text-sky-200">
                                방장
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-emerald-300 font-semibold">
                              출항 준비 완료
                            </span>
                            {isHost && !isMe && onKickFleet && (
                              <button
                                type="button"
                                onClick={() => onKickFleet(f.clientId)}
                                title="목록에서 제외"
                                className="rounded p-1 text-slate-400 hover:text-rose-300 hover:bg-rose-950/50 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isHost ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onHostStartVoyage}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] py-3 text-sm font-black text-slate-950 shadow-lg transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    전원 출항 시작! (제1턴 개시)
                  </button>
                  <button
                    type="button"
                    onClick={onOpenTeacherMode}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 py-2.5 text-xs font-black text-sky-200 transition cursor-pointer"
                  >
                    <Monitor className="w-4 h-4" />
                    교사용 세계 지도 관전 화면 열기
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-center space-y-1">
                  <div className="text-xs font-black text-amber-300 animate-pulse">
                    방장이 항해를 시작하기를 기다리는 중...
                  </div>
                  <p className="text-[11px] text-slate-300">
                    모든 조가 대기방에 모이면 방장이 제1턴 출항을 시작합니다.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="text-center text-[11px] text-slate-500 pt-4">
          동시 턴 진행 모드: 매 턴 모든 선단이 턴을 마쳐야 다음 턴으로 넘어갑니다.
        </footer>
      </div>
    </div>
  );
}
