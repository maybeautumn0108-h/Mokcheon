import React from 'react';
import { Award, Compass, Flag, LogOut, RotateCcw, Skull, Trophy } from 'lucide-react';

function getGradeBadgeClasses(grade) {
  switch (grade) {
    case 'S':
      return 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-slate-950 border-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.55)]';
    case 'A':
      return 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-slate-950 border-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]';
    case 'B':
      return 'bg-gradient-to-br from-sky-300 to-sky-500 text-slate-950 border-sky-100';
    case 'C':
      return 'bg-slate-600 text-white border-slate-400';
    default:
      return 'bg-gradient-to-br from-rose-600 to-rose-800 text-white border-rose-300 shadow-[0_0_20px_rgba(225,29,72,0.45)]';
  }
}

export default function VoyageEndedView({
  state,
  settlement,
  endMeta,
  playMode,
  readyCount = 0,
  totalFleets = 1,
  onOpenSettlement,
  onLeaveOrReset,
}) {
  if (!state || !settlement) return null;

  const goalAchieved =
    settlement.outcomeType === 'returned' && Boolean(settlement.missionProgress?.goalAchieved);
  const grade = settlement.grade || 'F';
  const turnsTaken = settlement.turnsTaken || state.completedTurn || state.turn || 1;
  const maxTurns = settlement.mission?.maxTurns ?? 15;

  return (
    <section
      className={`rounded-3xl border-2 p-4 space-y-4 shadow-2xl ${
        goalAchieved
          ? 'border-amber-400/70 bg-gradient-to-b from-[#2b1a07] via-[#17120c] to-slate-950'
          : 'border-rose-500/60 bg-gradient-to-b from-[#280b16] via-[#160f19] to-slate-950'
      }`}
    >
      {/* Top Status Banner - Clearly Distinct from Active Sailing Deck */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${
            goalAchieved
              ? 'border-amber-300/60 bg-amber-500/20 text-amber-200'
              : 'border-rose-400/60 bg-rose-500/20 text-rose-200'
          }`}
        >
          {goalAchieved ? <Trophy className="w-3.5 h-3.5" /> : <Skull className="w-3.5 h-3.5" />}
          <span>{goalAchieved ? '항해 완수 · 최종 종료' : '항해 종료 · 미완수'}</span>
        </span>
        <span className="text-[11px] font-bold text-slate-400 tabular-nums">
          최종 {turnsTaken}/{maxTurns}턴
        </span>
      </div>

      {/* Completely Distinct Dedicated Ending Artwork */}
      <div
        className={`rounded-2xl border overflow-hidden shadow-inner ${
          goalAchieved ? 'border-amber-400/40 bg-slate-950' : 'border-rose-500/35 bg-slate-950'
        }`}
      >
        {goalAchieved ? (
          <svg viewBox="0 0 360 170" className="w-full h-auto block">
            <defs>
              <linearGradient id="endWinSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="55%" stopColor="#7c2d12" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="endWinMedal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <rect width="360" height="118" fill="url(#endWinSky)" />
            <rect y="118" width="360" height="52" fill="#0c4a6e" />
            {/* Radiant Triumphal Sun */}
            <circle cx="180" cy="82" r="56" fill="#fef08a" opacity="0.16" />
            <circle cx="180" cy="82" r="36" fill="#fbbf24" opacity="0.22" />
            {/* Celebration Fireworks */}
            <g stroke="#fde68a" strokeWidth="1.4" opacity="0.85">
              <line x1="68" y1="36" x2="68" y2="20" />
              <line x1="68" y1="36" x2="82" y2="26" />
              <line x1="68" y1="36" x2="84" y2="40" />
              <line x1="68" y1="36" x2="54" y2="26" />
              <line x1="68" y1="36" x2="52" y2="42" />
              <line x1="292" y1="34" x2="292" y2="18" />
              <line x1="292" y1="34" x2="306" y2="24" />
              <line x1="292" y1="34" x2="306" y2="42" />
              <line x1="292" y1="34" x2="278" y2="24" />
              <line x1="292" y1="34" x2="278" y2="42" />
            </g>
            {/* Cape Cliffs / Royal Arch */}
            <path d="M 0 118 L 62 74 L 118 118 Z" fill="#29170b" />
            <path d="M 242 118 L 298 72 L 360 118 Z" fill="#29170b" />
            {/* Flag planted at summit */}
            <line x1="298" y1="72" x2="298" y2="44" stroke="#fef3c7" strokeWidth="2" />
            <polygon points="299,44 322,50 299,56" fill="#dc2626" />
            {/* Central Royal Crown Medallion */}
            <g transform="translate(180, 74)">
              <circle r="32" fill="#1e293b" stroke="url(#endWinMedal)" strokeWidth="4" />
              <circle r="26" fill="none" stroke="#fef08a" strokeWidth="1" strokeDasharray="3 2" />
              <path d="M -14 8 L -16 -6 L -7 2 L 0 -10 L 7 2 L 16 -6 L 14 8 Z" fill="url(#endWinMedal)" />
              <rect x="-14" y="10" width="28" height="4" rx="1.5" fill="#fef08a" />
            </g>
            <text
              x="180"
              y="148"
              textAnchor="middle"
              fontSize="13"
              fontWeight="900"
              fill="#fef3c7"
              letterSpacing="1.5"
            >
              VOYAGE ACCOMPLISHED · 항해 완주 기념
            </text>
          </svg>
        ) : (
          <svg viewBox="0 0 360 170" className="w-full h-auto block">
            <defs>
              <linearGradient id="endFailSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#090d16" />
                <stop offset="60%" stopColor="#311022" />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.65" />
              </linearGradient>
            </defs>
            <rect width="360" height="118" fill="url(#endFailSky)" />
            <rect y="118" width="360" height="52" fill="#0f172a" />
            {/* Storm Clouds & Lightning */}
            <ellipse cx="95" cy="36" rx="52" ry="18" fill="#1e293b" opacity="0.85" />
            <ellipse cx="265" cy="40" rx="58" ry="20" fill="#1e293b" opacity="0.85" />
            <polyline points="262,48 250,74 260,74 244,104" fill="none" stroke="#fda4af" strokeWidth="2.2" opacity="0.7" />
            {/* Broken Mast & Adrift Ship Silhouette */}
            <g transform="translate(180, 108) rotate(-7)">
              <path d="M -42 6 L -30 22 L 32 22 L 46 4 Z" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
              <line x1="-2" y1="6" x2="-2" y2="-28" stroke="#475569" strokeWidth="4" />
              <line x1="-2" y1="-28" x2="14" y2="-12" stroke="#64748b" strokeWidth="3" />
              <path d="M -2 -26 L 16 -10 L 6 4 L -2 2 Z" fill="#cbd5e1" opacity="0.35" />
            </g>
            {/* Stormy Waves */}
            <path d="M 0 124 Q 30 114 60 124 T 120 124 T 180 124 T 240 124 T 300 124 T 360 124" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.35" />
            {/* Red Wax End Seal */}
            <g transform="translate(64, 72) rotate(-10)">
              <circle r="24" fill="#9f1239" stroke="#fda4af" strokeWidth="2" opacity="0.95" />
              <text x="0" y="6" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff1f2">F</text>
            </g>
            <text
              x="180"
              y="150"
              textAnchor="middle"
              fontSize="13"
              fontWeight="900"
              fill="#fecdd3"
              letterSpacing="1.5"
            >
              VOYAGE TERMINATED · 항해 종료 보고서
            </text>
          </svg>
        )}
      </div>

      {/* Grade Medallion & Final Result Summary */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3.5 flex items-center gap-3.5">
        <div
          className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 ${getGradeBadgeClasses(
            grade,
          )}`}
        >
          <span className="text-3xl font-black leading-none">{grade}</span>
          <span className="text-[10px] font-black mt-0.5">등급</span>
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-xs font-black text-amber-300">{settlement.gradeTitle}</div>
          <h2 className="text-base font-black text-white leading-snug">
            {endMeta?.title || settlement.rankLabel}
          </h2>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {endMeta?.desc || settlement.rankLabel}
          </p>
        </div>
      </div>

      {playMode === 'online' && (
        <div className="rounded-xl border border-sky-500/35 bg-sky-950/35 px-3 py-2 text-[11px] font-bold text-sky-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>내 선단 항해가 완료되어 성적표가 확정되었습니다.</span>
          </span>
          <span className="shrink-0 text-sky-300 tabular-nums">
            전체 {readyCount}/{Math.max(1, totalFleets)}팀 진행
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onOpenSettlement}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 active:scale-[0.99] py-3.5 text-sm font-black text-slate-950 shadow-lg cursor-pointer transition"
        >
          <Award className="w-4 h-4" />
          <span>최종 성적표 · 항로 비교 및 이미지 저장</span>
        </button>

        <button
          type="button"
          onClick={onLeaveOrReset}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
        >
          {playMode === 'solo' ? <RotateCcw className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
          <span>{playMode === 'solo' ? '새 항해 시작하기' : '대기실로 돌아가기'}</span>
        </button>
      </div>
    </section>
  );
}
