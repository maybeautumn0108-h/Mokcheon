/**
 * Prevailing wind zones aligned with the orange wind arrows on the B4 chart
 * and historical Age of Sail monsoon / trade wind / westerly belts.
 *
 * `windToDeg` is the compass azimuth (0=N, 90=E, 180=S, 270=W) TOWARD which the wind blows.
 */

export const WIND_CLASSES = {
  TAILWIND: { id: 'tailwind', label: '순풍', baseCm: 4.0, color: 'emerald' },
  REACH: { id: 'reach', label: '측풍·사풍', baseCm: 3.0, color: 'sky' },
  CALM: { id: 'calm', label: '기본 (무풍/약풍)', baseCm: 2.0, color: 'amber' },
  HEADWIND: { id: 'headwind', label: '역풍', baseCm: 1.0, color: 'rose' },
};

export function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

export function smallestAngleDiff(a, b) {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Determine local prevailing wind vector `{ windToDeg, isDoldrums, beltName }`
 * without leaking exact continent names to the student.
 */
export function getLocalWind(lat, lon, turn = 1) {
  const isWinterMonsoon = turn >= 16; // Turns 16~30 (Oct ~ Feb)

  // Indian Ocean & Southeast Asia Monsoon Belt (25°E ~ 130°E, 10°S ~ 25°N)
  if (lon >= 25 && lon <= 130 && lat >= -10 && lat <= 25) {
    if (lat >= -2 && lat <= 3 && lon >= 95 && lon <= 115) {
      // Strait / Equatorial variable winds
      return {
        windToDeg: isWinterMonsoon ? 235 : 45,
        isDoldrums: false,
        beltName: isWinterMonsoon ? '계절풍 (북동→남서)' : '계절풍 (남서→북동)',
      };
    }
    return {
      windToDeg: isWinterMonsoon ? 225 : 45, // Winter: NE->SW (225°), Summer: SW->NE (45°)
      isDoldrums: false,
      beltName: isWinterMonsoon ? '겨울 계절풍' : '여름 계절풍',
    };
  }

  // Equatorial Doldrums (적도 무풍대: 4°S ~ 5°N outside active monsoon core)
  if (lat > -4 && lat < 5) {
    return {
      windToDeg: 270,
      isDoldrums: true,
      beltName: '적도 무풍대',
    };
  }

  // North Atlantic Canary Current / NE Trade Wind curve near Iberia & West Africa
  if (lon >= -24 && lon <= -5 && lat >= 23 && lat <= 40) {
    return {
      windToDeg: 205, // SSW along Iberia -> Canaries (matches PDF arrow!)
      isDoldrums: false,
      beltName: '북동 무역풍 연안류',
    };
  }

  // South Atlantic Gyre (westward near Brazil, curving S then SE/E toward Cape of Good Hope)
  if (lon >= -50 && lon <= 20 && lat <= -15 && lat > -30) {
    if (lon < -15) {
      if (lat <= -25) {
        return {
          windToDeg: 130, // Curves SE toward Cape of Good Hope (matches PDF arrow!)
          isDoldrums: false,
          beltName: '남대서양 환류풍',
        };
      }
      return {
        windToDeg: 200, // SSW along South America (matches PDF curved arrow!)
        isDoldrums: false,
        beltName: '남대서양 환류풍',
      };
    }
    return {
      windToDeg: 320, // SE Trade Wind (blowing NW)
      isDoldrums: false,
      beltName: '남동 무역풍',
    };
  }

  // Northern Hemisphere Westerlies (35°N ~ 65°N)
  if (lat >= 35) {
    return {
      windToDeg: 75, // ENE Westerlies
      isDoldrums: false,
      beltName: '북반구 편서풍',
    };
  }

  // Northern Hemisphere Trade Winds (5°N ~ 35°N)
  if (lat >= 5) {
    return {
      windToDeg: 240, // WSW Trade Winds
      isDoldrums: false,
      beltName: '북동 무역풍',
    };
  }

  // Southern Hemisphere Trade Winds (4°S ~ 30°S)
  if (lat > -30) {
    return {
      windToDeg: 300, // WNW Trade Winds
      isDoldrums: false,
      beltName: '남동 무역풍',
    };
  }

  // Southern Hemisphere Roaring Forties / Westerlies (30°S ~ 65°S)
  return {
    windToDeg: 90, // Eastward
    isDoldrums: false,
    beltName: '남반구 편서풍',
  };
}

/**
 * Evaluate ship heading against local wind.
 */
export function evaluateWind(headingDeg, lat, lon, turn = 1, isFullSail = false) {
  const wind = getLocalWind(lat, lon, turn);
  const normalizedHeading = normalizeDeg(headingDeg);
  const diff = smallestAngleDiff(normalizedHeading, wind.windToDeg);

  let windClass;
  if (wind.isDoldrums) {
    windClass = WIND_CLASSES.CALM;
  } else if (diff <= 45) {
    windClass = WIND_CLASSES.TAILWIND;
  } else if (diff <= 115) {
    windClass = WIND_CLASSES.REACH;
  } else if (diff <= 145) {
    windClass = WIND_CLASSES.CALM;
  } else {
    windClass = WIND_CLASSES.HEADWIND;
  }

  const moveCm = windClass.baseCm + (isFullSail ? 1.0 : 0);
  const moveDeg = moveCm * 10; // B4 1:1 scale: 1.0 cm = 10°

  return {
    ...wind,
    headingDeg: normalizedHeading,
    angleDiff: Math.round(diff),
    windClass,
    baseCm: windClass.baseCm,
    moveCm,
    moveDeg,
    isFullSail,
  };
}
