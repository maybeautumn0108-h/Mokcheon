/**
 * Ship-to-ship interaction engine:
 * 1) Trade (물자 교환: Gold / Food)
 * 2) Naval Battle (전투하기: Best-of-3 Rock-Paper-Scissors / 가위바위보 3판 2선승)
 */
import { getTurnInfo } from '../data/calendar.js';

export const RPS_OPTIONS = [
  { id: 'scissors', label: '가위', emoji: '✌️' },
  { id: 'rock', label: '바위', emoji: '✊' },
  { id: 'paper', label: '보', emoji: '✋' },
];

export const BATTLE_STAKES = {
  lootGold: 60,
  lootFood: 10,
  loserHullDamage: 15,
  fleeFoodCost: 5,
};

export function createInitialBattlePayload() {
  return {
    round: 1,
    initiatorWins: 0,
    targetWins: 0,
    initiatorChoice: null,
    targetChoice: null,
    history: [],
    winnerRole: null,
    ...BATTLE_STAKES,
  };
}

export function resolveRpsRound(iChoice, tChoice) {
  if (iChoice === tChoice) return 'draw';
  if (
    (iChoice === 'rock' && tChoice === 'scissors') ||
    (iChoice === 'scissors' && tChoice === 'paper') ||
    (iChoice === 'paper' && tChoice === 'rock')
  ) {
    return 'initiator';
  }
  return 'target';
}

/**
 * Submit one player's RPS choice for the current round.
 * Only resolves the round once BOTH choices are present.
 */
export function advanceBattleState(payload, actorRole, choice) {
  const next = {
    ...payload,
    history: [...(payload.history || [])],
  };

  if (actorRole === 'initiator') {
    next.initiatorChoice = choice;
  } else {
    next.targetChoice = choice;
  }

  // Wait until both players have locked in their choice
  if (!next.initiatorChoice || !next.targetChoice) {
    return { nextPayload: next, nextStatus: 'active' };
  }

  const iChoice = next.initiatorChoice;
  const tChoice = next.targetChoice;
  const roundWinner = resolveRpsRound(iChoice, tChoice);

  if (roundWinner === 'initiator') next.initiatorWins += 1;
  else if (roundWinner === 'target') next.targetWins += 1;

  next.history.push({
    round: next.round,
    initiatorChoice: iChoice,
    targetChoice: tChoice,
    winner: roundWinner,
  });

  if (next.initiatorWins >= 2) {
    next.winnerRole = 'initiator';
    next.initiatorChoice = null;
    next.targetChoice = null;
    return { nextPayload: next, nextStatus: 'completed' };
  }

  if (next.targetWins >= 2) {
    next.winnerRole = 'target';
    next.initiatorChoice = null;
    next.targetChoice = null;
    return { nextPayload: next, nextStatus: 'completed' };
  }

  // Next round (draw repeats round counter or advances round display cleanly)
  next.round = roundWinner === 'draw' ? next.round : next.round + 1;
  next.initiatorChoice = null;
  next.targetChoice = null;
  return { nextPayload: next, nextStatus: 'active' };
}

export function canAffordResource(state, resourceType, amount) {
  if (amount <= 0) return false;
  if (resourceType === 'gold') return state.gold >= amount;
  if (resourceType === 'food') return state.food > amount; // keep at least 1 food
  return false;
}

export function validateTradeOffer(state, offer) {
  if (!offer) return '교환 조건이 올바르지 않습니다.';
  if (offer.giveType === offer.wantType) {
    return '서로 다른 물자(금화 ↔ 식량·식수)만 교환할 수 있습니다.';
  }
  if (offer.giveAmount <= 0 || offer.wantAmount <= 0) {
    return '교환 수량은 1 이상이어야 합니다.';
  }
  if (!canAffordResource(state, offer.giveType, offer.giveAmount)) {
    return offer.giveType === 'gold'
      ? '보유 금화가 부족합니다.'
      : '보유 식량·식수가 부족합니다 (최소 1 이상 남겨야 합니다).';
  }
  return null;
}

