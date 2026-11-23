/**
 * World landmass polygons matching the B4 Square-Grid Navigation Chart
 * (170°W ~ 170°E, 75°N ~ 65°S, 10° = 1.0 cm).
 *
 * Coordinates in each ring are [lon, lat] pairs.
 * NO continent/country names are ever exposed to the student UI on collision.
 */

const RAW_LANDMASSES = [
  // 1. Europe (Mainland + Iberia + Italy + Greece + Scandinavia)
  [
    [-9.0, 38.7], [-9.4, 39.5], [-9.0, 41.5], [-9.2, 43.0], [-7.5, 43.7],
    [-2.0, 43.4], [-1.5, 45.5], [-4.5, 48.4], [-2.0, 49.5], [1.5, 51.0],
    [4.5, 52.5], [8.5, 54.0], [8.2, 57.0], [10.5, 57.7], [12.0, 56.0],
    [10.5, 59.0], [5.5, 59.0], [5.0, 62.0], [10.0, 65.0], [15.0, 69.0],
    [25.0, 71.0], [32.0, 70.0], [42.0, 67.5], [60.0, 69.0], [60.0, 52.0],
    [48.0, 45.0], [39.0, 47.0], [36.5, 45.0], [33.5, 44.5], [30.5, 46.2],
    [28.0, 41.2], [26.0, 40.5], [23.8, 38.0], [22.5, 36.6], [20.5, 39.0],
    [19.5, 41.0], [14.0, 45.5], [12.5, 44.0], [16.0, 41.0], [18.4, 40.0],
    [16.0, 38.0], [12.5, 41.5], [10.0, 44.0], [7.5, 43.8], [3.2, 42.5],
    [0.0, 38.8], [-2.0, 36.8], [-5.4, 36.1], [-7.5, 37.0], [-8.9, 37.0],
    [-9.0, 38.7],
  ],
  // Great Britain
  [
    [-5.5, 50.1], [-4.5, 51.3], [-5.0, 52.0], [-3.2, 53.3], [-5.0, 55.0],
    [-6.2, 56.8], [-5.0, 58.6], [-3.0, 58.6], [-1.8, 57.5], [-2.5, 56.0],
    [-1.0, 54.5], [1.7, 52.6], [1.3, 51.2], [-1.5, 50.7], [-5.5, 50.1],
  ],
  // Ireland
  [
    [-10.2, 51.6], [-10.0, 54.0], [-7.5, 55.3], [-5.5, 54.5], [-6.2, 52.2],
    [-8.5, 51.5], [-10.2, 51.6],
  ],
  // Iceland
  [
    [-24.0, 65.5], [-18.0, 66.2], [-13.5, 65.0], [-15.0, 63.8], [-22.5, 63.8],
    [-24.0, 65.5],
  ],

  // 2. Africa (Mainland)
  [
    [-5.8, 35.7], [-2.0, 35.2], [3.0, 36.8], [10.0, 37.2], [11.5, 33.5],
    [20.0, 31.0], [32.3, 31.2], [34.5, 28.0], [38.0, 21.0], [43.3, 12.6],
    [51.3, 11.9], [49.0, 5.0], [40.6, -1.5], [39.9, -3.3], [39.6, -4.5], [40.5, -10.5],
    [35.0, -17.8], [34.6, -20.0], [35.5, -24.0], [32.8, -26.0], [28.0, -33.0],
    [20.0, -34.8], [18.3, -34.2], [17.8, -32.0], [14.5, -23.0], [12.0, -16.0],
    [13.0, -9.0], [11.8, -5.0], [9.3, 1.0], [9.5, 4.0], [5.0, 4.3],
    [1.0, 6.0], [-1.3, 5.2], [-7.5, 4.5], [-13.3, 8.5], [-16.5, 12.5],
    [-17.5, 14.7], [-16.0, 21.0], [-13.2, 27.5], [-9.5, 31.5], [-5.8, 35.7],
  ],
  // Madagascar
  [
    [49.3, -12.0], [50.4, -15.5], [47.5, -25.0], [44.0, -25.2], [43.3, -21.0],
    [44.5, -16.5], [48.0, -13.5], [49.3, -12.0],
  ],

  // 3. Asia (Arabia, India, SE Asia, China, Siberia)
  [
    [26.5, 40.0], [35.5, 36.5], [35.0, 31.5], [34.8, 29.5], [39.0, 21.5],
    [43.4, 12.7], [52.0, 15.5], [59.8, 22.5], [56.0, 25.7], [50.0, 29.5],
    [51.5, 30.2], [57.2, 26.6], [66.5, 25.0], [68.5, 23.0], [72.6, 20.5], [73.5, 15.5],
    [75.2, 12.5], [77.5, 8.1], [79.8, 10.5], [82.0, 16.5], [88.5, 22.0],
    [92.0, 21.0], [94.3, 16.0], [97.5, 16.0], [98.5, 10.0], [100.3, 5.5],
    [102.0, 2.5], [103.8, 1.3], [104.3, 2.5], [102.5, 6.0], [100.5, 13.5],
    [105.0, 8.6], [109.2, 13.0], [108.0, 21.0], [114.2, 22.3], [120.5, 26.0],
    [121.8, 31.0], [120.0, 35.0], [122.5, 37.4], [118.5, 39.0], [124.0, 40.0],
    [126.5, 35.0], [129.0, 35.1], [129.5, 38.5], [135.0, 43.5], [141.0, 52.0],
    [140.0, 56.0], [155.0, 60.0], [157.0, 51.0], [163.0, 56.0], [178.0, 66.0],
    [170.0, 70.0], [130.0, 72.0], [100.0, 75.0], [70.0, 73.0], [60.0, 69.0],
    [55.0, 52.0], [45.0, 42.0], [36.0, 42.0], [26.5, 40.0],
  ],
  // Sri Lanka
  [
    [80.0, 9.7], [81.8, 7.8], [80.6, 6.0], [79.7, 7.5], [80.0, 9.7],
  ],
  // Japan (Main archipelago simplified)
  [
    [130.5, 31.3], [130.0, 33.5], [135.5, 34.5], [139.8, 35.5], [141.5, 40.5],
    [145.5, 43.5], [141.5, 45.3], [139.5, 41.0], [136.5, 37.0], [132.0, 34.5],
    [130.5, 31.3],
  ],
  // Taiwan
  [
    [120.8, 25.2], [121.9, 24.5], [120.8, 22.0], [120.1, 23.5], [120.8, 25.2],
  ],
  // Philippines (Luzon + Mindanao simplified blocks)
  [
    [120.2, 18.5], [122.4, 17.5], [122.5, 14.0], [124.0, 13.0], [120.0, 14.5],
    [120.2, 18.5],
  ],
  [
    [123.5, 9.8], [126.4, 9.0], [125.5, 5.6], [122.0, 6.8], [123.5, 9.8],
  ],

  // 4. Maritime Southeast Asia & Oceania
  // Sumatra
  [
    [95.3, 5.5], [98.5, 3.6], [100.3, 1.5], [103.5, -0.5], [105.8, -5.8],
    [104.2, -5.7], [100.5, -1.5], [97.5, 1.5], [95.3, 5.5],
  ],
  // Java
  [
    [105.4, -6.1], [114.4, -7.8], [114.2, -8.7], [106.0, -7.2], [105.4, -6.1],
  ],
  // Borneo
  [
    [109.0, 1.5], [115.0, 5.2], [117.5, 6.9], [118.8, 4.5], [117.5, -3.5],
    [110.2, -3.2], [109.0, 1.5],
  ],
  // Sulawesi
  [
    [119.5, 1.2], [125.0, 1.6], [123.0, -1.0], [122.8, -4.5], [120.5, -5.5],
    [119.0, -3.5], [119.5, 1.2],
  ],
  // New Guinea
  [
    [131.0, -1.2], [136.0, -2.0], [141.0, -2.6], [148.0, -8.0], [150.5, -10.5],
    [143.0, -9.0], [138.0, -8.2], [132.5, -4.0], [131.0, -1.2],
  ],
  // Australia
  [
    [113.5, -22.0], [122.0, -17.0], [130.5, -12.0], [136.8, -12.3], [136.5, -15.5],
    [140.8, -17.5], [142.5, -10.8], [145.5, -15.0], [153.5, -26.0], [150.0, -37.5],
    [144.5, -38.5], [138.5, -35.5], [135.5, -34.8], [129.0, -31.8], [115.1, -34.3],
    [115.5, -31.5], [113.5, -22.0],
  ],
  // Tasmania
  [
    [144.8, -40.8], [148.3, -41.0], [147.2, -43.5], [145.2, -42.5], [144.8, -40.8],
  ],
  // New Zealand (South & North Islands)
  [
    [172.5, -34.5], [178.5, -37.7], [175.5, -41.5], [172.5, -38.0], [172.5, -34.5],
  ],
  [
    [172.0, -41.0], [174.0, -42.0], [168.5, -46.6], [166.5, -45.5], [172.0, -41.0],
  ],

  // 5. North America & Greenland & Caribbean
  // North America Mainland
  [
    [-168.0, 65.5], [-162.0, 71.0], [-135.0, 70.0], [-100.0, 73.0], [-80.0, 72.0],
    [-64.0, 62.0], [-55.6, 52.0], [-53.0, 47.0], [-60.0, 46.0], [-67.0, 45.0],
    [-70.0, 41.8], [-75.5, 35.5], [-80.2, 25.5], [-82.5, 28.0], [-89.0, 29.0],
    [-97.2, 26.0], [-96.0, 19.2], [-90.5, 21.2], [-87.0, 21.4], [-88.2, 16.0],
    [-83.5, 15.0], [-83.0, 10.0], [-78.0, 8.8], [-79.5, 8.5], [-85.5, 10.5],
    [-92.2, 14.5], [-105.5, 20.5], [-110.0, 23.0], [-114.5, 31.5], [-117.1, 32.5],
    [-122.5, 37.8], [-124.5, 48.0], [-135.0, 57.0], [-150.0, 60.0], [-162.0, 55.0],
    [-166.0, 60.0], [-168.0, 65.5],
  ],
  // Greenland
  [
    [-55.0, 75.0], [-20.0, 75.0], [-22.0, 70.0], [-43.5, 59.8], [-53.0, 66.0],
    [-68.0, 75.0], [-55.0, 75.0],
  ],
  // Cuba
  [
    [-84.9, 21.9], [-79.0, 23.0], [-74.1, 20.2], [-77.5, 19.8], [-84.9, 21.9],
  ],
  // Hispaniola
  [
    [-74.4, 18.5], [-70.0, 19.8], [-68.3, 18.5], [-71.5, 17.6], [-74.4, 18.5],
  ],

  // 6. South America
  [
    [-78.0, 8.8], [-75.5, 10.8], [-71.5, 12.2], [-62.0, 10.5], [-50.0, 1.5],
    [-35.2, -5.5], [-34.8, -8.0], [-38.5, -13.0], [-41.0, -22.0], [-48.5, -28.0],
    [-53.5, -34.0], [-58.0, -38.5], [-65.0, -43.0], [-67.5, -50.0], [-67.0, -55.0],
    [-71.5, -54.5], [-75.0, -47.0], [-73.5, -40.0], [-71.5, -33.0], [-70.5, -18.5],
    [-77.5, -12.0], [-81.3, -4.8], [-79.5, 2.0], [-78.0, 8.8],
  ],
];

