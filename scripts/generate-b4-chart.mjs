import fs from 'node:fs';
import path from 'node:path';
import { LAND_POLYGONS } from '../src/data/worldCoastlines.js';
import { PORTS } from '../src/data/ports.js';
import { TURN_CALENDAR } from '../src/data/calendar.js';

const ROOT_DIR = process.cwd();
const OUT_HTML = path.join(ROOT_DIR, 'B4_대항해시대_항해도.html');

// Exact B4 physical scale: 10° = 10.000 mm = 1.000 cm
// Lon: -170 .. +170 (340° = 340.0 mm = 34.0 cm)
// Lat: +75 .. -65   (140° = 140.0 mm = 14.0 cm)
const LON_MIN = -170;
const LON_MAX = 170;
const LAT_MAX = 75;
const LAT_MIN = -65;
const SVG_W = LON_MAX - LON_MIN; // 340
const SVG_H = LAT_MAX - LAT_MIN; // 140

const toX = (lon) => lon - LON_MIN;
const toY = (lat) => LAT_MAX - lat;

const PORT_LABEL_LAYOUT = {
  lisbon: { dx: -2.4, dy: -2.8, anchor: 'end', star: true, color: '#991b1b', label: '리스본(출발·38.7°N)' },
  seville: { dx: 2.4, dy: 2.8, anchor: 'start', label: '세비야' },
  azores: { dx: 0, dy: 4.2, anchor: 'middle', label: '아조레스' },
  canaries: { dx: -2.2, dy: 1.2, anchor: 'end', label: '카나리아' },
  stjohns: { dx: 2.2, dy: 0.8, anchor: 'start', label: '세인트존스' },
  jamestown: { dx: 2.2, dy: 0.8, anchor: 'start', label: '제임스타운' },
  havana: { dx: 2.2, dy: -1.0, anchor: 'start', label: '아바나' },
  acapulco: { dx: -2.2, dy: 1.4, anchor: 'end', label: '아카풀코' },
  monterey: { dx: -2.2, dy: 1.0, anchor: 'end', label: '몬터레이' },
  salvador: { dx: 2.2, dy: -1.2, anchor: 'start', label: '바이아' },
  laplata: { dx: 2.2, dy: 1.0, anchor: 'start', label: '라플라타' },
  magellanstrait: { dx: 2.2, dy: 1.2, anchor: 'start', label: '마젤란해협' },
  valparaiso: { dx: -2.2, dy: 0.8, anchor: 'end', label: '발파라이소' },
  callao: { dx: -2.2, dy: 0.8, anchor: 'end', label: '카야오(리마)' },
  caboverde: { dx: -2.2, dy: 0.8, anchor: 'end', label: '카보베르데' },
  elmina: { dx: -1.8, dy: 3.2, anchor: 'end', label: '엘미나' },
  luanda: { dx: -2.2, dy: 0.9, anchor: 'end', label: '루안다' },
  goodhope: { dx: -2.4, dy: 1.4, anchor: 'end', label: '희망봉(34.5°S)' },
  sofala: { dx: 2.2, dy: 1.0, anchor: 'start', label: '소팔라' },
  malindi: { dx: 2.2, dy: 0.8, anchor: 'start', label: '말린디' },
  aden: { dx: 2.0, dy: 2.6, anchor: 'start', label: '아덴' },
  hormuz: { dx: 2.0, dy: -1.8, anchor: 'start', label: '호르무즈' },
  goacalicut: { dx: -2.0, dy: -1.8, anchor: 'end', label: '고아·캘리컷' },
  colombo: { dx: 2.0, dy: 2.6, anchor: 'start', label: '콜롬보' },
  malacca: { dx: -2.2, dy: 2.0, anchor: 'end', label: '말라카' },
  macau: { dx: -2.4, dy: -1.6, anchor: 'end', star: true, color: '#991b1b', label: '마카오·광저우(M2)' },
  manila: { dx: 2.2, dy: 0.5, anchor: 'start', label: '마닐라' },
  nagasaki: { dx: 2.2, dy: 0.6, anchor: 'start', label: '나가사키' },
  guam: { dx: 2.2, dy: 0.9, anchor: 'start', label: '괌' },
  maluku: { dx: 2.2, dy: 3.0, anchor: 'start', star: true, color: '#991b1b', label: '향료제도(말루쿠·M1)' },
};

