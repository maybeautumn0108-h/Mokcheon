/**
 * Historical ports matching the B4 map and project specification.
 * Note: Port names are only shown when docking inside port radius (never leaked on random coastline collision).
 */
export const LISBON_COORDS = { lat: 38.7, lon: -9.1 };

export const RESUPPLY_COST = 60;
export const REPAIR_COST = 50;
export const REPAIR_AMOUNT = 35;

export const PORTS = [
  {
    id: 'lisbon',
    name: '리스본',
    region: '이베리아 반도 (출발/귀항지)',
    lat: 38.7,
    lon: -9.1,
    dockRadiusDeg: 3.5,
    specialty: null,
    buyPrice: 0,
    multiplier: 1.0,
    isHomePort: true,
  },
  {
    id: 'canaries',
    name: '카나리아 제도',
    region: '북대서양 중계지',
    lat: 28.1,
    lon: -15.4,
    dockRadiusDeg: 3.5,
    specialty: null,
    buyPrice: 0,
    multiplier: 1.0,
  },
  {
    id: 'caboverde',
    name: '카보베르데',
    region: '서아프리카',
    lat: 15.0,
    lon: -23.6,
    dockRadiusDeg: 3.5,
    specialty: '사금·상아',
    buyPrice: 100,
    multiplier: 1.5,
  },
  {
    id: 'elmina',
    name: '엘미나',
    region: '서아프리카',
    lat: 5.1,
    lon: -1.3,
    dockRadiusDeg: 3.5,
    specialty: '사금·상아',
    buyPrice: 100,
    multiplier: 1.5,
  },
  {
    id: 'goodhope',
    name: '희망봉',
    region: '남아프리카 관문',
    lat: -34.3,
    lon: 18.5,
    dockRadiusDeg: 3.8,
    specialty: null,
    buyPrice: 0,
    multiplier: 1.0,
  },
  {
    id: 'sofala',
    name: '소팔라',
    region: '동아프리카',
    lat: -20.2,
    lon: 34.8,
    dockRadiusDeg: 3.5,
    specialty: '유향·몰약',
    buyPrice: 120,
    multiplier: 2.0,
  },
  {
    id: 'malindi',
    name: '말린디',
    region: '동아프리카',
    lat: -3.2,
    lon: 40.1,
    dockRadiusDeg: 3.5,
    specialty: '유향·몰약',
    buyPrice: 120,
    multiplier: 2.0,
  },
  {
    id: 'goacalicut',
    name: '고아·캘리컷',
    region: '인도 서안',
    lat: 13.0,
    lon: 74.8,
    dockRadiusDeg: 4.0,
    specialty: '후추·홍차',
    buyPrice: 150,
    multiplier: 3.0,
  },
  {
    id: 'malacca',
    name: '말라카',
    region: '동남아시아',
    lat: 2.2,
    lon: 102.2,
    dockRadiusDeg: 3.8,
    specialty: '계피·비단',
    buyPrice: 180,
    multiplier: 4.0,
  },
  {
    id: 'maluku',
    name: '향료제도(말루쿠)',
    region: '동쪽 다도해 (최종 목적지)',
    lat: -1.5,
    lon: 127.5,
    dockRadiusDeg: 4.2,
    specialty: '정향·육두구',
    buyPrice: 200,
    multiplier: 5.5,
    isGoalPort: true,
  },
];

export function getPortById(portId) {
  return PORTS.find((p) => p.id === portId) || null;
}
