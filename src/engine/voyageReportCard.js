import { LAND_POLYGONS } from '../data/worldCoastlines.js';
import { PORTS, getPortById } from '../data/ports.js';

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function getGradePalette(grade) {
  switch (grade) {
    case 'S':
      return { bg: '#f59e0b', border: '#fef08a', text: '#0f172a', accent: '#fbbf24' };
    case 'A':
      return { bg: '#10b981', border: '#a7f3d0', text: '#022c22', accent: '#34d399' };
    case 'B':
      return { bg: '#0ea5e9', border: '#bae6fd', text: '#082f49', accent: '#38bdf8' };
    case 'C':
      return { bg: '#64748b', border: '#cbd5e1', text: '#f8fafc', accent: '#94a3b8' };
    default:
      return { bg: '#e11d48', border: '#fecdd3', text: '#fff1f2', accent: '#fb7185' };
  }
}

function formatCoord(lat, lon) {
  const latStr = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const lonStr = lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return `${latStr}, ${lonStr}`;
}

/**
 * Render a high-resolution shareable PNG voyage achievement report card on a 2D Canvas.
 */
export function renderVoyageReportCanvas({ settlement, state, teamName }) {
  const W = 1080;
  const H = 1360;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const fontStack =
    '"Pretendard", "Noto Sans KR", "Malgun Gothic", -apple-system, BlinkMacSystemFont, sans-serif';

  // Background deep navy gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0b1528');
  bgGrad.addColorStop(0.55, '#0f172a');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle golden halo behind top badge
  const halo = ctx.createRadialGradient(W / 2, 180, 20, W / 2, 180, 420);
  halo.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
  halo.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, 560);

  // Outer ornamental double frame
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 36);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 42, 42, W - 84, H - 84, 28);
  ctx.stroke();

  const grade = settlement?.grade || 'B';
  const gradeTitle = settlement?.gradeTitle || '항해사';
  const pal = getGradePalette(grade);
  const displayTeam = (teamName || '대항해 원정대').trim();

  // Header Tag
  ctx.fillStyle = '#fbbf24';
  ctx.font = `800 22px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText('AGE OF SAIL SIMULATOR · 공식 항해 성과보고서', W / 2, 98);

  // Team & Mission Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = `900 46px ${fontStack}`;
  ctx.fillText(displayTeam, W / 2, 158);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `700 26px ${fontStack}`;
  ctx.fillText(settlement?.mission?.title || '대항해 미션', W / 2, 202);

  // Navigation Grade Medallion Card
  drawRoundedRect(ctx, 68, 232, W - 136, 178, 26);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Left Grade Seal
  ctx.save();
  ctx.beginPath();
  ctx.arc(176, 321, 62, 0, Math.PI * 2);
  ctx.fillStyle = pal.bg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.border;
  ctx.stroke();

  ctx.fillStyle = pal.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 58px ${fontStack}`;
  ctx.fillText(grade, 176, 310);
  ctx.font = `800 18px ${fontStack}`;
  ctx.fillText('등급', 176, 355);
  ctx.restore();

  // Grade & Rank Description
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = pal.accent;
  ctx.font = `900 26px ${fontStack}`;
  ctx.fillText(`항해 등급: ${grade}등급 · ${gradeTitle}`, 268, 294);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 30px ${fontStack}`;
  const rankStr = settlement?.rankLabel || '항해 완수';
  const maxRankLen = 26;
  const shownRank = rankStr.length > maxRankLen ? `${rankStr.slice(0, maxRankLen)}…` : rankStr;
  ctx.fillText(shownRank, 268, 342);

  ctx.fillStyle = settlement?.missionProgress?.goalAchieved ? '#34d399' : '#fda4af';
  ctx.font = `800 22px ${fontStack}`;
  ctx.fillText(
    settlement?.missionProgress?.goalAchieved
      ? '★ 미션 목표 완수!'
      : '○ 항해 종료 (부분 달성 / 재도전)',
    268,
    384,
  );

  // World Map Card
  const mapX = 68;
  const mapY = 434;
  const mapW = W - 136; // 944
  const mapH = 400;

  drawRoundedRect(ctx, mapX, mapY, mapW, mapH, 22);
  ctx.save();
  ctx.clip();

  // Ocean chart background
  ctx.fillStyle = '#e8f1f5';
  ctx.fillRect(mapX, mapY, mapW, mapH);

  const isA4Event = settlement?.mission?.chartDegPerCm === 5;
  const lonMin = isA4Event ? -142 : -170;
  const lonMax = isA4Event ? 70 : 170;
  const lonSpan = lonMax - lonMin;
  const latMax = isA4Event ? 50 : 75;
  const latMin = isA4Event ? -40 : -65;
  const latSpan = latMax - latMin;

  const toCanvasX = (lon) => mapX + ((lon - lonMin) / lonSpan) * mapW;
  const toCanvasY = (lat) => mapY + ((latMax - lat) / latSpan) * mapH;

  // Grid lines
  const gridStep = isA4Event ? 5 : 10;
  for (let lon = Math.ceil(lonMin / gridStep) * gridStep; lon <= lonMax; lon += gridStep) {
    const x = toCanvasX(lon);
    ctx.strokeStyle = lon === 0 ? '#94a3b8' : lon % 10 === 0 ? '#cbd5e1' : '#e2e8f0';
    ctx.lineWidth = lon === 0 ? 1.8 : lon % 10 === 0 ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.moveTo(x, mapY);
    ctx.lineTo(x, mapY + mapH);
    ctx.stroke();
  }
  for (let lat = Math.ceil(latMin / gridStep) * gridStep; lat <= latMax; lat += gridStep) {
    const y = toCanvasY(lat);
    ctx.strokeStyle = lat === 0 ? '#dc2626' : lat % 10 === 0 ? '#cbd5e1' : '#e2e8f0';
    ctx.lineWidth = lat === 0 ? 1.8 : lat % 10 === 0 ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.moveTo(mapX, y);
    ctx.lineTo(mapX + mapW, y);
    ctx.stroke();
  }

  // Landmasses
  for (const poly of LAND_POLYGONS) {
    ctx.beginPath();
    poly.ring.forEach(([lon, lat], idx) => {
      const px = toCanvasX(lon);
      const py = toCanvasY(lat);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = '#d6c198';
    ctx.fill();
    ctx.strokeStyle = '#8c734b';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Major ports
  for (const port of PORTS) {
    const px = toCanvasX(port.lon);
    const py = toCanvasY(port.lat);
    const isStar = port.isHomePort || port.isGoalPort;
    ctx.beginPath();
    ctx.arc(px, py, isStar ? 5.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isStar ? '#dc2626' : '#1d4ed8';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Voyage trail split at antimeridian
  const trail = state?.trail || [];
  if (trail.length > 0) {
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    trail.forEach((pt, idx) => {
      const px = toCanvasX(pt.lon);
      const py = toCanvasY(pt.lat);
      if (idx === 0 || Math.abs(pt.lon - trail[idx - 1].lon) > 180) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();

    // Start & End markers
    const first = trail[0];
    const last = trail[trail.length - 1];
    ctx.beginPath();
    ctx.arc(toCanvasX(first.lon), toCanvasY(first.lat), 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(toCanvasX(last.lon), toCanvasY(last.lat), 11, 0, Math.PI * 2);
    ctx.strokeStyle = state?.status === 'returned' ? '#10b981' : '#e11d48';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(toCanvasX(last.lon), toCanvasY(last.lat), 6.5, 0, Math.PI * 2);
    ctx.fillStyle = state?.status === 'returned' ? '#10b981' : '#f43f5e';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, mapX, mapY, mapW, mapH, 22);
  ctx.stroke();

  // KPI Grid (4 boxes)
  const kpis = [
    { label: '최종 점수', value: `${settlement?.totalScore ?? 0}점`, color: '#fbbf24' },
    {
      label: '소요 턴',
      value: `${settlement?.turnsTaken ?? state?.turn ?? 0} / ${settlement?.mission?.maxTurns ?? 30}턴`,
      color: '#34d399',
    },
    {
      label: '방문 기항지',
      value: `${(state?.visitedPorts || []).length}곳`,
      color: '#38bdf8',
    },
    {
      label: '최종 위치',
      value: formatCoord(state?.lat ?? 38.7, state?.lon ?? -9.1),
      color: '#e2e8f0',
    },
  ];

  const boxW = (W - 136 - 36) / 2;
  const boxH = 104;
  kpis.forEach((k, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = 68 + col * (boxW + 36);
    const by = 860 + row * (boxH + 20);
    drawRoundedRect(ctx, bx, by, boxW, boxH, 18);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 20px ${fontStack}`;
    ctx.fillText(k.label, bx + 22, by + 38);

    ctx.fillStyle = k.color;
    ctx.font = `900 32px ${fontStack}`;
    ctx.fillText(k.value, bx + 22, by + 82);
  });

  // Visited ports & Checklist card
  drawRoundedRect(ctx, 68, 1110, W - 136, 152, 20);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const visitedNames = (state?.visitedPorts || [])
    .map((id) => getPortById(id)?.name)
    .filter(Boolean);
  const routeLine =
    visitedNames.length > 0 ? visitedNames.join(' → ') : '리스본 출항';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#34d399';
  ctx.font = `800 22px ${fontStack}`;
  ctx.fillText('주요 항해 발자취', 92, 1152);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `700 21px ${fontStack}`;
  const clippedRoute = routeLine.length > 44 ? `${routeLine.slice(0, 44)}…` : routeLine;
  ctx.fillText(clippedRoute, 92, 1188);

  const checklist = (settlement?.missionProgress?.checklist || [])
    .map((c) => `${c.done ? '✓' : '✕'} ${c.label}`)
    .join('   ·   ');
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `700 20px ${fontStack}`;
  const clippedCheck = checklist.length > 50 ? `${checklist.slice(0, 50)}…` : checklist;
  ctx.fillText(clippedCheck, 92, 1232);

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 20px ${fontStack}`;
  const todayStr = new Date().toLocaleDateString('ko-KR');
  ctx.fillText(
    `대항해시대 항해 시뮬레이터 · ${todayStr} 발행`,
    W / 2,
    1304,
  );

  return canvas;
}

export async function exportVoyageReportBlob(args) {
  const canvas = renderVoyageReportCanvas(args);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob, dataUrl };
}

export async function downloadVoyageReportPng(args) {
  const { dataUrl } = await exportVoyageReportBlob(args);
  const safeName = String(args.teamName || '원정대')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `항해성과보고서_${safeName}_${args.settlement?.grade || 'A'}등급.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return dataUrl;
}