const gridLinesSvg = (() => {
  const out = [];
  // Latitude horizontals every 10° (1.000 cm)
  for (let lat = 70; lat >= -60; lat -= 10) {
    const y = toY(lat);
    const isEquator = lat === 0;
    out.push(
      `<line x1="0" y1="${y}" x2="${SVG_W}" y2="${y}" stroke="${isEquator ? '#b91c1c' : '#cbb896'}" stroke-width="${
        isEquator ? '0.45' : '0.2'
      }" ${isEquator ? '' : 'opacity="0.85"'} />`,
    );
  }
  // Longitude verticals every 10° (1.000 cm)
  for (let lon = -160; lon <= 160; lon += 10) {
    const x = toX(lon);
    const isPrime = lon === 0;
    out.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${SVG_H}" stroke="${isPrime ? '#a16207' : '#cbb896'}" stroke-width="${
        isPrime ? '0.35' : '0.2'
      }" opacity="0.85" />`,
    );
  }
  return out.join('\n');
})();

const landSvg = LAND_POLYGONS.map((poly) => {
  const d =
    poly.ring
      .map(([lon, lat], idx) => `${idx === 0 ? 'M' : 'L'} ${toX(lon).toFixed(2)} ${toY(lat).toFixed(2)}`)
      .join(' ') + ' Z';
  return `<path d="${d}" fill="#e6cfa4" stroke="#6f4c24" stroke-width="0.38" stroke-linejoin="round" />`;
}).join('\n');

