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
import { rollWeather } from '../data/weather.js';

export const SAFE_OFFSHORE_DEG = 1.8;
export const COAST_SIGHT_RADIUS_DEG = 6.0;
export const FLEET_RADAR_RADIUS_DEG = 10.0; // 1.0 cm (1 grid square) on B4 map
export const SPOILAGE_THRESHOLD_TURNS = 6;

export function createInitialGameState() {
  return {
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
    food: 100,
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
        title: '리스본 출항 준비 완료',
        detail: 'B4 항해도와 자를 준비하고 첫 항로를 설정하세요. (출발지: 38.7°N, 9.1°W)',
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
 * Compute blocked azimuth ranges around (lat, lon) within `lookaheadDeg`
 * so the student knows which steering directions are blocked by coastline.
 */
export function computeBlockedAzimuthSummary(lat, lon, lookaheadDeg = 3.2) {
  const blocked = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const sinB = Math.sin(rad);
    const cosB = Math.cos(rad);
    let hit = false;
    for (let d = 0.4; d <= lookaheadDeg; d += 0.4) {
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
 * Ray-march movement on the B4 Euclidean plane with oblique coastal deflection
 * and automatic 1.8° offshore safe-water separation.
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
  let collided = false;
  let hitBoundary = false;
  let collidedAtStep = totalSteps;

  for (let i = 1; i <= totalSteps; i++) {
    const nextLat = curLat + dirLat * stepDeg;
    const nextLon = wrapLon(curLon + dirLon * stepDeg);

    if (nextLat > 75 || nextLat < -65) {
      hitBoundary = true;
      collided = true;
      collidedAtStep = i - 1;
      break;
    }

    if (isPointOnLand(nextLat, nextLon)) {
      collided = true;
      collidedAtStep = i - 1;
      break;
    }

    curLat = nextLat;
    curLon = nextLon;
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

  const traveledBeforeHit = collidedAtStep * stepDeg;
  const remainingDeg = Math.max(0, plannedDeg - traveledBeforeHit);

  if (!hitBoundary && remainingDeg > 0.2) {
    const nearest = findNearestCoast(curLat, curLon, 5.0);
    if (nearest) {
      const toCoastRad = (nearest.bearingToCoastDeg * Math.PI) / 180;
      const nLat = -Math.cos(toCoastRad);
      const nLon = -Math.sin(toCoastRad);

      const t1Lat = -nLon;
      const t1Lon = nLat;
      const t2Lat = nLon;
      const t2Lon = -nLat;

      const dot1 = dirLat * t1Lat + dirLon * t1Lon;
      const dot2 = dirLat * t2Lat + dirLon * t2Lon;
      const tLat = dot1 >= dot2 ? t1Lat : t2Lat;
      const tLon = dot1 >= dot2 ? t1Lon : t2Lon;

      const slideDist = Math.min(remainingDeg * 0.35, 3.5);
      const slideSteps = Math.max(1, Math.round(slideDist / stepDeg));
      for (let s = 1; s <= slideSteps; s++) {
        const candLat = curLat + (tLat * 0.92 + nLat * 0.25) * stepDeg;
        const candLon = wrapLon(curLon + (tLon * 0.92 + nLon * 0.25) * stepDeg);
        if (candLat > 75 || candLat < -65 || isPointOnLand(candLat, candLon)) {
          break;
        }
        curLat = candLat;
        curLon = candLon;
      }
    }
  }

  const safe = pushToSafeOffshore(curLat, curLon, SAFE_OFFSHORE_DEG);
  const actualDeg = b4EuclideanDeg(startLat, startLon, safe.lat, safe.lon);
  const blockedRanges = computeBlockedAzimuthSummary(safe.lat, safe.lon, 3.2);

  return {
    endLat: Number(safe.lat.toFixed(3)),
    endLon: Number(safe.lon.toFixed(3)),
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
export function executeSailTurn(state) {
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

  const baseFoodCost = state.isFullSail ? 18 : 13;
  const foodCost = Math.round(baseFoodCost * (nextIsSpoiled ? 1.5 : 1.0));
  const nextFood = Math.max(0, state.food - foodCost);

  const hullDamage = moveResult.collided ? (state.isFullSail ? 16 : 8) : 0;
  const nextHull = Math.max(0, state.hull - hullDamage);

  const nearbyPort = findNearbyPort(moveResult.endLat, moveResult.endLon);
  const hasDepartedLisbon =
    state.hasDepartedLisbon || nearbyPort?.id !== 'lisbon';

  let nextStatus = 'active';
  const nextTurn = state.turn + 1;

  if (nextHull <= 0) {
    nextStatus = 'sunk';
  } else if (nextFood <= 0) {
    nextStatus = 'stranded';
  } else if (
    hasDepartedLisbon &&
    nearbyPort?.id === 'lisbon' &&
    state.turn >= 2
  ) {
    nextStatus = 'returned';
  } else if (state.turn >= MAX_TURNS) {
    nextStatus = 'timeup';
  }

  const turnInfo = getTurnInfo(state.turn);
  const logTitle = moveResult.collided
    ? `제${state.turn}턴 항해 · 연안 접촉 후 외해 이격 (${moveResult.actualCm.toFixed(1)} cm)`
    : `제${state.turn}턴 항해 완료 · 자로 ${planned.effectiveCm.toFixed(1)} cm 이동`;

  const blockedText =
    moveResult.blockedRanges.length > 0
      ? ` · 막힌 방위: ${moveResult.blockedRanges.join(', ')}`
      : '';

  const logDetail = `방위 ${String(planned.headingDeg).padStart(3, '0')}° · ${planned.windClass.label}${
    state.isFullSail ? '(전속)' : ''
  } · 식량 -${foodCost}${hullDamage > 0 ? ` · 선체 -${hullDamage}` : ''}${blockedText}`;

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
    turnsWithoutPort: nextTurnsWithoutPort,
    isSpoiled: nextIsSpoiled,
    isDocked: false,
    currentPortId: null,
    hasDepartedLisbon,
    nextTurnBonusCm: 0,
    nextTurnMaxCm: null,
    weatherId: rollWeather(moveResult.endLat),
    status: nextStatus,
    trail: [...state.trail, { turn: state.turn, lat: moveResult.endLat, lon: moveResult.endLon }],
    logs: [
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
  const foodCost = Math.round(7 * (state.isSpoiled ? 1.5 : 1.0));
  const nextFood = Math.max(0, state.food - foodCost);
  const nextStatus =
    nextFood <= 0 ? 'stranded' : state.turn >= MAX_TURNS ? 'timeup' : 'active';
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

  const isReturningHome = state.hasDepartedLisbon && port.id === 'lisbon';

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
  const nextStatus = resolvedTurn >= MAX_TURNS ? 'timeup' : 'active';

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
  const nextStatus =
    state.hasDepartedLisbon && port.id === 'lisbon'
      ? 'returned'
      : state.turn >= MAX_TURNS
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
    food: 100,
    turnsWithoutPort: 0,
    isSpoiled: false,
    logs: [
      {
        turn: state.turn,
        dateLabel: turnInfo.label,
        type: 'trade',
        title: `식량·식수 완충 (-${RESUPPLY_COST} G)`,
        detail: '식량·식수 100 회복 및 식수 부패 해제',
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
  const visitedMaluku = state.visitedPorts.includes('maluku');
  const cargoBreakdown = state.cargo.map((item) => {
    let appliedMultiplier = 0;
    if (state.status === 'returned') {
      appliedMultiplier = item.multiplier;
    } else if (state.status === 'timeup' && state.isDocked) {
      appliedMultiplier = 1.0; // Overseas port at turn 30: recover principal only
    }
    const payout = Math.round(item.buyPrice * appliedMultiplier);
    return { ...item, appliedMultiplier, payout };
  });

  const cargoTotal = cargoBreakdown.reduce((sum, item) => sum + item.payout, 0);

  if (state.status === 'stranded' || state.status === 'sunk') {
    return {
      outcomeType: 'disaster',
      remainingGold: 0,
      cargoTotal: 0,
      resourceBonus: 0,
      totalScore: 0,
      visitedMaluku,
      cargoBreakdown,
      rankLabel: '조난 / 난파',
    };
  }

  if (state.status === 'timeup' && !state.isDocked) {
    return {
      outcomeType: 'open_sea_timeup',
      remainingGold: 0,
      cargoTotal: 0,
      resourceBonus: 0,
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
      remainingGold: state.gold,
      cargoTotal,
      resourceBonus: 0,
      totalScore,
      visitedMaluku,
      cargoBreakdown,
      rankLabel: '해외 기항지 정박 (매입 원금 회수)',
    };
  }

  // Returned to Lisbon within 30 turns
  const resourceBonus = state.food + state.hull;
  const totalScore = state.gold + cargoTotal + resourceBonus;
  const rankLabel =
    visitedMaluku && totalScore >= 1400
      ? '전설의 항해 제독 (향료제도 완주)'
      : visitedMaluku
        ? '향료 무역 개척자 (말루쿠 달성)'
        : totalScore >= 900
          ? '노련한 상단 선장'
          : '무사 귀항 항해사';

  return {
    outcomeType: 'returned',
    remainingGold: state.gold,
    cargoTotal,
    resourceBonus,
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