// Precompute bounding boxes for ultra-fast spatial filtering
export const LAND_POLYGONS = RAW_LANDMASSES.map((ring) => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { ring, minLon, maxLon, minLat, maxLat };
});

export function wrapLon(lon) {
  let x = ((lon + 180) % 360 + 360) % 360 - 180;
  if (x === -180 && lon > 0) x = 180;
  return x;
}

export function shortestLonDelta(fromLon, toLon) {
  let d = toLon - fromLon;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function clampLat(lat) {
  return Math.max(-65, Math.min(75, lat));
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns true if (lat, lon) lies inside any landmass polygon.
 */
export function isPointOnLand(lat, lon) {
  const wLon = wrapLon(lon);
  for (const poly of LAND_POLYGONS) {
    if (
      wLon >= poly.minLon &&
      wLon <= poly.maxLon &&
      lat >= poly.minLat &&
      lat <= poly.maxLat
    ) {
      if (pointInRing(wLon, lat, poly.ring)) return true;
    }
  }
  return false;
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, distSq: (px - ax) ** 2 + (py - ay) ** 2 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { x: cx, y: cy, distSq: (px - cx) ** 2 + (py - cy) ** 2 };
}

/**
 * Find the nearest coastline point within searchRadiusDeg (Euclidean B4 grid degrees).
 */
export function findNearestCoast(lat, lon, searchRadiusDeg = 12) {
  const wLon = wrapLon(lon);
  let best = null;
  let bestDistSq = searchRadiusDeg * searchRadiusDeg;

  for (const poly of LAND_POLYGONS) {
    // Check bbox proximity considering wraparound
    const latOut =
      lat < poly.minLat - searchRadiusDeg || lat > poly.maxLat + searchRadiusDeg;
    if (latOut) continue;

    // Account for longitude wrap shifts (-360, 0, +360)
    for (const shift of [0, -360, 360]) {
      const testLon = wLon + shift;
      if (
        testLon < poly.minLon - searchRadiusDeg ||
        testLon > poly.maxLon + searchRadiusDeg
      ) {
        continue;
      }
      const { ring } = poly;
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        const hit = closestPointOnSegment(testLon, lat, ax, ay, bx, by);
        if (hit.distSq < bestDistSq) {
          bestDistSq = hit.distSq;
          const distDeg = Math.sqrt(hit.distSq);
          const dLon = hit.x - testLon;
          const dLat = hit.y - lat;
          const bearingToCoastDeg = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
          best = {
            distDeg,
            coastLat: hit.y,
            coastLon: wrapLon(hit.x),
            bearingToCoastDeg,
          };
        }
      }
    }
  }
  return best;
}

/**
 * Sample 72 radial sectors (5° step) up to `radiusDeg` (default 6.0° = 0.6 cm)
 * to produce a generic coastline profile for the 1st-person deck view.
 * Never reveals continent or country names!
 */
export function getCoastalSightings(lat, lon, headingDeg, radiusDeg = 6.0) {
  const sectors = [];
  const stepDeg = 0.35;

  for (let absBearing = 0; absBearing < 360; absBearing += 5) {
    const rad = (absBearing * Math.PI) / 180;
    const sinB = Math.sin(rad);
    const cosB = Math.cos(rad);
    let hitDist = null;

    for (let d = stepDeg; d <= radiusDeg; d += stepDeg) {
      const sLat = lat + d * cosB;
      const sLon = wrapLon(lon + d * sinB);
      if (sLat > 75 || sLat < -65 || isPointOnLand(sLat, sLon)) {
        hitDist = d;
        break;
      }
    }

    if (hitDist !== null) {
      let rel = absBearing - headingDeg;
      while (rel > 180) rel -= 360;
      while (rel <= -180) rel += 360;

      sectors.push({
        absBearing,
        relBearing: rel,
        distDeg: Number(hitDist.toFixed(2)),
        distCm: Number((hitDist / 10).toFixed(2)),
      });
    }
  }

  return sectors;
}
