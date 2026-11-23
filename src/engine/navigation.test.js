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
import { getWeatherById, rollWeather } from '../data/weather.js';
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
  createInitialBattlePayload,
  resolveRpsRound,
  validateTradeOffer,
} from './interactions.js';
import {
  SAFE_OFFSHORE_DEG,
  applySituationCardToState,
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
  repairHull,
  resolveMovement,
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

test('Sailing East directly into West Africa triggers oblique deflection and >= 1.8° offshore separation', () => {
  const result = resolveMovement(10, -20, 90, 40);
  assert.equal(result.collided, true);
  assert.equal(isPointOnLand(result.endLat, result.endLon), false);

  const nearest = findNearestCoast(result.endLat, result.endLon, 10);
  assert.ok(nearest, 'Should find nearby coast');
  assert.ok(
    nearest.distDeg >= SAFE_OFFSHORE_DEG - 0.05,
    `Expected >= ${SAFE_OFFSHORE_DEG}° offshore, got ${nearest.distDeg}`,
  );
  assert.ok(result.blockedRanges.length > 0, 'Should report blocked azimuth ranges');
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

test('Weather-driven Quadrant difficulty blocks occluded shots and tightens storm tolerance', () => {
  const clear = getWeatherById('clear');
  const storm = getWeatherById('storm');
  assert.ok(storm.toleranceDeg < clear.toleranceDeg);
  assert.ok(storm.swayAmpX > clear.swayAmpX * 3);
  assert.ok(storm.cloudCover > 0.9);

  // Shooting while clouds occlude target fails
  const clouded = evaluateQuadrantShot({
    trueAltitudeDeg: 38.7,
    weatherId: 'storm',
    distFromReticle: 0.5,
    swayX: 0,
    swayY: 0,
    isOccluded: true,
  });
  assert.equal(clouded.ok, false);
  assert.equal(clouded.reason, 'cloud');

  // Shooting at 3.5° offset succeeds in clear weather (±4.8°) but misses in storm (±2.6°)
  const clearHit = evaluateQuadrantShot({
    trueAltitudeDeg: 38.7,
    weatherId: 'clear',
    distFromReticle: 3.5,
    swayX: 2.0,
    swayY: 1.5,
    isOccluded: false,
  });
  assert.equal(clearHit.ok, true);

  const stormMiss = evaluateQuadrantShot({
    trueAltitudeDeg: 38.7,
    weatherId: 'storm',
    distFromReticle: 3.5,
    swayX: 2.0,
    swayY: 1.5,
    isOccluded: false,
  });
  assert.equal(stormMiss.ok, false);
  assert.equal(stormMiss.reason, 'missed');

  // Storm sway amplitude and occlusion over time
  const stormFrame = computeWeatherSway('storm', 1.2);
  assert.ok(stormFrame.cloudOpacity > 0.4);
  assert.ok(['clear', 'partly_cloudy', 'fog', 'squall', 'storm'].includes(rollWeather(-40)));
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
