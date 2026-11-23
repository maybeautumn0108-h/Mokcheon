import React from 'react';
import { Anchor, ArrowRight, CheckCircle2, Handshake, Ship, Swords } from 'lucide-react';

export default function ActivityStepPanel({
  activeTurn,
  nearbyPort,
  isDocked,
  nearbyFleets,
  interactedThisTurn,
  onEnterPort,
  onOpenTradeShop,
  onStartTrade,
  onStartBattle,
  onFinishTurn,
}) {
  return (
    <section className="rounded-2xl border border-amber-500/40 bg-slate-900/95 p-3.5 shadow-lg space-y-3">
      {/* 3-Step Turn Progress Bar */}
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          1. 항해
        </span>
        <span className="text-slate-600">→</span>
        <span className="text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          2. 카드
        </span>
        <span className="text-slate-600">→</span>
        <span className="text-amber-300 rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5">
          3. 주변활동 ({activeTurn}턴)
        </span>
      </div>

      {/* Port Visit Option */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 space-y-2">
        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Anchor className="w-4 h-4 text-emerald-400" />
          기항지 방문
        </div>

        {!nearbyPort ? (
          <div className="text-[11px] text-slate-400">
            주변 기항지 반경에 있지 않습니다. (망망대해)
          </div>
        ) : isDocked ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-emerald-300 font-semibold">
              {nearbyPort.name} 정박 중 · 교역소에서 보급·거래 가능
            </span>
            <button
              type="button"
              onClick={onOpenTradeShop}
              className="rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1 text-[11px] font-black text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
            >
              교역소 열기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnterPort}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 py-2.5 text-xs font-black text-emerald-200 transition cursor-pointer"
          >
            <Anchor className="w-4 h-4" />
            기항지 입항 · 보급 및 특산품 매입
          </button>
        )}
      </div>

      {/* Nearby Ship Interactions (within 1.0 cm / 10°, 1 grid square) */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Ship className="w-4 h-4 text-sky-400" />
            인접 선박 상호작용 (반경 1.0 cm · 격자 1칸)
          </span>
          {interactedThisTurn && (
            <span className="text-[10px] font-bold text-emerald-300">이번 턴 상호작용 완료</span>
          )}
        </div>

        {nearbyFleets.length === 0 ? (
          <div className="text-[11px] text-slate-400">
            반경 1.0 cm(10°) 이내에 인접한 다른 선단이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {nearbyFleets.map((peer) => (
              <div
                key={peer.clientId}
                className="rounded-xl border border-sky-500/30 bg-sky-950/25 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-sky-200">{peer.teamName}</span>
                  <span className="text-[11px] text-sky-300 tabular-nums">
                    {peer.sectorLabel} · {peer.distCm.toFixed(1)} cm
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={interactedThisTurn}
                    onClick={() => onStartTrade(peer)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 py-2 text-xs font-black text-emerald-200 transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Handshake className="w-3.5 h-3.5" />
                    물자 교환
                  </button>

                  <button
                    type="button"
                    disabled={interactedThisTurn}
                    onClick={() => onStartBattle(peer)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-rose-400/50 bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 py-2 text-xs font-black text-rose-200 transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    전투하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finish Step 3 & Complete Turn */}
      <button
        type="button"
        onClick={onFinishTurn}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] py-3 text-sm font-black text-slate-950 shadow-lg transition cursor-pointer"
      >
        <span>주변활동 완료 · 제{activeTurn}턴 마치기</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </section>
  );
}
