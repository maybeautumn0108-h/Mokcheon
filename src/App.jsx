import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Anchor, Flag, Navigation, RotateCcw, Sparkles, X } from 'lucide-react';
import TopResourceBar from './components/TopResourceBar.jsx';
import DeckView from './components/DeckView.jsx';
import HelmWheel from './components/HelmWheel.jsx';
import BottomNav from './components/BottomNav.jsx';
import TurnResultModal from './components/TurnResultModal.jsx';
import SituationCardModal from './components/SituationCardModal.jsx';
import SettlementModal from './components/SettlementModal.jsx';
import QuadrantTab from './components/QuadrantTab.jsx';
import TradeLogTab from './components/TradeLogTab.jsx';
import FleetTab from './components/FleetTab.jsx';
import TeacherModeView from './components/TeacherModeView.jsx';
import { drawThreeSituationCards } from './data/situationCards.js';
import { getTurnInfo } from './data/calendar.js';
import {
  applySituationCardToState,
  buySpecialty,
  buySupplies,
  calculateFinalSettlement,
  computePlannedMove,
  createInitialGameState,
  executeDockTurn,
  executeSailTurn,
  findNearbyPort,
  getNearbyFleets,
  repairHull,
  sellCargoItem,
} from './engine/navigation.js';
import {
  clearLocalGameState,
  clearRoomInSupabase,
  clearRoomSnapshot,
  getDemoRivalFleets,
  getOrCreateClientId,
  isSupabaseConfigured,
  loadLocalGameState,
  loadRoomSnapshot,
  saveLocalGameState,
  savePlayerToRoom,
  subscribeToRoomSupabase,
  upsertPlayerToSupabase,
} from './engine/fleetSync.js';

const END_MESSAGES = {
  returned: {
    title: '리스본 무사 귀항 성공!',
    tone: 'emerald',
    desc: '30턴 이내에 리스본으로 복귀하여 최종 정산을 완료했습니다.',
  },
  timeup: {
    title: '30턴 항해 기한 종료',
    tone: 'amber',
    desc: '10개월(30턴)의 항해 기간이 모두 경과했습니다. 최종 정산 결과를 확인하세요.',
  },
  stranded: {
    title: '식량·식수 고갈로 조난',
    tone: 'rose',
    desc: '식량과 식수가 바닥났습니다. 6턴 이내 기항지 보급 전략을 세워 다시 도전하세요.',
  },
  sunk: {
    title: '선체 파손으로 난파',
    tone: 'rose',
    desc: '연안 좌초 피해가 누적되어 항해를 계속할 수 없습니다.',
  },
};

