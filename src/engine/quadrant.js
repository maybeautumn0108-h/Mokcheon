/**
 * Quadrant (사분의) Astronomical Observation Engine with Weather & Wave Sway.
 */
import { getWeatherById } from '../data/weather.js';

export const POLARIS_POS = { x: 0, y: 0 };

// Big Dipper (국자 끝 두 별 -> 5배 연장선 끝이 북극성)
export const BIG_DIPPER_STARS = [
  { x: -12, y: 24 },
  { x: -16, y: 31 },
  { x: -26, y: 32 },
  { x: -25, y: 23 },
  { x: -34, y: 18 },
  { x: -42, y: 14 },
  { x: -51, y: 16 },
];

// Cassiopeia (W자 별자리 - 북극성 반대편)
export const CASSIOPEIA_STARS = [
  { x: 14, y: -22 },
  { x: 20, y: -16 },
  { x: 26, y: -21 },
  { x: 32, y: -15 },
  { x: 38, y: -22 },
];

// Dense unlabeled decoy stars across a wider sky (-95..95) so Polaris blends naturally
export const BACKGROUND_STARS = [
  { x: -78, y: -42, r: 1.4 },
  { x: -64, y: -18, r: 1.7 },
  { x: -58, y: 40, r: 1.3 },
  { x: -45, y: -25, r: 1.5 },
  { x: -32, y: -12, r: 1.6 },
  { x: -18, y: -28, r: 1.2 },
  { x: -14, y: -48, r: 1.7 },
  { x: 8, y: 18, r: 1.5 },
  { x: 24, y: 25, r: 1.3 },
  { x: 38, y: 12, r: 1.6 },
  { x: 46, y: -6, r: 1.4 },
  { x: -5, y: -14, r: 1.2 },
  { x: 11, y: 6, r: 1.3 },
  { x: -28, y: -35, r: 1.5 },
  { x: 42, y: 30, r: 1.4 },
  { x: -48, y: 4, r: 1.5 },
  { x: 64, y: -34, r: 1.7 },
  { x: 72, y: 14, r: 1.4 },
  { x: 56, y: 44, r: 1.6 },
  { x: -72, y: 22, r: 1.5 },
  { x: 18, y: 46, r: 1.7 },
  { x: -6, y: 42, r: 1.3 },
  { x: 82, y: -14, r: 1.3 },
  { x: -84, y: -8, r: 1.2 },
];

export function getCelestialTarget(lat, declination) {
  if (lat >= 0) {
    return {
      hemisphere: 'north',
      trueAltitudeDeg: Number(lat.toFixed(1)),
      formulaText: '북위(°N) = 사분의 북극성 고도(°)',
    };
  }

  const absLat = Math.abs(lat);
  const noonSunAlt = 90 - absLat - declination;
  return {
    hemisphere: 'south',
    trueAltitudeDeg: Number(noonSunAlt.toFixed(1)),
    declination,
    formulaText: '남위(°S) = 90° − 정오 태양 고도(h) − 태양 적위(δ)',
  };
}

export function computeSouthLatitude(noonAltitudeDeg, declination) {
  return Number((90 - noonAltitudeDeg - declination).toFixed(1));
}

export function measureWithSway(trueAltitudeDeg, swayX, swayY, errorScale = 0.45) {
  const errorDeg = swayY * errorScale + swayX * 0.14;
  const measured = Math.max(0, Math.min(90, trueAltitudeDeg + errorDeg));
  const absErr = Math.abs(errorDeg);
  const precisionLabel =
    absErr <= 0.5 ? '매우 정밀' : absErr <= 1.5 ? '양호' : '거친 파도 오차 큼';

  return {
    measuredDeg: Number(measured.toFixed(1)),
    errorDeg: Number(errorDeg.toFixed(1)),
    precisionLabel,
  };
}

/**
 * Compute real-time 2-axis wave sway + drifting cloud occlusion for a given weather & timestamp (sec).
 */
export function computeWeatherSway(weatherId, tSec) {
  const w = getWeatherById(weatherId);
  const s = w.swaySpeed;

  const gustX = w.gustJitter * Math.sin(tSec * 5.7 + Math.cos(tSec * 2.3));
  const gustY = w.gustJitter * Math.cos(tSec * 4.9 + Math.sin(tSec * 3.1));

  const swayX =
    Math.sin(tSec * 1.45 * s) * (w.swayAmpX * 0.65) +
    Math.cos(tSec * 2.35 * s) * (w.swayAmpX * 0.35) +
    gustX;

  const swayY =
    Math.cos(tSec * 1.25 * s) * (w.swayAmpY * 0.65) +
    Math.sin(tSec * 2.15 * s) * (w.swayAmpY * 0.35) +
    gustY;

  // Storm completely blocks celestial sightlines; fog/cloud occlusion removed
  const isOccluded = w.id === 'storm';
  const cloudOpacity = isOccluded ? 0.94 : 0;

  return {
    weather: w,
    swayX,
    swayY,
    cloudOpacity,
    isOccluded,
  };
}

/**
 * Evaluate a Quadrant lock-on attempt against weather tolerance and storm blockage.
 */
export function evaluateQuadrantShot({
  trueAltitudeDeg,
  weatherId,
  distFromReticle,
  swayX,
  swayY,
  isOccluded,
}) {
  const w = getWeatherById(weatherId);

  if (w.id === 'storm' || isOccluded) {
    return {
      ok: false,
      reason: 'storm',
      message: '폭풍우로 인해 천체 측량이 불가능합니다! 폭풍우가 지나간 다음 턴에 측량하세요.',
    };
  }

  if (distFromReticle > w.toleranceDeg) {
    return {
      ok: false,
      reason: 'missed',
      message: `파도 흔들림 속에서 조준원 정중앙(±${w.toleranceDeg}°)에 맞추지 못했습니다. 타이밍을 노려 다시 시도하세요.`,
    };
  }

  const res = measureWithSway(trueAltitudeDeg, swayX, swayY, w.errorScale);
  return {
    ok: true,
    ...res,
  };
}
