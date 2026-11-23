import React from 'react';
import { AlertTriangle, Anchor, CheckCircle2, Compass, Ruler, Snowflake } from 'lucide-react';

export default function TurnResultModal({ outcome, onClose }) {
  if (!outcome) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {outcome.collided ? (
            <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 p-2 text-amber-300 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-2 text-emerald-300 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-amber-300/90">
              제{outcome.completedTurn}턴 ({outcome.dateLabel}) 보고
            </div>
            <h3 className="text-base font-black text-white mt-0.5">
              {outcome.collided
                ? outcome.actualCm <= 0.05
                  ? `제${outcome.completedTurn}턴: 육지에 막혀 이 방향으로는 갈 수 없습니다 (0.0 cm)`
                  : `제${outcome.completedTurn}턴: 육지에 닿아 자로 ${outcome.actualCm.toFixed(1)} cm 이동 후 정지`
                : `제${outcome.completedTurn}턴 항해 완료! 자로 ${outcome.actualCm.toFixed(1)} cm 이동`}
            </h3>
          </div>
        </div>

        {/* Ruler Plotting Instruction Box */}
        <div className="mt-3 rounded-xl border border-sky-500/30 bg-sky-950/40 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-sky-200">
            <Ruler className="w-4 h-4 text-sky-400 shrink-0" />
            <span>B4 종이 지도 작도</span>
          </div>
          <div className="text-sm font-black text-sky-300 tabular-nums">
            방위 {String(outcome.headingDeg).padStart(3, '0')}° · 자로 {outcome.actualCm.toFixed(1)} cm
          </div>
        </div>

        {/* Coastal Stop Warning (No hull damage, no continent names!) */}
        {outcome.collided && (
          <div className="mt-2.5 rounded-xl border border-amber-500/45 bg-amber-950/40 p-3 text-xs text-amber-100 space-y-1.5">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {outcome.hitBoundary
                  ? '항해도 경계에 닿아 이동을 멈췄습니다. 그쪽 방향으로는 갈 수 없습니다.'
                  : '육지(해안선)에 닿아 이동을 멈췄습니다. 그쪽 방향으로는 갈 수 없으니 방위를 돌려주세요.'}
              </span>
            </div>
            {outcome.blockedRanges.length > 0 && (
              <div className="flex items-center gap-1.5 text-amber-200/95">
                <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  갈 수 없는 방위각 범위: <strong>{outcome.blockedRanges.join(', ')}</strong>
                </span>
              </div>
            )}
            {(outcome.hullDamage ?? 0) > 0 && (
              <div className="text-rose-300 font-semibold">선체 내구도 피해: -{outcome.hullDamage}</div>
            )}
          </div>
        )}

        {/* Spoilage Alert */}
        {outcome.newlySpoiled && (
          <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-950/40 p-2.5 text-xs text-amber-200">
            <strong>식수 부패 및 괴혈병 발생!</strong> 연속 8턴 이상 기항지에 정박하지 않아 이후 기항 시까지 식량·식수 소모가 1.5배로 증가합니다.
          </div>
        )}

        {/* Polar Region Alert */}
        {outcome.polarZone && (
          <div className="mt-2.5 rounded-xl border border-cyan-400/50 bg-cyan-950/45 p-2.5 text-xs text-cyan-100 flex items-center gap-2">
            <Snowflake className="w-4 h-4 text-cyan-300 shrink-0" />
            <span>
              <strong>{outcome.polarZone.label}:</strong> {outcome.polarZone.warning}
            </span>
          </div>
        )}

        {/* Nearby Port Hint */}
        {outcome.nearbyPort && (
          <div className="mt-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <Anchor className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              기항지 반경에 진입했습니다! 조타실 하단의 <strong>[기항지 정박]</strong>을 눌러 보급하세요.
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>
            풍향: {outcome.windClass.label} · 식량·식수 -{outcome.foodCost}
          </span>
          <span>
            {outcome.nextStatus === 'active' ? '다음: 2단계 상황 카드' : '항해 종료'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3.5 w-full rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] py-2.5 text-sm font-black text-slate-950 transition cursor-pointer"
        >
          {outcome.nextStatus === 'active' ? '2단계: 상황 카드 뽑기' : '최종 정산 보기'}
        </button>
      </div>
    </div>
  );
}
