import { PORTS, REPAIR_COST, RESUPPLY_COST, getPortById } from '../data/ports.js';
import { getMissionById, evaluateMissionProgress } from '../data/missions.js';
import { drawThreeSituationCards } from '../data/situationCards.js';
import { normalizeDeg, smallestAngleDiff } from '../data/windZones.js';
import { shortestLonDelta } from '../data/worldCoastlines.js';
import {
  MAX_FOOD,
  applySituationCardToState,
  b4EuclideanDeg,
  buySpecialty,
  buySupplies,
  computePlannedMove,
  createInitialGameState,
  enterPortInActivity,
  executeSailTurn,
  findNearbyPort,
  finishActivityTurn,
  getNearbyFleets,
  isDirectionImmediatelyBlocked,
  repairHull,
  resolveMovement,
} from './navigation.js';
import {
  RPS_OPTIONS,
  advanceBattleState,
  applyBattleToState,
  applyFleeBattleToState,
  applyTradeToState,
  canAcceptTradeOffer,
  canInitiateInteractionWithPeer,
  createInitialBattlePayload,
  validateTradeOffer,
} from './interactions.js';

export const MAX_AI_PER_ROOM = 3;

export const AI_PERSONALITIES = {
  explorer: {
    id: 'explorer',
    label: '탐험형',
    badge: '🧭 탐험',
    names: ['다 가마 함대(AI)', '마젤란 원정대(AI)', '카브랄 탐험선(AI)'],
    battleChance: 0.15,
    tradeInitiateChance: 0.25,
    tradeAcceptChance: 0.55,
  },
  pirate: {
    id: 'pirate',
    label: '해적형',
    badge: '🏴‍☠️ 해적',
    names: ['드레이크 사략선(AI)', '바르바로사 해적(AI)', '키드 해적단(AI)'],
    battleChance: 0.72,
    tradeInitiateChance: 0.05,
    tradeAcceptChance: 0.25,
  },
  merchant: {
    id: 'merchant',
    label: '상인형',
    badge: '💰 상인',
    names: ['정화 대보선단(AI)', '베네치아 대상단(AI)', '메디치 상단(AI)'],
    battleChance: 0.06,
    tradeInitiateChance: 0.55,
    tradeAcceptChance: 0.85,
  },
};

export const AI_LEVELS = [
  {
    level: 1,
    label: '1단계 · 초보',
    shortLabel: 'Lv.1 초보',
    desc: '목적지 감각이 부족해 출발지 근처 해역을 방황하고 보급을 놓칩니다.',
  },
  {
    level: 2,
    label: '2단계 · 견습',
    shortLabel: 'Lv.2 견습',
    desc: '목표 지점으로 직선 항해하려다 대륙에 자주 막히며 전속 항해를 거의 쓰지 않습니다.',
  },
  {
    level: 3,
    label: '3단계 · 숙련',
    shortLabel: 'Lv.3 숙련',
    desc: '중간 거점 항로를 따라가고 부패(8턴) 전 기항지를 찾아 균형 있게 항해합니다.',
  },
  {
    level: 4,
    label: '4단계 · 마스터',
    shortLabel: 'Lv.4 마스터',
    desc: '매 턴 해안선·바람·전속·보급·특산품을 계산해 최단 턴·최고 점수를 노립니다.',
  },
];

function wpPort(portId) {
  const p = getPortById(portId);
  return p ? { lat: p.lat, lon: p.lon, portId: p.id, label: p.name } : null;
}

