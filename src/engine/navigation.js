import {
  clampLat,
  findNearestCoast,
  isPointOnLand,
  shortestLonDelta,
  wrapLon,
} from '../data/worldCoastlines.js';
import {
  LISBON_COORDS,
  PORTS,
  REPAIR_AMOUNT,
  REPAIR_COST,
  RESUPPLY_COST,
  getPortById,
} from '../data/ports.js';
import { MAX_TURNS, getTurnInfo } from '../data/calendar.js';
import { evaluateWind, normalizeDeg } from '../data/windZones.js';
import { getPolarZone, rollWeather } from '../data/weather.js';
import { evaluateMissionProgress, getMissionById } from '../data/missions.js';

export const SAFE_OFFSHORE_DEG = 1.8;
export const COAST_SIGHT_RADIUS_DEG = 6.0;
export const FLEET_RADAR_RADIUS_DEG = 10.0; // 1.0 cm (1 grid square) on B4 map
export const SPOILAGE_THRESHOLD_TURNS = 8;
export const INITIAL_FOOD = 140;
export const MAX_FOOD = 140;
export const NORMAL_SAIL_FOOD_COST = 10;
export const FULL_SAIL_FOOD_COST = 15;
export const POSITION_CHECK_INTERVAL_TURNS = 3;

const NATIVE_GOOD_EVENTS = [
  {
    title: '원주민의 우호적 환대',
    detail: '해안 부족이 신선한 담수와 열대 과일을 나누어 주었습니다! (식량·식수 +20)',
    foodDelta: 20,
    goldDelta: 0,
    hullDelta: 0,
  },
  {
    title: '원주민과 뜻밖의 물물교환',
    detail: '현지 주민과 물품을 나누며 귀한 사금과 식량을 얻었습니다! (금화 +80G, 식량·식수 +10)',
    foodDelta: 10,
    goldDelta: 80,
    hullDelta: 0,
  },
  {
    title: '원주민 장인의 선박 보수',
    detail: '원주민들이 목재와 약초를 지원해 배를 손봐 주었습니다! (내구도 +15, 식량·식수 +10)',
    foodDelta: 10,
    goldDelta: 0,
    hullDelta: 15,
  },
];

const NATIVE_BAD_EVENTS = [
  {
    title: '원주민 부족의 경계·기습',
    detail: '낯선 함대를 경계한 원주민들과 충돌하여 보급품과 금화를 잃었습니다. (식량·식수 -15, 금화 -50G)',
    foodDelta: -15,
    goldDelta: -50,
    hullDelta: 0,
  },
  {
    title: '해안 기습으로 인한 선박 손상',
    detail: '상륙 지점에서 공격을 받아 선체가 파손되며 급히 후퇴했습니다. (내구도 -15, 식량·식수 -10)',
    foodDelta: -10,
    goldDelta: 0,
    hullDelta: -15,
  },
  {
    title: '협상 결렬 및 공물 손실',
    detail: '거친 마찰 끝에 통행 대가로 금화와 식량을 내어주고 물러났습니다. (금화 -70G, 식량·식수 -10)',
    foodDelta: -10,
    goldDelta: -70,
    hullDelta: 0,
  },
];

/**
 * Roll encounter when arriving at uncharted (non-port) land:
 * 50% chance to meet natives -> among encounters, 30% good / 70% bad.
 */
export function rollNativeEncounter(rng = Math.random) {
  if (rng() >= 0.5) {
    return {
      met: false,
      isGood: null,
      tone: 'neutral',
      title: '조용한 무인 해안',
      detail: '항구가 없는 빈 땅에 닿았으나 원주민과 마주치지 않았습니다.',
      foodDelta: 0,
      goldDelta: 0,
      hullDelta: 0,
    };
  }
  const isGood = rng() < 0.3;
  const pool = isGood ? NATIVE_GOOD_EVENTS : NATIVE_BAD_EVENTS;
  const picked = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return {
    met: true,
    isGood,
    tone: isGood ? 'good' : 'bad',
    ...picked,
  };
}

export function createInitialGameState(missionId = 'mission_1') {
  const mission = getMissionById(missionId);
  return {
    missionId: mission.id,
    turn: 1,
    activeTurn: 1,
    cardCompletedTurn: 0,
    completedTurn: 0,
    turnStep: 'sail', // 'sail' | 'card' | 'activity' | 'done'
    interactedThisTurn: false,
    lat: LISBON_COORDS.lat,
    lon: LISBON_COORDS.lon,
    headingDeg: 205, // SSW initial course toward Canaries/Atlantic
    isFullSail: false,
    food: INITIAL_FOOD,
    hull: 100,
    gold: 500,
    cargo: [],
    turnsWithoutPort: 0,
    isSpoiled: false,
    isDocked: true,
    currentPortId: 'lisbon',
    visitedPorts: ['lisbon'],
    hasDepartedLisbon: false,
    nextTurnBonusCm: 0,
    nextTurnMaxCm: null,
    weatherId: 'clear',
    status: 'active', // 'active' | 'returned' | 'stranded' | 'sunk' | 'timeup'
    trail: [{ turn: 0, lat: LISBON_COORDS.lat, lon: LISBON_COORDS.lon }],
    logs: [
      {
        turn: 0,
        dateLabel: '5월 초',
        type: 'depart',
        title: `${mission.shortTitle} 출항 준비 완료`,
        detail: `${mission.rulesNote} (출발지: 리스본 38.7°N, 9.1°W)`,
      },
    ],
  };
}

