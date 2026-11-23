import React from 'react';
import { Anchor, Compass, Coins, Droplets, HeartPulse, Package, AlertTriangle } from 'lucide-react';
import { MAX_TURNS, getTurnInfo } from '../data/calendar.js';

export default function TopResourceBar({ state, onReset }) {
  const turnInfo = getTurnInfo(state.turn);
  const foodLow = state.food <= 25;
  const hullLow = state.hull <= 30;

  return (
    <header className="sticky top-0 z-30 border-b border-amber-500/20 bg-slate-950/95 backdrop-blur-md px-3 pt-2.5 pb-2">
      {/* Row 1: Turn, Calendar Date, Spoilage Warning, Reset */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold text-amber-300">
            <Compass className="w-3.5 h-3.5" />
            <span>
              턴 {state.turn}/{MAX_TURNS}
            </span>
            <span className="text-amber-200/70 font-medium">· {turnInfo.label}</span>
          </div>

          {state.isSpoiled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 text-[11px] font-bold text-rose-300 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              식수 부패 1.5배
            </span>
          ) : state.turnsWithoutPort >= 4 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              외해 {state.turnsWithoutPort}턴 (6턴 시 부패)
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onReset}
          title="항해 초기화"
          className="text-[11px] font-medium text-slate-400 hover:text-amber-300 border border-slate-700/80 hover:border-amber-500/40 rounded-md px-2 py-0.5 transition-colors cursor-pointer"
        >
          초기화
        </button>
      </div>

      {/* Row 2: 4 Core Resource Pills */}
      <div className="grid grid-cols-4 gap-1.5 text-xs">
        <div
          className={`flex items-center justify-between rounded-lg px-2 py-1.5 border ${
            state.isSpoiled || foodLow
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-slate-800 text-slate-100'
          }`}
        >
          <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <div className="text-right leading-tight">
            <div className="text-[10px] text-slate-400">식량·식수</div>
            <div className="font-bold tabular-nums">{state.food}</div>
          </div>
        </div>

        <div
          className={`flex items-center justify-between rounded-lg px-2 py-1.5 border ${
            hullLow
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-slate-800 text-slate-100'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="text-right leading-tight">
            <div className="text-[10px] text-slate-400">내구도</div>
            <div className="font-bold tabular-nums">{state.hull}</div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg px-2 py-1.5 border bg-slate-900/90 border-slate-800 text-slate-100">
          <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div className="text-right leading-tight">
            <div className="text-[10px] text-slate-400">금화</div>
            <div className="font-bold tabular-nums">{state.gold}G</div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg px-2 py-1.5 border bg-slate-900/90 border-slate-800 text-slate-100">
          <Package className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <div className="text-right leading-tight">
            <div className="text-[10px] text-slate-400">특산품</div>
            <div className="font-bold tabular-nums">{state.cargo.length}종</div>
          </div>
        </div>
      </div>

      {state.isDocked && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-300/90">
          <Anchor className="w-3 h-3" />
          <span>현재 기항지 정박 중 · 출항 방위를 설정해 항해하세요</span>
        </div>
      )}
    </header>
  );
}
