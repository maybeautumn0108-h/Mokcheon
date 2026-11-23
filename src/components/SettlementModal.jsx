import React from 'react';
import { Award, Coins, Flag, RotateCcw, Ship } from 'lucide-react';

export default function SettlementModal({ settlement, state, onReset, onClose }) {
  if (!settlement) return null;

  const isSuccess = settlement.outcomeType === 'returned';
  const isPartial = settlement.outcomeType === 'overseas_docked';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/45 bg-slate-900 p-4 shadow-2xl my-auto">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 border ${
              isSuccess
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : isPartial
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
            }`}
          >
            {isSuccess ? <Award className="w-6 h-6" /> : <Flag className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-bold text-amber-300/90">최종 항해 정산</div>
            <h2 className="text-lg font-black text-white">{settlement.rankLabel}</h2>
          </div>
        </div>

        {/* Maluku Badge */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-0.5 font-bold border ${
              settlement.visitedMaluku
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {settlement.visitedMaluku ? '★ 향료제도(말루쿠) 도달 완료' : '향료제도 미도달'}
          </span>
          <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-slate-300">
            경과 {state.turn}/30턴
          </span>
        </div>

        {/* Financial Breakdown */}
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">남은 금화</span>
            <span className="font-bold text-slate-200 tabular-nums">
              {settlement.remainingGold} G
            </span>
          </div>

          <div className="border-t border-slate-800/80 pt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400">특산품 정산</span>
              <span className="font-bold text-amber-300 tabular-nums">
                +{settlement.cargoTotal} G
              </span>
            </div>
            {settlement.cargoBreakdown.length === 0 ? (
              <div className="text-[11px] text-slate-500">선적한 특산품 없음</div>
            ) : (
              <div className="space-y-1">
                {settlement.cargoBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-[11px] text-slate-300"
                  >
                    <span>
                      {item.name} ({item.portName})
                    </span>
                    <span className="tabular-nums">
                      {item.buyPrice}G × {item.appliedMultiplier}배 ={' '}
                      <strong className="text-amber-300">{item.payout}G</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span className="text-slate-400">잔여 자원 보너스 (식량+내구도)</span>
            <span className="font-bold text-sky-300 tabular-nums">
              +{settlement.resourceBonus} 점
            </span>
          </div>

          <div className="border-t border-amber-500/30 pt-2.5 flex items-center justify-between text-sm">
            <span className="font-black text-white flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              최종 정산 점수
            </span>
            <span className="text-xl font-black text-amber-300 tabular-nums">
              {settlement.totalScore} 점
            </span>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            일지 살펴보기
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-black text-slate-950 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            새 항해 시작
          </button>
        </div>
      </div>
    </div>
  );
}