/**
 * Euclidean distance on the B4 square-grid map (1.0 cm = 10°).
 */
export function b4EuclideanDeg(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = shortestLonDelta(lon1, lon2);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Compute effective planned movement including situation card modifiers.
 */
export function computePlannedMove(state) {
  const windEval = evaluateWind(
    state.headingDeg,
    state.lat,
    state.lon,
    state.turn,
    state.isFullSail,
  );

  let effectiveCm = windEval.moveCm + (state.nextTurnBonusCm || 0);
  if (typeof state.nextTurnMaxCm === 'number') {
    effectiveCm = Math.min(effectiveCm, state.nextTurnMaxCm);
  }
  effectiveCm = Math.max(0.5, Number(effectiveCm.toFixed(1)));

  return {
    ...windEval,
    effectiveCm,
    effectiveDeg: effectiveCm * 10,
  };
}

/**
 * Check if ship is within docking radius of any port.
 */
export function findNearbyPort(lat, lon) {
  let closest = null;
  let closestDist = Infinity;
  for (const port of PORTS) {
    const dist = b4EuclideanDeg(lat, lon, port.lat, port.lon);
    if (dist <= port.dockRadiusDeg && dist < closestDist) {
      closest = { ...port, distanceDeg: dist };
      closestDist = dist;
    }
  }
  return closest;
}

/**
 * Find port landmarks visible on the horizon (within 8.5° = 0.85 cm)
 * returning only relative bearing, distance, and regional `archStyle` (NO port name leaked!).
 */
export function findVisiblePortLandmarks(lat, lon, headingDeg, maxRadiusDeg = 10.0) {
  const results = [];
  for (const port of PORTS) {
    const dLat = port.lat - lat;
    const dLon = shortestLonDelta(lon, port.lon);
    const distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
    if (distDeg <= maxRadiusDeg) {
      const absBearing = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
      let relBearing = absBearing - headingDeg;
      while (relBearing > 180) relBearing -= 360;
      while (relBearing <= -180) relBearing += 360;
      results.push({
        id: port.id,
        archStyle: port.archStyle || 'iberia',
        distDeg: Number(distDeg.toFixed(2)),
        relBearing: Number(relBearing.toFixed(1)),
      });
    }
  }
  return results.sort((a, b) => b.distDeg - a.distDeg); // Draw farthest first
}

/**
 * Compute blocked azimuth ranges around (lat, lon) within `lookaheadDeg`
 * so the student knows which steering directions are blocked by coastline.
 */
export function computeBlockedAzimuthSummary(lat, lon, lookaheadDeg = 2.4) {
  const blocked = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const sinB = Math.sin(rad);
    const cosB = Math.cos(rad);
    let hit = false;
    for (let d = 0.15; d <= lookaheadDeg; d += 0.25) {
      const pLat = lat + d * cosB;
      const pLon = wrapLon(lon + d * sinB);
      if (pLat > 75 || pLat < -65 || isPointOnLand(pLat, pLon)) {
        hit = true;
        break;
      }
    }
    blocked.push(hit);
  }

  const n = blocked.length;
  if (blocked.every((b) => !b)) return [];
  if (blocked.every(Boolean)) return ['전방위 해안 근접'];

  const ranges = [];
  let inRun = false;
  let startIdx = 0;

  const firstClear = blocked.indexOf(false);
  for (let offset = 0; offset <= n; offset++) {
    const idx = (firstClear + offset) % n;
    const isB = blocked[idx];
    if (isB && !inRun) {
      inRun = true;
      startIdx = idx;
    } else if (!isB && inRun) {
      inRun = false;
      const endIdx = (idx - 1 + n) % n;
      const startDeg = String(startIdx * 5).padStart(3, '0');
      const endDeg = String(endIdx * 5).padStart(3, '0');
      ranges.push(`${startDeg}°~${endDeg}°`);
    }
  }

  return ranges.slice(0, 2);
}

