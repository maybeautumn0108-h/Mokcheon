import test from 'node:test';
import assert from 'node:assert/strict';
import { PORTS, REPAIR_COST, RESUPPLY_COST } from '../data/ports.js';
import { evaluateMissionProgress, getMissionById } from '../data/missions.js';
import {
  findNearestCoast,
  getCoastalSightings,
  isPointOnLand,
} from '../data/worldCoastlines.js';
import { evaluateWind } from '../data/windZones.js';
import { SITUATION_CARDS, drawThreeSituationCards } from '../data/situationCards.js';
import {
  computeSouthLatitude,
  computeWeatherSway,
  evaluateQuadrantShot,
  getCelestialTarget,
  measureWithSway,
} from './quadrant.js';
import { getPolarZone, getWeatherById, isSnowLatitude, rollWeather } from '../data/weather.js';
import {
  OFFLINE_TIMEOUT_MS,
  areAllFleetsCardsReady,
  areAllFleetsReadyForNextTurn,
  isFleetOffline,
} from './fleetSync.js';
import {
  advanceBattleState,
  applyBattleToState,
  applyTradeToState,
  canAcceptTradeOffer,
  canInitiateInteractionWithPeer,
  createInitialBattlePayload,
  resolveRpsRound,
  selectActiveInteractionForPlayer,
  validateTradeOffer,
} from './interactions.js';
import {
  MAX_AI_PER_ROOM,
  computeAiInteractionResponse,
  createAiFleetPayload,
  runAiActivityStep,
  runAiSailAndCardStep,
} from './aiPlayer.js';
import {
  SAFE_OFFSHORE_DEG,
  applySituationCardToState,
  b4EuclideanDeg,
  buySpecialty,
  buySupplies,
  calculateFinalSettlement,
  computePlannedMove,
  createInitialGameState,
  enterPortInActivity,
  executeDockTurn,
  executeSailTurn,
  findNearbyPort,
  findVisiblePortLandmarks,
  finishActivityTurn,
  getNearbyFleets,
  isDirectionImmediatelyBlocked,
  repairHull,
  resolveMovement,
  rollNativeEncounter,
  sellCargoItem,
} from './navigation.js';

test('All historical ports lie in navigable water (not trapped inside land polygons)', () => {
  for (const port of PORTS) {
    assert.equal(
      isPointOnLand(port.lat, port.lon),
      false,
      `Port ${port.name} (${port.lat}, ${port.lon}) should not be inside land polygon`,
    );
    const found = findNearbyPort(port.lat, port.lon);
    assert.equal(found?.id, port.id, `Port ${port.id} should be dockable at its coordinates`);
  }
});

test('Wind evaluation matches B4 ruler distances (1cm / 2cm / 3cm / 4cm + 1cm full sail)', () => {
  const tailwind = evaluateWind(205, 38.7, -9.1, 1, false);
  assert.equal(tailwind.windClass.id, 'tailwind');
  assert.equal(tailwind.moveCm, 4.0);

  const fullTailwind = evaluateWind(205, 38.7, -9.1, 1, true);
  assert.equal(fullTailwind.moveCm, 5.0);

  const headwind = evaluateWind(25, 38.7, -9.1, 1, false);
  assert.equal(headwind.windClass.id, 'headwind');
  assert.equal(headwind.moveCm, 1.0);

  const reach = evaluateWind(295, 38.7, -9.1, 1, false);
  assert.equal(reach.windClass.id, 'reach');
  assert.equal(reach.moveCm, 3.0);

  const doldrums = evaluateWind(180, 0, -20, 1, false);
  assert.equal(doldrums.windClass.id, 'calm');
  assert.equal(doldrums.moveCm, 2.0);
});

test('Sailing East directly into West Africa performs Method A coastal skirting with zero hull damage', () => {
  // Short move near shoreline glides smoothly along closest open coast and stays in navigable water
  const shortGlide = resolveMovement(10, -20, 90, 6);
  assert.equal(shortGlide.collided, true);
  assert.equal(shortGlide.coastalGuided, true);
  assert.equal(isPointOnLand(shortGlide.endLat, shortGlide.endLon), false);
  assert.equal(shortGlide.segments.length, 2);
  assert.ok(shortGlide.actualCm >= 0.55);

  const nearest = findNearestCoast(shortGlide.endLat, shortGlide.endLon, 5);
  assert.ok(nearest, 'Should remain near West African coastline after short coastal glide');
  assert.ok(shortGlide.blockedRanges.length > 0, 'Should report blocked azimuth ranges near shore');

  // Immediate ahead check still warns accurately when stopped adjacent to land
  assert.equal(isDirectionImmediatelyBlocked(shortGlide.endLat, shortGlide.endLon, 90), true);
  assert.equal(isDirectionImmediatelyBlocked(shortGlide.endLat, shortGlide.endLon, 270), false);

  // Full sail turn hitting land inflicts 0 hull damage and continues via coastal skirting
  const initial = { ...createInitialGameState(), lat: 10, lon: -20, headingDeg: 90, isFullSail: true };
  const sailRes = executeSailTurn(initial, () => 0.9);
  assert.equal(sailRes.outcome.collided, true);
  assert.equal(sailRes.outcome.coastalGuided, true);
  assert.equal(sailRes.outcome.hullDamage, 0);
  assert.equal(sailRes.nextState.hull, 100);
  assert.ok(sailRes.outcome.segments.length >= 1);

  // Hitting the north world map boundary stops cleanly at 0 cm with 0 hull damage
  const boundaryStop = executeSailTurn(
    { ...createInitialGameState(), lat: 75, lon: -10, headingDeg: 0 },
    () => 0.9,
  );
  assert.equal(boundaryStop.outcome.collided, true);
  assert.equal(boundaryStop.outcome.hitBoundary, true);
  assert.equal(boundaryStop.outcome.coastalGuided, false);
  assert.equal(boundaryStop.outcome.actualCm, 0);
  assert.equal(boundaryStop.outcome.hullDamage, 0);
});