export function getMissionWaypoints(missionId = 'mission_1') {
  if (missionId === 'mission_event_cape') {
    return [
      { lat: 12.0, lon: -25.0, label: '대서양 개방 해역' },
      { lat: -20.0, lon: -18.0, label: '남대서양 외해' },
      wpPort('goodhope'),
    ].filter(Boolean);
  }

  if (missionId === 'mission_2') {
    return [
      { lat: 12.0, lon: -26.0, label: '대서양 남서 진입' },
      { lat: -25.0, lon: -42.0, label: '브라질 연안 통과' },
      { lat: -57.5, lon: -66.5, portId: 'magellanstrait', label: '혼곶·마젤란 우회' },
      { lat: -44.0, lon: -82.0, label: '남동태평양 북상' },
      { lat: -10.0, lon: -95.0, label: '동태평양 무역풍' },
      { lat: 14.0, lon: -135.0, label: '태평양 횡단' },
      wpPort('guam'),
      { lat: 17.0, lon: 124.0, label: '필리핀 해역' },
      wpPort('macau'),
      { lat: 14.0, lon: 112.0, label: '남중국해 귀환' },
      wpPort('malacca'),
      { lat: 4.0, lon: 85.0, label: '인도양 귀환' },
      { lat: -18.0, lon: 54.0, label: '마다가스카르 외해' },
      { lat: -38.5, lon: 18.5, label: '희망봉 외해' },
      { lat: -12.0, lon: -20.0, label: '남대서양 북상' },
      { lat: 15.0, lon: -24.0, label: '카보베르데 외해' },
      wpPort('lisbon'),
    ].filter(Boolean);
  }

  if (missionId === 'mission_3') {
    return [
      { lat: 12.0, lon: -26.0, label: '대서양 남서 진입' },
      { lat: -25.0, lon: -42.0, label: '브라질 연안 통과' },
      { lat: -57.5, lon: -66.5, portId: 'magellanstrait', label: '혼곶·마젤란 우회' },
      { lat: -44.0, lon: -82.0, label: '남동태평양 북상' },
      { lat: -10.0, lon: -95.0, label: '동태평양 무역풍' },
      { lat: 14.0, lon: -135.0, label: '태평양 횡단' },
      wpPort('guam'),
      wpPort('maluku'),
      wpPort('malacca'),
      { lat: 4.0, lon: 85.0, label: '인도양 횡단' },
      { lat: -18.0, lon: 54.0, label: '인도양 서진' },
      { lat: -38.5, lon: 18.5, label: '희망봉 외해' },
      { lat: -12.0, lon: -20.0, label: '남대서양 북상' },
      { lat: 15.0, lon: -24.0, label: '카보베르데 외해' },
      wpPort('lisbon'),
    ].filter(Boolean);
  }

  // Mission 1: Spice Islands round-trip
  return [
    { lat: 12.0, lon: -25.0, label: '대서양 개방 해역' },
    { lat: -20.0, lon: -20.0, label: '남대서양 환류' },
    { lat: -38.5, lon: 18.5, label: '희망봉 외해' },
    { lat: -16.0, lon: 58.0, label: '인도양 남부' },
    { lat: 3.0, lon: 93.0, label: '말라카 진입' },
    { lat: -4.0, lon: 112.0, label: '자바해 통과' },
    wpPort('maluku'),
    { lat: -4.0, lon: 112.0, label: '자바해 귀환' },
    { lat: 3.0, lon: 93.0, label: '말라카 귀환' },
    { lat: -16.0, lon: 58.0, label: '인도양 귀환' },
    { lat: -38.5, lon: 18.5, label: '희망봉 귀환' },
    { lat: -12.0, lon: -20.0, label: '남대서양 북상' },
    { lat: 15.0, lon: -24.0, label: '카보베르데 외해' },
    wpPort('lisbon'),
  ].filter(Boolean);
}

export function bearingToPoint(fromLat, fromLon, toLat, toLon) {
  const dLat = toLat - fromLat;
  const dLon = shortestLonDelta(fromLon, toLon);
  return Math.round(normalizeDeg((Math.atan2(dLon, dLat) * 180) / Math.PI));
}