function pushToSafeOffshore(lat, lon, minOffshoreDeg = SAFE_OFFSHORE_DEG) {
  let curLat = clampLat(lat);
  let curLon = wrapLon(lon);

  for (let iter = 0; iter < 12; iter++) {
    const onLand = isPointOnLand(curLat, curLon);
    const nearest = findNearestCoast(curLat, curLon, minOffshoreDeg + 3.0);

    if (!onLand && (!nearest || nearest.distDeg >= minOffshoreDeg)) {
      break;
    }

    let pushLat = 0;
    let pushLon = 0;

    if (nearest) {
      const radToCoast = (nearest.bearingToCoastDeg * Math.PI) / 180;
      const sign = onLand ? 1 : -1;
      const step = onLand
        ? nearest.distDeg + minOffshoreDeg
        : Math.max(0.25, minOffshoreDeg - nearest.distDeg + 0.15);
      pushLat = sign * step * Math.cos(radToCoast);
      pushLon = sign * step * Math.sin(radToCoast);
    } else if (onLand) {
      for (let r = 0.5; r <= 12; r += 0.5) {
        let found = false;
        for (let a = 0; a < 360; a += 22.5) {
          const rad = (a * Math.PI) / 180;
          const tLat = clampLat(curLat + r * Math.cos(rad));
          const tLon = wrapLon(curLon + r * Math.sin(rad));
          if (!isPointOnLand(tLat, tLon)) {
            pushLat = tLat - curLat;
            pushLon = shortestLonDelta(curLon, tLon);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    curLat = clampLat(curLat + pushLat);
    curLon = wrapLon(curLon + pushLon);
  }

  return { lat: curLat, lon: curLon };
}

/**
 * Check if sailing straight ahead from (lat, lon) in `headingDeg` is blocked immediately by land/boundary.
 */
export function isDirectionImmediatelyBlocked(lat, lon, headingDeg, checkDeg = 0.45) {
  const rad = (normalizeDeg(headingDeg) * Math.PI) / 180;
  const sinB = Math.sin(rad);
  const cosB = Math.cos(rad);
  for (let d = 0.15; d <= checkDeg; d += 0.15) {
    const pLat = lat + d * cosB;
    const pLon = wrapLon(lon + d * sinB);
    if (pLat > 75 || pLat < -65 || isPointOnLand(pLat, pLon)) {
      return true;
    }
  }
  return false;
}

/**
 * Ray-march movement on the B4 Euclidean plane.
 * If the path touches land or map boundary, stop cleanly right at the coastline
 * without deflecting sideways, pushing backwards, or inflicting hull damage.
 */
export function resolveMovement(startLat, startLon, headingDeg, plannedDeg) {
  const normHeading = normalizeDeg(headingDeg);
  const rad = (normHeading * Math.PI) / 180;
  const dirLon = Math.sin(rad);
  const dirLat = Math.cos(rad);

  const stepDeg = 0.2;
  const totalSteps = Math.max(1, Math.round(plannedDeg / stepDeg));

  let curLat = startLat;
  let curLon = startLon;
  // Safety guard only if start position itself was somehow inside land
  if (isPointOnLand(curLat, curLon)) {
    const rescued = pushToSafeOffshore(curLat, curLon, 0.3);
    curLat = rescued.lat;
    curLon = rescued.lon;
  }

  let collided = false;
  let hitBoundary = false;
  let advancedMainStep = false;

  for (let i = 1; i <= totalSteps; i++) {
    const nextLat = curLat + dirLat * stepDeg;
    const nextLon = wrapLon(curLon + dirLon * stepDeg);

    if (nextLat > 75 || nextLat < -65) {
      hitBoundary = true;
      collided = true;
      break;
    }

    if (isPointOnLand(nextLat, nextLon) || isPointOnLand(Number(nextLat.toFixed(3)), Number(nextLon.toFixed(3)))) {
      collided = true;
      break;
    }

    curLat = nextLat;
    curLon = nextLon;
    advancedMainStep = true;
  }

  if (!collided) {
    return {
      endLat: Number(curLat.toFixed(3)),
      endLon: Number(curLon.toFixed(3)),
      actualDeg: Number(plannedDeg.toFixed(2)),
      actualCm: Number((plannedDeg / 10).toFixed(2)),
      collided: false,
      hitBoundary: false,
      blockedRanges: [],
    };
  }

  // Refine with tiny 0.02° steps so the ship rests cleanly right at the shoreline edge
  if (!hitBoundary && advancedMainStep) {
    const microStep = 0.02;
    for (let m = 0; m < 10; m++) {
      const mLat = curLat + dirLat * microStep;
      const mLon = wrapLon(curLon + dirLon * microStep);
      const rLat = Number(mLat.toFixed(3));
      const rLon = Number(mLon.toFixed(3));
      if (mLat > 75 || mLat < -65 || isPointOnLand(mLat, mLon) || isPointOnLand(rLat, rLon)) {
        break;
      }
      curLat = mLat;
      curLon = mLon;
    }
  }

  const endLat = Number(curLat.toFixed(3));
  const endLon = Number(curLon.toFixed(3));
  const actualDeg = b4EuclideanDeg(startLat, startLon, endLat, endLon);
  const blockedRanges = computeBlockedAzimuthSummary(endLat, endLon, 2.0);

  return {
    endLat,
    endLon,
    actualDeg: Number(actualDeg.toFixed(2)),
    actualCm: Number((actualDeg / 10).toFixed(2)),
    collided: true,
    hitBoundary,
    blockedRanges,
  };
}

/**
 * Execute one sailing turn.
 */
export function executeSailTurn(state, rng = Math.random) {
  if (state.status !== 'active') return { nextState: state, outcome: null };

  const planned = computePlannedMove(state);
  const moveResult = resolveMovement(
    state.lat,
    state.lon,
    state.headingDeg,
    planned.effectiveDeg,
  );

  const nextTurnsWithoutPort = state.turnsWithoutPort + 1;
  const nextIsSpoiled = nextTurnsWithoutPort >= SPOILAGE_THRESHOLD_TURNS;

  const baseFoodCost = state.isFullSail ? FULL_SAIL_FOOD_COST : NORMAL_SAIL_FOOD_COST;
  const foodCost = Math.round(baseFoodCost * (nextIsSpoiled ? 1.5 : 1.0));
  const afterSailFood = Math.max(0, state.food - foodCost);

  const hullDamage = 0;
  const afterSailHull = Math.max(0, state.hull - hullDamage);

  const nearbyPort = findNearbyPort(moveResult.endLat, moveResult.endLon);
  const hasDepartedLisbon =
    state.hasDepartedLisbon || nearbyPort?.id !== 'lisbon';

  // Trigger native encounter only when arriving at uncharted non-port land (after moving > 0.05 cm)
  const nativeEncounter =
    moveResult.collided &&
    !moveResult.hitBoundary &&
    !nearbyPort &&
    moveResult.actualCm > 0.05
      ? rollNativeEncounter(rng)
      : null;

  const nextFood = Math.max(
    0,
    Math.min(MAX_FOOD, afterSailFood + (nativeEncounter?.foodDelta || 0)),
  );
  const nextHull = Math.max(
    0,
    Math.min(100, afterSailHull + (nativeEncounter?.hullDelta || 0)),
  );
  const nextGold = Math.max(0, state.gold + (nativeEncounter?.goldDelta || 0));

  const mission = getMissionById(state.missionId);
  let nextStatus = 'active';
  const nextTurn = state.turn + 1;
  const missionMaxTurns = mission.maxTurns;
  const checkInterval = mission.positionCheckInterval || POSITION_CHECK_INTERVAL_TURNS;

  // One-way event mission (e.g. Hope Cape) succeeds immediately upon reaching goalPortId!
  const reachedOneWayGoal =
    Boolean(mission.isOneWayGoal && mission.goalPortId && nearbyPort?.id === mission.goalPortId);

  // For Missions 2 & 3, only treat returning to Lisbon as voyage completion once mission checkpoints are met
  const preProgress = evaluateMissionProgress(
    { ...state, status: 'returned' },
    state.missionId,
  );
  const canCompleteAtLisbon =
    state.missionId === 'mission_1' ? true : preProgress.goalAchieved;

  if (nextHull <= 0) {
    nextStatus = 'sunk';
  } else if (nextFood <= 0) {
    nextStatus = 'stranded';
  } else if (reachedOneWayGoal) {
    nextStatus = 'returned';
  } else if (
    hasDepartedLisbon &&
    nearbyPort?.id === 'lisbon' &&
    state.turn >= 2 &&
    canCompleteAtLisbon
  ) {
    nextStatus = 'returned';
  } else if (state.turn >= missionMaxTurns) {
    nextStatus = 'timeup';
  }

  const nextVisitedPorts =
    reachedOneWayGoal && nearbyPort && !(state.visitedPorts || []).includes(nearbyPort.id)
      ? [...(state.visitedPorts || []), nearbyPort.id]
      : state.visitedPorts;

  const turnInfo = getTurnInfo(state.turn);
  const logTitle = reachedOneWayGoal
    ? `제${state.turn}턴 · ${nearbyPort.name} 도착! 미션 대성공!`
    : moveResult.collided
      ? moveResult.hitBoundary
        ? `제${state.turn}턴 항해 · 해역 경계 도달 정지 (${moveResult.actualCm.toFixed(1)} cm)`
        : moveResult.actualCm <= 0.05
          ? `제${state.turn}턴 항해 · 육지에 가로막혀 이동 불가`
          : `제${state.turn}턴 항해 · 육지에 닿아 정지 (${moveResult.actualCm.toFixed(1)} cm)`
      : `제${state.turn}턴 항해 완료 · 자로 ${planned.effectiveCm.toFixed(1)} cm 이동`;

  const blockedText =
    moveResult.blockedRanges.length > 0
      ? ` · 갈 수 없는 방위: ${moveResult.blockedRanges.join(', ')}`
      : '';
  const polarZone = getPolarZone(moveResult.endLat);
  const polarText = polarZone ? ` · ${polarZone.shortLabel}` : '';
  const isPositionCheckTurn = state.turn % checkInterval === 0;

  const logDetail = `방위 ${String(planned.headingDeg).padStart(3, '0')}° · ${planned.windClass.label}${
    state.isFullSail ? '(전속)' : ''
  } · 식량 -${foodCost}${blockedText}${polarText}`;

  const extraLogs = [];
  if (nativeEncounter?.met) {
    extraLogs.push({
      turn: state.turn,
      dateLabel: turnInfo.label,
      type: nativeEncounter.isGood ? 'card' : 'collision',
      title: `미지의 해안 원주민 조우: ${nativeEncounter.title}`,
      detail: nativeEncounter.detail,
    });
  }

  const nextState = {
    ...state,
    turn: nextStatus === 'active' ? nextTurn : state.turn,
    activeTurn: state.turn,
    cardCompletedTurn: nextStatus === 'active' ? state.cardCompletedTurn : state.turn,
    completedTurn: nextStatus === 'active' ? state.completedTurn : state.turn,
    turnStep: nextStatus === 'active' ? 'card' : 'done',
    interactedThisTurn: false,
    lat: moveResult.endLat,
    lon: moveResult.endLon,
    food: nextFood,
    hull: nextHull,
    gold: nextGold,
    turnsWithoutPort: reachedOneWayGoal ? 0 : nextTurnsWithoutPort,
    isSpoiled: reachedOneWayGoal ? false : nextIsSpoiled,
    isDocked: reachedOneWayGoal,
    currentPortId: reachedOneWayGoal ? nearbyPort.id : null,
    visitedPorts: nextVisitedPorts,
    hasDepartedLisbon,
    nextTurnBonusCm: 0,
    nextTurnMaxCm: null,
    weatherId: rollWeather(moveResult.endLat),
    status: nextStatus,
    trail: [...state.trail, { turn: state.turn, lat: moveResult.endLat, lon: moveResult.endLon }],
    logs: [
      ...extraLogs,
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: moveResult.collided ? 'collision' : 'sail',
        title: logTitle,
        detail: logDetail,
      },
      ...state.logs,
    ],
  };

  const outcome = {
    completedTurn: state.turn,
    dateLabel: turnInfo.label,
    headingDeg: planned.headingDeg,
    windClass: planned.windClass,
    plannedCm: planned.effectiveCm,
    actualCm: moveResult.actualCm,
    collided: moveResult.collided,
    hitBoundary: moveResult.hitBoundary,
    blockedRanges: moveResult.blockedRanges,
    foodCost,
    hullDamage,
    newlySpoiled: !state.isSpoiled && nextIsSpoiled,
    nearbyPort: nearbyPort ? { id: nearbyPort.id, name: nearbyPort.name } : null,
    polarZone,
    nativeEncounter,
    isPositionCheckTurn,
    positionCheckInterval: checkInterval,
    nextStatus,
  };

  return { nextState, outcome };
}

/**
 * Step 1 alternative: Hold position in current waters (e.g. near port or rival fleet)
 * and advance directly to Step 2 (Situation Card).
 */
export function holdPositionTurn(state) {
  if (state.status !== 'active') return state;
  const foodCost = Math.round(5 * (state.isSpoiled ? 1.5 : 1.0));
  const nextFood = Math.max(0, state.food - foodCost);
  const missionMaxTurns = getMissionById(state.missionId).maxTurns;
  const nextStatus =
    nextFood <= 0 ? 'stranded' : state.turn >= missionMaxTurns ? 'timeup' : 'active';
  const turnInfo = getTurnInfo(state.turn);

  return {
    ...state,
    turn: nextStatus === 'active' ? state.turn + 1 : state.turn,
    activeTurn: state.turn,
    cardCompletedTurn: nextStatus === 'active' ? state.cardCompletedTurn : state.turn,
    completedTurn: nextStatus === 'active' ? state.completedTurn : state.turn,
    turnStep: nextStatus === 'active' ? 'card' : 'done',
    interactedThisTurn: false,
    food: nextFood,
    nextTurnBonusCm: 0,
    nextTurnMaxCm: null,
    weatherId: rollWeather(state.lat),
    status: nextStatus,
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'sail',
        title: `제${state.turn}턴 현 해역 정박·대기`,
        detail: `이동 없이 주변 상황을 주시했습니다. (식량·식수 -${foodCost})`,
      },
      ...state.logs,
    ],
  };
}

/**
 * Step 2: Apply a selected Situation Card (3-choose-1) without altering coordinates,
 * then advance to Step 3 (Surrounding Activity: Port Visit or Ship Interaction).
 */
export function applySituationCardToState(state, card) {
  if (!card) return { nextState: state, hintText: null };
  const patch = card.apply(state) || {};
  const { cardHint, ...stateFields } = patch;

  const nextFood = stateFields.food !== undefined ? stateFields.food : state.food;
  const nextHull = stateFields.hull !== undefined ? stateFields.hull : state.hull;

  let nextStatus = state.status;
  if (state.status === 'active') {
    if (nextHull <= 0) nextStatus = 'sunk';
    else if (nextFood <= 0) nextStatus = 'stranded';
  }

  const resolvedTurn = state.activeTurn || Math.max(1, state.turn - 1);
  const turnInfo = getTurnInfo(resolvedTurn);
  const detailParts = [card.effectSummary];
  if (cardHint) detailParts.push(cardHint);

  const nextState = {
    ...state,
    ...stateFields,
    cardCompletedTurn: resolvedTurn,
    completedTurn: nextStatus === 'active' ? state.completedTurn : resolvedTurn,
    turnStep: nextStatus === 'active' ? 'activity' : 'done',
    status: nextStatus,
    logs: [
      {
        turn: resolvedTurn,
        dateLabel: turnInfo.label,
        type: 'card',
        title: `상황 카드: ${card.title}`,
        detail: detailParts.join(' · '),
      },
      ...state.logs,
    ],
  };

  return { nextState, hintText: cardHint || null };
}

/**
 * Step 3A: Dock at nearby port during the Surrounding Activity step (resets spoilage, opens Port Shop).
 */
export function enterPortInActivity(state) {
  if (state.status !== 'active') return { nextState: state, dockedPort: null };
  const port = findNearbyPort(state.lat, state.lon);
  if (!port) return { nextState: state, dockedPort: null };

  const resolvedTurn = state.activeTurn || Math.max(1, state.turn - 1);
  const turnInfo = getTurnInfo(resolvedTurn);
  const visitedPorts = state.visitedPorts.includes(port.id)
    ? state.visitedPorts
    : [...state.visitedPorts, port.id];

  const mission = getMissionById(state.missionId);
  const preProgress = evaluateMissionProgress(
    { ...state, visitedPorts, status: 'returned' },
    state.missionId,
  );
  const canCompleteAtLisbon =
    state.missionId === 'mission_1' ? true : preProgress.goalAchieved;
  const reachedOneWayGoal =
    Boolean(mission.isOneWayGoal && mission.goalPortId && port.id === mission.goalPortId);
  const isReturningHome =
    reachedOneWayGoal ||
    (state.hasDepartedLisbon && port.id === 'lisbon' && canCompleteAtLisbon);

  const nextState = {
    ...state,
    turnsWithoutPort: 0,
    isSpoiled: false,
    isDocked: true,
    currentPortId: port.id,
    visitedPorts,
    completedTurn: isReturningHome ? resolvedTurn : state.completedTurn,
    cardCompletedTurn: Math.max(state.cardCompletedTurn || 0, resolvedTurn),
    turnStep: isReturningHome ? 'done' : state.turnStep,
    status: isReturningHome ? 'returned' : state.status,
    logs: [
      {
        turn: resolvedTurn,
        dateLabel: turnInfo.label,
        type: 'dock',
        title: `${port.name} 기항지 입항`,
        detail: `${port.region} 입항 완료 (식수 부패 해제${port.specialty ? ` · 특산품: ${port.specialty}` : ''})`,
      },
      ...state.logs,
    ],
  };

  return { nextState, dockedPort: port };
}

/**
 * Step 3B: Complete Surrounding Activity and finalize the current turn.
 */
export function finishActivityTurn(state) {
  if (state.status !== 'active') return state;
  const resolvedTurn = state.activeTurn || Math.max(1, state.turn - 1);
  const missionMaxTurns = getMissionById(state.missionId).maxTurns;
  const nextStatus = resolvedTurn >= missionMaxTurns ? 'timeup' : 'active';

  return {
    ...state,
    cardCompletedTurn: Math.max(state.cardCompletedTurn || 0, resolvedTurn),
    completedTurn: resolvedTurn,
    turnStep: nextStatus === 'active' ? 'sail' : 'done',
    interactedThisTurn: false,
    status: nextStatus,
  };
}

/**
 * Dock at nearby port (consumes 1 turn, clears water spoilage, enables port shop).
 */
export function executeDockTurn(state) {
  if (state.status !== 'active') return { nextState: state, dockedPort: null };
  const port = findNearbyPort(state.lat, state.lon);
  if (!port) return { nextState: state, dockedPort: null };

  const turnInfo = getTurnInfo(state.turn);
  const nextTurn = state.turn + 1;
  const missionMaxTurns = getMissionById(state.missionId).maxTurns;
  const nextStatus =
    state.hasDepartedLisbon && port.id === 'lisbon'
      ? 'returned'
      : state.turn >= missionMaxTurns
        ? 'timeup'
        : 'active';

  const visitedPorts = state.visitedPorts.includes(port.id)
    ? state.visitedPorts
    : [...state.visitedPorts, port.id];

  const nextState = {
    ...state,
    turn: nextStatus === 'active' ? nextTurn : state.turn,
    cardCompletedTurn: state.turn,
    completedTurn: state.turn,
    turnsWithoutPort: 0,
    isSpoiled: false,
    isDocked: true,
    currentPortId: port.id,
    visitedPorts,
    weatherId: rollWeather(state.lat),
    status: nextStatus,
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'dock',
        title: `${port.name} 기항지 정박`,
        detail: `${port.region} 정박 완료 (식수 부패 위험 초기화${port.specialty ? ` · 특산품: ${port.specialty}` : ''})`,
      },
      ...state.logs,
    ],
  };

  return { nextState, dockedPort: port };
}