test('Coastal sightings detect land within 6.0° at Lisbon without exposing continent names', () => {
  const sightings = getCoastalSightings(38.7, -9.1, 205, 6.0);
  assert.ok(sightings.length > 0, 'Lisbon departure should sight Iberian coast within 6.0°');
  for (const s of sightings) {
    assert.ok(s.distDeg <= 6.0);
    assert.equal('continent' in s, false);
  }

  // Port horizon landmarks expose regional archStyle without leaking port names
  const lms = findVisiblePortLandmarks(38.7, -9.1, 205, 8.5);
  assert.ok(lms.length > 0);
  assert.equal(lms[0].archStyle, 'iberia');
  assert.equal('name' in lms[0], false);
});

test('Departing Lisbon SW sails cleanly into open Atlantic and triggers water spoilage after 8 turns', () => {
  let state = createInitialGameState();
  assert.equal(state.food, 140);
  for (let t = 1; t <= 8; t++) {
    const res = executeSailTurn({ ...state, headingDeg: 205 });
    state = res.nextState;
    assert.equal(state.status, 'active');
    if (t < 8) {
      assert.equal(state.isSpoiled, false);
    } else {
      assert.equal(state.isSpoiled, true);
    }
  }
});

test('Docking resets water spoilage and consumes 1 turn', () => {
  let state = createInitialGameState();
  state = {
    ...state,
    lat: 15.0,
    lon: -23.6,
    turnsWithoutPort: 7,
    isSpoiled: true,
    hasDepartedLisbon: true,
  };
  const { nextState, dockedPort } = executeDockTurn(state);
  assert.equal(dockedPort?.id, 'caboverde');
  assert.equal(nextState.turnsWithoutPort, 0);
  assert.equal(nextState.isSpoiled, false);
  assert.equal(nextState.turn, 2);
});

test('Quadrant math accurately models Northern Polaris and Southern Noon Sun formula', () => {
  const north = getCelestialTarget(38.7, 15.5);
  assert.equal(north.hemisphere, 'north');
  assert.equal(north.trueAltitudeDeg, 38.7);

  // At 30°S on Turn 23 (declination -23.5°): h = 90 - 30 - (-23.5) = 83.5°
  const south = getCelestialTarget(-30.0, -23.5);
  assert.equal(south.hemisphere, 'south');
  assert.equal(south.trueAltitudeDeg, 83.5);
  assert.equal(computeSouthLatitude(83.5, -23.5), 30.0);

  const steady = measureWithSway(38.7, 0.2, 0.2);
  assert.equal(steady.precisionLabel, '매우 정밀');
});

test('Situation cards draw 3 distinct cards and NEVER alter ship lat/lon coordinates', () => {
  const drawn = drawThreeSituationCards();
  assert.equal(drawn.length, 3);
  assert.equal(new Set(drawn.map((c) => c.id)).size, 3);

  const base = createInitialGameState();
  for (const card of SITUATION_CARDS) {
    const { nextState } = applySituationCardToState(base, card);
    assert.equal(nextState.lat, base.lat, `Card ${card.id} must not modify lat`);
    assert.equal(nextState.lon, base.lon, `Card ${card.id} must not modify lon`);
  }

  const surgeCard = SITUATION_CARDS.find((c) => c.id === 'trade_wind_surge');
  const { nextState: boosted } = applySituationCardToState(base, surgeCard);
  const planned = computePlannedMove(boosted);
  assert.equal(planned.effectiveCm, 5.0);
});

test('Port shop resupply, hull repair, cargo purchase/sale, and final settlement calculation', () => {
  let state = {
    ...createInitialGameState(),
    lat: -1.5,
    lon: 127.5, // Maluku
    food: 40,
    hull: 60,
    gold: 500,
    isSpoiled: true,
    isDocked: true,
    currentPortId: 'maluku',
    visitedPorts: ['lisbon', 'maluku'],
    hasDepartedLisbon: true,
  };

  state = buySupplies(state);
  assert.equal(state.food, 140);
  assert.equal(state.isSpoiled, false);
  assert.equal(state.gold, 500 - RESUPPLY_COST);

  state = repairHull(state);
  assert.equal(state.hull, 95);
  assert.equal(state.gold, 500 - RESUPPLY_COST - REPAIR_COST);

  state = buySpecialty(state);
  assert.equal(state.cargo.length, 1);
  assert.equal(state.cargo[0].multiplier, 5.5);

  // Returned to Lisbon settlement: remaining gold + 200*5.5 + (140+95) + missionBonus(300)
  const returnedSettlement = calculateFinalSettlement({
    ...state,
    status: 'returned',
  });
  assert.equal(returnedSettlement.cargoTotal, 1100);
  assert.equal(returnedSettlement.resourceBonus, 235);
  assert.equal(returnedSettlement.missionBonus, 300);
  assert.equal(returnedSettlement.totalScore, state.gold + 1100 + 235 + 300);
  assert.equal(returnedSettlement.visitedMaluku, true);

  // Turn 30 docked overseas: recover principal 1.0x only
  const overseasSettlement = calculateFinalSettlement({
    ...state,
    status: 'timeup',
    isDocked: true,
  });
  assert.equal(overseasSettlement.cargoTotal, 200);
  assert.equal(overseasSettlement.totalScore, state.gold + 200);

  // Turn 30 open sea: stranded = 0
  const openSeaSettlement = calculateFinalSettlement({
    ...state,
    status: 'timeup',
    isDocked: false,
  });
  assert.equal(openSeaSettlement.totalScore, 0);

  // Emergency cargo sale restores purchase gold
  const afterSell = sellCargoItem(state, 0);
  assert.equal(afterSell.cargo.length, 0);
  assert.equal(afterSell.gold, state.gold + 200);
});

