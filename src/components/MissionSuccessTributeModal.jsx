import React from 'react';
import { Award, Crown, Map, Sparkles, Star } from 'lucide-react';

function getTributeCopy(missionId) {
  if (missionId === 'mission_event_cape') {
    return {
      royalTag: 'ROYAL ACCLAIM · 희망봉 개척 성공',
      heroTitle: '위대한 항해사여, 희망봉을 열다!',
      quote: '“폭풍의 곶이 아니라, 희망의 봉우리로 부르라!”',
      acclaimText:
        '거친 대서양을 뚫고 마침내 아프리카 최남단 희망봉(-34.5°S, 18.5°E)에 깃발을 꽂았습니다! 리스본 왕궁에 팡파르가 울려 퍼지고, 온 백성이 당신을 인도양의 문을 연 전설의 항해사로 추앙합니다!',
    };
  }
  if (missionId === 'mission_2') {
    return {
      royalTag: 'ROYAL ACCLAIM · 서쪽 신항로 명차 완수',
      heroTitle: '태평양을 넘어 귀환한 불멸의 무역상!',
      quote: '“아메리카 너머 동방의 보물을 품고 돌아오다!”',
      acclaimText:
        '서쪽 아메리카 대륙을 돌아 태평양을 건너고 명나라의 진귀한 차를 실어 리스본으로 무사 귀항했습니다. 대항해의 지도를 새로 쓴 위대한 항해사에게 왕실 최고의 훈장이 수여됩니다!',
    };
  }
  if (missionId === 'mission_3') {
    return {
      royalTag: 'ROYAL ACCLAIM · 사상 첫 지구 한 바퀴 완주',
      heroTitle: '지구를 한 바퀴 돈 인류사의 대제독!',
      quote: '“우리는 마침내 바다가 하나로 이어져 있음을 증명했다!”',
      acclaimText:
        '서반구와 동반구를 모두 돌파해 지구를 일주하고 리스본으로 복귀한 위대한 항해사! 온 세상이 당신의 위업을 영원히 기억할 것입니다!',
    };
  }
  return {
    royalTag: 'ROYAL ACCLAIM · 향료제도 대정복',
    heroTitle: '향료제도를 정복한 영광의 항해사!',
    quote: '“황금보다 귀한 향료와 함께 영광스런 귀항!”',
    acclaimText:
      '희망봉과 인도양의 계절풍을 뚫고 동남아시아 향료제도(말루쿠)에서 보물을 확보해 리스본으로 무사 귀항했습니다. 온 도시가 당신의 위대한 항해를 찬양하고 있습니다!',
  };
}