/**
 * Port Shop: Resupply Food & Water to 100 for 60 G (clears spoilage).
 */
export function buySupplies(state) {
  if (!state.isDocked || state.gold < RESUPPLY_COST) return state;
  const turnInfo = getTurnInfo(state.turn);
  return {
    ...state,
    gold: state.gold - RESUPPLY_COST,
    food: MAX_FOOD,
    turnsWithoutPort: 0,
    isSpoiled: false,
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'trade',
        title: `식량·식수 완충 (-${RESUPPLY_COST} G)`,
        detail: `식량·식수 ${MAX_FOOD} 회복 및 식수 부패 해제`,
      },
      ...state.logs,
    ],
  };
}

/**
 * Port Shop: Repair Hull +35 for 50 G.
 */
export function repairHull(state) {
  if (!state.isDocked || state.gold < REPAIR_COST || state.hull >= 100) return state;
  const nextHull = Math.min(100, state.hull + REPAIR_AMOUNT);
  const gained = nextHull - state.hull;
  const turnInfo = getTurnInfo(state.turn);
  return {
    ...state,
    gold: state.gold - REPAIR_COST,
    hull: nextHull,
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'trade',
        title: `선체 수리 (-${REPAIR_COST} G)`,
        detail: `선체 내구도 +${gained} 회복 (현재 ${nextHull})`,
      },
      ...state.logs,
    ],
  };
}

