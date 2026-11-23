import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
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
import ActivityStepPanel from './components/ActivityStepPanel.jsx';
import InteractionModal from './components/InteractionModal.jsx';
import TurnTransitionOverlay from './components/TurnTransitionOverlay.jsx';
import MissionBriefingModal from './components/MissionBriefingModal.jsx';
import { drawThreeSituationCards } from './data/situationCards.js';
import { getTurnInfo } from './data/calendar.js';
import { getMissionById } from './data/missions.js';
import {
  applySituationCardToState,
  buySpecialty,
  buySupplies,
  calculateFinalSettlement,
  computePlannedMove,
  createInitialGameState,
  enterPortInActivity,
  executeSailTurn,
  findNearbyPort,
  finishActivityTurn,
  getNearbyFleets,
  holdPositionTurn,
  isDirectionImmediatelyBlocked,
  repairHull,
  sellCargoItem,
} from './engine/navigation.js';
import {
  RPS_OPTIONS,
  advanceBattleState,
  applyBattleToState,
  applyFleeBattleToState,
  applyTradeToState,
  createInitialBattlePayload,
} from './engine/interactions.js';
import {
  HEARTBEAT_INTERVAL_MS,
  areAllFleetsCardsReady,
  areAllFleetsReadyForNextTurn,
  clearLocalGameState,
  clearRoomInSupabase,
  clearRoomSnapshot,
  createInteractionSupabase,
  deleteFleetKeepalive,
  deleteFleetSupabase,
  deleteLocalPlayerFromRoom,
  deleteRoomInSupabase,
  ensureRoomsBatchSupabase,
  fetchOrCreateRoomSupabase,
  fetchRoomFleetsFromSupabase,
  getDemoRivalFleets,
  getOrCreateClientId,
  isFleetOffline,
  isSupabaseConfigured,
  loadAllLocalFleets,
  loadAllLocalRoomsMeta,
  loadLocalGameState,
  loadLocalInteractions,
  loadLocalRoomMeta,
  loadRoomSnapshot,
  saveLocalGameState,
  saveLocalInteractions,
  saveLocalRoomMeta,
  savePlayerToRoom,
  subscribeToAllRoomsSupabase,
  subscribeToRoomAndFleetsSupabase,
  touchFleetHeartbeatSupabase,
  tryAdvanceRoomTurnSupabase,
  tryOpenActivityPhaseSupabase,
  updateInteractionSupabase,
  updateRoomInSupabase,
  upsertPlayerToSupabase,
} from './engine/fleetSync.js';

function getEndMeta(status, missionId) {
  const mission = getMissionById(missionId);
  if (status === 'returned') {
    return {
      title: '리스본 무사 귀항 성공!',
      tone: 'emerald',
      desc: `${mission.maxTurns}턴 이내에 리스본으로 복귀하여 최종 정산을 완료했습니다.`,
    };
  }
  if (status === 'timeup') {
    return {
      title: `${mission.maxTurns}턴 항해 기한 종료`,
      tone: 'amber',
      desc: `${mission.maxTurns}턴 항해 기간이 모두 경과했습니다. 최종 정산 결과를 확인하세요.`,
    };
  }
  if (status === 'stranded') {
    return {
      title: '식량·식수 고갈로 조난',
      tone: 'rose',
      desc: '식량과 식수가 바닥났습니다. 8턴 이내 기항지 보급 전략을 세워 다시 도전하세요.',
    };
  }
  if (status === 'sunk') {
    return {
      title: '선체 파손으로 난파',
      tone: 'rose',
      desc: '연안 좌초 피해가 누적되어 항해를 계속할 수 없습니다.',
    };
  }
  return null;
}