export function canAcceptTradeOffer(state, offer) {
  // Target gives `wantType / wantAmount` and receives `giveType / giveAmount`
  return canAffordResource(state, offer.wantType, offer.wantAmount);
}

export function applyTradeToState(state, offer, isInitiator, peerName) {
  const giveType = isInitiator ? offer.giveType : offer.wantType;
  const giveAmt = isInitiator ? offer.giveAmount : offer.wantAmount;
  const getType = isInitiator ? offer.wantType : offer.giveType;
  const getAmt = isInitiator ? offer.wantAmount : offer.giveAmount;

  let nextGold = state.gold;
  let nextFood = state.food;

  if (giveType === 'gold') nextGold = Math.max(0, nextGold - giveAmt);
  if (giveType === 'food') nextFood = Math.max(1, nextFood - giveAmt);

  if (getType === 'gold') nextGold += getAmt;
  if (getType === 'food') nextFood = Math.min(100, nextFood + getAmt);

  const labelMap = { gold: '금화', food: '식량·식수' };
  const turnInfo = getTurnInfo(state.activeTurn || state.turn);

  return {
    ...state,
    gold: nextGold,
    food: nextFood,
    logs: [
      {
        turn: state.activeTurn || state.turn,
        dateLabel: turnInfo.label,
        type: 'trade',
        title: `해상 물자 교환 완료 (${peerName})`,
        detail: `${labelMap[giveType]} ${giveAmt}${giveType === 'gold' ? 'G' : ''} 제공 ↔ ${labelMap[getType]} ${getAmt}${getType === 'gold' ? 'G' : ''} 수령`,
      },
      ...state.logs,
    ],
  };
}

export function applyBattleToState(state, isWinner, peerName, payload = BATTLE_STAKES) {
  const lootGold = payload.lootGold ?? BATTLE_STAKES.lootGold;
  const lootFood = payload.lootFood ?? BATTLE_STAKES.lootFood;
  const hullDmg = payload.loserHullDamage ?? BATTLE_STAKES.loserHullDamage;
  const turnInfo = getTurnInfo(state.activeTurn || state.turn);

  if (isWinner) {
    return {
      ...state,
      gold: state.gold + lootGold,
      food: Math.min(100, state.food + lootFood),
      logs: [
        {
          turn: state.activeTurn || state.turn,
          dateLabel: turnInfo.label,
          type: 'battle',
          title: `해전 승리! (${peerName} 상대로 2선승)`,
          detail: `전리품 획득: 금화 +${lootGold} G · 식량·식수 +${lootFood}`,
        },
        ...state.logs,
      ],
    };
  }

  const lostGold = Math.min(state.gold, lootGold);
  const nextHull = Math.max(5, state.hull - hullDmg);
  return {
    ...state,
    gold: state.gold - lostGold,
    hull: nextHull,
    logs: [
      {
        turn: state.activeTurn || state.turn,
        dateLabel: turnInfo.label,
        type: 'collision',
        title: `해전 패배 (${peerName})`,
        detail: `피해: 금화 -${lostGold} G · 선체 내구도 -${state.hull - nextHull}`,
      },
      ...state.logs,
    ],
  };
}

export function applyFleeBattleToState(state, peerName) {
  const cost = BATTLE_STAKES.fleeFoodCost;
  const nextFood = Math.max(1, state.food - cost);
  const turnInfo = getTurnInfo(state.activeTurn || state.turn);
  return {
    ...state,
    food: nextFood,
    logs: [
      {
        turn: state.activeTurn || state.turn,
        dateLabel: turnInfo.label,
        type: 'sail',
        title: `전투 회피 (${peerName})`,
        detail: `전속 회피 기동으로 교전을 피했습니다. (식량·식수 -${state.food - nextFood})`,
      },
      ...state.logs,
    ],
  };
}