/**
 * Port Shop: Buy regional specialty item.
 */
export function buySpecialty(state) {
  if (!state.isDocked || !state.currentPortId) return state;
  const port = getPortById(state.currentPortId);
  if (!port || !port.specialty || state.gold < port.buyPrice) return state;

  const turnInfo = getTurnInfo(state.turn);
  const newItem = {
    id: `${port.id}-${Date.now()}-${state.cargo.length}`,
    portId: port.id,
    portName: port.name,
    region: port.region,
    name: port.specialty,
    buyPrice: port.buyPrice,
    multiplier: port.multiplier,
  };

  return {
    ...state,
    gold: state.gold - port.buyPrice,
    cargo: [...state.cargo, newItem],
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'trade',
        title: `특산품 매입: ${port.specialty} (-${port.buyPrice} G)`,
        detail: `${port.name}에서 매입 · 리스본 귀항 시 ${port.multiplier}배(${Math.round(
          port.buyPrice * port.multiplier,
        )} G) 정산`,
      },
      ...state.logs,
    ],
  };
}

/**
 * Emergency Cargo Sale at current docked port (recovers 1.0x purchase price).
 */
export function sellCargoItem(state, index) {
  if (!state.isDocked || index < 0 || index >= state.cargo.length) return state;
  const item = state.cargo[index];
  const nextCargo = state.cargo.filter((_, i) => i !== index);
  const turnInfo = getTurnInfo(state.turn);
  return {
    ...state,
    gold: state.gold + item.buyPrice,
    cargo: nextCargo,
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'trade',
        title: `화물 처분: ${item.name} (+${item.buyPrice} G)`,
        detail: '기항지 상인에게 매입 원가로 처분하여 자금을 확보했습니다.',
      },
      ...state.logs,
    ],
  };
}