export default function App() {
  const savedSnapshot = useMemo(() => loadLocalGameState(), []);
  const [gameState, setGameState] = useState(
    () => savedSnapshot?.state || createInitialGameState(),
  );
  const [playMode, setPlayMode] = useState(
    () => savedSnapshot?.meta?.playMode || 'lobby',
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
    turnPhase: 'sail_card',
    missionId: 'mission_1',
  });
  const [interactions, setInteractions] = useState([]);
  const [draftTradePeer, setDraftTradePeer] = useState(null);
  const [localDemoInteraction, setLocalDemoInteraction] = useState(null);
  const [dismissedInteractionIds, setDismissedInteractionIds] = useState(() => new Set());
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [teacherAllRooms, setTeacherAllRooms] = useState([]);
  const [teacherAllFleetsByRoom, setTeacherAllFleetsByRoom] = useState({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [turnTransition, setTurnTransition] = useState(null);
  const [showMissionBriefing, setShowMissionBriefing] = useState(false);

  const sailTimerRef = useRef(null);
  const turnAnimTimerRef = useRef(null);
  const channelRef = useRef(null);
  const sendPingRef = useRef(() => {});
  const prevRoomTurnRef = useRef(1);
  const prevRoomTurnPhaseRef = useRef('sail_card');
  const prevCriticalSigRef = useRef('');
  const appliedInteractionIdsRef = useRef(new Set());

  const cleanRoom = roomCode.trim() || 'HIST-101';
  const isOnlineSession = playMode === 'online' || (playMode === 'lobby' && joinedLobbyRoom);

  useEffect(() => {
    return () => {
      if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
      if (turnAnimTimerRef.current) clearTimeout(turnAnimTimerRef.current);
    };
  }, []);

  const triggerTurnTransition = (turnNumber) => {
    if (turnAnimTimerRef.current) clearTimeout(turnAnimTimerRef.current);
    setTurnTransition({ turn: turnNumber, key: `${turnNumber}-${Date.now()}` });
    turnAnimTimerRef.current = setTimeout(() => {
      setTurnTransition(null);
    }, 2200);
  };

  useEffect(() => {
    saveLocalGameState(gameState, {
      playMode,
      joinedLobbyRoom,
      isSpectatorHost,
      roomCode: cleanRoom,
      teamName,
    });
  }, [gameState, playMode, joinedLobbyRoom, isSpectatorHost, cleanRoom, teamName]);

  // Subscribe to Room, Fleets, and Interactions
  useEffect(() => {
    if (!isOnlineSession) return;

    if (isSupabaseConfigured) {
      const sub = subscribeToRoomAndFleetsSupabase(cleanRoom, clientId, {
        onRoomChange: (rm) => setRoomMeta(rm),
        onFleetsChange: (map) => setRoomPeersMap(map),
        onInteractionsChange: (list) => setInteractions(list),
      });
      sendPingRef.current = sub.sendPing;
      return () => {
        sendPingRef.current = () => {};
        sub.unsubscribe();
      };
    }

    setRoomPeersMap(loadRoomSnapshot(cleanRoom));
    setRoomMeta(loadLocalRoomMeta(cleanRoom, clientId));
    setInteractions(loadLocalInteractions(cleanRoom));

    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(`age-of-sail-room-${cleanRoom}`);
      channelRef.current = channel;
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'SYNC_STATE') {
          setRoomPeersMap(loadRoomSnapshot(cleanRoom));
        } else if (ev.data?.type === 'SYNC_ROOM') {
          setRoomMeta(loadLocalRoomMeta(cleanRoom, clientId));
        } else if (ev.data?.type === 'SYNC_INTERACTIONS') {
          setInteractions(loadLocalInteractions(cleanRoom));
        } else if (ev.data?.type === 'CLEAR_ROOM') {
          setRoomPeersMap({});
          setInteractions([]);
        }
      };
    }

    const onStorage = (ev) => {
      if (ev.key === `age_of_sail_room_v1_${cleanRoom}`) {
        setRoomPeersMap(loadRoomSnapshot(cleanRoom));
      } else if (ev.key === `age_of_sail_room_meta_v1_${cleanRoom}`) {
        setRoomMeta(loadLocalRoomMeta(cleanRoom, clientId));
      } else if (ev.key === `age_of_sail_interactions_v1_${cleanRoom}`) {
        setInteractions(loadLocalInteractions(cleanRoom));
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
      channelRef.current = null;
    };
  }, [isOnlineSession, cleanRoom, clientId]);

  // Periodic tick to detect offline/departed fleets (> 25s without heartbeat)
  useEffect(() => {
    if (!isOnlineSession && !isTeacherMode) return;
    const id = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, [isOnlineSession, isTeacherMode]);

  // Multi-Room Teacher Dashboard subscription
  useEffect(() => {
    if (!isTeacherMode) return;

    if (isSupabaseConfigured) {
      return subscribeToAllRoomsSupabase({
        onRoomsChange: (rooms) => setTeacherAllRooms(rooms),
        onFleetsChange: (byRoom) => setTeacherAllFleetsByRoom(byRoom),
      });
    }

    const syncLocalAll = () => {
      setTeacherAllRooms(loadAllLocalRoomsMeta());
      setTeacherAllFleetsByRoom(loadAllLocalFleets());
    };
    syncLocalAll();
    const id = setInterval(syncLocalAll, 2000);
    window.addEventListener('storage', syncLocalAll);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', syncLocalAll);
    };
  }, [isTeacherMode]);

  // Presence heartbeat & automatic cleanup on tab close / pagehide
  useEffect(() => {
    if (!isOnlineSession || isSpectatorHost) return;

    const sendHeartbeat = () => {
      if (isSupabaseConfigured) {
        touchFleetHeartbeatSupabase(cleanRoom, clientId);
      } else {
        const cur = loadRoomSnapshot(cleanRoom);
        if (cur[clientId]) {
          savePlayerToRoom(cleanRoom, cur[clientId]);
          channelRef.current?.postMessage({ type: 'SYNC_STATE', clientId });
        }
      }
    };

    const hbId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    const onUnload = () => {
      if (isSupabaseConfigured) {
        deleteFleetKeepalive(cleanRoom, clientId);
      } else {
        deleteLocalPlayerFromRoom(cleanRoom, clientId);
        channelRef.current?.postMessage({ type: 'SYNC_STATE', clientId });
      }
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onUnload);

    return () => {
      clearInterval(hbId);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [isOnlineSession, isSpectatorHost, cleanRoom, clientId]);

  // Publish player's fleet row (immediate on turn/phase change, debounced on steering wheel drag)
  useEffect(() => {
    if (!isOnlineSession || isSpectatorHost) return;

    const lastLog = gameState.logs[0]?.title || '항해 중';
    const payload = {
      clientId,
      teamName: teamName.trim() || '탐험 선단',
      turn: gameState.turn,
      cardCompletedTurn: gameState.cardCompletedTurn ?? 0,
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

    const criticalSig = `${cleanRoom}|${teamName}|${gameState.turn}|${gameState.cardCompletedTurn}|${gameState.completedTurn}|${gameState.turnStep}|${gameState.status}|${gameState.gold}|${gameState.food}|${gameState.hull}`;
    const isCriticalChange = criticalSig !== prevCriticalSigRef.current;
    prevCriticalSigRef.current = criticalSig;

    if (isSupabaseConfigured) {
      const pushNow = async () => {
        await upsertPlayerToSupabase(cleanRoom, payload);
        const freshMap = await fetchRoomFleetsFromSupabase(cleanRoom);
        setRoomPeersMap(freshMap);
        sendPingRef.current?.();
      };

      if (isCriticalChange) {
        pushNow();
        return;
      }

      const timer = setTimeout(pushNow, 300);
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
    gameState.cardCompletedTurn,
    gameState.completedTurn,
    gameState.turnStep,
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

  // React to room phase transitions & turn advances
  useEffect(() => {
    if (!isOnlineSession) return;

    const targetMission = roomMeta.missionId || 'mission_1';

    if (
      roomMeta.phase === 'waiting' &&
      !isSpectatorHost &&
      playMode === 'lobby' &&
      (gameState.missionId || 'mission_1') !== targetMission
    ) {
      setGameState(createInitialGameState(targetMission));
    }

    if (roomMeta.phase === 'waiting' && playMode === 'online') {
      setPlayMode('lobby');
      setJoinedLobbyRoom(true);
      setIsTeacherMode(false);
      setTurnOutcome(null);
      setDrawnCards(null);
      setShowSettlement(false);
      setDraftTradePeer(null);
      setLocalDemoInteraction(null);
      setGameState(createInitialGameState(targetMission));
      prevRoomTurnRef.current = 1;
      prevRoomTurnPhaseRef.current = 'sail_card';
      return;
    }

    if (
      (roomMeta.phase === 'playing' || roomMeta.phase === 'finished') &&
      playMode === 'lobby' &&
      joinedLobbyRoom &&
      !isSpectatorHost
    ) {
      setGameState((prev) =>
        (prev.missionId || 'mission_1') !== targetMission &&
        prev.turn === 1 &&
        (prev.trail?.length ?? 0) <= 1
          ? createInitialGameState(targetMission)
          : prev,
      );
      setPlayMode('online');
      prevRoomTurnRef.current = roomMeta.currentTurn;
      prevRoomTurnPhaseRef.current = roomMeta.turnPhase || 'sail_card';
      if (roomMeta.phase === 'playing') {
        triggerTurnTransition(roomMeta.currentTurn);
        if (roomMeta.currentTurn === 1) {
          setShowMissionBriefing(true);
        }
      }
      return;
    }

    if (
      playMode === 'online' &&
      roomMeta.turnPhase === 'activity' &&
      prevRoomTurnPhaseRef.current !== 'activity'
    ) {
      prevRoomTurnPhaseRef.current = 'activity';
      setTurnToast('전원 카드 완료! 3단계 주변활동(기항지·교역·전투)이 열렸습니다!');
      setTurnOutcome(null);
      setDrawnCards(null);
      setGameState((prev) => {
        if (prev.status !== 'active' || prev.turnStep === 'activity') return prev;
        // Catch up lagging player if host forced Step 3 open
        return {
          ...prev,
          activeTurn: roomMeta.currentTurn,
          turn: roomMeta.currentTurn + 1,
          cardCompletedTurn: Math.max(prev.cardCompletedTurn ?? 0, roomMeta.currentTurn),
          turnStep: 'activity',
        };
      });
    }

    if (playMode === 'online' && roomMeta.currentTurn > prevRoomTurnRef.current) {
      prevRoomTurnRef.current = roomMeta.currentTurn;
      prevRoomTurnPhaseRef.current = roomMeta.turnPhase || 'sail_card';
      triggerTurnTransition(roomMeta.currentTurn);
      setTurnToast(`제${roomMeta.currentTurn}턴이 시작되었습니다!`);
      setTurnOutcome(null);
      setDrawnCards(null);
      setDraftTradePeer(null);
      setGameState((prev) => {
        if (prev.status !== 'active') return prev;
        const alreadyOnNewTurn =
          prev.turnStep === 'sail' &&
          (prev.completedTurn ?? 0) >= roomMeta.currentTurn - 1 &&
          prev.turn >= roomMeta.currentTurn;
        if (alreadyOnNewTurn) return prev;
        return {
          ...prev,
          turn: roomMeta.currentTurn,
          activeTurn: roomMeta.currentTurn,
          cardCompletedTurn: Math.max(prev.cardCompletedTurn ?? 0, roomMeta.currentTurn - 1),
          completedTurn: Math.max(prev.completedTurn ?? 0, roomMeta.currentTurn - 1),
          turnStep: 'sail',
          interactedThisTurn: false,
        };
      });
    }
  }, [
    isOnlineSession,
    roomMeta.phase,
    roomMeta.currentTurn,
    roomMeta.turnPhase,
    roomMeta.missionId,
    gameState.missionId,
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

  const onlineRealFleets = useMemo(
    () => realFleets.filter((f) => !isFleetOffline(f, nowTick)),
    [realFleets, nowTick],
  );

  // Barrier 1: Auto-open Step 3 (activity phase) once ALL online fleets complete Step 1+2 (sail & card)
  useEffect(() => {
    if (
      !isOnlineSession ||
      roomMeta.phase !== 'playing' ||
      roomMeta.turnPhase !== 'sail_card'
    ) {
      return;
    }
    if (!areAllFleetsCardsReady(realFleets, roomMeta.currentTurn, nowTick)) return;

    if (isSupabaseConfigured) {
      tryOpenActivityPhaseSupabase(cleanRoom, roomMeta.currentTurn, realFleets).then((ok) => {
        if (ok) sendPingRef.current?.();
      });
    } else {
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        turnPhase: 'activity',
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
  }, [isOnlineSession, roomMeta, realFleets, cleanRoom, nowTick]);

  // Barrier 2: Auto-advance room turn when ALL online fleets have completed Step 3
  useEffect(() => {
    if (
      !isOnlineSession ||
      roomMeta.phase !== 'playing' ||
      roomMeta.turnPhase !== 'activity'
    ) {
      return;
    }
    if (!areAllFleetsReadyForNextTurn(realFleets, roomMeta.currentTurn, nowTick)) return;

    if (isSupabaseConfigured) {
      tryAdvanceRoomTurnSupabase(
        cleanRoom,
        roomMeta.currentTurn,
        realFleets,
        roomMeta.missionId,
      ).then((ok) => {
        if (ok) sendPingRef.current?.();
      });
    } else {
      const missionMaxTurns = getMissionById(roomMeta.missionId).maxTurns;
      const isFinal = roomMeta.currentTurn >= missionMaxTurns;
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        currentTurn: isFinal ? missionMaxTurns : roomMeta.currentTurn + 1,
        turnPhase: 'sail_card',
        phase: isFinal ? 'finished' : 'playing',
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
  }, [isOnlineSession, roomMeta, realFleets, cleanRoom, nowTick]);

  // Apply completed interaction outcome ONCE to local gameState
  const allWatchedInteractions = useMemo(() => {
    return localDemoInteraction ? [localDemoInteraction, ...interactions] : interactions;
  }, [localDemoInteraction, interactions]);

  useEffect(() => {
    if (isSpectatorHost) return;
    for (const inter of allWatchedInteractions) {
      if (inter.status !== 'completed') continue;
      if (appliedInteractionIdsRef.current.has(inter.id)) continue;
      if (inter.initiatorId !== clientId && inter.targetId !== clientId) continue;

      appliedInteractionIdsRef.current.add(inter.id);
      const isInit = inter.initiatorId === clientId;
      const peerName = isInit ? inter.targetName : inter.initiatorName;

      if (inter.type === 'trade') {
        setGameState((prev) => ({
          ...applyTradeToState(prev, inter.payload, isInit, peerName),
          interactedThisTurn: isInit ? true : prev.interactedThisTurn,
        }));
      } else if (inter.type === 'battle') {
        const myRole = isInit ? 'initiator' : 'target';
        const isWinner = inter.payload?.winnerRole === myRole;
        setGameState((prev) => ({
          ...applyBattleToState(prev, isWinner, peerName, inter.payload),
          interactedThisTurn: isInit ? true : prev.interactedThisTurn,
        }));
      }
    }
  }, [allWatchedInteractions, clientId, isSpectatorHost]);

  // Find active interaction modal candidate for this player
  const activeInteraction = useMemo(() => {
    if (isSpectatorHost) return null;
    if (localDemoInteraction && !dismissedInteractionIds.has(localDemoInteraction.id)) {
      return localDemoInteraction;
    }
    return (
      interactions.find(
        (inter) =>
          (inter.initiatorId === clientId || inter.targetId === clientId) &&
          !dismissedInteractionIds.has(inter.id) &&
          (inter.status === 'pending' ||
            inter.status === 'active' ||
            inter.status === 'completed' ||
            inter.status === 'declined' ||
            inter.status === 'cancelled'),
      ) || null
    );
  }, [interactions, localDemoInteraction, clientId, dismissedInteractionIds, isSpectatorHost]);

  const allFleets = useMemo(() => {
    const demos = showDemoRivals ? getDemoRivalFleets(gameState.turn) : [];
    const byId = new Map();
    for (const f of demos) byId.set(f.clientId, f);
    for (const f of realFleets) byId.set(f.clientId, f);
    return Array.from(byId.values()).sort((a, b) => b.turn - a.turn || b.gold - a.gold);
  }, [realFleets, showDemoRivals, gameState.turn]);

  const otherFleets = useMemo(
    () => allFleets.filter((f) => f.clientId !== clientId && !isFleetOffline(f, nowTick)),
    [allFleets, clientId, nowTick],
  );

  const nearbyFleets = useMemo(
    () => getNearbyFleets(gameState.lat, gameState.lon, gameState.headingDeg, otherFleets),
    [gameState.lat, gameState.lon, gameState.headingDeg, otherFleets],
  );

  const windEval = useMemo(() => computePlannedMove(gameState), [gameState]);
  const isBlockedAhead = useMemo(
    () => isDirectionImmediatelyBlocked(gameState.lat, gameState.lon, gameState.headingDeg),
    [gameState.lat, gameState.lon, gameState.headingDeg],
  );
  const nearbyPort = useMemo(
    () => findNearbyPort(gameState.lat, gameState.lon),
    [gameState.lat, gameState.lon],
  );
  const settlement = useMemo(
    () => (gameState.status !== 'active' ? calculateFinalSettlement(gameState) : null),
    [gameState],
  );

  const isHost = roomMeta?.hostClientId === clientId;
  const turnStep = gameState.turnStep || 'sail';
  const isWaitingForActivityOpen =
    playMode === 'online' &&
    gameState.status === 'active' &&
    turnStep === 'activity' &&
    roomMeta.turnPhase === 'sail_card';

  const isWaitingForOthers =
    playMode === 'online' &&
    gameState.status === 'active' &&
    turnStep === 'sail' &&
    (gameState.completedTurn ?? 0) >= roomMeta.currentTurn &&
    !drawnCards &&
    !turnOutcome &&
    !isSailing;

  const canSail =
    gameState.status === 'active' &&
    turnStep === 'sail' &&
    !isSailing &&
    !drawnCards &&
    !isWaitingForOthers;

  // Lobby Handlers
  const handleJoinOnlineRoom = async () => {
    setIsSpectatorHost(false);
    setJoinedLobbyRoom(true);
    if (isSupabaseConfigured) {
      const rm = await fetchOrCreateRoomSupabase(cleanRoom, clientId);
      setGameState(createInitialGameState(rm?.missionId || 'mission_1'));
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
      setGameState(createInitialGameState(rm.missionId || 'mission_1'));
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

  const handleStartSoloPractice = (soloMissionId = 'mission_1') => {
    setIsSpectatorHost(false);
    setJoinedLobbyRoom(false);
    setShowDemoRivals(true);
    setPlayMode('solo');
    setGameState(createInitialGameState(soloMissionId));
    setActiveTab('helm');
    setShowMissionBriefing(true);
    triggerTurnTransition(1);
  };

  const handleLeaveToLobby = async () => {
    if (sailTimerRef.current) clearTimeout(sailTimerRef.current);
    const wasPlayer = isOnlineSession && !isSpectatorHost;
    setIsSailing(false);
    setTurnOutcome(null);
    setDrawnCards(null);
    setShowSettlement(false);
    setDraftTradePeer(null);
    setLocalDemoInteraction(null);
    setPlayMode('lobby');
    setJoinedLobbyRoom(false);
    setIsSpectatorHost(false);

    if (wasPlayer) {
      if (isSupabaseConfigured) {
        await deleteFleetSupabase(cleanRoom, clientId);
        sendPingRef.current?.();
      } else {
        const nextMap = deleteLocalPlayerFromRoom(cleanRoom, clientId);
        setRoomPeersMap(nextMap);
        channelRef.current?.postMessage({ type: 'SYNC_STATE', clientId });
      }
    }
  };

  const handleKickFleet = async (targetRoomCode, targetClientId) => {
    const rc = targetRoomCode || cleanRoom;
    if (!targetClientId) return;
    if (isSupabaseConfigured) {
      await deleteFleetSupabase(rc, targetClientId);
      if (rc === cleanRoom) {
        const freshMap = await fetchRoomFleetsFromSupabase(rc);
        setRoomPeersMap(freshMap);
        sendPingRef.current?.();
      }
    } else {
      const nextMap = deleteLocalPlayerFromRoom(rc, targetClientId);
      if (rc === cleanRoom) {
        setRoomPeersMap(nextMap);
        channelRef.current?.postMessage({ type: 'SYNC_STATE', clientId });
      }
    }
  };

  // Multi-Room Teacher Handlers
  const handleCreateBatchRooms = async (codes, missionId = 'mission_1') => {
    if (!codes?.length) return;
    if (isSupabaseConfigured) {
      const rooms = await ensureRoomsBatchSupabase(codes, clientId, missionId);
      setTeacherAllRooms(rooms);
    } else {
      for (const rc of codes) {
        const cur = loadLocalRoomMeta(rc, clientId);
        saveLocalRoomMeta(rc, { ...cur, hostClientId: clientId, missionId });
      }
      setTeacherAllRooms(loadAllLocalRoomsMeta());
    }
  };

  const handleChangeRoomMission = async (targetRoomCode, missionId) => {
    const rc = targetRoomCode || cleanRoom;
    if (!missionId) return;
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(rc, { missionId });
      if (updated) {
        if (rc === cleanRoom) setRoomMeta(updated);
        setTeacherAllRooms((prev) => prev.map((r) => (r.roomCode === rc ? updated : r)));
        sendPingRef.current?.();
      }
    } else {
      const cur = loadLocalRoomMeta(rc, clientId);
      const next = saveLocalRoomMeta(rc, { ...cur, missionId });
      if (rc === cleanRoom) {
        setRoomMeta(next);
        channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
      }
      setTeacherAllRooms(loadAllLocalRoomsMeta());
    }
  };

  const handleStartRoomByCode = async (rc) => {
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(rc, {
        phase: 'playing',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      if (rc === cleanRoom && updated) setRoomMeta(updated);
    } else {
      const cur = loadLocalRoomMeta(rc, clientId);
      const next = saveLocalRoomMeta(rc, {
        ...cur,
        phase: 'playing',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      if (rc === cleanRoom) setRoomMeta(next);
    }
  };

  const handleBatchStartWaiting = async (waitingCodes) => {
    await Promise.all((waitingCodes || []).map((rc) => handleStartRoomByCode(rc)));
  };

  const handleForceOpenActivityByCode = async (rc) => {
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(rc, { turnPhase: 'activity' });
      if (rc === cleanRoom && updated) setRoomMeta(updated);
    } else {
      const cur = loadLocalRoomMeta(rc, clientId);
      const next = saveLocalRoomMeta(rc, { ...cur, turnPhase: 'activity' });
      if (rc === cleanRoom) setRoomMeta(next);
    }
  };

  const handleForceNextTurnByCode = async (rc, curTurn) => {
    const roomObj =
      teacherAllRooms.find((r) => r.roomCode === rc) || (rc === cleanRoom ? roomMeta : null);
    const maxTurns = getMissionById(roomObj?.missionId).maxTurns;
    const isFinal = curTurn >= maxTurns;
    const nextTurn = isFinal ? maxTurns : curTurn + 1;
    const nextPhase = isFinal ? 'finished' : 'playing';
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(rc, {
        currentTurn: nextTurn,
        turnPhase: 'sail_card',
        phase: nextPhase,
      });
      if (rc === cleanRoom && updated) setRoomMeta(updated);
    } else {
      const cur = loadLocalRoomMeta(rc, clientId);
      const next = saveLocalRoomMeta(rc, {
        ...cur,
        currentTurn: nextTurn,
        turnPhase: 'sail_card',
        phase: nextPhase,
      });
      if (rc === cleanRoom) setRoomMeta(next);
    }
  };

  const handleResetRoomByCode = async (rc) => {
    if (isSupabaseConfigured) {
      await clearRoomInSupabase(rc);
      const updated = await updateRoomInSupabase(rc, {
        phase: 'waiting',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      if (rc === cleanRoom && updated) {
        setRoomMeta(updated);
        setRoomPeersMap({});
        setInteractions([]);
      }
    } else {
      clearRoomSnapshot(rc);
      saveLocalInteractions(rc, []);
      const cur = loadLocalRoomMeta(rc, clientId);
      const next = saveLocalRoomMeta(rc, {
        ...cur,
        phase: 'waiting',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      if (rc === cleanRoom) {
        setRoomPeersMap({});
        setInteractions([]);
        setRoomMeta(next);
      }
    }
  };

  const handleDeleteRoomByCode = async (rc) => {
    if (isSupabaseConfigured) {
      await deleteRoomInSupabase(rc);
      setTeacherAllRooms((prev) => prev.filter((r) => r.roomCode !== rc));
      setTeacherAllFleetsByRoom((prev) => {
        const copy = { ...prev };
        delete copy[rc];
        return copy;
      });
    } else {
      clearRoomSnapshot(rc);
      try {
        localStorage.removeItem(`age_of_sail_room_meta_v1_${rc}`);
      } catch {
        // Ignore
      }
      setTeacherAllRooms(loadAllLocalRoomsMeta());
      setTeacherAllFleetsByRoom(loadAllLocalFleets());
    }
  };

  const handleHostStartVoyage = async () => {
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(cleanRoom, {
        phase: 'playing',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      if (updated) setRoomMeta(updated);
    } else {
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        phase: 'playing',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
    if (!isSpectatorHost) {
      setPlayMode('online');
      setShowMissionBriefing(true);
      prevRoomTurnRef.current = 1;
      prevRoomTurnPhaseRef.current = 'sail_card';
    }
  };

  const handleForceOpenActivity = async () => {
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(cleanRoom, {
        turnPhase: 'activity',
      });
      if (updated) setRoomMeta(updated);
    } else {
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        turnPhase: 'activity',
      });
      setRoomMeta(nextMeta);
      channelRef.current?.postMessage({ type: 'SYNC_ROOM' });
    }
  };

  const handleForceNextTurn = async () => {
    const maxTurns = getMissionById(roomMeta.missionId).maxTurns;
    const isFinal = roomMeta.currentTurn >= maxTurns;
    const nextTurn = isFinal ? maxTurns : roomMeta.currentTurn + 1;
    const nextPhase = isFinal ? 'finished' : 'playing';
    if (isSupabaseConfigured) {
      const updated = await updateRoomInSupabase(cleanRoom, {
        currentTurn: nextTurn,
        turnPhase: 'sail_card',
        phase: nextPhase,
      });
      if (updated) setRoomMeta(updated);
    } else {
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        currentTurn: nextTurn,
        turnPhase: 'sail_card',
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
        turnPhase: 'sail_card',
      });
      if (updated) setRoomMeta(updated);
      setRoomPeersMap({});
      setInteractions([]);
    } else {
      clearRoomSnapshot(cleanRoom);
      saveLocalInteractions(cleanRoom, []);
      const nextMeta = saveLocalRoomMeta(cleanRoom, {
        ...roomMeta,
        phase: 'waiting',
        currentTurn: 1,
        turnPhase: 'sail_card',
      });
      setRoomPeersMap({});
      setInteractions([]);
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
    saveLocalInteractions(cleanRoom, []);
    setRoomPeersMap({});
    setInteractions([]);
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
    setDraftTradePeer(null);
    setLocalDemoInteraction(null);
    clearLocalGameState();
    setGameState((prev) => createInitialGameState(prev.missionId || 'mission_1'));
    setActiveTab('helm');
    if (playMode === 'online') {
      setPlayMode('lobby');
      setJoinedLobbyRoom(false);
    }
  };

  // Step 1: Sail or Hold Position
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

  const handleHoldPosition = () => {
    if (!canSail) return;
    setDockToast(null);
    setTurnToast(null);
    setCardHintBanner(null);
    setGameState((prev) => {
      const next = holdPositionTurn(prev);
      if (next.status !== 'active') {
        setShowSettlement(true);
      } else {
        setDrawnCards(drawThreeSituationCards());
      }
      return next;
    });
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

  // Step 2: Confirm Situation Card -> transitions to Step 3 (Surrounding Activity)
  const handleConfirmCard = (card) => {
    const { nextState, hintText } = applySituationCardToState(gameState, card);
    setGameState(nextState);
    setDrawnCards(null);
    if (hintText) setCardHintBanner(hintText);
    if (nextState.status !== 'active') {
      setShowSettlement(true);
    }
  };

  // Step 3: Port Visit & Finish Activity
  const handleEnterPort = () => {
    const { nextState, dockedPort } = enterPortInActivity(gameState);
    setGameState(nextState);
    if (nextState.status !== 'active') {
      setShowSettlement(true);
      return;
    }
    if (dockedPort) {
      setDockToast(`${dockedPort.name} 입항 완료! 교역·일지 탭에서 보급과 특산품을 거래하세요.`);
    }
  };

  const handleFinishActivity = () => {
    setGameState((prev) => {
      const next = finishActivityTurn(prev);
      if (next.status !== 'active') {
        setShowSettlement(true);
      } else if (playMode === 'solo') {
        triggerTurnTransition(next.turn);
      }
      return next;
    });
  };

  // Interaction Helpers (Supabase + Local + Demo AI)
  const persistInteractionList = (updater) => {
    const nextList = updater(loadLocalInteractions(cleanRoom));
    saveLocalInteractions(cleanRoom, nextList);
    setInteractions(nextList);
    channelRef.current?.postMessage({ type: 'SYNC_INTERACTIONS' });
  };

  const handleSendTradeOffer = async (peer, offer) => {
    setDraftTradePeer(null);
    if (peer.isDemo) {
      const demoId = `demo-trade-${Date.now()}`;
      setLocalDemoInteraction({
        id: demoId,
        roomCode: cleanRoom,
        turn: gameState.activeTurn || gameState.turn,
        type: 'trade',
        initiatorId: clientId,
        initiatorName: teamName,
        targetId: peer.clientId,
        targetName: peer.teamName,
        status: 'pending',
        payload: offer,
      });
      setTimeout(() => {
        setLocalDemoInteraction((cur) =>
          cur && cur.id === demoId ? { ...cur, status: 'completed' } : cur,
        );
      }, 750);
      return;
    }

    if (isSupabaseConfigured) {
      await createInteractionSupabase({
        roomCode: cleanRoom,
        turn: gameState.activeTurn || gameState.turn,
        type: 'trade',
        initiatorId: clientId,
        initiatorName: teamName.trim() || '탐험 선단',
        targetId: peer.clientId,
        targetName: peer.teamName,
        payload: offer,
      });
    } else {
      const item = {
        id: `local-${Date.now()}`,
        roomCode: cleanRoom,
        turn: gameState.activeTurn || gameState.turn,
        type: 'trade',
        initiatorId: clientId,
        initiatorName: teamName.trim() || '탐험 선단',
        targetId: peer.clientId,
        targetName: peer.teamName,
        status: 'pending',
        payload: offer,
      };
      persistInteractionList((prev) => [item, ...prev]);
    }
  };

  const handleStartBattle = async (peer) => {
    const initPayload = createInitialBattlePayload();
    if (peer.isDemo) {
      const demoId = `demo-battle-${Date.now()}`;
      setLocalDemoInteraction({
        id: demoId,
        roomCode: cleanRoom,
        turn: gameState.activeTurn || gameState.turn,
        type: 'battle',
        initiatorId: clientId,
        initiatorName: teamName,
        targetId: peer.clientId,
        targetName: peer.teamName,
        status: 'pending',
        payload: initPayload,
      });
      setTimeout(() => {
        setLocalDemoInteraction((cur) =>
          cur && cur.id === demoId ? { ...cur, status: 'active' } : cur,
        );
      }, 650);
      return;
    }

    if (isSupabaseConfigured) {
      await createInteractionSupabase({
        roomCode: cleanRoom,
        turn: gameState.activeTurn || gameState.turn,
        type: 'battle',
        initiatorId: clientId,
        initiatorName: teamName.trim() || '탐험 선단',
        targetId: peer.clientId,
        targetName: peer.teamName,
        payload: initPayload,
      });
    } else {
      const item = {
        id: `local-${Date.now()}`,
        roomCode: cleanRoom,
        turn: gameState.activeTurn || gameState.turn,
        type: 'battle',
        initiatorId: clientId,
        initiatorName: teamName.trim() || '탐험 선단',
        targetId: peer.clientId,
        targetName: peer.teamName,
        status: 'pending',
        payload: initPayload,
      };
      persistInteractionList((prev) => [item, ...prev]);
    }
  };

  const patchInteraction = async (inter, patch) => {
    if (inter.id.startsWith('demo-')) {
      setLocalDemoInteraction((cur) => (cur ? { ...cur, ...patch } : null));
      return;
    }
    if (isSupabaseConfigured) {
      await updateInteractionSupabase(inter.id, patch);
    } else {
      persistInteractionList((prev) =>
        prev.map((item) => (item.id === inter.id ? { ...item, ...patch } : item)),
      );
    }
  };

  const handleAcceptTrade = (inter) => patchInteraction(inter, { status: 'completed' });
  const handleDeclineInteraction = (inter) => patchInteraction(inter, { status: 'declined' });
  const handleCancelInteraction = (inter) => patchInteraction(inter, { status: 'cancelled' });
  const handleAcceptBattle = (inter) => patchInteraction(inter, { status: 'active' });

  const handleFleeBattle = async (inter) => {
    setGameState((prev) => applyFleeBattleToState(prev, inter.initiatorName));
    await patchInteraction(inter, { status: 'declined' });
  };

  const handleSubmitRpsChoice = async (inter, choice) => {
    const actorRole = inter.initiatorId === clientId ? 'initiator' : 'target';
    const { nextPayload, nextStatus } = advanceBattleState(inter.payload, actorRole, choice);
    await patchInteraction(inter, { payload: nextPayload, status: nextStatus });

    if (inter.id.startsWith('demo-') && nextStatus === 'active') {
      const aiPick = RPS_OPTIONS[Math.floor(Math.random() * RPS_OPTIONS.length)].id;
      setTimeout(() => {
        setLocalDemoInteraction((cur) => {
          if (!cur || cur.id !== inter.id) return cur;
          const aiStep = advanceBattleState(cur.payload, 'target', aiPick);
          return {
            ...cur,
            payload: aiStep.nextPayload,
            status: aiStep.nextStatus,
          };
        });
      }, 450);
    }
  };

  const handleCloseCompletedInteraction = () => {
    if (activeInteraction) {
      setDismissedInteractionIds((prev) => new Set(prev).add(activeInteraction.id));
      if (activeInteraction.id.startsWith('demo-')) {
        setLocalDemoInteraction(null);
      }
    }
    setDraftTradePeer(null);
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
        activeRoomCode={cleanRoom}
        allRooms={teacherAllRooms}
        allFleetsByRoom={teacherAllFleetsByRoom}
        onBackToStudent={() => {
          setIsTeacherMode(false);
          if (isSpectatorHost) setPlayMode('lobby');
        }}
        onCreateBatchRooms={handleCreateBatchRooms}
        onBatchStartWaiting={handleBatchStartWaiting}
        onStartRoom={handleStartRoomByCode}
        onForceOpenActivityRoom={handleForceOpenActivityByCode}
        onForceNextTurnRoom={handleForceNextTurnByCode}
        onResetRoom={handleResetRoomByCode}
        onKickFleet={handleKickFleet}
        onDeleteRoom={handleDeleteRoomByCode}
        onChangeRoomMission={handleChangeRoomMission}
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
        realFleets={onlineRealFleets}
        myClientId={clientId}
        isOnlineSync={isSupabaseConfigured}
        onJoinOnlineRoom={handleJoinOnlineRoom}
        onJoinAsTeacherHost={handleJoinAsTeacherHost}
        onStartSoloPractice={handleStartSoloPractice}
        onLeaveRoom={handleLeaveToLobby}
        onHostStartVoyage={handleHostStartVoyage}
        onChangeRoomMission={(mid) => handleChangeRoomMission(cleanRoom, mid)}
        onKickFleet={(cid) => handleKickFleet(cleanRoom, cid)}
        onOpenTeacherMode={() => setIsTeacherMode(true)}
      />
    );
  }

  const endMeta = getEndMeta(gameState.status, gameState.missionId);
  const cardsReadyCount = onlineRealFleets.filter(
    (f) =>
      f.status !== 'active' ||
      (f.cardCompletedTurn ?? 0) >= roomMeta.currentTurn ||
      (f.completedTurn ?? 0) >= roomMeta.currentTurn,
  ).length;
  const readyCount = onlineRealFleets.filter(
    (f) => f.status !== 'active' || (f.completedTurn ?? 0) >= roomMeta.currentTurn,
  ).length;
  const displayTurn =
    playMode === 'online'
      ? roomMeta.currentTurn
      : gameState.turnStep === 'sail' && !isWaitingForOthers
        ? gameState.turn
        : gameState.activeTurn || gameState.turn;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex justify-center">
      <div className="w-full max-w-md min-h-dvh flex flex-col bg-slate-950 border-x border-slate-900 shadow-2xl">
        <TopResourceBar
          state={gameState}
          displayTurn={displayTurn}
          canReset={playMode === 'solo'}
          onReset={handleReset}
          onOpenBriefing={() => setShowMissionBriefing(true)}
        />

        <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Synchronized Turn Waiting Banner */}
          {isWaitingForOthers && (
            <div className="rounded-2xl border border-amber-400/50 bg-amber-950/45 p-3.5 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>
                    제{gameState.completedTurn}턴 완료! 다른 선단 대기 중 ({readyCount}/
                    {Math.max(1, onlineRealFleets.length)}팀)
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
                {onlineRealFleets.map((f) => {
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
                  {playMode === 'solo' && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900/80 border border-slate-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      새 항해
                    </button>
                  )}
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
                isBlockedAhead={isBlockedAhead}
              />

              {turnStep === 'activity' && gameState.status === 'active' ? (
                isWaitingForActivityOpen ? (
                  <section className="rounded-2xl border border-sky-400/50 bg-sky-950/45 p-4 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-black text-sky-200">
                        <Clock className="w-4 h-4 text-sky-400 animate-pulse" />
                        <span>
                          2단계(카드) 완료! 전원 카드 완료 후 3단계 동시 개방 ({cardsReadyCount}/
                          {Math.max(1, onlineRealFleets.length)}팀)
                        </span>
                      </div>
                      {isHost && (
                        <button
                          type="button"
                          onClick={handleForceOpenActivity}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-500 hover:bg-sky-400 px-2 py-1 text-[10px] font-black text-slate-950 cursor-pointer"
                        >
                          <FastForward className="w-3 h-3" />
                          강제 개방
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      모든 선단이 이번 턴 항해와 상황 카드 선택을 마쳐야 정확한 선박 위치가 확정되어
                      3단계(기항지 방문·선박 교역/전투)가 동시에 열립니다.
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {onlineRealFleets.map((f) => {
                        const cardDone =
                          f.status !== 'active' ||
                          (f.cardCompletedTurn ?? 0) >= roomMeta.currentTurn ||
                          (f.completedTurn ?? 0) >= roomMeta.currentTurn;
                        return (
                          <span
                            key={f.clientId}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              cardDone
                                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                                : 'border-slate-700 bg-slate-900 text-slate-300'
                            }`}
                          >
                            {cardDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Clock className="w-3 h-3 text-sky-400" />
                            )}
                            {f.teamName}
                          </span>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <ActivityStepPanel
                    activeTurn={gameState.activeTurn || Math.max(1, gameState.turn - 1)}
                    nearbyPort={nearbyPort}
                    isDocked={gameState.isDocked}
                    nearbyFleets={nearbyFleets}
                    interactedThisTurn={Boolean(gameState.interactedThisTurn)}
                    onEnterPort={handleEnterPort}
                    onOpenTradeShop={() => setActiveTab('log')}
                    onStartTrade={(peer) => setDraftTradePeer(peer)}
                    onStartBattle={handleStartBattle}
                    onFinishTurn={handleFinishActivity}
                  />
                )
              ) : (
                <>
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

                  <div className="space-y-2 pt-0.5">
                    {canSail && isBlockedAhead && (
                      <div className="rounded-xl border border-amber-400/50 bg-amber-950/45 px-3 py-2 text-xs font-bold text-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          현재 방위({String(gameState.headingDeg).padStart(3, '0')}°) 바로 앞은 육지(해안)입니다. 이 방향으로는 갈 수 없으니 방위를 돌려주세요!
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!canSail}
                      onClick={handleSail}
                      className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black shadow-lg transition ${
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
                            : `1단계 항해 실행 (자로 ${windEval.effectiveCm.toFixed(1)} cm)`}
                      </span>
                    </button>

                    {canSail && (nearbyPort || nearbyFleets.length > 0) && (
                      <button
                        type="button"
                        onClick={handleHoldPosition}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/35 hover:bg-emerald-950/55 py-2.5 text-xs font-bold text-emerald-200 transition cursor-pointer"
                      >
                        <Anchor className="w-3.5 h-3.5" />
                        <span>
                          이동 없이 현 해역 유지 (바로 2단계 카드 · 3단계 주변활동)
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
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
      {(draftTradePeer || activeInteraction) && (
        <InteractionModal
          draftTradePeer={draftTradePeer}
          activeInteraction={activeInteraction}
          myClientId={clientId}
          gameState={gameState}
          onSendTradeOffer={handleSendTradeOffer}
          onAcceptTrade={handleAcceptTrade}
          onDeclineInteraction={handleDeclineInteraction}
          onCancelInteraction={handleCancelInteraction}
          onAcceptBattle={handleAcceptBattle}
          onFleeBattle={handleFleeBattle}
          onSubmitRpsChoice={handleSubmitRpsChoice}
          onCloseCompleted={handleCloseCompletedInteraction}
        />
      )}
      {showSettlement && (
        <SettlementModal
          settlement={settlement}
          state={gameState}
          canReset={playMode === 'solo'}
          onReset={handleReset}
          onClose={() => setShowSettlement(false)}
        />
      )}
      {showMissionBriefing && (
        <MissionBriefingModal
          missionId={gameState.missionId}
          onClose={() => setShowMissionBriefing(false)}
        />
      )}
      <TurnTransitionOverlay transition={turnTransition} />
    </div>
  );
}