export default function MissionSuccessTributeModal({
  settlement,
  state,
  teamName,
  onViewSettlement,
}) {
  if (!settlement || !state) return null;
  const copy = getTributeCopy(settlement.mission?.id);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/92 backdrop-blur-md p-3 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-[#2b1a08] via-[#1c1309] to-slate-950 p-5 shadow-[0_0_70px_rgba(245,158,11,0.4)] text-center space-y-4 overflow-hidden my-auto">
        {/* Radiant Golden Halo Background */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full opacity-35 blur-2xl"
          style={{
            background: 'radial-gradient(circle, #fbbf24 0%, #d97706 45%, transparent 72%)',
          }}
        />

        {/* Hero Proclamation Header */}
        <div className="relative space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-500/20 px-3 py-1 text-[11px] font-black tracking-wider text-amber-200 shadow">
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>{copy.royalTag}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-100 leading-tight drop-shadow">
            {copy.heroTitle}
          </h2>
          <p className="text-xs font-bold text-amber-300/90 italic">{copy.quote}</p>
        </div>

        {/* Golden Monument & Cheering Harbor Illustration */}
        <div className="relative rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-950/50 via-slate-900/80 to-slate-950 p-2 overflow-hidden shadow-inner">
          <svg viewBox="0 0 360 155" className="w-full h-auto block">
            <defs>
              <radialGradient id="glorySun" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="goldMedal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>

            {/* Sunburst Rays */}
            <circle cx="180" cy="64" r="78" fill="url(#glorySun)" />
            <g stroke="#fde68a" strokeWidth="1.2" opacity="0.32">
              <line x1="180" y1="64" x2="40" y2="8" />
              <line x1="180" y1="64" x2="100" y2="2" />
              <line x1="180" y1="64" x2="180" y2="0" />
              <line x1="180" y1="64" x2="260" y2="2" />
              <line x1="180" y1="64" x2="320" y2="8" />
              <line x1="180" y1="64" x2="25" y2="55" />
              <line x1="180" y1="64" x2="335" y2="55" />
            </g>

            {/* Decorative Stars */}
            <g fill="#fef08a" opacity="0.9">
              <circle cx="58" cy="28" r="2" />
              <circle cx="94" cy="18" r="1.5" />
              <circle cx="268" cy="19" r="1.8" />
              <circle cx="305" cy="30" r="2.2" />
              <circle cx="122" cy="38" r="1.4" />
              <circle cx="242" cy="38" r="1.4" />
            </g>

            {/* Sea Horizon & Triumphal Cape Cliff */}
            <rect x="0" y="108" width="360" height="47" fill="#0c4a6e" opacity="0.85" />
            <path d="M 0 112 L 58 84 L 116 112 Z" fill="#452715" opacity="0.7" />
            <path d="M 244 112 L 302 82 L 360 112 Z" fill="#452715" opacity="0.7" />

            {/* Laurel Wreath & Royal Galleon Medallion */}
            <g transform="translate(180, 66)">
              {/* Laurel left & right arcs */}
              <path
                d="M -38 14 Q -48 -14 -24 -32"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 38 14 Q 48 -14 24 -32"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx="0" cy="-4" r="32" fill="#1e293b" stroke="url(#goldMedal)" strokeWidth="3.5" />

              {/* Golden Flagship inside Medallion */}
              <path d="M -18 8 L 18 8 L 13 15 L -13 15 Z" fill="#d97706" stroke="#fef08a" strokeWidth="1" />
              <line x1="0" y1="8" x2="0" y2="-22" stroke="#fde68a" strokeWidth="1.8" />
              <path d="M -12 -18 Q 0 -12 12 -18 L 10 2 Q 0 -2 -10 2 Z" fill="#fef3c7" />
              <path d="M 0 -14 L 0 -3 M -5 -9 L 5 -9" stroke="#b91c1c" strokeWidth="2.2" strokeLinecap="round" />
              {/* Crown above medallion */}
              <polygon points="-10,-36 -7,-45 0,-39 7,-45 10,-36" fill="url(#goldMedal)" stroke="#fef08a" strokeWidth="0.8" />
            </g>

            {/* Cheering Crowd Silhouettes at Harbor */}
            <g fill="#f59e0b" opacity="0.85">
              {[-130, -110, -90, -70, 70, 90, 110, 130].map((dx, i) => (
                <g key={i} transform={`translate(${180 + dx}, 136)`}>
                  <circle cx="0" cy="-10" r="3.4" />
                  <path d="M -5 4 L -3 -6 L 3 -6 L 5 4 Z" />
                  {/* Raised cheering arms */}
                  <line x1="-2" y1="-5" x2="-7" y2="-13" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="2" y1="-5" x2="7" y2="-13" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" />
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Acclaim Story & Honor Card */}
        <div className="relative rounded-2xl border border-amber-500/35 bg-slate-900/90 p-3.5 text-left space-y-2.5">
          <p className="text-xs text-amber-100/95 leading-relaxed">{copy.acclaimText}</p>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="rounded-xl border border-amber-500/30 bg-slate-950/90 px-2 py-2">
              <div className="text-[10px] text-slate-400">원정대</div>
              <div className="text-xs font-black text-amber-200 truncate">
                {teamName || '탐험 선단'}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-slate-950/90 px-2 py-2">
              <div className="text-[10px] text-slate-400">달성 턴</div>
              <div className="text-xs font-black text-emerald-300 tabular-nums">
                {state.turn} / {settlement.mission?.maxTurns}턴
              </div>
            </div>
            <div className="rounded-xl border border-amber-400/50 bg-amber-950/40 px-2 py-2">
              <div className="text-[10px] text-amber-300/90">총 점수</div>
              <div className="text-sm font-black text-amber-300 tabular-nums">
                {settlement.totalScore}점
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 px-3 py-1.5 text-xs font-black text-amber-200">
            <Award className="w-4 h-4 text-amber-300 shrink-0" />
            <span>수여 칭호: {settlement.rankLabel}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewSettlement}
          className="relative w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-105 active:scale-[0.99] py-3.5 text-sm font-black text-slate-950 shadow-xl transition cursor-pointer"
        >
          <Map className="w-4 h-4" />
          <span>내 항로 지도 비교 · 상세 정산표 보기</span>
          <Star className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
}