export function createAiFleetPayload({
  existingFleets = [],
  personality = 'explorer',
  level = 3,
  missionId = 'mission_1',
}) {
  const existingAi = (existingFleets || []).filter(
    (f) => f.isAi || f.aiConfig?.isAi || String(f.clientId || '').startsWith('ai-'),
  );
  if (existingAi.length >= MAX_AI_PER_ROOM) {
    return null;
  }

  const pMeta = AI_PERSONALITIES[personality] || AI_PERSONALITIES.explorer;
  const usedNames = new Set((existingFleets || []).map((f) => f.teamName));
  const pickedName =
    pMeta.names.find((n) => !usedNames.has(n)) ||
    `${pMeta.label} AI ${existingAi.length + 1}호`;

  const clientId = `ai-${personality}-lv${level}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 5)}`;

  const state = createInitialGameState(missionId);
  const aiConfig = {
    isAi: true,
    personality: pMeta.id,
    level: Math.max(1, Math.min(4, Number(level) || 3)),
    waypointIndex: 0,
    state,
  };

  return {
    clientId,
    teamName: pickedName,
    turn: state.turn,
    cardCompletedTurn: 0,
    completedTurn: 0,
    lat: state.lat,
    lon: state.lon,
    headingDeg: state.headingDeg,
    food: state.food,
    hull: state.hull,
    gold: state.gold,
    cargoCount: state.cargo.length,
    lastEvent: `${pMeta.badge} · Lv.${aiConfig.level} 출항 준비`,
    status: state.status,
    trail: state.trail,
    aiConfig,
    isAi: true,
  };
}

function advanceWaypointIndex(state, missionId, currentIdx) {
  const waypoints = getMissionWaypoints(missionId);
  let idx = Math.max(0, Math.min(waypoints.length - 1, currentIdx || 0));

  while (idx < waypoints.length - 1) {
    const wp = waypoints[idx];
    const dist = b4EuclideanDeg(state.lat, state.lon, wp.lat, wp.lon);
    const hitGoalPort =
      wp.portId &&
      wp.portId !== 'lisbon' &&
      (state.visitedPorts || []).includes(wp.portId);
    const arriveThreshold = wp.portId ? 6.5 : 14.0;
    if (dist <= arriveThreshold || hitGoalPort) {
      idx += 1;
      continue;
    }
    // Never stay behind an intermediate ocean waypoint if already closer to the next open waypoint
    if (!wp.portId && idx + 1 < waypoints.length) {
      const nextWp = waypoints[idx + 1];
      const nextDist = b4EuclideanDeg(state.lat, state.lon, nextWp.lat, nextWp.lon);
      if (nextDist < dist && dist > 18) {
        idx += 1;
        continue;
      }
    }
    break;
  }
  return { idx, target: waypoints[idx], waypoints };
}