test('Fleet proximity radar detects peers within 1.0 cm (10°, 1 grid square) and ignores distant ones', () => {
  const nearby = getNearbyFleets(30, -20, 180, [
    { clientId: 'near', teamName: '가까운선단', lat: 21, lon: -20 }, // 9° due South (ahead) = 0.9 cm
    { clientId: 'outside', teamName: '약간먼선단', lat: 18, lon: -20 }, // 12° = 1.2 cm (> 1.0 cm)
    { clientId: 'far', teamName: '먼선단', lat: -10, lon: 10 },
  ]);
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].clientId, 'near');
  assert.equal(nearby[0].distCm, 0.9);
  assert.equal(nearby[0].sectorLabel, '정면');
});

test('Weather-driven Quadrant difficulty blocks storm shots (no fog occlusion) and tightens storm tolerance', () => {
  const clear = getWeatherById('clear');
  const storm = getWeatherById('storm');
  assert.ok(storm.toleranceDeg < clear.toleranceDeg);
  assert.ok(storm.swayAmpX > clear.swayAmpX * 3);
  assert.equal(clear.cloudCover, 0);
  assert.equal(storm.cloudCover, 1.0);

  // Storm blocks Quadrant observation cleanly
  const stormBlocked = evaluateQuadrantShot({
    trueAltitudeDeg: 38.7,
    weatherId: 'storm',
    distFromReticle: 0.5,
    swayX: 0,
    swayY: 0,
    isOccluded: true,
  });
  assert.equal(stormBlocked.ok, false);
  assert.equal(stormBlocked.reason, 'storm');

  // Non-storm weathers never occlude sky (no fog system)
  const squallHit = evaluateQuadrantShot({
    trueAltitudeDeg: 38.7,
    weatherId: 'squall',
    distFromReticle: 1.5,
    swayX: 1.0,
    swayY: 0.5,
    isOccluded: false,
  });
  assert.equal(squallHit.ok, true);

  const clearHit = evaluateQuadrantShot({
    trueAltitudeDeg: 38.7,
    weatherId: 'clear',
    distFromReticle: 3.5,
    swayX: 2.0,
    swayY: 1.5,
    isOccluded: false,
  });
  assert.equal(clearHit.ok, true);

  const stormFrame = computeWeatherSway('storm', 1.2);
  const squallFrame = computeWeatherSway('squall', 1.2);
  assert.equal(stormFrame.isOccluded, true);
  assert.equal(squallFrame.isOccluded, false);
  assert.equal(squallFrame.cloudOpacity, 0);
  assert.ok(['clear', 'partly_cloudy', 'squall', 'storm'].includes(rollWeather(-40)));
});

test('3-step turn flow (1. Sail -> 2. Card -> 3. Activity) tracks turnStep and completedTurn', () => {
  let s1 = createInitialGameState();
  assert.equal(s1.completedTurn, 0);
  assert.equal(s1.turnStep, 'sail');

  // Step 1: Sail Turn 1 -> turnStep becomes 'card', completedTurn still 0
  const sailRes = executeSailTurn(s1);
  s1 = sailRes.nextState;
  assert.equal(s1.turn, 2);
  assert.equal(s1.activeTurn, 1);
  assert.equal(s1.turnStep, 'card');
  assert.equal(s1.completedTurn, 0);

  // Step 2: Pick Situation Card -> turnStep becomes 'activity', cardCompletedTurn = 1, completedTurn still 0
  const cardRes = applySituationCardToState(s1, SITUATION_CARDS[0]);
  s1 = cardRes.nextState;
  assert.equal(s1.turnStep, 'activity');
  assert.equal(s1.cardCompletedTurn, 1);
  assert.equal(s1.completedTurn, 0);

  // Barrier 1: Step 3 does not open until all active fleets complete Step 2 (cards)
  assert.equal(
    areAllFleetsCardsReady(
      [
        { clientId: 'a', status: 'active', cardCompletedTurn: 1 },
        { clientId: 'b', status: 'active', cardCompletedTurn: 0 },
      ],
      1,
    ),
    false,
  );
  assert.equal(
    areAllFleetsCardsReady(
      [
        { clientId: 'a', status: 'active', cardCompletedTurn: 1 },
        { clientId: 'b', status: 'active', cardCompletedTurn: 1 },
      ],
      1,
    ),
    true,
  );

  // Step 3: Finish Activity -> Turn 1 is finalized and turnStep resets to 'sail'
  s1 = finishActivityTurn(s1);
  assert.equal(s1.completedTurn, 1);
  assert.equal(s1.turnStep, 'sail');

  // Entering port during Step 3 docks without advancing turn again
  let portState = {
    ...createInitialGameState(),
    lat: 15.0,
    lon: -23.6,
    activeTurn: 2,
    turn: 3,
    turnStep: 'activity',
    hasDepartedLisbon: true,
    isDocked: false,
    currentPortId: null,
  };
  const entered = enterPortInActivity(portState);
  assert.equal(entered.dockedPort?.id, 'caboverde');
  assert.equal(entered.nextState.isDocked, true);
  assert.equal(entered.nextState.isSpoiled, false);

  // Room lockstep check: 1조 done, 2조 still in Turn 1 -> NOT ready
  assert.equal(
    areAllFleetsReadyForNextTurn(
      [
        { clientId: 'a', status: 'active', completedTurn: 1 },
        { clientId: 'b', status: 'active', completedTurn: 0 },
      ],
      1,
    ),
    false,
  );

  // Both active fleets done (or sunk/returned) -> READY for Turn 2
  assert.equal(
    areAllFleetsReadyForNextTurn(
      [
        { clientId: 'a', status: 'active', completedTurn: 1 },
        { clientId: 'b', status: 'active', completedTurn: 1 },
        { clientId: 'c', status: 'stranded', completedTurn: 0 },
      ],
      1,
    ),
    true,
  );

  // Disconnected/stale offline fleets (> 25s without heartbeat) do NOT block turn progression
  const now = 1_000_000;
  assert.equal(isFleetOffline({ updatedAt: now - OFFLINE_TIMEOUT_MS - 1000 }, now), true);
  assert.equal(isFleetOffline({ updatedAt: now - 3000 }, now), false);
  assert.equal(
    areAllFleetsCardsReady(
      [
        { clientId: 'a', status: 'active', cardCompletedTurn: 2, updatedAt: now - 1000 },
        { clientId: 'ghost', status: 'active', cardCompletedTurn: 0, updatedAt: now - 40000 },
      ],
      2,
      now,
    ),
    true,
  );
  assert.equal(
    areAllFleetsReadyForNextTurn(
      [
        { clientId: 'a', status: 'active', completedTurn: 2, updatedAt: now - 1000 },
        { clientId: 'ghost', status: 'active', completedTurn: 0, updatedAt: now - 40000 },
      ],
      2,
      now,
    ),
    true,
  );
});