export default function App() {
  const savedSnapshot = useMemo(() => loadLocalGameState(), []);
  const [gameState, setGameState] = useState(
    () => savedSnapshot?.state || createInitialGameState(),
  );
  const [activeTab, setActiveTab] = useState('helm');
  const [isSailing, setIsSailing] = useState(false);
  const [turnOutcome, setTurnOutcome] = useState(null);
  const [drawnCards, setDrawnCards] = useState(null);
  const [cardHintBanner, setCardHintBanner] = useState(null);
  const [dockToast, setDockToast] = useState(null);
  const [showSettlement, setShowSettlement] = useState(false);

  // Classroom Multiplayer & Teacher Mode state
  const [clientId] = useState(() => getOrCreateClientId());
  const [roomCode, setRoomCode] = useState(
    () => savedSnapshot?.meta?.roomCode || 'HIST-101',
  );
  const [teamName, setTeamName] = useState(
    () => savedSnapshot?.meta?.teamName || '1조 콜럼버스',
  );
  const [showDemoRivals, setShowDemoRivals] = useState(true);
  const [roomPeersMap, setRoomPeersMap] = useState({});
  const [isTeacherMode, setIsTeacherMode] = useState(false);

  const sailTimerRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    return () => {
      if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
    };
  }, []);

  // Persist game state locally so mobile refresh preserves voyage progress
  useEffect(() => {
    saveLocalGameState(gameState, { roomCode, teamName });
  }, [gameState, roomCode, teamName]);

  // Room sync: Supabase Realtime when configured, else BroadcastChannel + localStorage
  useEffect(() => {
    const cleanRoom = roomCode.trim() || 'HIST-101';

    if (isSupabaseConfigured) {
      const unsubscribe = subscribeToRoomSupabase(cleanRoom, (map) => {
        setRoomPeersMap(map);
      });
      return unsubscribe;
    }

    setRoomPeersMap(loadRoomSnapshot(cleanRoom));

    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(`age-of-sail-room-${cleanRoom}`);
      channelRef.current = channel;
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'SYNC_STATE') {
          setRoomPeersMap(loadRoomSnapshot(cleanRoom));
        } else if (ev.data?.type === 'CLEAR_ROOM') {
          setRoomPeersMap({});
        }
      };
    }

    const onStorage = (ev) => {
      if (ev.key === `age_of_sail_room_v1_${cleanRoom}`) {
        setRoomPeersMap(loadRoomSnapshot(cleanRoom));
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
      channelRef.current = null;
    };
  }, [roomCode]);

  // Publish my fleet state whenever key properties change
  useEffect(() => {
    const cleanRoom = roomCode.trim() || 'HIST-101';
    const lastLog = gameState.logs[0]?.title || '항해 중';
    const payload = {
      clientId,
      teamName: teamName.trim() || '탐험 선단',
      turn: gameState.turn,
      lat: gameState.lat,
      lon: gameState.lon,
      headingDeg: gameState.headingDeg,
      food: gameState.food,
      hull: gameState.hull,
      gold: gameState.gold,
      cargoCount: gameState.cargo.length,
      lastEvent: lastLog,
      status: gameState.status,
      trail: gameState.trail,
    };

    if (isSupabaseConfigured) {
      upsertPlayerToSupabase(cleanRoom, payload);
      return;
    }

    const nextMap = savePlayerToRoom(cleanRoom, payload);
    setRoomPeersMap(nextMap);
    channelRef.current?.postMessage({ type: 'SYNC_STATE', clientId });
  }, [
    clientId,
    roomCode,
    teamName,
    gameState.turn,
    gameState.lat,
    gameState.lon,
    gameState.headingDeg,
    gameState.food,
    gameState.hull,
    gameState.gold,
    gameState.cargo.length,
    gameState.status,
    gameState.trail,
    gameState.logs,
  ]);

  const windEval = useMemo(() => computePlannedMove(gameState), [gameState]);
  const nearbyPort = useMemo(
    () => findNearbyPort(gameState.lat, gameState.lon),
    [gameState.lat, gameState.lon],
  );
  const settlement = useMemo(
    () => (gameState.status !== 'active' ? calculateFinalSettlement(gameState) : null),
    [gameState],
  );

  // Merge room peers + optional demo rivals
  const allFleets = useMemo(() => {
    const realPeers = Object.values(roomPeersMap);
    const demos = showDemoRivals ? getDemoRivalFleets(gameState.turn) : [];
    const byId = new Map();
    for (const f of demos) byId.set(f.clientId, f);
    for (const f of realPeers) byId.set(f.clientId, f);
    return Array.from(byId.values()).sort((a, b) => b.turn - a.turn || b.gold - a.gold);
  }, [roomPeersMap, showDemoRivals, gameState.turn]);

  const otherFleets = useMemo(
    () => allFleets.filter((f) => f.clientId !== clientId),
    [allFleets, clientId],
  );

  const nearbyFleets = useMemo(
    () => getNearbyFleets(gameState.lat, gameState.lon, gameState.headingDeg, otherFleets),
    [gameState.lat, gameState.lon, gameState.headingDeg, otherFleets],
  );

  const canSail = gameState.status === 'active' && !isSailing && !drawnCards;
  const canDock =
    canSail &&
    Boolean(nearbyPort) &&
    !(gameState.isDocked && gameState.currentPortId === nearbyPort?.id);

  const handleReset = () => {
    if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
    setIsSailing(false);
    setTurnOutcome(null);
    setDrawnCards(null);
    setCardHintBanner(null);
    setDockToast(null);
    setShowSettlement(false);
    clearLocalGameState();
    setGameState(createInitialGameState());
    setActiveTab('helm');
  };

  const handleSail = () => {
    if (!canSail) return;
    setDockToast(null);
    setCardHintBanner(null);
    setIsSailing(true);
    sailTimerRef.current = setTimeout(() => {
      setGameState((prev) => {
        const { nextState, outcome } = executeSailTurn(prev);
        setTurnOutcome(outcome);
        return nextState;
      });
      setIsSailing(false);
    }, 1900);
  };

  const handleCloseTurnModal = () => {
    const wasActive = gameState.status === 'active';
    setTurnOutcome(null);
    if (wasActive) {
      setDrawnCards(drawThreeSituationCards());
    } else {
      setShowSettlement(true);
    }
  };

  const handleConfirmCard = (card) => {
    const { nextState, hintText } = applySituationCardToState(gameState, card);
    setGameState(nextState);
    setDrawnCards(null);
    if (hintText) setCardHintBanner(hintText);
    if (nextState.status !== 'active') {
      setShowSettlement(true);
    }
  };

  const handleDock = () => {
    if (!canDock) return;
    const { nextState, dockedPort } = executeDockTurn(gameState);
    setGameState(nextState);
    if (nextState.status !== 'active') {
      setShowSettlement(true);
      return;
    }
    if (dockedPort) {
      setDockToast(`${dockedPort.name} 정박 완료! 교역·일지 탭에서 보급과 특산품을 거래하세요.`);
    }
  };

  const handleRecordObservation = (record) => {
    const turnInfo = getTurnInfo(gameState.turn);
    const title =
      record.hemisphere === 'north'
        ? `사분의 관측: 북극성 고도 ${record.measuredDeg.toFixed(1)}°`
        : `사분의 관측: 정오 태양 고도 ${record.measuredDeg.toFixed(1)}°`;
    const detail =
      record.hemisphere === 'north'
        ? `추정 위도: 북위 ${record.measuredDeg.toFixed(1)}°N (${record.precisionLabel})`
        : `적위 ${record.declination > 0 ? `+${record.declination}°` : `${record.declination}°`} · 남위 계산기로 위도를 도출하세요`;

    setGameState((prev) => ({
      ...prev,
      logs: [
        {
          turn: prev.turn,
          dateLabel: turnInfo.label,
          type: 'obs',
          title,
          detail,
        },
        ...prev.logs,
      ],
    }));
  };

  const handleClearRoom = async () => {
    const cleanRoom = roomCode.trim() || 'HIST-101';
    if (isSupabaseConfigured) {
      await clearRoomInSupabase(cleanRoom);
    }
    clearRoomSnapshot(cleanRoom);
    setRoomPeersMap({});
    channelRef.current?.postMessage({ type: 'CLEAR_ROOM' });
  };

  if (isTeacherMode) {
    return (
      <TeacherModeView
        roomCode={roomCode.trim() || 'HIST-101'}
        fleets={allFleets}
        onBackToStudent={() => setIsTeacherMode(false)}
        onClearRoom={handleClearRoom}
      />
    );
  }

  const endMeta = END_MESSAGES[gameState.status];

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex justify-center">
      <div className="w-full max-w-md min-h-dvh flex flex-col bg-slate-950 border-x border-slate-900 shadow-2xl">
        <TopResourceBar state={gameState} onReset={handleReset} />

        <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {endMeta && (
            <div
              className={`rounded-2xl border p-3.5 ${
                endMeta.tone === 'emerald'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : endMeta.tone === 'amber'
                    ? 'border-amber-500/50 bg-amber-950/40 text-amber-100'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black flex items-center gap-1.5">
                  <Flag className="w-4 h-4" />
                  {endMeta.title}
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSettlement(true)}
                    className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-black text-slate-950 hover:bg-amber-400 cursor-pointer"
                  >
                    정산표
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900/80 border border-slate-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    새 항해
                  </button>
                </div>
              </div>
              <p className="text-xs opacity-90 mt-1">{endMeta.desc}</p>
            </div>
          )}

          {dockToast && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Anchor className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{dockToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('log')}
                className="shrink-0 rounded-lg bg-emerald-500/25 border border-emerald-400/50 px-2 py-1 text-[11px] font-black text-emerald-200 cursor-pointer"
              >
                교역소
              </button>
            </div>
          )}

          {cardHintBanner && (
            <div className="rounded-xl border border-sky-500/40 bg-sky-950/45 px-3 py-2 text-xs text-sky-200 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>{cardHintBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setCardHintBanner(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'helm' && (
            <>
              {(gameState.nextTurnBonusCm > 0 || gameState.nextTurnMaxCm !== null) && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-950/35 px-3 py-1.5 text-[11px] font-bold text-amber-200 text-center">
                  {gameState.nextTurnBonusCm > 0
                    ? `상황 카드 효과 적용 중: 이번 턴 이동 거리 +${gameState.nextTurnBonusCm.toFixed(1)} cm`
                    : `무풍대 효과 적용 중: 이번 턴 최대 ${gameState.nextTurnMaxCm.toFixed(1)} cm 이동 제한`}
                </div>
              )}

              <DeckView
                lat={gameState.lat}
                lon={gameState.lon}
                headingDeg={gameState.headingDeg}
                windToDeg={windEval.windToDeg}
                isSailing={isSailing}
                nearbyPort={nearbyPort}
                nearbyFleets={nearbyFleets}
                weatherId={gameState.weatherId}
              />

              <HelmWheel
                headingDeg={gameState.headingDeg}
                onChangeHeading={(headingDeg) =>
                  setGameState((prev) => ({ ...prev, headingDeg }))
                }
                windEval={windEval}
                isFullSail={gameState.isFullSail}
                onToggleFullSail={() =>
                  setGameState((prev) => ({ ...prev, isFullSail: !prev.isFullSail }))
                }
                disabled={!canSail}
              />

              {/* Primary Action Controls */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={!canDock}
                  onClick={handleDock}
                  className={`col-span-1 flex items-center justify-center gap-1.5 rounded-2xl border py-3.5 text-xs font-black transition ${
                    canDock
                      ? 'border-emerald-400/50 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35 active:scale-95 cursor-pointer'
                      : 'border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Anchor className="w-4 h-4" />
                  <span>기항지 정박</span>
                </button>

                <button
                  type="button"
                  disabled={!canSail}
                  onClick={handleSail}
                  className={`col-span-2 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black shadow-lg transition ${
                    canSail
                      ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>
                    {isSailing
                      ? '항해 진행 중...'
                      : `항해 실행 (자로 ${windEval.effectiveCm.toFixed(1)} cm)`}
                  </span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'quadrant' && (
            <QuadrantTab
              lat={gameState.lat}
              currentTurn={gameState.turn}
              weatherId={gameState.weatherId}
              onRecordObservation={handleRecordObservation}
            />
          )}

          {activeTab === 'log' && (
            <TradeLogTab
              state={gameState}
              onBuySupplies={() => setGameState((prev) => buySupplies(prev))}
              onRepairHull={() => setGameState((prev) => repairHull(prev))}
              onBuySpecialty={() => setGameState((prev) => buySpecialty(prev))}
              onSellCargo={(idx) => setGameState((prev) => sellCargoItem(prev, idx))}
            />
          )}

          {activeTab === 'fleet' && (
            <FleetTab
              roomCode={roomCode}
              onChangeRoomCode={setRoomCode}
              teamName={teamName}
              onChangeTeamName={setTeamName}
              showDemoRivals={showDemoRivals}
              onToggleDemoRivals={() => setShowDemoRivals((v) => !v)}
              allFleets={allFleets}
              nearbyFleets={nearbyFleets}
              myClientId={clientId}
              isOnlineSync={isSupabaseConfigured}
              onOpenTeacherMode={() => setIsTeacherMode(true)}
            />
          )}
        </main>

        <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>

      <TurnResultModal outcome={turnOutcome} onClose={handleCloseTurnModal} />
      {drawnCards && (
        <SituationCardModal
          key={`cards-turn-${gameState.turn}`}
          cards={drawnCards}
          onConfirmCard={handleConfirmCard}
        />
      )}
      {showSettlement && (
        <SettlementModal
          settlement={settlement}
          state={gameState}
          onReset={handleReset}
          onClose={() => setShowSettlement(false)}
        />
      )}
    </div>
  );
}
