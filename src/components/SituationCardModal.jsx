import React, { useEffect, useState } from 'react';
import { Compass, Sparkles } from 'lucide-react';

const TONE_BADGE = {
  emerald: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
  rose: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
  amber: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
  sky: 'bg-sky-500/20 border-sky-400/40 text-sky-300',
};

export default function SituationCardModal({ cards, onConfirmCard }) {
  const [selectedIdx, setSelectedIdx] = useState(null);

  useEffect(() => {
    setSelectedIdx(null);
  }, [cards]);

  if (!cards || cards.length === 0) return null;

  const selectedCard = selectedIdx !== null ? cards[selectedIdx] : null;

  const handleSelect = (idx) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-black text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            항해 상황 카드 선택 (3택 1)
          </h3>
          <span className="text-[11px] text-slate-400">좌표 이동 없음</span>
        </div>
        <p className="text-xs text-slate-300 mb-3">
          {selectedCard
            ? '선택한 카드의 결과가 선단에 반영됩니다.'
            : '뒤집힌 항해 일지 카드 3장 중 1장을 선택하세요.'}
        </p>

        <div className="grid grid-cols-3 gap-2">
          {cards.map((card, idx) => {
            const isPicked = selectedIdx === idx;
            const isRevealed = selectedIdx !== null;
            const badgeStyle = TONE_BADGE[card.tone] || TONE_BADGE.amber;

            if (!isRevealed) {
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-b from-slate-800 to-slate-900 hover:from-amber-950/60 hover:to-slate-900 hover:border-amber-400 active:scale-95 py-6 px-2 transition cursor-pointer shadow-md"
                >
                  <div className="w-10 h-10 rounded-full border border-amber-400/40 bg-amber-500/10 flex items-center justify-center text-amber-300 group-hover:scale-110 transition">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-amber-200">카드 {idx + 1}</span>
                  <span className="text-[10px] text-slate-400">터치하여 확인</span>
                </button>
              );
            }

            return (
              <div
                key={card.id}
                className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition ${
                  isPicked
                    ? 'border-amber-400 bg-slate-800/95 ring-2 ring-amber-400/40'
                    : 'border-slate-800 bg-slate-950/70 opacity-50'
                }`}
              >
                <div>
                  <span
                    className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeStyle}`}
                  >
                    {card.category}
                  </span>
                  <div className="mt-1.5 text-xs font-black text-white leading-snug">
                    {card.title}
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-bold text-amber-300 leading-tight">
                  {card.effectSummary}
                </div>
              </div>
            );
          })}
        </div>

        {selectedCard && (
          <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/80 p-3 text-xs space-y-1.5">
            <div className="font-bold text-amber-300">{selectedCard.title}</div>
            <p className="text-slate-300 leading-relaxed">{selectedCard.description}</p>
            <div className="font-bold text-sky-300">효과: {selectedCard.effectSummary}</div>
          </div>
        )}

        {selectedCard && (
          <button
            type="button"
            onClick={() => onConfirmCard(selectedCard)}
            className="mt-3.5 w-full rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] py-2.5 text-sm font-black text-slate-950 transition cursor-pointer"
          >
            카드 효과 적용
          </button>
        )}
      </div>
    </div>
  );
}
