import { isSupabaseConfigured, supabase } from './supabaseClient.js';

const STORAGE_PREFIX = 'age_of_sail_room_v1_';
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

function rowToFleet(row) {
  return {
    clientId: row.client_id,
    teamName: row.team_name,
    turn: row.turn,
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

export async function clearRoomInSupabase(roomCode) {
  if (!supabase || !roomCode) return;
  const { error } = await supabase
    .from('fleets')
    .delete()
    .eq('room_code', roomCode);
  if (error) {
    console.warn('[Supabase] clearRoom error:', error.message);
  }
}

export function subscribeToRoomSupabase(roomCode, onSnapshot) {
  if (!supabase || !roomCode) return () => {};

  const refresh = async () => {
    const map = await fetchRoomFleetsFromSupabase(roomCode);
    onSnapshot(map);
  };

  refresh();

  const channel = supabase
    .channel(`fleets-${roomCode}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'fleets',
        filter: `room_code=eq.${roomCode}`,
      },
      () => {
        refresh();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
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