test('Ship-to-ship Best-of-3 Rock-Paper-Scissors battle and trade exchange logic', () => {
  assert.equal(resolveRpsRound('rock', 'scissors'), 'initiator');
  assert.equal(resolveRpsRound('rock', 'paper'), 'target');
  assert.equal(resolveRpsRound('paper', 'paper'), 'draw');

  let payload = createInitialBattlePayload();
  // Round 1: draw (stays on round 1)
  let step = advanceBattleState(payload, 'initiator', 'rock');
  assert.equal(step.nextStatus, 'active');
  step = advanceBattleState(step.nextPayload, 'target', 'rock');
  assert.equal(step.nextStatus, 'active');
  assert.equal(step.nextPayload.round, 1);
  assert.equal(step.nextPayload.initiatorWins, 0);

  // Round 1 replay: initiator wins (1-0)
  step = advanceBattleState(step.nextPayload, 'initiator', 'scissors');
  step = advanceBattleState(step.nextPayload, 'target', 'paper');
  assert.equal(step.nextStatus, 'active');
  assert.equal(step.nextPayload.initiatorWins, 1);
  assert.equal(step.nextPayload.round, 2);

  // Round 2: initiator wins (2-0 -> battle completed!)
  step = advanceBattleState(step.nextPayload, 'initiator', 'rock');
  step = advanceBattleState(step.nextPayload, 'target', 'scissors');
  assert.equal(step.nextStatus, 'completed');
  assert.equal(step.nextPayload.winnerRole, 'initiator');

  const winnerState = applyBattleToState(createInitialGameState(), true, '2조', step.nextPayload);
  assert.equal(winnerState.gold, 560);
  const loserState = applyBattleToState(createInitialGameState(), false, '1조', step.nextPayload);
  assert.equal(loserState.gold, 440);
  assert.equal(loserState.hull, 85);

  // Trade exchange: initiator gives 50G for 15 food
  const offer = { giveType: 'gold', giveAmount: 50, wantType: 'food', wantAmount: 15 };
  const sInit = { ...createInitialGameState(), gold: 200, food: 40 };
  const sTarg = { ...createInitialGameState(), gold: 100, food: 80 };
  assert.equal(validateTradeOffer(sInit, offer), null);
  assert.equal(canAcceptTradeOffer(sTarg, offer), true);

  const afterInit = applyTradeToState(sInit, offer, true, '2조');
  assert.equal(afterInit.gold, 150);
  assert.equal(afterInit.food, 55);

  const afterTarg = applyTradeToState(sTarg, offer, false, '1조');
  assert.equal(afterTarg.gold, 150);
  assert.equal(afterTarg.food, 65);
});

test('Multi-mission system enforces Western Americas route for Mission 2 and full globe for Mission 3', () => {
  assert.equal(getMissionById('mission_1').maxTurns, 30);
  assert.equal(getMissionById('mission_2').maxTurns, 34);
  assert.equal(getMissionById('mission_3').maxTurns, 40);

  // Mission 2: Visiting Macau ONLY via eastern Indian Ocean does NOT satisfy West-route requirement
  const m2EastOnly = {
    ...createInitialGameState('mission_2'),
    status: 'returned',
    visitedPorts: ['lisbon', 'cape', 'goa', 'malacca', 'macau'],
    trail: [
      { lat: 38.7, lon: -9.1 },
      { lat: -34.4, lon: 18.5 },
      { lat: 15.5, lon: 73.8 },
      { lat: 22.2, lon: 113.5 },
    ],
  };
  const m2Fail = evaluateMissionProgress(m2EastOnly, 'mission_2');
  assert.equal(m2Fail.visitedChina, true);
  assert.equal(m2Fail.hasWestRoute, false);
  assert.equal(m2Fail.goalAchieved, false);

  // Mission 2: Passing Strait of Magellan / Rio + Macau + returning to Lisbon achieves Mission 2
  const m2WestAndMacau = {
    ...createInitialGameState('mission_2'),
    status: 'returned',
    visitedPorts: ['lisbon', 'magellan', 'guam', 'macau'],
    trail: [
      { lat: 38.7, lon: -9.1 },
      { lat: -53.5, lon: -70.0 },
      { lat: 13.5, lon: 144.8 },
      { lat: 22.2, lon: 113.5 },
    ],
  };
  const m2Ok = evaluateMissionProgress(m2WestAndMacau, 'mission_2');
  assert.equal(m2Ok.visitedChina, true);
  assert.equal(m2Ok.hasWestRoute, true);
  assert.equal(m2Ok.goalAchieved, true);

  // Settlement gives mission bonus ONLY when goalAchieved === true
  const sFail = calculateFinalSettlement(m2EastOnly);
  assert.equal(sFail.missionBonus, 0);
  const sWin = calculateFinalSettlement(m2WestAndMacau);
  assert.equal(sWin.missionBonus, 300);

  // Mission 3: Visiting Americas only and turning back does NOT complete circumnavigation
  const m3Partial = evaluateMissionProgress(
    {
      ...createInitialGameState('mission_3'),
      status: 'returned',
      visitedPorts: ['lisbon', 'rio', 'magellan'],
      trail: [
        { lat: 38.7, lon: -9.1 },
        { lat: -22.9, lon: -43.2 },
        { lat: -53.5, lon: -70.0 },
      ],
    },
    'mission_3',
  );
  assert.equal(m3Partial.hasWestRoute, true);
  assert.equal(m3Partial.hasEastRoute, false);
  assert.equal(m3Partial.goalAchieved, false);

  const m3Full = evaluateMissionProgress(
    {
      ...createInitialGameState('mission_3'),
      status: 'returned',
      visitedPorts: ['lisbon', 'magellan', 'guam', 'maluku', 'cape'],
      trail: [
        { lat: 38.7, lon: -9.1 },
        { lat: -53.5, lon: -70.0 },
        { lat: 13.5, lon: 144.8 },
        { lat: -1.5, lon: 127.5 },
        { lat: -34.4, lon: 18.5 },
      ],
    },
    'mission_3',
  );
  assert.equal(m3Full.hasWestRoute, true);
  assert.equal(m3Full.hasEastRoute, true);
  assert.equal(m3Full.goalAchieved, true);
});

