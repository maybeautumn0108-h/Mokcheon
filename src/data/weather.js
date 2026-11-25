/**
 * Maritime weather conditions affecting DeckView atmosphere and
 * Quadrant astronomical observation difficulty.
 */
export const WEATHERS = [
  {
    id: 'clear',
    name: '맑음',
    badgeTone: 'sky',
    weight: 38,
    swayAmpX: 6.5,
    swayAmpY: 6.0,
    swaySpeed: 1.35,
    gustJitter: 0.0,
    cloudCover: 0,
    toleranceDeg: 4.8,
    errorScale: 0.35,
    description: '시계가 맑지만 대양의 너울로 사분의 추가 흔들립니다.',
  },
  {
    id: 'partly_cloudy',
    name: '구름 많음',
    badgeTone: 'slate',
    weight: 32,
    swayAmpX: 9.5,
    swayAmpY: 8.5,
    swaySpeed: 1.65,
    gustJitter: 0.8,
    cloudCover: 0,
    toleranceDeg: 4.2,
    errorScale: 0.55,
    description: '너울과 바람이 다소 강해지지만 천체 관측 시야는 확보됩니다.',
  },
  {
    id: 'squall',
    name: '돌풍·거친 파도',
    badgeTone: 'rose',
    weight: 18,
    swayAmpX: 17.5,
    swayAmpY: 15.5,
    swaySpeed: 2.55,
    gustJitter: 3.2,
    cloudCover: 0,
    toleranceDeg: 3.2,
    errorScale: 1.25,
    description: '갑판이 크게 요동쳐 사분의 조준이 어렵습니다.',
  },
  {
    id: 'storm',
    name: '폭풍우',
    badgeTone: 'purple',
    weight: 12,
    swayAmpX: 25.0,
    swayAmpY: 22.0,
    swaySpeed: 3.35,
    gustJitter: 6.5,
    cloudCover: 1.0,
    toleranceDeg: 2.6,
    errorScale: 2.1,
    description: '거대한 폭풍우가 몰아쳐 천체 측량이 불가능합니다!',
  },
];

export function getWeatherById(id) {
  return WEATHERS.find((w) => w.id === id) || WEATHERS[0];
}

export function isSnowLatitude(lat = 0) {
  return lat >= 55 || lat <= -51;
}

export function getPolarZone(lat = 0) {
  if (lat >= 58) {
    return {
      id: 'arctic',
      label: '북극권 극지 해역',
      shortLabel: '북극권 · 눈/유빙',
      warning: '북극권 극한 해역 진입! 눈보라가 날리고 유빙이 떠다니고 있습니다.',
    };
  }
  if (lat <= -53) {
    return {
      id: 'antarctic',
      label: '남극권 극지 해역',
      shortLabel: '남극권 · 눈/빙산',
      warning: '남극권 극한 해역 진입! 눈발이 휘날리고 거대한 빙산이 관측됩니다.',
    };
  }
  return null;
}

export function rollWeather(lat = 0, rng = Math.random) {
  // Slightly higher chance of rough seas in high latitudes / polar waters
  const isHighLat = Math.abs(lat) >= 34;
  const isPolar = Math.abs(lat) >= 54;
  const adjusted = WEATHERS.map((w) => {
    let weight = w.weight;
    if (isHighLat && (w.id === 'squall' || w.id === 'storm')) {
      weight += 5;
    }
    if (isPolar && (w.id === 'squall' || w.id === 'storm')) {
      weight += 6;
    }
    return { ...w, weight };
  });

  const total = adjusted.reduce((sum, w) => sum + w.weight, 0);
  let pick = rng() * total;
  for (const w of adjusted) {
    pick -= w.weight;
    if (pick <= 0) return w.id;
  }
  return 'clear';
}
