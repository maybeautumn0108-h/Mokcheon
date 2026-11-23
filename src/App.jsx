import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  CheckCircle2,
  Clock,
  FastForward,
  Flag,
  Navigation,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
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
import LobbyView from './components/LobbyView.jsx';
import { drawThreeSituationCards } from './data/situationCards.js';
import { MAX_TURNS, getTurnInfo } from './data/calendar.js';
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
  areAllFleetsReadyForNextTurn,
  clearLocalGameState,
  clearRoomInSupabase,
  clearRoomSnapshot,
  fetchOrCreateRoomSupabase,
  getDemoRivalFleets,
  getOrCreateClientId,
  isSupabaseConfigured,
  loadLocalGameState,
  loadLocalRoomMeta,
  loadRoomSnapshot,
  saveLocalGameState,
  saveLocalRoomMeta,
  savePlayerToRoom,
  subscribeToRoomAndFleetsSupabase,
  tryAdvanceRoomTurnSupabase,
  updateRoomInSupabase,
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
  const [playMode, setPlayMode] = useState(
    () => savedSnapshot?.meta?.playMode || 'lobby', // 'lobby' | 'online' | 'solo'
  );
  const [joinedLobbyRoom, setJoinedLobbyRoom] = useState(
    () => Boolean(savedSnapshot?.meta?.joinedLobbyRoom),
  );
  const [isSpectatorHost, setIsSpectatorHost] = useState(
    () => Boolean(savedSnapshot?.meta?.isSpectatorHost),
  );

  const [activeTab, setActiveTab] = useState('helm');
  const [isSailing, setIsSailing] = useState(false);
  const [turnOutcome, setTurnOutcome] = useState(null);
  const [drawnCards, setDrawnCards] = useState(null);
  const [cardHintBanner, setCardHintBanner] = useState(null);
  const [dockToast, setDockToast] = useState(null);
  const [turnToast, setTurnToast] = useState(null);
  const [showSettlement, setShowSettlement] = useState(false);

  const [clientId] = useState(() => getOrCreateClientId());
  const [roomCode, setRoomCode] = useState(
    () => savedSnapshot?.meta?.roomCode || 'HIST-101',
  );
  const [teamName, setTeamName] = useState(
    () => savedSnapshot?.meta?.teamName || '1조 콜럼버스',
  );
  const [showDemoRivals, setShowDemoRivals] = useState(false);
  const [roomPeersMap, setRoomPeersMap] = useState({});
  const [roomMeta, setRoomMeta] = useState({
    roomCode: 'HIST-101',
    hostClientId: clientId,
    phase: 'waiting',
    currentTurn: 1,
  });
  const [isTeacherMode, setIsTeacherMode] = useState(false);

  const sailTimerRef = useRef(null);
  const channelRef = useRef(null);
  const prevRoomTurnRef = useRef(1);

  const cleanRoom = roomCode.trim() || 'HIST-101';
  const isOnlineSession = playMode === 'online' || (playMode === 'lobby' && joinedLobbyRoom);

  useEffect(() => {
    return () => {
      if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
    };
  }, []);

  // Persist game state & lobby metadata locally for mobile refresh recovery
  useEffect(() => {
    saveLocalGameState(gameState, {
      playMode,
      joinedLobbyRoom,
      isSpectatorHost,
      roomCode: cleanRoom,
      teamName,
    });
  }, [gameState, playMode, joinedLobbyRoom, isSpectatorHost, cleanRoom, teamName]);

  // Subscribe to Room & Fleets whenever inside online waiting room or online game
  useEffect(() => {
    if (!isOnlineSession) return;

    if (isSupabaseConfigured) {
      const unsubscribe = subscribeToRoomAndFleetsSupabase(cleanRoom, clientId, {
        onRoomChange: (rm) => setRoomMeta(rm),
        onFleetsChange: (map) => setRoomPeersMap(map),
      });
      return unsubscribe;
    }

    setRoomPeersMap(loadRoomSnapshot(cleanRoom));
    setRoomMeta(loadLocalRoomMeta(cleanRoom, clientId));

    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(`age-of-sail-room-${cleanRoom}`);
      channelRef.current = channel;
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'SYNC_STATE') {
          setRoomPeersMap(loadRoomSnapshot(cleanRoom));
        } else if (ev.data?.type === 'SYNC_ROOM') {
          setRoomMeta(loadLocalRoomMeta(cleanRoom, clientId));
        } else if (ev.data?.type === 'CLEAR_ROOM') {
          setRoomPeersMap({});
        }
      };
    }

    const onStorage = (ev) => {
      if (ev.key === `age_of_sail_room_v1_${cleanRoom}`) {
        setRoomPeersMap(loadRoomSnapshot(cleanRoom));
      } else if (ev.key === `age_of_sail_room_meta_v1_${cleanRoom}`) {
        setRoomMeta(loadLocalRoomMeta(cleanRoom, clientId));
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
      channelRef.current = null;
    };
  }, [isOnlineSession, cleanRoom, clientId]);

  // Publish player's fleet row (spectator teacher host does NOT publish a blocking ship!)
  useEffect(() => {
    if (!isOnlineSession || isSpectatorHost) return;

    const lastLog = gameState.logs[0]?.title || '항해 중';
    const payload = {
      clientId,
      teamName: teamName.trim() || '탐험 선단',
      turn: gameState.turn,
      completedTurn: gameState.completedTurn ?? 0,
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
      const timer = setTimeout(() => {
        upsertPlayerToSupabase(cleanRoom, payload);
      }, 350);
      return () => clearTimeout(timer);
    }

    const nextMap = savePlayerToRoom(cleanRoom, payload);
    setRoomPeersMap(nextMap);
    channelRef.current?.postMessage({ type: 'SYNC_STATE', clientId });
  }, [
    isOnlineSession,
    isSpectatorHost,
    clientId,
    cleanRoom,
    teamName,
    gameState.turn,
    gameState.completedTurn,
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

  // React to room phase transitions (waiting <-> playing <-> finished) & turn advances
  useEffect(() => {
    if (!isOnlineSession) return;

    if (roomMeta.phase === 'waiting' && playMode === 'online') {
      // Teacher reset the room back to waiting lobby
      setPlayMode('lobby');
      setJoinedLobbyRoom(true);
      setIsTeacherMode(false);
      setTurnOutcome(null);
      setDrawnCards(null);
      setShowSettlement(false);
      setGameState(createInitialGameState());
      prevRoomTurnRef.current = 1;
      return;
    }

    if (
      (roomMeta.phase === 'playing' || roomMeta.phase === 'finished') &&
      playMode === 'lobby' &&
      joinedLobbyRoom &&
      !isSpectatorHost
    ) {
      // Host started the voyage! Enter simulator
      setPlayMode('online');
      prevRoomTurnRef.current = roomMeta.currentTurn;
      return;
    }

    if (playMode === 'online' && roomMeta.currentTurn > prevRoomTurnRef.current) {
      prevRoomTurnRef.current = roomMeta.currentTurn;
      setTurnToast(`제${roomMeta.currentTurn}턴이 시작되었습니다!`);
      setGameState((prev) => {
        if (prev.status !== 'active' || prev.turn >= roomMeta.currentTurn) return prev;
        // Catch up a lagging player if teacher forced turn forward
        return {
          ...prev,
          turn: roomMeta.currentTurn,
          completedTurn: Math.max(prev.completedTurn ?? 0, roomMeta.currentTurn - 1),
        };
      });
    }
  }, [
    isOnlineSession,
    roomMeta.phase,
    roomMeta.currentTurn,
    playMode,
    joinedLobbyRoom,
    isSpectatorHost,
  ]);

  const realFleets = useMemo(
    () =>
      Object.values(roomPeersMap).sort(
        (a, b) =>
          (b.completedTurn ?? 0) - (a.completedTurn ?? 0) ||
          b.turn - a.turn ||
          b.gold - a.gold,
      ),
    [roomPeersMap],
  );

  // Auto-advance room turn when ALL active fleets have completed the current room turn
  useEffect(() => {
    if (!isOnlineSession || roomMeta.phase !== 'playing') return;
    if (!areAllFleetsReadyForNextTurn(realFleets, roomMeta.currentTurn)) return;

    if (isSupabaseConfigured) {
      tryAdvanceRoomTurnSupabase(cleanRoom, roomMeta.currentTurn, realFleets);
    } else {
      const isFinal = roomMeta.currentTurn >= MAX_TURNS;
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        currentTurn: isFinal ? MAX_TURNS : roomMeta.currentTurn + 1,
        phase: isFinal ? 'finished' : 'playing',
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
  }, [isOnlineSession, roomMeta, realFleets, cleanRoom]);

  const allFleets = useMemo(() => {
    const demos = showDemoRivals ? getDemoRivalFleets(gameState.turn) : [];
    const byId = new Map();
    for (const f of demos) byId.set(f.clientId, f);
    for (const f of realFleets) byId.set(f.clientId, f);
    return Array.from(byId.values()).sort((a, b) => b.turn - a.turn || b.gold - a.gold);
  }, [realFleets, showDemoRivals, gameState.turn]);

  const otherFleets = useMemo(
    () => allFleets.filter((f) => f.clientId !== clientId),
    [allFleets, clientId],
  );

  const nearbyFleets = useMemo(
    () => getNearbyFleets(gameState.lat, gameState.lon, gameState.headingDeg, otherFleets),
    [gameState.lat, gameState.lon, gameState.headingDeg, otherFleets],
  );

  const windEval = useMemo(() => computePlannedMove(gameState), [gameState]);
  const nearbyPort = useMemo(
    () => findNearbyPort(gameState.lat, gameState.lon),
    [gameState.lat, gameState.lon],
  );
  const settlement = useMemo(
    () => (gameState.status !== 'active' ? calculateFinalSettlement(gameState) : null),
    [gameState],
  );

  const isHost = roomMeta?.hostClientId === clientId;
  const isWaitingForOthers =
    playMode === 'online' &&
    gameState.status === 'active' &&
    (gameState.completedTurn ?? 0) >= roomMeta.currentTurn &&
    !drawnCards &&
    !turnOutcome &&
    !isSailing;

  const canSail =
    gameState.status === 'active' && !isSailing && !drawnCards && !isWaitingForOthers;
  const canDock =
    canSail &&
    Boolean(nearbyPort) &&
    !(gameState.isDocked && gameState.currentPortId === nearbyPort?.id);

  // Lobby Handlers
  const handleJoinOnlineRoom = async () => {
    setIsSpectatorHost(false);
    setJoinedLobbyRoom(true);
    setGameState(createInitialGameState());
    if (isSupabaseConfigured) {
      const rm = await fetchOrCreateRoomSupabase(cleanRoom, clientId);
      if (rm) {
        setRoomMeta(rm);
        if (rm.phase === 'playing') {
          setPlayMode('online');
          prevRoomTurnRef.current = rm.currentTurn;
        }
      }
    } else {
      const rm = loadLocalRoomMeta(cleanRoom, clientId);
      saveLocalRoomMeta(cleanRoom, rm);
      setRoomMeta(rm);
      if (rm.phase === 'playing') {
        setPlayMode('online');
      }
    }
  };

  const handleJoinAsTeacherHost = async () => {
    setIsSpectatorHost(true);
    setJoinedLobbyRoom(true);
    if (isSupabaseConfigured) {
      await fetchOrCreateRoomSupabase(cleanRoom, clientId);
      const updated = await updateRoomInSupabase(cleanRoom, { hostClientId: clientId });
      if (updated) setRoomMeta(updated);
    } else {
      const cur = loadLocalRoomMeta(cleanRoom, clientId);
      const updated = saveLocalRoomMeta(cleanRoom, { ...cur, hostClientId: clientId });
      setRoomMeta(updated);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
    setIsTeacherMode(true);
  };

  const handleStartSoloPractice = () => {
    setIsSpectatorHost(false);
    setJoinedLobbyRoom(false);
    setPlayMode('solo');
    setGameState(createInitialGameState());
    setActiveTab('helm');
  };

  const handleLeaveToLobby = () => {
    if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
    setIsSailing(false);
    setTurnOutcome(null);
    setDrawnCards(null);
    setShowSettlement(false);
    setPlayMode('lobby');
    setJoinedLobbyRoom(false);
    setIsSpectatorHost(false);
  };

  const handleHostStartVoyage = async () => {
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(cleanRoom, {
        phase: 'playing',
        currentTurn: 1,
      });
      if (updated) setRoomMeta(updated);
    } else {
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        phase: 'playing',
        currentTurn: 1,
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
    if (!isSpectatorHost) {
      setPlayMode('online');
      prevRoomTurnRef.current = 1;
    }
  };

  const handleForceNextTurn = async () => {
    const isFinal = roomMeta.currentTurn >= MAX_TURNS;
    const nextTurn = isFinal ? MAX_TURNS : roomMeta.currentTurn + 1;
    const nextPhase = isFinal ? 'finished' : 'playing';
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(cleanRoom, {
        currentTurn: nextTurn,
        phase: nextPhase,
      });
      if (updated) setRoomMeta(updated);
    } else {
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        currentTurn: nextTurn,
        phase: nextPhase,
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
  };

  const handleResetToWaiting = async () => {
    if (isSupabaseConfigured) {
      await clearRoomInSupabase(cleanRoom);
      const updated = await updateRoomInSupabase(cleanRoom, {
        phase: 'waiting',
        currentTurn: 1,
      });
      if (updated) setRoomMeta(updated);
      setRoomPeersMap({});
    } else {
      clearRoomSnapshot(cleanRoom);
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        phase: 'waiting',
        currentTurn: 1,
      });
      setRoomPeersMap({});
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'CLEAR_ROOM' });
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
  };

  const handleClearRoom = async () => {
    if (isSupabaseConfigured) {
      await clearRoomInSupabase(cleanRoom);
    }
    clearRoomSnapshot(cleanRoom);
    setRoomPeersMap({});
    channelRef.current?.postMessage({ type: 'CLEAR_ROOM' });
  };

  const handleReset = () => {
    if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
    setIsSailing(false);
    setTurnOutcome(null);
    setDrawnCards(null);
    setCardHintBanner(null);
    setDockToast(null);
    setTurnToast(null);
    setShowSettlement(false);
    clearLocalGameState();
    setGameState(createInitialGameState());
    setActiveTab('helm');
    if (playMode === 'online') {
      setPlayMode('lobby');
      setJoinedLobbyRoom(false);
    }
  };

  const handleSail = () => {
    if (!canSail) return;
    setDockToast(null);
    setTurnToast(null);
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
    setTurnToast(null);
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

  if (isTeacherMode) {
    return (
      <TeacherModeView
        roomCode={cleanRoom}
        roomMeta={roomMeta}
        fleets={allFleets}
        onBackToStudent={() => {
          setIsTeacherMode(false);
          if (isSpectatorHost) setPlayMode('lobby');
        }}
        onStartVoyage={handleHostStartVoyage}
        onForceNextTurn={handleForceNextTurn}
        onResetToWaiting={handleResetToWaiting}
        onClearRoom={handleClearRoom}
      />
    );
  }

  if (playMode === 'lobby') {
    return (
      <LobbyView
        roomCode={roomCode}
        onChangeRoomCode={setRoomCode}
        teamName={teamName}
        onChangeTeamName={setTeamName}
        joinedRoom={joinedLobbyRoom}
        roomMeta={roomMeta}
        realFleets={realFleets}
        myClientId={clientId}
        isOnlineSync={isSupabaseConfigured}
        onJoinOnlineRoom={handleJoinOnlineRoom}
        onJoinAsTeacherHost={handleJoinAsTeacherHost}
        onStartSoloPractice={handleStartSoloPractice}
        onLeaveRoom={handleLeaveToLobby}
        onHostStartVoyage={handleHostStartVoyage}
        onOpenTeacherMode={() => setIsTeacherMode(true)}
      />
    );
  }

  const endMeta = END_MESSAGES[gameState.status];
  const readyCount = realFleets.filter(
    (f) => f.status !== 'active' || (f.completedTurn ?? 0) >= roomMeta.currentTurn,
  ).length;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex justify-center">
      <div className="w-full max-w-md min-h-dvh flex flex-col bg-slate-950 border-x border-slate-900 shadow-2xl">
        <TopResourceBar state={gameState} onReset={handleReset} />

        <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Synchronized Turn Waiting Banner */}
          {isWaitingForOthers && (
            <div className="rounded-2xl border border-amber-400/50 bg-amber-950/45 p-3.5 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>
                    제{gameState.completedTurn}턴 완료! 다른 선단 대기 중 ({readyCount}/
                    {Math.max(1, realFleets.length)}팀)
                  </span>
                </div>
                {isHost && (
                  <button
                    type="button"
                    onClick={handleForceNextTurn}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-2 py-1 text-[10px] font-black text-slate-950 cursor-pointer"
                  >
                    <FastForward className="w-3 h-3" />
                    강제 진행
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {realFleets.map((f) => {
                  const done =
                    f.status !== 'active' || (f.completedTurn ?? 0) >= roomMeta.currentTurn;
                  return (
                    <span
                      key={f.clientId}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        done
                          ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-400" />
                      )}
                      {f.teamName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {turnToast && !isWaitingForOthers && (
            <div className="rounded-xl border border-sky-400/50 bg-sky-950/45 px-3 py-2 text-xs font-bold text-sky-200 flex items-center justify-between">
              <span>{turnToast}</span>
              <button
                type="button"
                onClick={() => setTurnToast(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
                    {isWaitingForOthers
                      ? '다른 선단 턴 종료 대기 중...'
                      : isSailing
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
              roomMeta={roomMeta}
              playMode={playMode}
              onChangeRoomCode={setRoomCode}
              teamName={teamName}
              onChangeTeamName={setTeamName}
              showDemoRivals={showDemoRivals}
              onToggleDemoRivals={() => setShowDemoRivals((v) => !v)}
              allFleets={allFleets}
              nearbyFleets={nearbyFleets}
              myClientId={clientId}
              isOnlineSync={isSupabaseConfigured}
              onLeaveToLobby={handleLeaveToLobby}
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
