import React, { useState } from 'react';
import { Check, Handshake, ShieldAlert, Swords, X } from 'lucide-react';
import {
  BATTLE_STAKES,
  RPS_OPTIONS,
  canAcceptTradeOffer,
  validateTradeOffer,
} from '../engine/interactions.js';

function choiceEmoji(choiceId) {
  return RPS_OPTIONS.find((c) => c.id === choiceId)?.emoji || '❓';
}

function choiceLabel(choiceId) {
  return RPS_OPTIONS.find((c) => c.id === choiceId)?.label || choiceId;
}

export default function InteractionModal({
  draftTradePeer,
  activeInteraction,
  myClientId,
  gameState,
  onSendTradeOffer,
  onAcceptTrade,
  onDeclineInteraction,
  onCancelInteraction,
  onAcceptBattle,
  onFleeBattle,
  onSubmitRpsChoice,
  onCloseCompleted,
}) {
  const [giveType, setGiveType] = useState('gold');
  const [giveAmount, setGiveAmount] = useState(50);
  const [wantType, setWantType] = useState('food');
  const [wantAmount, setWantAmount] = useState(15);
  const [formError, setFormError] = useState(null);

  // Case 1: Drafting a new Trade Proposal
  if (draftTradePeer && !activeInteraction) {
    const handleSubmitTrade = (e) => {
      e.preventDefault();
      const offer = {
        giveType,
        giveAmount: Number(giveAmount),
        wantType,
        wantAmount: Number(wantAmount),
      };
      const err = validateTradeOffer(gameState, offer);
      if (err) {
        setFormError(err);
        return;
      }
      setFormError(null);
      onSendTradeOffer(draftTradePeer, offer);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3">
        <form
          onSubmit={handleSubmitTrade}
          className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-emerald-300 flex items-center gap-1.5">
              <Handshake className="w-5 h-5" />
              {draftTradePeer.teamName} 선단에 물자 교환 제안
            </h3>
            <button
              type="button"
              onClick={onCloseCompleted}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 space-y-2">
              <div className="font-bold text-rose-300">내가 주는 물자</div>
              <select
                value={giveType}
                onChange={(e) => {
                  const val = e.target.value;
                  setGiveType(val);
                  setWantType(val === 'gold' ? 'food' : 'gold');
                  setGiveAmount(val === 'gold' ? 50 : 15);
                  setWantAmount(val === 'gold' ? 15 : 50);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-bold text-white"
              >
                <option value="gold">금화 (보유 {gameState.gold}G)</option>
                <option value="food">식량·식수 (보유 {gameState.food})</option>
              </select>
              <input
                type="number"
                min="1"
                max={giveType === 'gold' ? gameState.gold : Math.max(1, gameState.food - 1)}
                value={giveAmount}
                onChange={(e) => setGiveAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-black text-amber-300 tabular-nums"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 space-y-2">
              <div className="font-bold text-emerald-300">내가 받을 물자</div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 font-bold text-slate-200">
                {wantType === 'gold' ? '금화 (G)' : '식량·식수'}
              </div>
              <input
                type="number"
                min="1"
                max={wantType === 'gold' ? 300 : 50}
                value={wantAmount}
                onChange={(e) => setWantAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-black text-emerald-300 tabular-nums"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              {formError}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-sm font-black text-slate-950 cursor-pointer"
          >
            교환 제안 보내기
          </button>
        </form>
      </div>
    );
  }

  if (!activeInteraction) return null;

  const isInitiator = activeInteraction.initiatorId === myClientId;
  const peerName = isInitiator
    ? activeInteraction.targetName
    : activeInteraction.initiatorName;
  const { type, status, payload } = activeInteraction;

  // Case 2: Trade Interaction (Pending / Completed / Declined / Cancelled)
  if (type === 'trade') {
    const labelMap = { gold: '금화', food: '식량·식수' };
    const giveStr = `${labelMap[payload.giveType]} ${payload.giveAmount}${payload.giveType === 'gold' ? 'G' : ''}`;
    const wantStr = `${labelMap[payload.wantType]} ${payload.wantAmount}${payload.wantType === 'gold' ? 'G' : ''}`;
    const targetCanAfford = canAcceptTradeOffer(gameState, payload);

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-2xl space-y-3">
          <h3 className="text-base font-black text-emerald-300 flex items-center gap-1.5">
            <Handshake className="w-5 h-5" />
            해상 물자 교환 ({peerName})
          </h3>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-1.5">
            {isInitiator ? (
              <>
                <div>내가 주는 물자: <strong className="text-rose-300">{giveStr}</strong></div>
                <div>내가 받는 물자: <strong className="text-emerald-300">{wantStr}</strong></div>
              </>
            ) : (
              <>
                <div>상대가 주는 물자 (내 수령): <strong className="text-emerald-300">{giveStr}</strong></div>
                <div>내가 내주는 물자: <strong className="text-rose-300">{wantStr}</strong></div>
              </>
            )}
          </div>

          {status === 'pending' && isInitiator && (
            <div className="space-y-2">
              <div className="text-xs text-amber-300 font-bold text-center animate-pulse">
                {peerName} 선단의 수락을 기다리는 중...
              </div>
              <button
                type="button"
                onClick={() => onCancelInteraction(activeInteraction)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 text-xs font-bold text-slate-200 cursor-pointer"
              >
                제안 취소하기
              </button>
            </div>
          )}

          {status === 'pending' && !isInitiator && (
            <div className="space-y-2">
              {!targetCanAfford && (
                <div className="text-xs text-rose-300">
                  보유한 {labelMap[payload.wantType]}이(가) 부족해 수락할 수 없습니다.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDeclineInteraction(activeInteraction)}
                  className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  거절하기
                </button>
                <button
                  type="button"
                  disabled={!targetCanAfford}
                  onClick={() => onAcceptTrade(activeInteraction)}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 py-2.5 text-xs font-black text-slate-950 cursor-pointer disabled:cursor-not-allowed"
                >
                  수락 및 교환
                </button>
              </div>
            </div>
          )}

          {status !== 'pending' && (
            <div className="space-y-2.5">
              <div
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                  status === 'completed'
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                    : 'border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                {status === 'completed'
                  ? '물자 교환이 성공적으로 완료되었습니다!'
                  : status === 'declined'
                    ? `${peerName} 선단이 물자 교환을 거절했습니다.`
                    : '물자 교환 제안이 취소되었습니다.'}
              </div>
              <button
                type="button"
                onClick={onCloseCompleted}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-sm font-black text-slate-950 cursor-pointer"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Case 3: Battle Interaction (Best-of-3 Rock-Paper-Scissors)
  const myRole = isInitiator ? 'initiator' : 'target';
  const myWins = isInitiator ? payload.initiatorWins : payload.targetWins;
  const peerWins = isInitiator ? payload.targetWins : payload.initiatorWins;
  const myChoice = isInitiator ? payload.initiatorChoice : payload.targetChoice;
  const peerChoice = isInitiator ? payload.targetChoice : payload.initiatorChoice;
  const history = payload.history || [];
  const iWonBattle = payload.winnerRole === myRole;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/50 bg-slate-900 p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-rose-300 flex items-center gap-1.5">
            <Swords className="w-5 h-5" />
            해상 전투 · 가위바위보 (3판 2선승)
          </h3>
          <span className="rounded-full bg-rose-500/15 border border-rose-400/40 px-2 py-0.5 text-[10px] font-bold text-rose-200">
            승리 +{BATTLE_STAKES.lootGold}G / +식량{BATTLE_STAKES.lootFood}
          </span>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-3 items-center rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-center">
          <div>
            <div className="text-[10px] text-slate-400">우리 선단</div>
            <div className="text-xl font-black text-sky-300 tabular-nums">{myWins}승</div>
          </div>
          <div>
            <div className="text-[10px] text-amber-300 font-bold">
              {status === 'completed' ? '최종 결판' : `제 ${payload.round} 라운드`}
            </div>
            <div className="text-xs font-black text-slate-400">VS</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">{peerName}</div>
            <div className="text-xl font-black text-rose-300 tabular-nums">{peerWins}승</div>
          </div>
        </div>

        {/* Pending Invite */}
        {status === 'pending' && isInitiator && (
          <div className="space-y-2">
            <div className="text-xs text-amber-300 font-bold text-center animate-pulse">
              {peerName} 선단의 응전을 기다리는 중...
            </div>
            <button
              type="button"
              onClick={() => onCancelInteraction(activeInteraction)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 text-xs font-bold text-slate-200 cursor-pointer"
            >
              전투 철수하기
            </button>
          </div>
        )}

        {status === 'pending' && !isInitiator && (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 p-3 text-xs text-rose-100 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong>{peerName}</strong> 선단이 전투를 걸어왔습니다! (패배 시 금화 -
                {BATTLE_STAKES.lootGold}G, 내구도 -{BATTLE_STAKES.loserHullDamage} / 회피 시 식량 -
                {BATTLE_STAKES.fleeFoodCost})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onFleeBattle(activeInteraction)}
                className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
              >
                전속 회피 (식량 -{BATTLE_STAKES.fleeFoodCost})
              </button>
              <button
                type="button"
                onClick={() => onAcceptBattle(activeInteraction)}
                className="rounded-xl bg-rose-500 hover:bg-rose-400 py-2.5 text-xs font-black text-white cursor-pointer"
              >
                ⚔️ 응전하기!
              </button>
            </div>
          </div>
        )}

        {/* Active Battle RPS Selection */}
        {status === 'active' && (
          <div className="space-y-2.5">
            <div className="text-center text-xs text-slate-300">
              {myChoice
                ? `내 선택 완료 (${choiceEmoji(myChoice)} ${choiceLabel(myChoice)}) · 상대 선택 대기 중...`
                : peerChoice
                  ? '상대가 패를 냈습니다! 가위·바위·보 중 하나를 선택하세요.'
                  : '가위 · 바위 · 보 중 하나를 선택하세요!'}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {RPS_OPTIONS.map((opt) => {
                const isPicked = myChoice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(myChoice)}
                    onClick={() => onSubmitRpsChoice(activeInteraction, opt.id)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-4 transition cursor-pointer disabled:cursor-not-allowed ${
                      isPicked
                        ? 'border-amber-400 bg-amber-500/25 text-amber-200 ring-2 ring-amber-400/50'
                        : 'border-slate-700 bg-slate-800/90 hover:bg-slate-700 disabled:opacity-45 text-white'
                    }`}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <span className="text-xs font-black">{opt.label}</span>
                    {isPicked && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Round-by-Round History */}
        {history.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 space-y-1">
            <div className="text-[10px] font-bold text-slate-400">라운드 기록</div>
            {history.map((h, idx) => {
              const myC = isInitiator ? h.initiatorChoice : h.targetChoice;
              const oppC = isInitiator ? h.targetChoice : h.initiatorChoice;
              const resLabel =
                h.winner === 'draw' ? '무승부' : h.winner === myRole ? '승리!' : '패배';
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs text-slate-200"
                >
                  <span>
                    {h.round}판: 나 {choiceEmoji(myC)} vs {choiceEmoji(oppC)} {peerName}
                  </span>
                  <span
                    className={`font-black ${
                      h.winner === 'draw'
                        ? 'text-slate-400'
                        : h.winner === myRole
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {resLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Battle Finished / Declined / Cancelled */}
        {(status === 'completed' || status === 'declined' || status === 'cancelled') && (
          <div className="space-y-2.5">
            <div
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                status === 'completed'
                  ? iWonBattle
                    ? 'border-emerald-500/40 bg-emerald-950/45 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-950/45 text-rose-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300'
              }`}
            >
              {status === 'completed'
                ? iWonBattle
                  ? `승리했습니다! 전리품 금화 +${BATTLE_STAKES.lootGold}G, 식량·식수 +${BATTLE_STAKES.lootFood} 획득!`
                  : `패배했습니다. 금화 -${BATTLE_STAKES.lootGold}G, 선체 내구도 -${BATTLE_STAKES.loserHullDamage} 피해를 입었습니다.`
                : status === 'declined'
                  ? `${peerName} 선단이 교전을 회피했습니다.`
                  : '전투가 취소되었습니다.'}
            </div>
            <button
              type="button"
              onClick={onCloseCompleted}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-sm font-black text-slate-950 cursor-pointer"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