test('New Americas ports maintain healthy separation (>= 14°) and polar waters trigger snow/warnings', () => {
  const newAmericasIds = ['stjohns', 'jamestown', 'monterey', 'laplata', 'valparaiso', 'callao'];
  for (const id of newAmericasIds) {
    const port = PORTS.find((p) => p.id === id);
    assert.ok(port, `Missing new port ${id}`);
    for (const other of PORTS) {
      if (other.id === id) continue;
      const dist = b4EuclideanDeg(port.lat, port.lon, other.lat, other.lon);
      assert.ok(dist >= 14.0, `Port ${id} too close to ${other.id}: ${dist.toFixed(2)}°`);
    }
  }

  assert.equal(isSnowLatitude(38.7), false);
  assert.equal(getPolarZone(38.7), null);
  assert.equal(isSnowLatitude(60), true);
  assert.equal(getPolarZone(60)?.id, 'arctic');
  assert.equal(isSnowLatitude(-54), true);
  assert.equal(getPolarZone(-54)?.id, 'antarctic');

  const arcticSail = executeSailTurn({
    ...createInitialGameState(),
    lat: 60,
    lon: -10,
    headingDeg: 270,
  });
  assert.equal(arcticSail.outcome.polarZone?.id, 'arctic');
});

test('Food cost is 10/turn, position check opens every 3 turns, and non-port land rolls 50% native (30% good / 70% bad)', () => {
  // Base food consumption is 10/turn
  const t1 = executeSailTurn({ ...createInitialGameState(), turn: 1, headingDeg: 205 });
  assert.equal(t1.outcome.foodCost, 10);
  assert.equal(t1.nextState.food, 130);
  assert.equal(t1.outcome.isPositionCheckTurn, false);

  // Every 3 turns triggers position check flag
  const t3 = executeSailTurn({ ...createInitialGameState(), turn: 3, headingDeg: 205 });
  assert.equal(t3.outcome.isPositionCheckTurn, true);
  const t6 = executeSailTurn({ ...createInitialGameState(), turn: 6, headingDeg: 205 });
  assert.equal(t6.outcome.isPositionCheckTurn, true);

  // Native encounter probabilities: 50% met, then 30% good / 70% bad
  assert.equal(rollNativeEncounter(() => 0.5).met, false);
  assert.equal(rollNativeEncounter(() => 0.49).met, true);

  const seqGood = [0.1, 0.29, 0.0];
  let idxG = 0;
  const goodRes = rollNativeEncounter(() => seqGood[idxG++]);
  assert.equal(goodRes.met, true);
  assert.equal(goodRes.isGood, true);
  assert.ok(goodRes.foodDelta > 0 || goodRes.goldDelta > 0 || goodRes.hullDelta > 0);

  const seqBad = [0.1, 0.31, 0.0];
  let idxB = 0;
  const badRes = rollNativeEncounter(() => seqBad[idxB++]);
  assert.equal(badRes.met, true);
  assert.equal(badRes.isGood, false);
  assert.ok(badRes.foodDelta < 0 || badRes.goldDelta < 0 || badRes.hullDelta < 0);

  // Landing at an uncharted coast (non-port land) triggers native encounter via RNG
  // Sail East at lat 10, lon -20 hits West Africa around lon -15.6 (no port nearby)
  const seqCoastGood = [0.2, 0.1, 0.0];
  let idxC = 0;
  const coastLand = executeSailTurn(
    { ...createInitialGameState(), lat: 10, lon: -20, headingDeg: 90 },
    () => seqCoastGood[idxC++] ?? 0.5,
  );
  assert.equal(coastLand.outcome.collided, true);
  assert.equal(coastLand.outcome.nearbyPort, null);
  assert.equal(coastLand.outcome.nativeEncounter?.met, true);
  assert.equal(coastLand.outcome.nativeEncounter?.isGood, true);
});

