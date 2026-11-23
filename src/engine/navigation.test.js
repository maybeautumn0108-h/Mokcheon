import test from 'node:test';
import assert from 'node:assert/strict';
import { PORTS, REPAIR_COST, RESUPPLY_COST } from '../data/ports.js';
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
import { areAllFleetsReadyForNextTurn } from './fleetSync.js';
import {
  SAFE_OFFSHORE_DEG,
  applySituationCardToState,
  buySpecialty,
  buySupplies,
  calculateFinalSettlement,
  computePlannedMove,
  createInitialGameState,
  executeDockTurn,
  executeSailTurn,
  findNearbyPort,
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
});

test('Departing Lisbon SW sails cleanly into open Atlantic and triggers water spoilage after 6 turns', () => {
  let state = createInitialGameState();
  for (let t = 1; t <= 6; t++) {
    const res = executeSailTurn({ ...state, headingDeg: 205 });
    state = res.nextState;
    assert.equal(state.status, 'active');
    if (t < 6) {
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
  assert.equal(state.food, 100);
  assert.equal(state.isSpoiled, false);
  assert.equal(state.gold, 500 - RESUPPLY_COST);

  state = repairHull(state);
  assert.equal(state.hull, 95);
  assert.equal(state.gold, 500 - RESUPPLY_COST - REPAIR_COST);

  state = buySpecialty(state);
  assert.equal(state.cargo.length, 1);
  assert.equal(state.cargo[0].multiplier, 5.5);

  // Returned to Lisbon settlement: remaining gold + 200*5.5 + (100+95)
  const returnedSettlement = calculateFinalSettlement({
    ...state,
    status: 'returned',
  });
  assert.equal(returnedSettlement.cargoTotal, 1100);
  assert.equal(returnedSettlement.resourceBonus, 195);
  assert.equal(returnedSettlement.totalScore, state.gold + 1100 + 195);
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

test('Fleet proximity radar detects peers within 2.5 cm (25°) and ignores distant ones', () => {
  const nearby = getNearbyFleets(30, -20, 180, [
    { clientId: 'near', teamName: '가까운선단', lat: 20, lon: -20 }, // 10° due South (ahead) = 1.0 cm
    { clientId: 'far', teamName: '먼선단', lat: -10, lon: 10 }, // > 25°
  ]);
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].clientId, 'near');
  assert.equal(nearby[0].distCm, 1.0);
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

test('Synchronized turn lockstep tracks completedTurn and waits until all active fleets finish', () => {
  let s1 = createInitialGameState();
  assert.equal(s1.completedTurn, 0);

  // Sail Turn 1 -> completedTurn stays 0 until Situation Card is picked
  const sailRes = executeSailTurn(s1);
  s1 = sailRes.nextState;
  assert.equal(s1.turn, 2);
  assert.equal(s1.completedTurn, 0);

  // Pick Situation Card -> Turn 1 is now completed
  const cardRes = applySituationCardToState(s1, SITUATION_CARDS[0]);
  s1 = cardRes.nextState;
  assert.equal(s1.completedTurn, 1);

  // Docking also marks the turn completed
  let s2 = { ...createInitialGameState(), hasDepartedLisbon: true };
  const dockRes = executeDockTurn(s2);
  assert.equal(dockRes.nextState.completedTurn, 1);

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
});
