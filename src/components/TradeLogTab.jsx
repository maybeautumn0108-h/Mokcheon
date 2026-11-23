import React from 'react';
import { Anchor, Coins, Droplets, HeartPulse, Package, ScrollText, ShoppingBag } from 'lucide-react';
import { REPAIR_AMOUNT, REPAIR_COST, RESUPPLY_COST, getPortById } from '../data/ports.js';
import VoyageTrailMap from './VoyageTrailMap.jsx';

export default function TradeLogTab({
  state,
  onBuySupplies,
  onRepairHull,
  onBuySpecialty,
  onSellCargo,
}) {
  const dockedPort = state.isDocked && state.currentPortId ? getPortById(state.currentPortId) : null;
  const expectedCargoPayout = state.cargo.reduce(
    (sum, item) => sum + Math.round(item.buyPrice * item.multiplier),
    0,
  );

  return (
    <div className="space-y-3">
      {/* Reveal full voyage trail on B4 map once voyage has ended */}
      {state.status !== 'active' && <VoyageTrailMap state={state} />}

      {/* Port Shop (Active when docked) */}
      <section className="rounded-2xl border border-amber-500/30 bg-slate-900/95 p-3.5 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" />
            {dockedPort ? `${dockedPort.name} 기항지 상점` : '기항지 상점 & 보급소'}
          </h2>
          <span className="rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 text-xs font-black text-amber-300 tabular-nums">
            {state.gold} G
          </span>
        </div>

        {!dockedPort ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400 flex items-center gap-2">
            <Anchor className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              현재 항해 중입니다. 기항지 반경 내에서 조타실의 <strong>[기항지 정박]</strong>을 누르면
              보급·수리 및 특산품 매입이 활성화됩니다.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 space-y-0.5">
              <div className="text-[11px] text-emerald-300 font-bold">
                {dockedPort.region} 정박 중 · 출항 전 보급과 교역을 진행하세요.
              </div>
              {dockedPort.historyNote && (
                <div className="text-[11px] text-slate-300">{dockedPort.historyNote}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={state.gold < RESUPPLY_COST || (state.food >= 100 && !state.isSpoiled)}
                onClick={onBuySupplies}
                className="flex flex-col items-start gap-1 rounded-xl border border-sky-500/40 bg-sky-950/35 hover:bg-sky-950/55 disabled:opacity-45 p-2.5 text-left transition cursor-pointer disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between w-full text-xs font-black text-sky-200">
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-sky-400" />
                    식량·식수 완충
                  </span>
                  <span className="text-amber-300">{RESUPPLY_COST} G</span>
                </div>
                <span className="text-[10px] text-slate-300">100 회복 · 부패 해제</span>
              </button>

              <button
                type="button"
                disabled={state.gold < REPAIR_COST || state.hull >= 100}
                onClick={onRepairHull}
                className="flex flex-col items-start gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/35 hover:bg-emerald-950/55 disabled:opacity-45 p-2.5 text-left transition cursor-pointer disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between w-full text-xs font-black text-emerald-200">
                  <span className="inline-flex items-center gap-1">
                    <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
                    선체 수리 (+{REPAIR_AMOUNT})
                  </span>
                  <span className="text-amber-300">{REPAIR_COST} G</span>
                </div>
                <span className="text-[10px] text-slate-300">현재 내구도: {state.hull}/100</span>
              </button>
            </div>

            {dockedPort.specialty ? (
              <button
                type="button"
                disabled={state.gold < dockedPort.buyPrice}
                onClick={onBuySpecialty}
                className="w-full flex items-center justify-between rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-45 px-3 py-2.5 text-left transition cursor-pointer disabled:cursor-not-allowed"
              >
                <div>
                  <div className="text-xs font-black text-amber-200">
                    특산품 매입: {dockedPort.specialty}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    리스본 귀항 정산 <strong className="text-emerald-300">{dockedPort.multiplier}배</strong> (
                    {Math.round(dockedPort.buyPrice * dockedPort.multiplier)} G 가치)
                  </div>
                </div>
                <span className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-black text-slate-950 shrink-0">
                  {dockedPort.buyPrice} G 매입
                </span>
              </button>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
                이 기항지는 보급·수리 전용 중계지입니다. (교역 특산품 없음)
              </div>
            )}
          </div>
        )}
      </section>

      {/* Cargo Hold */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-violet-400" />
            보유 특산품 ({state.cargo.length}종)
          </h3>
          <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 tabular-nums">
            <Coins className="w-3.5 h-3.5" />
            예상 귀항액 {expectedCargoPayout} G
          </span>
        </div>

        {state.cargo.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">
            아직 선적한 특산품이 없습니다. 서아프리카~향료제도 기항지에서 특산품을 매입해 리스본으로
            귀항하세요!
          </div>
        ) : (
          <div className="space-y-1.5">
            {state.cargo.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-100">
                    {item.name}{' '}
                    <span className="text-[10px] text-slate-400">({item.portName})</span>
                  </div>
                  <div className="text-[11px] text-amber-300 tabular-nums">
                    매입 {item.buyPrice}G → 귀항 {item.multiplier}배 (
                    {Math.round(item.buyPrice * item.multiplier)}G)
                  </div>
                </div>
                {dockedPort && (
                  <button
                    type="button"
                    onClick={() => onSellCargo(idx)}
                    className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 cursor-pointer"
                  >
                    원가 매각 (+{item.buyPrice}G)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Voyage Log */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2.5">
          <ScrollText className="w-4 h-4 text-sky-400" />
          항해 일지 (최근 기록순)
        </h3>

        <div className="space-y-2">
          {state.logs.map((entry, idx) => (
            <div
              key={`${entry.turn}-${idx}`}
              className={`rounded-xl border px-3 py-2 text-xs ${
                entry.type === 'collision'
                  ? 'border-rose-500/35 bg-rose-950/30 text-rose-100'
                  : entry.type === 'dock'
                    ? 'border-emerald-500/35 bg-emerald-950/30 text-emerald-100'
                    : entry.type === 'card'
                      ? 'border-amber-500/35 bg-amber-950/25 text-amber-100'
                      : entry.type === 'trade'
                        ? 'border-violet-500/35 bg-violet-950/25 text-violet-100'
                        : 'border-slate-800 bg-slate-950/60 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] opacity-80 mb-0.5">
                <span className="font-bold">
                  {entry.turn === 0 ? '출항 준비' : `제${entry.turn}턴`}
                </span>
                <span>{entry.dateLabel}</span>
              </div>
              <div className="font-bold">{entry.title}</div>
              <div className="text-[11px] text-slate-300/90 mt-0.5">{entry.detail}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