/**
 * Final Settlement Calculator matching SPEC §6.
 */
export function calculateFinalSettlement(state) {
  const mission = getMissionById(state.missionId);
  const missionProgress = evaluateMissionProgress(state, mission.id);
  const visitedMaluku = missionProgress.visitedMaluku;

  const cargoBreakdown = state.cargo.map((item) => {
    let appliedMultiplier = 0;
    if (state.status === 'returned') {
      appliedMultiplier = item.multiplier;
    } else if (state.status === 'timeup' && state.isDocked) {
      appliedMultiplier = 1.0;
    }
    const payout = Math.round(item.buyPrice * appliedMultiplier);
    return { ...item, appliedMultiplier, payout };
  });

  const cargoTotal = cargoBreakdown.reduce((sum, item) => sum + item.payout, 0);

  if (state.status === 'stranded' || state.status === 'sunk') {
    return {
      outcomeType: 'disaster',
      mission,
      missionProgress,
      remainingGold: 0,
      cargoTotal: 0,
      resourceBonus: 0,
      missionBonus: 0,
      totalScore: 0,
      visitedMaluku,
      cargoBreakdown,
      rankLabel: '조난 / 난파',
    };
  }

  if (state.status === 'timeup' && !state.isDocked) {
    return {
      outcomeType: 'open_sea_timeup',
      mission,
      missionProgress,
      remainingGold: 0,
      cargoTotal: 0,
      resourceBonus: 0,
      missionBonus: 0,
      totalScore: 0,
      visitedMaluku,
      cargoBreakdown,
      rankLabel: '망망대해 기한 종료 (조난 처리)',
    };
  }

  if (state.status === 'timeup' && state.isDocked) {
    const totalScore = state.gold + cargoTotal;
    return {
      outcomeType: 'overseas_docked',
      mission,
      missionProgress,
      remainingGold: state.gold,
      cargoTotal,
      resourceBonus: 0,
      missionBonus: 0,
      totalScore,
      visitedMaluku,
      cargoBreakdown,
      rankLabel: '해외 기항지 정박 (매입 원금 회수)',
    };
  }

  // Returned to Lisbon within mission turn limit
  const resourceBonus = state.food + state.hull;
  const missionBonus = missionProgress.goalAchieved ? 300 : 0;
  const totalScore = state.gold + cargoTotal + resourceBonus + missionBonus;

  let rankLabel = '무사 귀항 항해사';
  if (mission.id === 'mission_event_cape') {
    rankLabel = missionProgress.goalAchieved
      ? '희망봉 개척 대영웅 (인도양의 문을 연 전설의 항해사!)'
      : '희망봉 도달 미완수';
  } else if (mission.id === 'mission_3') {
    rankLabel = missionProgress.goalAchieved
      ? '세계 일주 대제독 (마젤란·엘카노 완주!)'
      : '부분 항해 귀항 (세계 일주 조건 미달)';
  } else if (mission.id === 'mission_2') {
    rankLabel = missionProgress.goalAchieved
      ? '신항로 명차 대무역상 (서쪽 우회 완수!)'
      : '귀항 완료 (서쪽 아메리카·중국 조건 미달)';
  } else {
    rankLabel =
      visitedMaluku && totalScore >= 1400
        ? '전설의 항해 제독 (향료제도 완주)'
        : visitedMaluku
          ? '향료 무역 개척자 (말루쿠 달성)'
          : totalScore >= 900
            ? '노련한 상단 선장'
            : '무사 귀항 항해사';
  }

  return {
    outcomeType: 'returned',
    mission,
    missionProgress,
    remainingGold: state.gold,
    cargoTotal,
    resourceBonus,
    missionBonus,
    totalScore,
    visitedMaluku,
    cargoBreakdown,
    rankLabel,
  };
}