test('Ports enforce tight docking radii (2.0° small islands / 3.5~4.0° continental) and interaction guards prevent infinite battles', () => {
  for (const port of PORTS) {
    if (port.isSmallIsland) {
      assert.equal(port.dockRadiusDeg, 2.0, `Small island ${port.id} should use tight 2.0° radius`);
    } else {
      assert.ok(
        port.dockRadiusDeg >= 3.5 && port.dockRadiusDeg <= 4.0,
        `Port ${port.id} dockRadiusDeg should be 3.5~4.0, got ${port.dockRadiusDeg}`,
      );
    }
  }
  // Caboverde at (15.0, -23.6) requires approaching within 2.0°, and is NOT triggered 5.5° west (-29.1)
  assert.equal(findNearbyPort(15.0, -25.4)?.id, 'caboverde');
  assert.equal(findNearbyPort(15.0, -29.1), null);

  // Guard blocks duplicate initiation after already initiating or after a declined challenge in the same turn
  const turn3Interactions = [
    {
      id: 'i1',
      turn: 3,
      initiatorId: 'team-a',
      targetId: 'team-b',
      status: 'declined',
      updatedAt: Date.now(),
    },
    {
      id: 'i2',
      turn: 3,
      initiatorId: 'team-c',
      targetId: 'team-d',
      status: 'active',
      updatedAt: Date.now(),
    },
  ];
  // Team A cannot re-challenge Team B (or anyone) in Turn 3 even after Team B declined
  assert.equal(
    canInitiateInteractionWithPeer(turn3Interactions, 'team-a', 'team-b', 3, false).allowed,
    false,
  );
  // Team B cannot challenge Team C while Team C is in an active battle with Team D
  assert.equal(
    canInitiateInteractionWithPeer(turn3Interactions, 'team-b', 'team-c', 3, false).allowed,
    false,
  );
  // Once room advances to Turn 4, old Turn 3 declined/pending/active interactions are ignored
  assert.equal(
    canInitiateInteractionWithPeer(turn3Interactions, 'team-a', 'team-b', 4, false).allowed,
    true,
  );

  // Stale Turn 2 pending battle must NOT surface on Turn 3
  const staleList = [
    {
      id: 'old-battle',
      turn: 2,
      initiatorId: 'team-a',
      targetId: 'team-b',
      status: 'pending',
      updatedAt: Date.now(),
    },
  ];
  assert.equal(selectActiveInteractionForPlayer(staleList, 'team-b', 3, new Set()), null);
  assert.equal(selectActiveInteractionForPlayer(staleList, 'team-b', 2, new Set())?.id, 'old-battle');
});

test('AI players cap at 3/room, stay online, battle/trade proactively, and Lv.4 outperforms Lv.1', () => {
  // Enforce MAX_AI_PER_ROOM = 3
  const list = [];
  for (let i = 0; i < MAX_AI_PER_ROOM; i++) {
    const ai = createAiFleetPayload({
      existingFleets: list,
      personality: i === 0 ? 'pirate' : i === 1 ? 'explorer' : 'merchant',
      level: i + 2,
      missionId: 'mission_1',
    });
    assert.ok(ai);
    assert.equal(isFleetOffline({ ...ai, updatedAt: Date.now() - 120000 }), false);
    list.push(ai);
  }
  assert.equal(
    createAiFleetPayload({ existingFleets: list, personality: 'pirate', level: 4 }),
    null,
  );

  // Pirate AI initiates proactive battle against nearby human fleet in Step 3
  const pirate = list[0];
  const nearbyHuman = {
    clientId: 'human-1',
    teamName: '1조 학생',
    status: 'active',
    lat: pirate.lat,
    lon: pirate.lon - 2.0,
    headingDeg: 180,
  };
  const actRes = runAiActivityStep(
    pirate,
    1,
    'mission_1',
    [pirate, nearbyHuman],
    [],
    () => 0.1, // triggers battleChance (0.72)
  );
  assert.equal(actRes.newInteraction?.type, 'battle');
  assert.equal(actRes.newInteraction?.initiatorId, pirate.clientId);

  // AI plays pure random RPS choice in active battle
  const resp = computeAiInteractionResponse(
    pirate,
    {
      id: 'b-ai',
      type: 'battle',
      status: 'active',
      initiatorId: 'human-1',
      targetId: pirate.clientId,
      payload: createInitialBattlePayload(),
    },
    () => 0.4,
  );
  assert.ok(['rock', 'paper', 'scissors'].includes(resp.patch.payload.targetChoice));

  // Deterministic PRNG helper to compare Lv.1 Novice vs Lv.4 Master over Mission 1 (30 turns)
  const makeRng = (seed = 42) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  };

  let lv1 = createAiFleetPayload({ personality: 'explorer', level: 1, missionId: 'mission_1' });
  let lv4 = createAiFleetPayload({ personality: 'explorer', level: 4, missionId: 'mission_1' });
  const rng1 = makeRng(7);
  const rng4 = makeRng(7);

  for (let t = 1; t <= 30; t++) {
    if (lv1.status === 'active') {
      lv1 = runAiSailAndCardStep(lv1, t, 'mission_1', rng1);
      lv1 = runAiActivityStep(lv1, t, 'mission_1', [lv1], [], rng1).updatedFleet;
    }
    if (lv4.status === 'active') {
      lv4 = runAiSailAndCardStep(lv4, t, 'mission_1', rng4);
      lv4 = runAiActivityStep(lv4, t, 'mission_1', [lv4], [], rng4).updatedFleet;
    }
  }

  // Lv.1 Novice fails Mission 1 goal (never completes Maluku voyage), while Lv.4 Master returns with goal achieved!
  assert.equal(
    evaluateMissionProgress(lv1.aiConfig.state, 'mission_1').goalAchieved,
    false,
  );
  assert.equal(lv4.status, 'returned');
  assert.equal(
    evaluateMissionProgress(lv4.aiConfig.state, 'mission_1').goalAchieved,
    true,
  );

  // Pirate AI prioritizes human fleets (within 16° ambush radius) over closer AI peers
  const ambushPirate = createAiFleetPayload({ personality: 'pirate', level: 3, missionId: 'mission_event_cape' });
  const peerBot = createAiFleetPayload({
    existingFleets: [ambushPirate],
    personality: 'explorer',
    level: 2,
    missionId: 'mission_event_cape',
  });
  const humanFleet = {
    clientId: 'human-player-1',
    teamName: '사람 탐험단',
    status: 'active',
    isAi: false,
    lat: ambushPirate.lat - 12, // 12° away (outside standard 10° radar, inside pirate 16° ambush radius; peerBot is 0° away)
    lon: ambushPirate.lon,
    headingDeg: 180,
  };
  const pirateAmbush = runAiActivityStep(
    ambushPirate,
    1,
    'mission_event_cape',
    [ambushPirate, peerBot, humanFleet],
    [],
    () => 0.2,
  );
  assert.ok(pirateAmbush.newInteraction, 'Pirate should initiate battle with nearby human fleet');
  assert.equal(pirateAmbush.newInteraction.type, 'battle');
  assert.equal(pirateAmbush.newInteraction.initiatorId, ambushPirate.clientId);
  assert.equal(pirateAmbush.newInteraction.targetId, humanFleet.clientId);
});