function findResupplyPortNearRoute(lat, lon, maxDist = 38) {
  let best = null;
  let bestDist = Infinity;
  for (const p of PORTS) {
    const d = b4EuclideanDeg(lat, lon, p.lat, p.lon);
    if (d <= maxDist && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Pick heading & fullSail for AI turns according to intelligence tier 1..4.
 */
export function chooseAiSailDecision(
  state,
  level = 3,
  waypointIndex = 0,
  rng = Math.random,
) {
  const missionId = state.missionId || 'mission_1';
  const progress = evaluateMissionProgress(
    { ...state, status: 'returned' },
    missionId,
  );
  const goalPortId =
    missionId === 'mission_1'
      ? 'maluku'
      : missionId === 'mission_2'
        ? 'macau'
        : missionId === 'mission_event_cape'
          ? 'goodhope'
          : 'lisbon';

  // Level 1: Clueless novice wandering nearby Atlantic/Europe waters
  if (level === 1) {
    const base = state.turn <= 2 ? 205 : state.headingDeg;
    let heading = normalizeDeg(Math.round(base + (rng() - 0.5) * 110));
    if (isDirectionImmediatelyBlocked(state.lat, state.lon, heading, 1.0)) {
      heading = normalizeDeg(heading + (rng() < 0.5 ? 125 : -125));
    }
    return {
      headingDeg: heading,
      isFullSail: false,
      waypointIndex,
    };
  }

  // Level 2: Apprentice aiming directly toward goal/Lisbon without smart continent bypass
  if (level === 2) {
    const returnPhase =
      missionId === 'mission_1'
        ? (state.visitedPorts || []).includes('maluku')
        : progress.goalAchieved;
    const directPort = getPortById(returnPhase ? 'lisbon' : goalPortId) || getPortById('lisbon');
    let heading = bearingToPoint(state.lat, state.lon, directPort.lat, directPort.lon);
    heading = normalizeDeg(Math.round(heading + (rng() - 0.5) * 44));
    if (isDirectionImmediatelyBlocked(state.lat, state.lon, heading, 0.8)) {
      heading = normalizeDeg(heading + (rng() < 0.5 ? 70 : -70));
    }
    return {
      headingDeg: heading,
      isFullSail: state.food >= 80 && rng() < 0.15,
      waypointIndex,
    };
  }

  // Level 3 & Level 4: Waypoint-guided strategic navigation
  const { idx, target } = advanceWaypointIndex(state, missionId, waypointIndex);
  let navTarget = target;

  // Proactive resupply diversion before 8-turn spoilage or critical food loss
  const distToNav = b4EuclideanDeg(state.lat, state.lon, navTarget.lat, navTarget.lon);
  const needsSupply =
    (state.isSpoiled ||
      state.turnsWithoutPort >= (level === 4 ? 6 : 7) ||
      state.food <= (level === 4 ? 48 : 35)) &&
    !(navTarget.portId && distToNav <= 42);
  if (needsSupply) {
    const nearPort = findResupplyPortNearRoute(state.lat, state.lon, 40);
    if (nearPort) {
      navTarget = { lat: nearPort.lat, lon: nearPort.lon, portId: nearPort.id };
    }
  }

  const directBearing = bearingToPoint(state.lat, state.lon, navTarget.lat, navTarget.lon);

  if (level === 3) {
    let bestScore = -Infinity;
    let bestHeading = directBearing;
    let bestFullSail = false;

    for (const offset of [0, -25, 25, -50, 50, -80, 80, 120, -120]) {
      const h = normalizeDeg(directBearing + offset);
      const cand = { ...state, headingDeg: h, isFullSail: false };
      const planned = computePlannedMove(cand);
      const move = resolveMovement(state.lat, state.lon, h, planned.effectiveDeg);
      const dockedHere = findNearbyPort(move.endLat, move.endLon);
      const nextDist = b4EuclideanDeg(move.endLat, move.endLon, navTarget.lat, navTarget.lon);
      let score = -nextDist;
      if (move.actualDeg < 1.5 && !(navTarget.portId && dockedHere?.id === navTarget.portId)) {
        score -= 400;
      } else if (move.collided && !(navTarget.portId && dockedHere?.id === navTarget.portId)) {
        score -= 55;
      }
      if (planned.windClass.id === 'tailwind') score += 4;
      if (score > bestScore) {
        bestScore = score;
        bestHeading = h;
        bestFullSail =
          planned.windClass.id === 'tailwind' &&
          state.food >= 85 &&
          nextDist > 25 &&
          rng() < 0.4;
      }
    }

    return {
      headingDeg: bestHeading,
      isFullSail: bestFullSail,
      waypointIndex: idx,
    };
  }

  // Level 4: Full 360° simulation + wind/full-sail optimization
  let bestScore = -Infinity;
  let bestHeading = directBearing;
  let bestFullSail = false;
  const missionMax = getMissionById(missionId).maxTurns;
  const turnsLeft = Math.max(1, missionMax - state.turn + 1);
  const allowFullSail = state.food >= 50 || turnsLeft <= 7;

  for (let h = 0; h < 360; h += 10) {
    for (const fs of allowFullSail ? [false, true] : [false]) {
      const cand = { ...state, headingDeg: h, isFullSail: fs };
      const planned = computePlannedMove(cand);
      const move = resolveMovement(state.lat, state.lon, h, planned.effectiveDeg);
      const dockedHere = findNearbyPort(move.endLat, move.endLon);
      const distAfter = b4EuclideanDeg(move.endLat, move.endLon, navTarget.lat, navTarget.lon);
      const intendedDock = Boolean(navTarget.portId && dockedHere?.id === navTarget.portId);

      let score = -distAfter;
      if (move.actualDeg < 1.5 && !intendedDock) {
        // Strictly reject getting pinned against coastline
        score -= 500;
      } else if (move.collided && !intendedDock) {
        // Strongly avoid wasting movement / risking native ambushes
        score -= 120;
      }
      if (move.hitBoundary) score -= 250;
      if (intendedDock) {
        score += 40;
      } else if (dockedHere && (state.turnsWithoutPort >= 4 || state.food < 105)) {
        // Opportunistic free mid-route resupply if naturally passing a port
        score += 8;
      }
      // Use full sail when it materially accelerates waypoint arrival without endangering food
      if (fs) {
        const gainBonus = planned.effectiveCm >= 4.0 ? 4.5 : -2.5;
        score += gainBonus - (state.food < 65 ? 5.0 : 0);
      }
      score -= smallestAngleDiff(h, directBearing) * 0.01;

      if (score > bestScore) {
        bestScore = score;
        bestHeading = h;
        bestFullSail = fs;
      }
    }
  }

  return {
    headingDeg: bestHeading,
    isFullSail: bestFullSail,
    waypointIndex: idx,
  };
}

function pickAiSituationCard(cards, level, rng) {
  if (!cards?.length) return null;
  if (level <= 2) {
    return cards[Math.floor(rng() * cards.length)];
  }
  // Level 3 & 4 avoid pure negative cards if a positive/helpful card exists
  let best = cards[0];
  let bestScore = -999;
  for (const c of cards) {
    let s = 0;
    if (c.tone === 'emerald') s += 4;
    else if (c.tone === 'sky') s += 3;
    else if (c.tone === 'amber') s += 1;
    else if (c.tone === 'rose') s -= 3;
    if (level === 3 && rng() < 0.25) s += 1.5;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

/**
 * Pure random RPS choice (as explicitly requested by the user).
 */
export function pickRandomRpsChoice(rng = Math.random) {
  return RPS_OPTIONS[Math.min(RPS_OPTIONS.length - 1, Math.floor(rng() * RPS_OPTIONS.length))].id;
}

/**
 * Execute AI's Step 1 (Sail) + Step 2 (Card) synchronously.
 */
export function runAiSailAndCardStep(aiFleet, roomTurn, roomMissionId, rng = Math.random) {
  const aiConfig = aiFleet.aiConfig || {
    isAi: true,
    personality: 'explorer',
    level: 3,
    waypointIndex: 0,
  };
  const level = aiConfig.level || 3;
  const missionId = roomMissionId || aiConfig.state?.missionId || 'mission_1';

  let state = aiConfig.state
    ? { ...aiConfig.state, missionId }
    : createInitialGameState(missionId);

  if (state.status !== 'active') {
    return {
      ...aiFleet,
      cardCompletedTurn: Math.max(aiFleet.cardCompletedTurn ?? 0, roomTurn),
      completedTurn: Math.max(aiFleet.completedTurn ?? 0, roomTurn),
      status: state.status,
      aiConfig: { ...aiConfig, state },
    };
  }

  // Sync turn number to room turn cleanly
  state = {
    ...state,
    turn: roomTurn,
    activeTurn: roomTurn,
    turnStep: 'sail',
  };

  const decision = chooseAiSailDecision(state, level, aiConfig.waypointIndex || 0, rng);
  state = {
    ...state,
    headingDeg: decision.headingDeg,
    isFullSail: decision.isFullSail,
  };

  const sailResult = executeSailTurn(state, rng);
  state = sailResult.nextState;

  if (state.status === 'active') {
    const cards = drawThreeSituationCards(rng);
    const pickedCard = pickAiSituationCard(cards, level, rng);
    const cardRes = applySituationCardToState(state, pickedCard);
    state = cardRes.nextState;
  }

  const nextAiConfig = {
    ...aiConfig,
    isAi: true,
    waypointIndex: decision.waypointIndex,
    state,
  };

  const pMeta = AI_PERSONALITIES[aiConfig.personality] || AI_PERSONALITIES.explorer;
  return {
    ...aiFleet,
    turn: state.turn,
    cardCompletedTurn:
      state.status === 'active'
        ? Math.max(state.cardCompletedTurn ?? 0, roomTurn)
        : roomTurn,
    completedTurn:
      state.status === 'active'
        ? state.completedTurn ?? 0
        : roomTurn,
    lat: state.lat,
    lon: state.lon,
    headingDeg: state.headingDeg,
    food: state.food,
    hull: state.hull,
    gold: state.gold,
    cargoCount: state.cargo.length,
    lastEvent: `${pMeta.badge} · ${state.logs[0]?.title || '항해 중'}`,
    status: state.status,
    trail: state.trail,
    aiConfig: nextAiConfig,
    isAi: true,
  };
}

/**
 * Evaluate AI response to an incoming pending/active interaction.
 * Always plays pure random Rock-Paper-Scissors as requested.
 */
export function computeAiInteractionResponse(
  aiFleet,
  inter,
  rng = Math.random,
) {
  if (!aiFleet || !inter) return null;
  const aiConfig = aiFleet.aiConfig || { personality: 'explorer', level: 3 };
  const pMeta = AI_PERSONALITIES[aiConfig.personality] || AI_PERSONALITIES.explorer;
  const aiState = aiConfig.state || {
    gold: aiFleet.gold ?? 500,
    food: aiFleet.food ?? 140,
    hull: aiFleet.hull ?? 100,
  };
  const myRole = inter.initiatorId === aiFleet.clientId ? 'initiator' : 'target';

  // Pending Trade Offer -> accept or decline
  if (inter.type === 'trade' && inter.status === 'pending' && myRole === 'target') {
    const canAfford = canAcceptTradeOffer(aiState, inter.payload);
    if (!canAfford) {
      return { patch: { status: 'declined' }, completedForAi: false };
    }
    const wantFoodBonus = inter.payload?.giveType === 'food' && aiState.food < 75 ? 0.25 : 0;
    const accept = rng() < Math.min(0.95, pMeta.tradeAcceptChance + wantFoodBonus);
    return {
      patch: { status: accept ? 'completed' : 'declined' },
      completedForAi: false,
    };
  }

  // Pending Battle Challenge -> accept (always accept unless Level 4 is critically damaged/broke)
  if (inter.type === 'battle' && inter.status === 'pending' && myRole === 'target') {
    if ((aiConfig.level || 3) === 4 && (aiState.hull <= 25 || aiState.gold < 30)) {
      return { patch: { status: 'declined' }, fled: true };
    }
    return { patch: { status: 'active' }, fled: false };
  }

  // Active Battle -> submit pure random RPS choice if AI hasn't picked yet this round
  if (inter.type === 'battle' && inter.status === 'active') {
    const alreadyPicked =
      myRole === 'initiator'
        ? Boolean(inter.payload?.initiatorChoice)
        : Boolean(inter.payload?.targetChoice);
    if (alreadyPicked) return null;

    const choice = pickRandomRpsChoice(rng);
    const { nextPayload, nextStatus } = advanceBattleState(
      inter.payload,
      myRole,
      choice,
    );
    return {
      patch: { payload: nextPayload, status: nextStatus },
      fled: false,
    };
  }

  return null;
}

/**
 * Apply completed trade/battle outcomes once to an AI fleet's persisted state.
 */
export function applyResolvedInteractionToAiFleet(aiFleet, inter, fled = false) {
  if (!aiFleet?.aiConfig?.state || !inter) return null;
  const appliedIds = aiFleet.aiConfig.appliedInteractionIds || [];
  if (appliedIds.includes(inter.id)) return null;

  const myRole = inter.initiatorId === aiFleet.clientId ? 'initiator' : 'target';
  if (inter.initiatorId !== aiFleet.clientId && inter.targetId !== aiFleet.clientId) return null;

  const isInit = myRole === 'initiator';
  const peerName = isInit ? inter.targetName : inter.initiatorName;
  let state = aiFleet.aiConfig.state;

  if (fled && inter.type === 'battle' && !isInit) {
    state = applyFleeBattleToState(state, peerName);
  } else if (inter.status === 'completed') {
    if (inter.type === 'trade') {
      state = applyTradeToState(state, inter.payload, isInit, peerName);
    } else if (inter.type === 'battle') {
      const isWinner = inter.payload?.winnerRole === myRole;
      state = applyBattleToState(state, isWinner, peerName, inter.payload);
    }
  } else {
    return null;
  }

  const pMeta = AI_PERSONALITIES[aiFleet.aiConfig.personality] || AI_PERSONALITIES.explorer;
  return {
    ...aiFleet,
    food: state.food,
    hull: state.hull,
    gold: state.gold,
    lastEvent: `${pMeta.badge} · ${state.logs[0]?.title || '상호작용 완료'}`,
    aiConfig: {
      ...aiFleet.aiConfig,
      appliedInteractionIds: [...appliedIds, inter.id].slice(-30),
      state,
    },
  };
}

/**
 * Execute AI's Step 3 (Port docking / resupply / cargo + optional nearby interaction).
 * Returns `{ updatedFleet, newInteraction }` (if AI initiated a trade/battle).
 */
export function runAiActivityStep(
  aiFleet,
  roomTurn,
  roomMissionId,
  roomFleets = [],
  roomInteractions = [],
  rng = Math.random,
) {
  const aiConfig = aiFleet.aiConfig || {
    isAi: true,
    personality: 'explorer',
    level: 3,
    waypointIndex: 0,
  };
  const level = aiConfig.level || 3;
  const pMeta = AI_PERSONALITIES[aiConfig.personality] || AI_PERSONALITIES.explorer;
  const missionId = roomMissionId || aiConfig.state?.missionId || 'mission_1';
  let state = aiConfig.state
    ? { ...aiConfig.state, missionId }
    : createInitialGameState(missionId);

  if (state.status !== 'active') {
    return {
      updatedFleet: {
        ...aiFleet,
        completedTurn: Math.max(aiFleet.completedTurn ?? 0, roomTurn),
        status: state.status,
      },
      newInteraction: null,
    };
  }

  // Check if AI still has an open pending/active interaction in this turn (wait for peer up to 20s)
  const openWithMe = (roomInteractions || []).find(
    (inter) =>
      (!inter.turn || inter.turn === roomTurn) &&
      (inter.initiatorId === aiFleet.clientId || inter.targetId === aiFleet.clientId) &&
      (inter.status === 'pending' || inter.status === 'active'),
  );
  if (openWithMe) {
    const ageMs = Date.now() - (openWithMe.updatedAt || Date.now());
    if (ageMs < 20000) {
      return { updatedFleet: null, newInteraction: null };
    }
  }

  // 1) Port Docking, Resupply & Specialty Purchase
  const nearbyPort = findNearbyPort(state.lat, state.lon);
  if (nearbyPort && !state.isDocked) {
    const isGoal =
      (missionId === 'mission_1' && nearbyPort.id === 'maluku') ||
      (missionId === 'mission_2' && nearbyPort.id === 'macau') ||
      (missionId === 'mission_event_cape' && nearbyPort.id === 'goodhope') ||
      nearbyPort.isHomePort;
    const shouldDock =
      level === 1
        ? rng() < 0.35
        : level === 2
          ? isGoal || state.food <= 60 || rng() < 0.65
          : isGoal ||
            state.isSpoiled ||
            state.turnsWithoutPort >= (level === 4 ? 5 : 6) ||
            state.food <= 70 ||
            (nearbyPort.specialty &&
              state.cargo.length < 3 &&
              state.gold >= nearbyPort.buyPrice + 80);

    if (shouldDock) {
      const dockRes = enterPortInActivity(state);
      state = dockRes.nextState;
      if (state.status === 'active' && state.isDocked) {
        if (
          (level >= 2 || rng() < 0.4) &&
          (state.isSpoiled || state.food < (level === 4 ? 115 : 100)) &&
          state.gold >= RESUPPLY_COST
        ) {
          state = buySupplies(state);
        }
        if (level >= 3 && state.hull < 75 && state.gold >= REPAIR_COST + 30) {
          state = repairHull(state);
        }
        if (
          level >= 2 &&
          nearbyPort.specialty &&
          state.cargo.length < 3 &&
          state.gold >= nearbyPort.buyPrice + (level === 4 ? 50 : 20) &&
          (level >= 3 || rng() < 0.5)
        ) {
          state = buySpecialty(state);
        }
      }
    }
  }

  // 2) Nearby Fleet Interaction (Pirate attacks proactively; Merchant offers trade; Explorer occasional)
  let newInteraction = null;
  if (state.status === 'active' && !state.interactedThisTurn) {
    const otherPeers = (roomFleets || []).filter(
      (f) => f.clientId !== aiFleet.clientId && f.status === 'active',
    );
    const nearbyPeers = getNearbyFleets(state.lat, state.lon, state.headingDeg, otherPeers);
    const eligiblePeer = nearbyPeers.find(
      (p) =>
        canInitiateInteractionWithPeer(
          roomInteractions,
          aiFleet.clientId,
          p.clientId,
          roomTurn,
          false,
        ).allowed,
    );

    if (eligiblePeer) {
      const roll = rng();
      if (roll < pMeta.battleChance) {
        state = { ...state, interactedThisTurn: true };
        newInteraction = {
          roomCode: null,
          turn: roomTurn,
          type: 'battle',
          initiatorId: aiFleet.clientId,
          initiatorName: aiFleet.teamName,
          targetId: eligiblePeer.clientId,
          targetName: eligiblePeer.teamName,
          status: 'pending',
          payload: createInitialBattlePayload(),
        };
      } else if (
        roll < pMeta.battleChance + pMeta.tradeInitiateChance &&
        state.gold >= 60 &&
        state.food < MAX_FOOD - 10
      ) {
        const offer = {
          giveType: 'gold',
          giveAmount: 50,
          wantType: 'food',
          wantAmount: 15,
        };
        if (!validateTradeOffer(state, offer)) {
          state = { ...state, interactedThisTurn: true };
          newInteraction = {
            roomCode: null,
            turn: roomTurn,
            type: 'trade',
            initiatorId: aiFleet.clientId,
            initiatorName: aiFleet.teamName,
            targetId: eligiblePeer.clientId,
            targetName: eligiblePeer.teamName,
            status: 'pending',
            payload: offer,
          };
        }
      }
    }
  }

  // 3) Finalize Step 3 turn (if AI didn't just initiate an interactive request to a human, or wait if it did)
  if (!newInteraction) {
    state = finishActivityTurn(state);
  }

  const nextAiConfig = {
    ...aiConfig,
    isAi: true,
    state,
  };

  const updatedFleet = {
    ...aiFleet,
    turn: state.turn,
    cardCompletedTurn: Math.max(aiFleet.cardCompletedTurn ?? 0, roomTurn),
    completedTurn: newInteraction
      ? aiFleet.completedTurn ?? 0
      : roomTurn,
    lat: state.lat,
    lon: state.lon,
    headingDeg: state.headingDeg,
    food: state.food,
    hull: state.hull,
    gold: state.gold,
    cargoCount: state.cargo.length,
    lastEvent: `${pMeta.badge} · ${state.logs[0]?.title || '주변활동 완료'}`,
    status: state.status,
    trail: state.trail,
    aiConfig: nextAiConfig,
    isAi: true,
  };

  return { updatedFleet, newInteraction };
}
