import React from 'react';
import { Compass } from 'lucide-react';
import { getTurnInfo } from '../data/calendar.js';

const ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른'];

export function getKoreanTurnOrdinal(turn) {
  if (turn <= 1) return '첫 번째 턴';
  if (turn === 20) return '스무 번째 턴';
  if (turn >= 1 && turn <= 30) {
    const t = Math.floor(turn / 10);
    const o = turn % 10;
    return `${TENS[t]}${ONES[o]} 번째 턴`;
  }
  return `제${turn}턴`;
}

export default function TurnTransitionOverlay({ transition }) {
  if (!transition) return null;

  const { turn } = transition;
  const turnInfo = getTurnInfo(turn);
  const voyageDay = (turn - 1) * 10 + 1;
  const ordinalTitle = getKoreanTurnOrdinal(turn);

  return (
    <div
      key={`turn-curtain-${transition.key}`}
      className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center bg-black animate-turn-curtain"
    >
      <div className="text-center px-6 space-y-2.5 animate-turn-title-rise">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-amber-400/50 bg-amber-500/15 text-amber-300 mx-auto">
          <Compass className="w-6 h-6" />
        </div>

        <div className="text-xs font-bold tracking-widest text-amber-300/90 uppercase">
          제 {turn} 턴 개시
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {ordinalTitle}
        </h2>

        <div className="text-sm font-bold text-sky-300">
          항해 {voyageDay}일차 · {turnInfo.label}
        </div>

        <div className="pt-1 text-xs text-slate-400">
          1단계: 타륜을 조타해 항로를 결정하세요
        </div>
      </div>
    </div>
  );
}