test('19. Event mission (mission_event_cape): 15 turns, 2-turn map check, doldrums fail & Volta do Mar balance', () => {
  const mission = getMissionById('mission_event_cape');
  assert.equal(mission.id, 'mission_event_cape');
  assert.equal(mission.maxTurns, 15);
  assert.equal(mission.positionCheckInterval, 2);
  assert.equal(mission.isOneWayGoal, true);
  assert.equal(mission.goalPortId, 'goodhope');
  assert.equal(mission.chartDegPerCm, 5);
  assert.equal(mission.chartSizeLabel, 'A4');
  assert.equal(mission.foodCostPerTurn, 15);

  // Turn 1: not a position check turn; Turn 2: position check turn (every 2 turns), scaled to A4 (1cm = 5deg) & -15 food
  let state = createInitialGameState('mission_event_cape');
  const planned = computePlannedMove({ ...state, headingDeg: 205 });
  assert.equal(planned.degPerCm, 5);
  assert.equal(planned.chartSizeLabel, 'A4');
  assert.equal(planned.normalFoodCost, 15);
  assert.equal(planned.effectiveCm, Number((planned.effectiveDeg / 5).toFixed(1)));
  const t1 = executeSailTurn({ ...state, turnStep: 'sail', headingDeg: 205 }, () => 0.9);
  assert.equal(t1.nextState.food, state.food - 15);
  assert.equal(t1.outcome.isPositionCheckTurn, false);
  assert.equal(t1.outcome.positionCheckInterval, 2);
  assert.equal(t1.outcome.degPerCm, 5);
  assert.equal(t1.outcome.chartSizeLabel, 'A4');
  assert.equal(t1.outcome.plannedCm, planned.effectiveCm);

  const t2 = executeSailTurn(
    { ...t1.nextState, turnStep: 'sail', headingDeg: 205 },
    () => 0.9,
  );
  assert.equal(t2.outcome.completedTurn, 2);
  assert.equal(t2.outcome.isPositionCheckTurn, true);
  assert.equal(t2.outcome.positionCheckInterval, 2);

  // One-way goal arrival near Cape of Good Hope immediately triggers mission victory without returning to Lisbon
  const approachCape = {
    ...createInitialGameState('mission_event_cape'),
    turn: 5,
    lat: -34.5,
    lon: 17.5,
    headingDeg: 90,
    plannedCm: 3,
    turnStep: 'sail',
  };
  const winRes = executeSailTurn(approachCape, () => 0.9);
  assert.equal(winRes.nextState.status, 'returned');
  assert.equal(winRes.outcome.nextStatus, 'returned');
  assert.equal(winRes.nextState.visitedPorts.includes('goodhope'), true);
  assert.equal(
    evaluateMissionProgress(winRes.nextState, 'mission_event_cape').goalAchieved,
    true,
  );
  const settlement = calculateFinalSettlement(winRes.nextState);
  assert.equal(settlement.missionBonus, 300);

  // Lv.4 Master AI completes mission_event_cape within 15 turns
  const makeRng = (seed = 19) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  };
  let aiCape = createAiFleetPayload({
    personality: 'explorer',
    level: 4,
    missionId: 'mission_event_cape',
  });
  const rngCape = makeRng(19);
  for (let t = 1; t <= 15; t++) {
    if (aiCape.status === 'active') {
      aiCape = runAiSailAndCardStep(aiCape, t, 'mission_event_cape', rngCape);
      aiCape = runAiActivityStep(aiCape, t, 'mission_event_cape', [aiCape], [], rngCape).updatedFleet;
    }
  }
  assert.equal(aiCape.status, 'returned');
  assert.ok(aiCape.aiConfig.state.turn >= 7 && aiCape.aiConfig.state.turn <= 12, `Expected Lv.4 AI 7~12 turns, got ${aiCape.aiConfig.state.turn}`);
  assert.equal(
    evaluateMissionProgress(aiCape.aiConfig.state, 'mission_event_cape').goalAchieved,
    true,
  );

  // Verify 15-turn balance: optimal (~8-9 turns), 1-mistake + resupply recovery (<= 15), forcing doldrums fails
  const runCapeStrategy = (wps, { isMistakeTurn1 = false, forceDoldrums = false, dockResupply = false } = {}) => {
    let s = createInitialGameState('mission_event_cape');
    let wpIdx = 0;
    for (let t = 1; t <= 15; t++) {
      if (s.status !== 'active') break;
      while (
        wpIdx < wps.length - 1 &&
        (dockResupply && wpIdx === 0
          ? s.visitedPorts.includes('caboverde')
          : b4EuclideanDeg(s.lat, s.lon, wps[wpIdx].lat, wps[wpIdx].lon) <= 10)
      ) {
        wpIdx++;
      }
      const tgt = wps[wpIdx];
      let h = Math.round(((Math.atan2(tgt.lon - s.lon, tgt.lat - s.lat) * 180) / Math.PI + 360) % 360);
      if (isMistakeTurn1 && t === 1) {
        h = 135;
      }
      const res = executeSailTurn({ ...s, headingDeg: h, isFullSail: false }, () => 0.9);
      s = { ...res.nextState, turnStep: 'activity' };
      if (dockResupply && s.status === 'active') {
        const ep = enterPortInActivity(s);
        if (ep.dockedPort) {
          s = buySupplies(ep.nextState);
        }
      }
      if (s.status === 'active') {
        s = finishActivityTurn(s);
      }
    }
    return s;
  };
  const optRes = runCapeStrategy([{ lat: 20, lon: -26 }, { lat: -33, lon: -16 }, { lat: -34.5, lon: 18.5 }]);
  assert.equal(optRes.status, 'returned');
  assert.ok(optRes.turn <= 10, `Expected optimal route <= 10 turns, got ${optRes.turn}`);

  const mistRes = runCapeStrategy(
    [{ lat: 15.0, lon: -23.6 }, { lat: -33, lon: -16 }, { lat: -34.5, lon: 18.5 }],
    { isMistakeTurn1: true, dockResupply: true },
  );
  assert.equal(mistRes.status, 'returned');
  assert.ok(mistRes.turn >= 10 && mistRes.turn <= 15, `Expected 1-mistake recovery 10~15 turns, got ${mistRes.turn}`);

  const doldrumsRes = runCapeStrategy(
    [{ lat: 3, lon: -5 }, { lat: -10, lon: 8 }, { lat: -34.5, lon: 18.5 }],
    { forceDoldrums: true, dockResupply: true },
  );
  assert.notEqual(doldrumsRes.status, 'returned', 'Forcing straight through equatorial doldrums must fail');
});

