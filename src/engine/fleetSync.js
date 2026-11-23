import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
  supabase,
} from './supabaseClient.js';
import { MAX_TURNS } from '../data/calendar.js';

export const OFFLINE_TIMEOUT_MS = 25000;
export const HEARTBEAT_INTERVAL_MS = 8000;

const STORAGE_PREFIX = 'age_of_sail_room_v1_';
const ROOM_META_PREFIX = 'age_of_sail_room_meta_v1_';
const INTERACTIONS_PREFIX = 'age_of_sail_interactions_v1_';
const GAME_STATE_KEY = 'age_of_sail_saved_game_v1';

export { isSupabaseConfigured };

export function getOrCreateClientId() {
  try {
    let id = sessionStorage.getItem('age_of_sail_client_id');
    if (!id) {
      id = `fleet-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem('age_of_sail_client_id', id);
    }
    return id;
  } catch {
    return `fleet-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function saveLocalGameState(state, meta) {
  try {
    localStorage.setItem(
      GAME_STATE_KEY,
      JSON.stringify({ state, meta, savedAt: Date.now() }),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalGameState() {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalGameState() {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
  } catch {
    // Ignore
  }
}

export function loadRoomSnapshot(roomCode) {
  if (!roomCode) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomCode}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePlayerToRoom(roomCode, playerPayload) {
  if (!roomCode || !playerPayload?.clientId) return {};
  const current = loadRoomSnapshot(roomCode);
  const next = {
    ...current,
    [playerPayload.clientId]: {
      ...playerPayload,
      updatedAt: Date.now(),
    },
  };
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${roomCode}`, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function clearRoomSnapshot(roomCode) {
  if (!roomCode) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${roomCode}`);
  } catch {
    // Ignore
  }
}

export function loadLocalRoomMeta(roomCode, fallbackHostId) {
  try {
    const raw = localStorage.getItem(`${ROOM_META_PREFIX}${roomCode}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return {
    roomCode,
    hostClientId: fallbackHostId || 'local-host',
    phase: 'waiting',
    currentTurn: 1,
    turnPhase: 'sail_card',
  };
}

export function saveLocalRoomMeta(roomCode, meta) {
  try {
    localStorage.setItem(`${ROOM_META_PREFIX}${roomCode}`, JSON.stringify(meta));
  } catch {
    // Ignore
  }
  return meta;
}

export function loadAllLocalRoomsMeta() {
  const list = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ROOM_META_PREFIX)) {
        const raw = localStorage.getItem(k);
        if (raw) list.push(JSON.parse(raw));
      }
    }
  } catch {
    // Ignore
  }
  return list.sort((a, b) => (a.roomCode || '').localeCompare(b.roomCode || ''));
}

export function loadAllLocalFleets() {
  const byRoom = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        const roomCode = k.slice(STORAGE_PREFIX.length);
        const raw = localStorage.getItem(k);
        byRoom[roomCode] = raw ? JSON.parse(raw) : {};
      }
    }
  } catch {
    // Ignore
  }
  return byRoom;
}

function rowToFleet(row) {
  return {
    clientId: row.client_id,
    teamName: row.team_name,
    turn: row.turn,
    cardCompletedTurn: row.card_completed_turn ?? 0,
    completedTurn: row.completed_turn ?? 0,
    lat: row.lat,
    lon: row.lon,
    headingDeg: row.heading_deg,
    food: row.food,
    hull: row.hull,
    gold: row.gold,
    cargoCount: row.cargo_count,
    lastEvent: row.last_event,
    status: row.status,
    trail: Array.isArray(row.trail) ? row.trail : [],
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function rowToRoom(row) {
  if (!row) return null;
  return {
    roomCode: row.room_code,
    hostClientId: row.host_client_id,
    phase: row.phase || 'waiting',
    currentTurn: row.current_turn ?? 1,
    turnPhase: row.turn_phase || 'sail_card',
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export async function fetchOrCreateRoomSupabase(roomCode, clientId) {
  if (!supabase || !roomCode) return null;

  const { data: existing, error: selErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode)
    .maybeSingle();

  if (existing) return rowToRoom(existing);
  if (selErr) {
    console.warn('[Supabase] fetch room error:', selErr.message);
  }

  const initialRoom = {
    room_code: roomCode,
    host_client_id: clientId,
    phase: 'waiting',
    current_turn: 1,
    turn_phase: 'sail_card',
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insErr } = await supabase
    .from('rooms')
    .upsert(initialRoom, { onConflict: 'room_code', ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (inserted) return rowToRoom(inserted);

  if (insErr) {
    console.warn('[Supabase] create room error:', insErr.message);
  }

  const { data: fallback } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode)
    .maybeSingle();

  return rowToRoom(fallback) || {
    roomCode,
    hostClientId: clientId,
    phase: 'waiting',
    currentTurn: 1,
    turnPhase: 'sail_card',
  };
}

export async function updateRoomInSupabase(roomCode, patch) {
  if (!supabase || !roomCode) return null;
  const dbPatch = {
    updated_at: new Date().toISOString(),
  };
  if (patch.phase !== undefined) dbPatch.phase = patch.phase;
  if (patch.currentTurn !== undefined) dbPatch.current_turn = patch.currentTurn;
  if (patch.turnPhase !== undefined) dbPatch.turn_phase = patch.turnPhase;
  if (patch.hostClientId !== undefined) dbPatch.host_client_id = patch.hostClientId;

  const { data, error } = await supabase
    .from('rooms')
    .update(dbPatch)
    .eq('room_code', roomCode)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] update room error:', error.message);
    return null;
  }
  return rowToRoom(data);
}

export function isFleetOffline(fleet, nowMs = Date.now()) {
  if (!fleet || fleet.isDemo) return false;
  if (!fleet.updatedAt) return false;
  return nowMs - fleet.updatedAt > OFFLINE_TIMEOUT_MS;
}

export function areAllFleetsCardsReady(fleets, currentTurn, nowMs = Date.now()) {
  const onlineFleets = (fleets || []).filter(
    (f) => !f.isDemo && !isFleetOffline(f, nowMs),
  );
  if (onlineFleets.length === 0) return false;
  return onlineFleets.every(
    (f) =>
      f.status !== 'active' ||
      (f.cardCompletedTurn ?? 0) >= currentTurn ||
      (f.completedTurn ?? 0) >= currentTurn,
  );
}

/**
 * Atomically open Step 3 (activity phase) once all online active fleets have finished Step 1+2 (sail & card).
 */
export async function tryOpenActivityPhaseSupabase(roomCode, currentTurn, fleets) {
  if (!supabase || !roomCode) return false;
  if (!areAllFleetsCardsReady(fleets, currentTurn)) return false;

  const { data, error } = await supabase
    .from('rooms')
    .update({
      turn_phase: 'activity',
      updated_at: new Date().toISOString(),
    })
    .eq('room_code', roomCode)
    .eq('phase', 'playing')
    .eq('current_turn', currentTurn)
    .eq('turn_phase', 'sail_card')
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] open activity phase error:', error.message);
    return false;
  }
  return Boolean(data);
}

/**
 * Pure helper to determine whether all online real fleets in the room have finished `currentTurn`.
 */
export function areAllFleetsReadyForNextTurn(fleets, currentTurn, nowMs = Date.now()) {
  const onlineFleets = (fleets || []).filter(
    (f) => !f.isDemo && !isFleetOffline(f, nowMs),
  );
  if (onlineFleets.length === 0) return false;
  return onlineFleets.every(
    (f) => f.status !== 'active' || (f.completedTurn ?? 0) >= currentTurn,
  );
}

/**
 * Atomically advance room turn in Supabase if all active fleets have completed `currentTurn`.
 */
export async function tryAdvanceRoomTurnSupabase(roomCode, currentTurn, fleets) {
  if (!supabase || !roomCode) return false;
  if (!areAllFleetsReadyForNextTurn(fleets, currentTurn)) return false;

  const isFinalTurn = currentTurn >= MAX_TURNS;
  const nextTurn = isFinalTurn ? MAX_TURNS : currentTurn + 1;
  const nextPhase = isFinalTurn ? 'finished' : 'playing';

  const { data, error } = await supabase
    .from('rooms')
    .update({
      current_turn: nextTurn,
      phase: nextPhase,
      turn_phase: 'sail_card',
      updated_at: new Date().toISOString(),
    })
    .eq('room_code', roomCode)
    .eq('phase', 'playing')
    .eq('current_turn', currentTurn)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] advance turn error:', error.message);
    return false;
  }
  return Boolean(data);
}

export async function fetchRoomFleetsFromSupabase(roomCode) {
  if (!supabase || !roomCode) return {};
  const { data, error } = await supabase
    .from('fleets')
    .select('*')
    .eq('room_code', roomCode);

  if (error) {
    console.warn('[Supabase] fetchRoomFleets error:', error.message);
    return {};
  }

  const map = {};
  for (const row of data || []) {
    map[row.client_id] = rowToFleet(row);
  }
  return map;
}

export async function upsertPlayerToSupabase(roomCode, playerPayload) {
  if (!supabase || !roomCode || !playerPayload?.clientId) return;
  const { error } = await supabase.from('fleets').upsert(
    {
      room_code: roomCode,
      client_id: playerPayload.clientId,
      team_name: playerPayload.teamName,
      turn: playerPayload.turn,
      card_completed_turn: playerPayload.cardCompletedTurn ?? 0,
      completed_turn: playerPayload.completedTurn ?? 0,
      lat: playerPayload.lat,
      lon: playerPayload.lon,
      heading_deg: playerPayload.headingDeg,
      food: playerPayload.food,
      hull: playerPayload.hull,
      gold: playerPayload.gold,
      cargo_count: playerPayload.cargoCount,
      last_event: playerPayload.lastEvent,
      status: playerPayload.status,
      trail: playerPayload.trail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_code,client_id' },
  );
  if (error) {
    console.warn('[Supabase] upsert error:', error.message);
  }
}

function rowToInteraction(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomCode: row.room_code,
    turn: row.turn,
    type: row.type,
    initiatorId: row.initiator_id,
    initiatorName: row.initiator_name,
    targetId: row.target_id,
    targetName: row.target_name,
    status: row.status,
    payload: row.payload || {},
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export function loadLocalInteractions(roomCode) {
  try {
    const raw = localStorage.getItem(`${INTERACTIONS_PREFIX}${roomCode}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalInteractions(roomCode, list) {
  try {
    localStorage.setItem(`${INTERACTIONS_PREFIX}${roomCode}`, JSON.stringify(list));
  } catch {
    // Ignore
  }
  return list;
}

export async function fetchInteractionsSupabase(roomCode) {
  if (!supabase || !roomCode) return [];
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('room_code', roomCode)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) {
    console.warn('[Supabase] fetchInteractions error:', error.message);
    return [];
  }
  return (data || []).map(rowToInteraction);
}

export async function createInteractionSupabase({
  roomCode,
  turn,
  type,
  initiatorId,
  initiatorName,
  targetId,
  targetName,
  payload,
}) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      room_code: roomCode,
      turn,
      type,
      initiator_id: initiatorId,
      initiator_name: initiatorName,
      target_id: targetId,
      target_name: targetName,
      status: 'pending',
      payload: payload || {},
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    console.warn('[Supabase] createInteraction error:', error.message);
    return null;
  }
  return rowToInteraction(data);
}

export async function updateInteractionSupabase(id, patch) {
  if (!supabase || !id) return null;
  const dbPatch = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.payload !== undefined) dbPatch.payload = patch.payload;

  const { data, error } = await supabase
    .from('interactions')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) {
    console.warn('[Supabase] updateInteraction error:', error.message);
    return null;
  }
  return rowToInteraction(data);
}

export async function touchFleetHeartbeatSupabase(roomCode, clientId) {
  if (!supabase || !roomCode || !clientId) return;
  await supabase
    .from('fleets')
    .update({ updated_at: new Date().toISOString() })
    .eq('room_code', roomCode)
    .eq('client_id', clientId);
}

export async function deleteFleetSupabase(roomCode, clientId) {
  if (!supabase || !roomCode || !clientId) return;
  const { error } = await supabase
    .from('fleets')
    .delete()
    .eq('room_code', roomCode)
    .eq('client_id', clientId);
  if (error) {
    console.warn('[Supabase] deleteFleet error:', error.message);
  }
}

export function deleteFleetKeepalive(roomCode, clientId) {
  if (!isSupabaseConfigured || !roomCode || !clientId || typeof fetch === 'undefined') return;
  const url = `${SUPABASE_URL}/rest/v1/fleets?room_code=eq.${encodeURIComponent(
    roomCode,
  )}&client_id=eq.${encodeURIComponent(clientId)}`;
  try {
    fetch(url, {
      method: 'DELETE',
      keepalive: true,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
  } catch {
    // Ignore unload network errors
  }
}

export function deleteLocalPlayerFromRoom(roomCode, clientId) {
  if (!roomCode || !clientId) return {};
  const current = loadRoomSnapshot(roomCode);
  if (!current[clientId]) return current;
  const next = { ...current };
  delete next[clientId];
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${roomCode}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}
export async function clearRoomInSupabase(roomCode) {
  if (!supabase || !roomCode) return;
  const [fRes, iRes] = await Promise.all([
    supabase.from('fleets').delete().eq('room_code', roomCode),
    supabase.from('interactions').delete().eq('room_code', roomCode),
  ]);
  if (fRes.error) console.warn('[Supabase] clearRoom fleets error:', fRes.error.message);
  if (iRes.error) console.warn('[Supabase] clearRoom interactions error:', iRes.error.message);
}

export async function deleteRoomInSupabase(roomCode) {
  if (!supabase || !roomCode) return;
  await clearRoomInSupabase(roomCode);
  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('room_code', roomCode);
  if (error) {
    console.warn('[Supabase] deleteRoom error:', error.message);
  }
}

export async function fetchAllRoomsSupabase() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) {
    console.warn('[Supabase] fetchAllRooms error:', error.message);
    return [];
  }
  return (data || []).map(rowToRoom);
}

export async function fetchAllFleetsGroupedSupabase() {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('fleets')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) {
    console.warn('[Supabase] fetchAllFleets error:', error.message);
    return {};
  }
  const grouped = {};
  for (const row of data || []) {
    const f = rowToFleet(row);
    if (!grouped[row.room_code]) grouped[row.room_code] = {};
    grouped[row.room_code][row.client_id] = f;
  }
  return grouped;
}

export async function ensureRoomsBatchSupabase(roomCodes, hostClientId) {
  if (!supabase || !roomCodes?.length) return [];
  const rows = roomCodes.map((rc) => ({
    room_code: rc,
    host_client_id: hostClientId,
    phase: 'waiting',
    current_turn: 1,
    turn_phase: 'sail_card',
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('rooms')
    .upsert(rows, { onConflict: 'room_code', ignoreDuplicates: true });
  if (error) {
    console.warn('[Supabase] ensureRoomsBatch error:', error.message);
  }
  // Also claim host ownership for teacher control
  await supabase
    .from('rooms')
    .update({ host_client_id: hostClientId })
    .in('room_code', roomCodes);
  return fetchAllRoomsSupabase();
}

export function subscribeToAllRoomsSupabase({ onRoomsChange, onFleetsChange }) {
  if (!supabase) return () => {};
  let active = true;

  const refreshAll = async () => {
    const [rooms, fleetsByRoom] = await Promise.all([
      fetchAllRoomsSupabase(),
      fetchAllFleetsGroupedSupabase(),
    ]);
    if (!active) return;
    onRoomsChange?.(rooms);
    onFleetsChange?.(fleetsByRoom);
  };

  refreshAll();

  const channel = supabase
    .channel('teacher-all-rooms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
      refreshAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fleets' }, () => {
      refreshAll();
    })
    .subscribe();

  const pollId = setInterval(() => {
    refreshAll();
  }, 2500);

  return () => {
    active = false;
    clearInterval(pollId);
    supabase.removeChannel(channel);
  };
}

export function subscribeToRoomAndFleetsSupabase(
  roomCode,
  clientId,
  { onRoomChange, onFleetsChange, onInteractionsChange },
) {
  if (!supabase || !roomCode) return { unsubscribe: () => {}, sendPing: () => {} };
  let active = true;

  const refreshAll = async () => {
    const [room, fleetsMap, interactions] = await Promise.all([
      fetchOrCreateRoomSupabase(roomCode, clientId),
      fetchRoomFleetsFromSupabase(roomCode),
      fetchInteractionsSupabase(roomCode),
    ]);
    if (!active) return;
    if (room) onRoomChange?.(room);
    onFleetsChange?.(fleetsMap);
    onInteractionsChange?.(interactions);
  };

  refreshAll();

  const channel = supabase
    .channel(`room-sync-${roomCode}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'fleets',
        filter: `room_code=eq.${roomCode}`,
      },
      async () => {
        const map = await fetchRoomFleetsFromSupabase(roomCode);
        if (active) onFleetsChange?.(map);
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => {
        if (!active) return;
        if (payload.new && payload.new.room_code) {
          onRoomChange?.(rowToRoom(payload.new));
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'interactions',
        filter: `room_code=eq.${roomCode}`,
      },
      async () => {
        const list = await fetchInteractionsSupabase(roomCode);
        if (active) onInteractionsChange?.(list);
      },
    )
    .on('broadcast', { event: 'room_ping' }, () => {
      if (active) refreshAll();
    })
    .subscribe();

  const pollId = setInterval(() => {
    refreshAll();
  }, 2500);

  const sendPing = () => {
    try {
      channel.send({ type: 'broadcast', event: 'room_ping', payload: { from: clientId } });
    } catch {
      // Ignore
    }
  };

  return {
    sendPing,
    unsubscribe: () => {
      active = false;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Generate realistic demo rival student fleets for classroom preview & radar testing.
 */
export function getDemoRivalFleets(currentTurn) {
  const t = Math.max(1, Math.min(30, currentTurn));
  return [
    {
      clientId: 'demo-magellan',
      teamName: '2조 마젤란',
      isDemo: true,
      turn: t,
      completedTurn: t - 1,
      lat: Number((38.7 - Math.min(t, 12) * 5.8 + Math.max(0, t - 12) * 1.2).toFixed(2)),
      lon: Number((-9.1 - Math.min(t, 16) * 4.6).toFixed(2)),
      headingDeg: t < 12 ? 215 : 265,
      gold: 500 - t * 12,
      food: Math.max(35, 100 - (t % 5) * 14),
      hull: 92,
      cargoCount: t >= 10 ? 1 : 0,
      lastEvent: t >= 10 ? '서쪽 항로 개척 중' : '대서양 남하 중',
      status: 'active',
      trail: [{ turn: 0, lat: 38.7, lon: -9.1 }],
    },
    {
      clientId: 'demo-dagama',
      teamName: '3조 바스쿠다가마',
      isDemo: true,
      turn: t,
      completedTurn: t - 1,
      lat: Number((37.2 - Math.min(t, 6) * 4.5 - Math.max(0, t - 6) * 3.8).toFixed(2)),
      lon: Number((-11.0 - Math.min(t, 4) * 3.0 + Math.max(0, t - 6) * 4.2).toFixed(2)),
      headingDeg: t < 6 ? 195 : 145,
      gold: 440,
      food: Math.max(40, 100 - (t % 4) * 15),
      hull: 96,
      cargoCount: t >= 4 ? 2 : 0,
      lastEvent: t >= 4 ? '카보베르데 경유 보급' : '남동 항로 탐색 중',
      status: 'active',
      trail: [
        { turn: 0, lat: 38.7, lon: -9.1 },
        { turn: 1, lat: 33.5, lon: -12.5 },
      ],
    },
  ];
}
