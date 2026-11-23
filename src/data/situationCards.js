import { PORTS } from './ports.js';
import { findNearestCoast, shortestLonDelta } from './worldCoastlines.js';

/**
 * Situation Cards (3-choose-1 after every sailing turn).
 * STRICT RULE: Never alter ship coordinates (lat/lon) via cards so students'
 * B4 paper map plotting remains 100% consistent.
 */
export const SITUATION_CARDS = [
  {
    id: 'rain_barrel',
    title: '스콜 빗물 저장',
    category: '보급',
    tone: 'emerald',
    description: '갑작스러운 열대 소나기를 돛과 통으로 받아 식수를 보충했습니다.',
    effectSummary: '식량·식수 +14',
    apply: (state) => ({
      food: Math.min(100, state.food + 14),
    }),
  },
  {
    id: 'flying_fish',
    title: '날치 떼와 어획',
    category: '보급',
    tone: 'emerald',
    description: '선원들이 갑판 위로 뛰어오른 날치와 다랑어를 낚아 식량을 아꼈습니다.',
    effectSummary: '식량·식수 +10',
    apply: (state) => ({
      food: Math.min(100, state.food + 10),
    }),
  },
  {
    id: 'rat_infestation',
    title: '선창 쥐 피해',
    category: '위기',
    tone: 'rose',
    description: '선창의 건빵 자루 일부가 쥐와 습기에 상해 폐기했습니다.',
    effectSummary: '식량·식수 -8',
    apply: (state) => ({
      food: Math.max(0, state.food - 8),
    }),
  },
  {
    id: 'carpenter_repair',
    title: '목수의 갑판 보수',
    category: '선체',
    tone: 'emerald',
    description: '항해 중 틈이 벌어진 늑골과 돛대를 선박 목수가 능숙하게 수리했습니다.',
    effectSummary: '선체 내구도 +12',
    apply: (state) => ({
      hull: Math.min(100, state.hull + 12),
    }),
  },
  {
    id: 'rogue_swell',
    title: '예기치 못한 너울',
    category: '위기',
    tone: 'rose',
    description: '높은 파도가 현측을 강타하여 난간과 선체 판자 일부가 손상되었습니다.',
    effectSummary: '선체 내구도 -9',
    apply: (state) => ({
      hull: Math.max(1, state.hull - 9),
    }),
  },
  {
    id: 'salvage_cargo',
    title: '표류 상자 인양',
    category: '행운',
    tone: 'amber',
    description: '바다에 떠다니던 상선 잔해에서 온전한 교역품과 은화 주머니를 건졌습니다.',
    effectSummary: '금화 +45 G',
    apply: (state) => ({
      gold: state.gold + 45,
    }),
  },
  {
    id: 'crew_bonus',
    title: '선원 격려 수당',
    category: '운영',
    tone: 'amber',
    description: '장기 항해에 지친 선원들의 사기를 높이기 위해 비상 금화를 지급했습니다.',
    effectSummary: '금화 -25 G · 식량·식수 +6',
    apply: (state) => ({
      gold: Math.max(0, state.gold - 25),
      food: Math.min(100, state.food + 6),
    }),
  },
  {
    id: 'trade_wind_surge',
    title: '강한 계절 순풍 포착',
    category: '항해',
    tone: 'sky',
    description: '상층 기류가 안정되어 다음 턴 돛을 최대한 활용할 수 있습니다.',
    effectSummary: '다음 턴 이동 거리 +1.0 cm 보너스',
    apply: () => ({
      nextTurnBonusCm: 1.0,
    }),
  },
  {
    id: 'calm_sea_trap',
    title: '끈적한 무풍대 조우',
    category: '기상',
    tone: 'rose',
    description: '해수면이 거울처럼 멈춰 바람이 멎었습니다. 다음 턴 전진이 크게 제한됩니다.',
    effectSummary: '다음 턴 이동 거리 최대 1.0 cm 제한',
    apply: () => ({
      nextTurnMaxCm: 1.0,
    }),
  },
  {
    id: 'seaweed_birds',
    title: '해초와 육지 새 발견',
    category: '정찰',
    tone: 'sky',
    description: '갈매기와 떠내려온 나뭇가지가 관측되었습니다. 육지가 멀지 않습니다.',
    effectSummary: '가장 가까운 연안 방향 힌트 획득',
    apply: (state) => {
      const coast = findNearestCoast(state.lat, state.lon, 35);
      if (!coast) {
        return {
          cardHint: '사방 3.5 cm(35°) 이내에 뚜렷한 육지 징후가 보이지 않습니다. 망망대해입니다.',
        };
      }
      const deg = String(Math.round(coast.bearingToCoastDeg) % 360).padStart(3, '0');
      const cm = (coast.distDeg / 10).toFixed(1);
      return {
        cardHint: `방위 ${deg}° 방면 약 ${cm} cm 거리에 육지 연안 징후가 포착되었습니다.`,
      };
    },
  },
  {
    id: 'merchant_signal',
    title: '원거리 상선의 항로 정보',
    category: '정찰',
    tone: 'sky',
    description: '지나가던 상선과 신호기를 교환하여 가까운 기항지 방위를 파악했습니다.',
    effectSummary: '가장 가까운 기항지 방향·거리 힌트',
    apply: (state) => {
      let bestPort = null;
      let bestDist = Infinity;
      for (const p of PORTS) {
        if (p.id === state.currentPortId) continue;
        const dLat = p.lat - state.lat;
        const dLon = shortestLonDelta(state.lon, p.lon);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < bestDist) {
          bestDist = dist;
          bestPort = { dist, dLat, dLon };
        }
      }
      if (!bestPort) return {};
      const bearing =
        ((Math.atan2(bestPort.dLon, bestPort.dLat) * 180) / Math.PI + 360) % 360;
      const deg = String(Math.round(bearing)).padStart(3, '0');
      const cm = (bestPort.dist / 10).toFixed(1);
      return {
        cardHint: `방위 ${deg}° 방면 약 ${cm} cm 거리에 기항 가능 항구 신호가 있습니다.`,
      };
    },
  },
  {
    id: 'careful_watch',
    title: '망루의 철저한 암초 경계',
    category: '선체',
    tone: 'emerald',
    description: '견시병이 얕은 모래톱을 미리 발견하고 돛을 정리해 선체를 보호했습니다.',
    effectSummary: '선체 내구도 +8 · 금화 +15 G',
    apply: (state) => ({
      hull: Math.min(100, state.hull + 8),
      gold: state.gold + 15,
    }),
  },
];

export function drawThreeSituationCards(rng = Math.random) {
  const pool = [...SITUATION_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