const windArrowsSvg = [
  // North Atlantic Canary & NE Trade Wind
  { pts: [[-13, 35], [-17, 25], [-21, 18]], dashed: false },
  { pts: [[-32, 21], [-48, 15]], dashed: false },
  { pts: [[-54, 44], [-34, 48]], dashed: false },
  // South Atlantic Gyre
  { pts: [[-26, -15], [-33, -24], [-22, -32], [-4, -36]], dashed: false },
  // Roaring Forties (South Ocean)
  { pts: [[18, -42], [45, -42]], dashed: false },
  { pts: [[85, -42], [115, -42]], dashed: false },
  { pts: [[-115, -42], [-85, -42]], dashed: false },
  // Indian Ocean & SE Asia Monsoon (Summer SW->NE & Winter reverse)
  { pts: [[56, 3], [70, 12]], dashed: false },
  { pts: [[84, 9], [96, 14]], dashed: true },
  // Pacific Trade Winds & North Pacific Westerlies
  { pts: [[-108, 18], [-128, 12]], dashed: false },
  { pts: [[158, 18], [138, 13]], dashed: false },
  { pts: [[142, 40], [164, 43]], dashed: false },
  { pts: [[-155, 42], [-132, 39]], dashed: false },
  { pts: [[-95, -16], [-118, -11]], dashed: false },
]
  .map(({ pts, dashed }) => {
    const d = pts.map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'} ${toX(lon)} ${toY(lat)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="#c2410c" stroke-width="0.55" ${
      dashed ? 'stroke-dasharray="1.4 1.0"' : ''
    } marker-end="url(#windArrow)" opacity="0.82" />`;
  })
  .join('\n');

const portsSvg = PORTS.map((port) => {
  const layout = PORT_LABEL_LAYOUT[port.id] || { dx: 2.2, dy: 0.8, anchor: 'start', label: port.name };
  const x = toX(port.lon);
  const y = toY(port.lat);
  const isStar = Boolean(layout.star);
  const fill = layout.color || '#1e3a8a';

  return `
    <g transform="translate(${x.toFixed(2)}, ${y.toFixed(2)})">
      ${
        isStar
          ? `<circle cx="0" cy="0" r="1.45" fill="#dc2626" stroke="#fff" stroke-width="0.35" />`
          : `<circle cx="0" cy="0" r="1.05" fill="#1d4ed8" stroke="#fff" stroke-width="0.3" />`
      }
      <text
        x="${layout.dx}"
        y="${layout.dy}"
        text-anchor="${layout.anchor}"
        font-size="${isStar ? '2.85' : '2.45'}"
        font-weight="${isStar ? '800' : '700'}"
        fill="${fill}"
        paint-order="stroke"
        stroke="#fcf7ea"
        stroke-width="0.85"
      >${isStar ? '★ ' : '⚓ '}${layout.label}</text>
    </g>
  `;
}).join('\n');

const labelsSvg = `
  <!-- Continent & Ocean Labels -->
  <g fill="#78512a" font-size="3.6" font-weight="700" text-anchor="middle" opacity="0.72">
    <text x="${toX(-104)}" y="${toY(47)}">북아메리카</text>
    <text x="${toX(-60)}" y="${toY(-14)}">남아메리카</text>
    <text x="${toX(14)}" y="${toY(50)}">유럽</text>
    <text x="${toX(20)}" y="${toY(14)}">아프리카</text>
    <text x="${toX(88)}" y="${toY(45)}">아시아</text>
    <text x="${toX(134)}" y="${toY(-25)}">호주</text>
  </g>
  <g fill="#476c8a" font-size="3.4" font-weight="600" text-anchor="middle" letter-spacing="0.9" opacity="0.72">
    <text x="${toX(-140)}" y="${toY(26)}">북 태 평 양</text>
    <text x="${toX(-122)}" y="${toY(-26)}">남 태 평 양</text>
    <text x="${toX(-42)}" y="${toY(28)}">북 대 서 양</text>
    <text x="${toX(-26)}" y="${toY(-27)}">남 대 서 양</text>
    <text x="${toX(76)}" y="${toY(-18)}">인 도 양</text>
    <text x="${toX(156)}" y="${toY(27)}">태 평 양</text>
  </g>
  <!-- Polar Warning Bands -->
  <rect x="0" y="0" width="${SVG_W}" height="${toY(58)}" fill="#0ea5e9" opacity="0.09" />
  <rect x="0" y="${toY(-53)}" width="${SVG_W}" height="${SVG_H - toY(-53)}" fill="#0ea5e9" opacity="0.11" />
  <line x1="0" y1="${toY(58)}" x2="${SVG_W}" y2="${toY(58)}" stroke="#0284c7" stroke-width="0.3" stroke-dasharray="2 1.5" opacity="0.65" />
  <line x1="0" y1="${toY(-53)}" x2="${SVG_W}" y2="${toY(-53)}" stroke="#0284c7" stroke-width="0.3" stroke-dasharray="2 1.5" opacity="0.65" />
  <text x="${toX(-158)}" y="${toY(64)}" font-size="2.6" font-weight="700" fill="#0369a1" opacity="0.9">❄ 북극권 (58°N↑ 눈·유빙 주의)</text>
  <text x="${toX(118)}" y="${toY(66)}" font-size="2.6" font-weight="700" fill="#0369a1" opacity="0.9">❄ 북극권 (눈보라·혹한)</text>
  <text x="${toX(18)}" y="${toY(-59)}" font-size="2.7" font-weight="700" fill="#0369a1" opacity="0.9">❄ 남극권 (53°S↓ 눈·빙산 주의)</text>

  <!-- Compass Rose in open South Atlantic -->
  <g transform="translate(${toX(-6)}, ${toY(-20)})">
    <circle cx="0" cy="0" r="6.8" fill="#fcf7ea" fill-opacity="0.72" stroke="#78350f" stroke-width="0.3" />
    <path d="M 0 -6.4 L 1.4 -1.4 L 6.4 0 L 1.4 1.4 L 0 6.4 L -1.4 1.4 L -6.4 0 L -1.4 -1.4 Z" fill="#1e293b" />
    <text x="0" y="-7.6" text-anchor="middle" font-size="2.5" font-weight="800" fill="#0f172a">000° N</text>
    <text x="8.2" y="0.9" text-anchor="start" font-size="2.3" font-weight="700" fill="#0f172a">090° E</text>
    <text x="0" y="9.2" text-anchor="middle" font-size="2.3" font-weight="700" fill="#0f172a">180° S</text>
    <text x="-8.2" y="0.9" text-anchor="end" font-size="2.3" font-weight="700" fill="#0f172a">270° W</text>
  </g>

  <!-- Exact Physical 1cm Scale Verification Bar (0..40 mm = 0..4 cm) -->
  <g transform="translate(${toX(-165)}, ${toY(-59)})">
    <rect x="-1.5" y="-4.8" width="59" height="8.5" rx="1.2" fill="#fcf7ea" fill-opacity="0.92" stroke="#92400e" stroke-width="0.28" />
    <line x1="0" y1="0" x2="40" y2="0" stroke="#0f172a" stroke-width="0.55" />
    ${[0, 10, 20, 30, 40]
      .map(
        (mm) =>
          `<line x1="${mm}" y1="-1.5" x2="${mm}" y2="1.2" stroke="#0f172a" stroke-width="0.45" />`,
      )
      .join('')}
    <text x="0" y="-2.1" text-anchor="middle" font-size="2.1" font-weight="800" fill="#0f172a">0</text>
    <text x="10" y="-2.1" text-anchor="middle" font-size="2.0" font-weight="700" fill="#b91c1c">1cm</text>
    <text x="20" y="-2.1" text-anchor="middle" font-size="2.0" font-weight="700" fill="#b45309">2cm</text>
    <text x="30" y="-2.1" text-anchor="middle" font-size="2.0" font-weight="700" fill="#0369a1">3cm</text>
    <text x="40" y="-2.1" text-anchor="middle" font-size="2.0" font-weight="700" fill="#047857">4cm</text>
    <text x="10" y="2.9" text-anchor="middle" font-size="1.65" font-weight="700" fill="#64748b">역풍</text>
    <text x="20" y="2.9" text-anchor="middle" font-size="1.65" font-weight="700" fill="#64748b">무풍</text>
    <text x="30" y="2.9" text-anchor="middle" font-size="1.65" font-weight="700" fill="#64748b">측풍</text>
    <text x="40" y="2.9" text-anchor="middle" font-size="1.65" font-weight="700" fill="#64748b">순풍</text>
    <text x="42.5" y="0.7" text-anchor="start" font-size="2.1" font-weight="800" fill="#0f172a">1cm = 10°</text>
  </g>
`;

const latAxisLeftHtml = Array.from({ length: 14 }, (_, idx) => {
  const lat = 70 - idx * 10;
  const topMm = toY(lat);
  const label = lat > 0 ? `${lat}°N` : lat === 0 ? '0° 적도' : `${Math.abs(lat)}°S`;
  return `<div class="lat-tick ${lat === 0 ? 'eq' : ''}" style="top: ${topMm}mm;">${label}</div>`;
}).join('');

function renderDeclinationHalf(rows) {
  const thCells = rows
    .map(
      (t) =>
        `<th>${t.turn}턴<br/><span>(${t.shortLabel})</span></th>`,
    )
    .join('');
  const tdCells = rows
    .map(
      (t) =>
        `<td>${t.declination > 0 ? `+${t.declination.toFixed(1)}°` : `${t.declination.toFixed(1)}°`}</td>`,
    )
    .join('');
  return `
    <tr>
      <th class="row-head">턴 (날짜)</th>
      ${thCells}
    </tr>
    <tr>
      <th class="row-head">적위(δ)</th>
      ${tdCells}
    </tr>
  `;
}

const first20 = TURN_CALENDAR.slice(0, 20);
const next20 = TURN_CALENDAR.slice(20, 40);

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>대항해시대 B4 조별 항해도 (1cm = 10° 정방형 · 40턴 적위표)</title>
  <style>
    @page {
      size: 364mm 257mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 364mm;
      height: 257mm;
      background: #ffffff;
      color: #0f172a;
      font-family: "Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 364mm;
      height: 257mm;
      padding: 6mm 0 5mm 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header {
      width: 340mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 2.2mm;
      border-bottom: 0.5mm solid #0f172a;
    }
    .eyebrow {
      font-size: 7.4pt;
      font-weight: 800;
      color: #9a3412;
      margin-bottom: 0.7mm;
    }
    h1 {
      font-size: 14.5pt;
      font-weight: 900;
      letter-spacing: -0.3pt;
      color: #0f172a;
    }
    .meta-right {
      text-align: right;
      font-size: 7.6pt;
      line-height: 1.45;
      color: #1e293b;
    }
    .hemisphere-bar {
      width: 340mm;
      height: 5.5mm;
      margin-top: 1.8mm;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 3mm;
      font-size: 7.3pt;
      font-weight: 700;
    }
    .hemisphere-center {
      color: #fde68a;
      font-weight: 800;
    }
    .map-row {
      width: 364mm;
      height: 140mm;
      display: flex;
      align-items: stretch;
      justify-content: center;
    }
    .lat-col {
      position: relative;
      width: 12mm;
      height: 140mm;
    }
    .lat-tick {
      position: absolute;
      left: 0;
      right: 0;
      transform: translateY(-50%);
      font-size: 6.4pt;
      font-weight: 700;
      color: #334155;
      text-align: center;
      white-space: nowrap;
    }
    .lat-tick.eq {
      color: #b91c1c;
      font-size: 5.9pt;
      font-weight: 900;
    }
    .map-frame {
      width: 340mm;
      height: 140mm;
      border: 0.45mm solid #334155;
      background: #fdfaf2;
      overflow: hidden;
      flex-shrink: 0;
    }
    .rules-strip {
      width: 340mm;
      margin-top: 2mm;
      padding: 1.6mm 2.8mm;
      border: 0.35mm solid #cbd5e1;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.2pt;
      color: #1e293b;
    }
    .rules-strip strong {
      color: #0f172a;
    }
    .declination-wrap {
      width: 340mm;
      margin-top: 2.2mm;
    }
    .declination-title {
      font-size: 7.5pt;
      font-weight: 800;
      color: #7c2d12;
      margin-bottom: 1mm;
      display: flex;
      justify-content: space-between;
    }
    table.decl-table {
      width: 340mm;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 6.7pt;
      text-align: center;
    }
    table.decl-table th,
    table.decl-table td {
      border: 0.25mm solid #94a3b8;
      padding: 1.25mm 0.25mm;
      line-height: 1.2;
    }
    table.decl-table th {
      background: #1e293b;
      color: #f8fafc;
      font-weight: 800;
    }
    table.decl-table th span {
      font-weight: 600;
      color: #fde68a;
      font-size: 5.8pt;
    }
    table.decl-table th.row-head {
      width: 14mm;
      background: #334155;
      color: #ffffff;
      font-size: 6.4pt;
    }
    table.decl-table td {
      background: #fffdf7;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .footer {
      width: 340mm;
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      font-size: 6.8pt;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <div>
        <div class="eyebrow">B4 정방형 항해도 · 정밀 축척 10° = 1.000 cm (1턴 = 10일 · 초기 식량 140 · 8턴 부패 · 육지 접촉 시 피해 없이 정지)</div>
        <h1>대항해시대 항해 시뮬레이션 : 전 세계 조별 항해도 및 40턴 태양 적위표</h1>
      </div>
      <div class="meta-right">
        <div><strong>원정대:</strong> _________ 조 &nbsp;|&nbsp; <strong>역할:</strong> 선장 _______ · 항해사 _______ · 해도작성 _______ · 보급관 _______</div>
        <div><strong>선택 미션:</strong> □ 미션1 (향료제도 · 30턴) &nbsp; □ 미션2 (아메리카 서쪽우회→중국 차 · 34턴) &nbsp; □ 미션3 (지구 일주 · 40턴)</div>
      </div>
    </header>

    <div class="hemisphere-bar">
      <span>◀ 서반구 (아메리카·태평양 방면 · 경도 숫자 비공개)</span>
      <span class="hemisphere-center">출발: 리스본(38.7°N) → 1.항해 → 2.카드 → 3.주변활동(기항·교역·전투) → 리스본 귀항</span>
      <span>동반구 (인도양·동남아·태평양 방면) ▶</span>
    </div>

    <div class="map-row">
      <div class="lat-col">${latAxisLeftHtml}</div>
      <div class="map-frame">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" style="width: 340mm; height: 140mm; display: block;">
          <defs>
            <marker id="windArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.8" markerHeight="3.8" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#c2410c" />
            </marker>
          </defs>
          <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="#fdfaf2" />
          ${gridLinesSvg}
          ${landSvg}
          ${windArrowsSvg}
          ${labelsSvg}
          ${portsSvg}
        </svg>
      </div>
      <div class="lat-col">${latAxisLeftHtml}</div>
    </div>

    <div class="rules-strip">
      <span><strong>B4 자 환산 (1cm = 10°):</strong> 역풍 1.0cm · 무풍/약풍 2.0cm · 측풍 3.0cm · 순풍 4.0cm (전속 항해 선택 시 +1.0cm)</span>
      <span><strong>항해 규칙:</strong> 초기 식량 140 · 8턴 연속 미기항 시 부패(소모 1.5배) · 육지 접촉 시 피해 없이 정지(방향 전환 필요) · 극지(58°N↑/53°S↓) 눈·유빙</span>
    </div>

    <div class="declination-wrap">
      <div class="declination-title">
        <span>40턴 항해 일정 및 태양 적위(δ) 조견표 (미션1: 1~30턴 · 미션2: 1~34턴 · 미션3: 1~40턴)</span>
        <span>※ 1cm = 10° 정방형 격자이므로 자로 잰 cm × 10 = 이동 각도(°)</span>
      </div>
      <table class="decl-table">
        ${renderDeclinationHalf(first20)}
        ${renderDeclinationHalf(next20)}
      </table>
    </div>

    <footer class="footer">
      <span>대항해시대 항해 시뮬레이션 (개정판 B4 항해도 · 북미/남미 신규 기항지 6곳 및 40턴 미션 반영)</span>
      <span>인쇄 설정: 용지 크기 B4(JIS 364×257mm) · 배율 100%(실제 크기, 용지에 맞춤 해제) 필수</span>
    </footer>
  </div>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html, 'utf8');
console.log(`Generated ${OUT_HTML}`);
