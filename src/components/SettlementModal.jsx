import React, { useState } from 'react';
import {
  Award,
  Check,
  Coins,
  Download,
  Flag,
  Map,
  RotateCcw,
  ScrollText,
  Share2,
} from 'lucide-react';
import VoyageTrailMap from './VoyageTrailMap.jsx';
import { getPortById } from '../data/ports.js';
import { downloadVoyageReportPng, exportVoyageReportBlob } from '../engine/voyageReportCard.js';

function getGradeBadgeStyle(grade) {
  switch (grade) {
    case 'S':
      return 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-slate-950 border-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.45)]';
    case 'A':
      return 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-slate-950 border-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.35)]';
    case 'B':
      return 'bg-gradient-to-br from-sky-300 to-sky-500 text-slate-950 border-sky-200';
    case 'C':
      return 'bg-slate-700 text-slate-100 border-slate-500';
    default:
      return 'bg-rose-700 text-rose-50 border-rose-400';
  }
}

export default function SettlementModal({
  settlement,
  state,
  teamName,
  canReset = true,
  onReset,
  onClose,
}) {
  const [viewTab, setViewTab] = useState('trail'); // 'trail' | 'summary'
  const [imageStatus, setImageStatus] = useState('');

  if (!settlement) return null;

  const isSuccess = settlement.outcomeType === 'returned';
  const isPartial = settlement.outcomeType === 'overseas_docked';
  const grade = settlement.grade || 'B';
  const gradeTitle = settlement.gradeTitle || '항해사';
  const visitedNames = (state?.visitedPorts || [])
    .map((id) => getPortById(id)?.name)
    .filter(Boolean);

  const handleDownloadImage = async () => {
    try {
      setImageStatus('saving');
      await downloadVoyageReportPng({ settlement, state, teamName });
      setImageStatus('saved');
      setTimeout(() => setImageStatus(''), 3000);
    } catch {
      setImageStatus('error');
      setTimeout(() => setImageStatus(''), 3000);
    }
  };

  const handleShareImage = async () => {
    try {
      setImageStatus('sharing');
      const { blob, dataUrl } = await exportVoyageReportBlob({ settlement, state, teamName });
      const safeName = String(teamName || '원정대').replace(/[\\/:*?"<>|]/g, '_').trim();
      const file = new File([blob], `항해성과보고서_${safeName}_${grade}등급.png`, {
        type: 'image/png',
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `대항해시대 성과보고서 (${grade}등급 · ${settlement.totalScore}점)`,
          text: `${teamName || '우리 선단'}의 ${settlement.mission?.title} 결과: ${grade}등급 (${settlement.rankLabel})!`,
          files: [file],
        });
        setImageStatus('shared');
        setTimeout(() => setImageStatus(''), 3000);
        return;
      }

      // Desktop/unsupported browser fallback: save PNG automatically
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `항해성과보고서_${safeName}_${grade}등급.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setImageStatus('saved');
      setTimeout(() => setImageStatus(''), 3000);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setImageStatus('error');
        setTimeout(() => setImageStatus(''), 3000);
      } else {
        setImageStatus('');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="w-full max-w-md max-h-[94dvh] overflow-y-auto rounded-2xl border border-amber-500/45 bg-slate-900 p-4 shadow-2xl my-auto">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 border ${
              isSuccess
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : isPartial
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
            }`}
          >
            {isSuccess ? <Award className="w-6 h-6" /> : <Flag className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-amber-300/90">
              최종 항해 정산 · {teamName || '탐험 선단'}
            </div>
            <h2 className="text-base font-black text-white truncate">{settlement.rankLabel}</h2>
          </div>
        </div>

        {/* Mission Milestone Badges */}
        <div className="mt-2.5 space-y-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 font-bold border ${
                settlement.missionProgress?.goalAchieved
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
              }`}
            >
              {settlement.missionProgress?.goalAchieved
                ? `★ ${settlement.mission?.shortTitle} 완수!`
                : `${settlement.mission?.shortTitle} 미달성`}
            </span>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-slate-300">
              경과 {state.turn}/{settlement.mission?.maxTurns ?? 30}턴
            </span>
          </div>
          {settlement.missionProgress?.checklist && (
            <div className="flex flex-wrap gap-1.5">
              {settlement.missionProgress.checklist.map((c, idx) => (
                <span
                  key={idx}
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                    c.done
                      ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  {c.done ? '✓' : '✕'} {c.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Tabs: Route Map & Report Card vs Settlement Breakdown */}
        <div className="grid grid-cols-2 gap-1.5 mt-3 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setViewTab('trail')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-black transition cursor-pointer ${
              viewTab === 'trail'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            위치·성과보고서
          </button>
          <button
            type="button"
            onClick={() => setViewTab('summary')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-black transition cursor-pointer ${
              viewTab === 'summary'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            상세 정산 내역
          </button>
        </div>

        {viewTab === 'trail' ? (
          <div className="mt-3 space-y-2.5">
            <VoyageTrailMap state={state} />

            {/* Compact Voyage Achievement Report Card */}
            <div className="rounded-2xl border border-amber-500/45 bg-gradient-to-br from-slate-950 via-[#161c2e] to-slate-950 p-3 space-y-2.5 shadow-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 ${getGradeBadgeStyle(
                    grade,
                  )}`}
                >
                  <span className="text-2xl font-black leading-none">{grade}</span>
                  <span className="text-[10px] font-black mt-0.5">등급</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                    공식 항해 성과보고서 · {gradeTitle}
                  </div>
                  <div className="text-sm font-black text-white truncate">
                    {teamName || '탐험 선단'}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">{settlement.rankLabel}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400">총 점수</div>
                  <div className="text-lg font-black text-amber-300 tabular-nums">
                    {settlement.totalScore}점
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <div className="rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1.5">
                  <div className="text-[10px] text-slate-400">항해 턴</div>
                  <div className="font-black text-emerald-300 tabular-nums">
                    {state.turn}/{settlement.mission?.maxTurns ?? 30}턴
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1.5">
                  <div className="text-[10px] text-slate-400">기항 항구</div>
                  <div className="font-black text-sky-300 tabular-nums">
                    {visitedNames.length}곳
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1.5">
                  <div className="text-[10px] text-slate-400">잔여 자원</div>
                  <div className="font-black text-amber-200 tabular-nums">
                    식량 {state.food}·선체 {state.hull}
                  </div>
                </div>
              </div>

              {/* Save / Share as Image Actions */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] py-2 text-xs font-black text-slate-950 transition cursor-pointer"
                >
                  {imageStatus === 'saved' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>PNG 저장 완료!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>이미지로 저장</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleShareImage}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 active:scale-[0.99] py-2 text-xs font-black text-sky-200 transition cursor-pointer"
                >
                  {imageStatus === 'shared' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>공유 완료!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>공유하기</span>
                    </>
                  )}
                </button>
              </div>
              {imageStatus === 'error' && (
                <div className="text-[11px] text-rose-300 text-center">
                  이미지 생성 중 오류가 발생했습니다. 다시 시도해주세요.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Financial Breakdown */
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">남은 금화</span>
              <span className="font-bold text-slate-200 tabular-nums">
                {settlement.remainingGold} G
              </span>
            </div>

            <div className="border-t border-slate-800/80 pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">특산품 정산</span>
                <span className="font-bold text-amber-300 tabular-nums">
                  +{settlement.cargoTotal} G
                </span>
              </div>
              {settlement.cargoBreakdown.length === 0 ? (
                <div className="text-[11px] text-slate-500">선적한 특산품 없음</div>
              ) : (
                <div className="space-y-1">
                  {settlement.cargoBreakdown.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-[11px] text-slate-300"
                    >
                      <span>
                        {item.name} ({item.portName})
                      </span>
                      <span className="tabular-nums">
                        {item.buyPrice}G × {item.appliedMultiplier}배 ={' '}
                        <strong className="text-amber-300">{item.payout}G</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
              <span className="text-slate-400">잔여 자원 보너스 (식량+내구도)</span>
              <span className="font-bold text-sky-300 tabular-nums">
                +{settlement.resourceBonus} 점
              </span>
            </div>

            {settlement.missionBonus > 0 && (
              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
                <span className="text-slate-400">미션 목표 완수 보너스</span>
                <span className="font-bold text-emerald-300 tabular-nums">
                  +{settlement.missionBonus} 점
                </span>
              </div>
            )}

            <div className="border-t border-amber-500/30 pt-2.5 flex items-center justify-between text-sm">
              <span className="font-black text-white flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                최종 정산 점수 ({grade}등급)
              </span>
              <span className="text-xl font-black text-amber-300 tabular-nums">
                {settlement.totalScore} 점
              </span>
            </div>
          </div>
        )}

        <div className={`mt-3.5 grid gap-2 ${canReset ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            일지 살펴보기
          </button>
          {canReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-black text-slate-950 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              새 항해 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
