/**
 * Host-selectable Classroom Missions:
 * 1. Mission 1: Spice Islands (Maluku) Round-trip (30 turns)
 * 2. Mission 2: Ming China Tea via Mandatory Western Americas Route (34 turns)
 * 3. Mission 3: Full Global Circumnavigation (40 turns)
 */

export const WEST_ROUTE_PORTS = new Set([
  'stjohns',
  'jamestown',
  'havana',
  'salvador',
  'laplata',
  'magellanstrait',
  'valparaiso',
  'callao',
  'acapulco',
  'monterey',
  'guam',
]);

export const EAST_ROUTE_PORTS = new Set([
  'goodhope',
  'sofala',
  'malindi',
  'aden',
  'hormuz',
  'goacalicut',
  'colombo',
  'malacca',
  'maluku',
  'macau',
  'manila',
  'nagasaki',
]);

export const MISSIONS = [
  {
    id: 'mission_1',
    shortTitle: '미션 1 · 향료제도',
    title: '미션 1: 향료제도(말루쿠) 왕복',
    maxTurns: 30,
    positionCheckInterval: 3,
    badgeText: '말루쿠 왕복 · 30턴',
    summary: '희망봉과 인도양 계절풍을 타고 동남아시아 향료제도(말루쿠)에서 정향·육두구를 매입해 리스본으로 귀항하세요.',
    rulesNote: '목표 항구: 향료제도(말루쿠) 기항 후 리스본 복귀',
  },
  {
    id: 'mission_2',
    shortTitle: '미션 2 · 중국 차(서쪽 항로)',
    title: '미션 2: 명나라 차 구하기 (서쪽 아메리카 우회 필수)',
    maxTurns: 34,
    positionCheckInterval: 3,
    badgeText: '서쪽 우회 → 중국 차 · 34턴',
    summary: '토르데시야스 조약으로 아프리카·인도양 봉쇄! 반드시 서쪽 아메리카(바이아·아바나·마젤란 해협·아카풀코 중 1곳 이상 또는 서경 55°W 이서)를 거쳐 중국(마카오·광저우)의 명차를 싣고 귀항하세요.',
    rulesNote: '필수 조건: ① 서쪽 아메리카 경유 ② 마카오·광저우 기항 ③ 리스본 귀항',
  },
  {
    id: 'mission_3',
    shortTitle: '미션 3 · 지구 한 바퀴',
    title: '미션 3: 지구 한 바퀴 세계 일주',
    maxTurns: 40,
    positionCheckInterval: 3,
    badgeText: '세계 일주 · 40턴',
    summary: '마젤란의 꿈을 완성하세요! 서반구(아메리카·태평양)와 동반구(아시아·인도양·희망봉)를 모두 통과해 지구를 한 바퀴 돌아 리스본으로 귀항하세요.',
    rulesNote: '필수 조건: ① 서반구(서경 60°W 이서) ② 동반구(동경 60°E 이동) ③ 리스본 귀항',
  },
  {
    id: 'mission_event_cape',
    shortTitle: '행사 · 희망봉 찾기',
    title: '행사 미션: 희망봉 개척 (10턴 단방향)',
    maxTurns: 10,
    positionCheckInterval: 2,
    isOneWayGoal: true,
    goalPortId: 'goodhope',
    badgeText: '희망봉 도착 · 10턴 · 2턴 위치확인',
    summary: '바르톨로메우 디아스의 발자취를 따라 10턴 안에 아프리카 최남단 희망봉에 도착하세요! 귀항 없이 희망봉에 닿기만 하면 위대한 항해사로 인정받습니다.',
    rulesNote: '목표: 10턴 이내 희망봉 도착 (귀항 불필요 · 2턴마다 위치 확인)',
  },
];

export function getMissionById(missionId) {
  return MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
}

/**
 * Evaluate mission-specific milestone completion from state & trail.
 */
export function evaluateMissionProgress(state, missionId = 'mission_1') {
  const visited = new Set(state?.visitedPorts || []);
  const trail = state?.trail || [];

  const crossedFarWest = trail.some((pt) => pt.lon <= -55);
  const crossedFarEast = trail.some((pt) => pt.lon >= 60);

  const visitedWestPort = [...visited].some((id) => WEST_ROUTE_PORTS.has(id));
  const visitedEastPort = [...visited].some((id) => EAST_ROUTE_PORTS.has(id));

  const hasWestRoute = visitedWestPort || crossedFarWest;
  const hasEastRoute = visitedEastPort || crossedFarEast;
  const visitedMaluku = visited.has('maluku');
  const visitedChina = visited.has('macau');
  const visitedGoodHope = visited.has('goodhope');
  const returnedHome = state?.status === 'returned';

  if (missionId === 'mission_event_cape') {
    const crossedSouthAtlantic =
      visited.has('caboverde') ||
      visited.has('elmina') ||
      visited.has('luanda') ||
      visitedGoodHope ||
      trail.some((pt) => pt.lat <= -5);
    const goalAchieved = visitedGoodHope;
    return {
      missionId,
      hasWestRoute,
      hasEastRoute,
      visitedMaluku,
      visitedChina,
      visitedGoodHope,
      returnedHome,
      goalAchieved,
      checklist: [
        { label: '대서양 남하 (아프리카 항로 진입)', done: crossedSouthAtlantic },
        { label: '희망봉(-34.5°S, 18.5°E) 도착', done: visitedGoodHope },
      ],
    };
  }

  if (missionId === 'mission_2') {
    const goalAchieved = hasWestRoute && visitedChina && returnedHome;
    return {
      missionId,
      hasWestRoute,
      hasEastRoute,
      visitedMaluku,
      visitedChina,
      returnedHome,
      goalAchieved,
      checklist: [
        { label: '서쪽 아메리카 우회 경유', done: hasWestRoute },
        { label: '중국(마카오·광저우) 차 확보', done: visitedChina },
        { label: '리스본 무사 귀항', done: returnedHome },
      ],
    };
  }

  if (missionId === 'mission_3') {
    const goalAchieved = hasWestRoute && hasEastRoute && returnedHome;
    return {
      missionId,
      hasWestRoute,
      hasEastRoute,
      visitedMaluku,
      visitedChina,
      returnedHome,
      goalAchieved,
      checklist: [
        { label: '서반구(아메리카·태평양) 돌파', done: hasWestRoute },
        { label: '동반구(아시아·인도양) 돌파', done: hasEastRoute },
        { label: '리스본 세계 일주 완주', done: returnedHome },
      ],
    };
  }

  // Default: mission_1
  const goalAchieved = visitedMaluku && returnedHome;
  return {
    missionId: 'mission_1',
    hasWestRoute,
    hasEastRoute,
    visitedMaluku,
    visitedChina,
    returnedHome,
    goalAchieved,
    checklist: [
      { label: '향료제도(말루쿠) 도달', done: visitedMaluku },
      { label: '리스본 무사 귀항', done: returnedHome },
    ],
  };
}