/**
 * Detect peer fleets within 2.5 cm (25°) for 1st-person deck sails & radar alert.
 */
export function getNearbyFleets(
  myLat,
  myLon,
  myHeadingDeg,
  peers,
  maxRadiusDeg = FLEET_RADAR_RADIUS_DEG,
) {
  const results = [];
  for (const peer of peers) {
    const dLat = peer.lat - myLat;
    const dLon = shortestLonDelta(myLon, peer.lon);
    const distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
    if (distDeg <= maxRadiusDeg) {
      const absBearing = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
      let relBearing = absBearing - myHeadingDeg;
      while (relBearing > 180) relBearing -= 360;
      while (relBearing <= -180) relBearing += 360;

      let sectorLabel = '정면';
      if (relBearing < -20 && relBearing >= -75) sectorLabel = '좌현 전방';
      else if (relBearing > 20 && relBearing <= 75) sectorLabel = '우현 전방';
      else if (relBearing < -75 && relBearing >= -135) sectorLabel = '좌현 측방';
      else if (relBearing > 75 && relBearing <= 135) sectorLabel = '우현 측방';
      else if (Math.abs(relBearing) > 135) sectorLabel = '후방';

      results.push({
        ...peer,
        distDeg: Number(distDeg.toFixed(2)),
        distCm: Number((distDeg / 10).toFixed(1)),
        absBearing: Math.round(absBearing),
        relBearing: Number(relBearing.toFixed(1)),
        sectorLabel,
      });
    }
  }
  return results.sort((a, b) => a.distDeg - b.distDeg);
}