test('20. 3-segment island bypass resumes original heading after Taiwan, and small-island ports stop on entry then depart freely', () => {
  // 1) Taiwan (23.5°N, 121.0°E) remains a full landmass polygon, and bypassing it resumes original heading (3 segments)
  assert.equal(isPointOnLand(23.5, 121.0), true);
  const bypassTaiwan = resolveMovement(27.0, 121.0, 180, 40);
  assert.equal(bypassTaiwan.collided, true);
  assert.equal(bypassTaiwan.coastalGuided, true);
  assert.equal(bypassTaiwan.resumedOriginalHeading, true);
  assert.equal(bypassTaiwan.segments.length, 3);
  assert.deepEqual(
    bypassTaiwan.segments.map((s) => s.kind),
    ['straight', 'coastal', 'resume'],
  );
  assert.equal(bypassTaiwan.segments[2].headingDeg, 180);

  // 2) Small island ports (Canaries, Azores, Cabo Verde, Guam) have no blocking land and are ignored on horizon landmarks
  assert.equal(isPointOnLand(28.1, -15.4), false);
  const nearCanariesLms = findVisiblePortLandmarks(30.0, -14.5, 205, 10.0);
  assert.equal(
    nearCanariesLms.some((lm) => lm.id === 'canaries'),
    false,
    'Canary Islands should be ignored in horizon landmarks',
  );
  const canariesPort = findNearbyPort(28.1, -15.4);
  assert.equal(canariesPort?.id, 'canaries');
  assert.equal(canariesPort?.isSmallIsland, true);

  // 3) Passing through Canaries from Lisbon stops upon entering Canaries dock radius,
  //    then departing from inside Canaries on the next turn moves freely through without halting again
  const stopAtCanaries = resolveMovement(38.7, -9.1, 205, 30);
  assert.equal(stopAtCanaries.collided, false);
  assert.equal(stopAtCanaries.stoppedAtPort?.id, 'canaries');
  assert.equal(findNearbyPort(stopAtCanaries.endLat, stopAtCanaries.endLon)?.id, 'canaries');

  const departCanaries = resolveMovement(stopAtCanaries.endLat, stopAtCanaries.endLon, 215, 20);
  assert.notEqual(departCanaries.stoppedAtPort?.id, 'canaries');
  assert.ok(departCanaries.actualCm >= 1.5);

  // 4) Sailing NE at (2.0, -11.0) for 2.5 cm hits Ivory Coast, glides ESE along Gulf of Guinea,
  //    and halts unconditionally upon entering Elmina radius
  const coastGlideToPort = resolveMovement(2.0, -11.0, 45, 25);
  assert.equal(coastGlideToPort.collided, true);
  assert.equal(coastGlideToPort.coastalGuided, true);
  assert.equal(coastGlideToPort.segments.length, 2);
  assert.equal(coastGlideToPort.stoppedAtPort?.id, 'elmina');
  assert.ok(coastGlideToPort.actualCm < 2.5, 'Should stop early upon entering Elmina radius');
  assert.equal(findNearbyPort(coastGlideToPort.endLat, coastGlideToPort.endLon)?.id, 'elmina');
});

test('21. Settlement calculates navigation grade (8t S, 9t A, 10~11t B, 12+t C, fail F) consistently', () => {
  const mkCapeWin = (completedTurn) =>
    calculateFinalSettlement({
      ...createInitialGameState('mission_event_cape'),
      status: 'returned',
      completedTurn,
      activeTurn: completedTurn,
      turn: completedTurn,
      visitedPorts: ['lisbon', 'goodhope'],
      gold: 400,
      food: 60,
      hull: 90,
    });

  assert.equal(mkCapeWin(8).grade, 'S');
  assert.equal(mkCapeWin(9).grade, 'A');
  assert.equal(mkCapeWin(10).grade, 'B');
  assert.equal(mkCapeWin(11).grade, 'B');
  assert.equal(mkCapeWin(12).grade, 'C');
  assert.equal(mkCapeWin(15).grade, 'C');

  const partialReturn = calculateFinalSettlement({
    ...createInitialGameState('mission_1'),
    status: 'returned',
    visitedPorts: ['lisbon', 'canaries'],
    gold: 300,
    food: 50,
    hull: 50,
  });
  assert.equal(partialReturn.grade, 'F');

  const openSeaTimeup = calculateFinalSettlement({
    ...createInitialGameState('mission_event_cape'),
    status: 'timeup',
    isDocked: false,
  });
  assert.equal(openSeaTimeup.grade, 'F');

  const disaster = calculateFinalSettlement({
    ...createInitialGameState('mission_event_cape'),
    status: 'stranded',
  });
  assert.equal(disaster.grade, 'F');
});
