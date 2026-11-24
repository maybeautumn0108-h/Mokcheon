-- Age of Sail Classroom Rooms, Fleets, and Interactions Schema
create table if not exists public.rooms (
  room_code text primary key,
  host_client_id text not null,
  phase text not null default 'waiting',
  current_turn integer not null default 1,
  turn_phase text not null default 'sail_card',
  mission_id text not null default 'mission_1',
  updated_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists turn_phase text not null default 'sail_card';

alter table public.rooms
  add column if not exists mission_id text not null default 'mission_1';

create table if not exists public.fleets (
  room_code text not null,
  client_id text not null,
  team_name text not null,
  turn integer not null default 1,
  card_completed_turn integer not null default 0,
  completed_turn integer not null default 0,
  lat double precision not null,
  lon double precision not null,
  heading_deg integer not null default 205,
  food integer not null default 100,
  hull integer not null default 100,
  gold integer not null default 500,
  cargo_count integer not null default 0,
  last_event text,
  status text not null default 'active',
  trail jsonb not null default '[]'::jsonb,
  ai_config jsonb,
  updated_at timestamptz not null default now(),
  primary key (room_code, client_id)
);

alter table public.fleets
  add column if not exists card_completed_turn integer not null default 0;

alter table public.fleets
  add column if not exists completed_turn integer not null default 0;

alter table public.fleets
  add column if not exists ai_config jsonb;

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  turn integer not null default 1,
  type text not null,
  initiator_id text not null,
  initiator_name text not null,
  target_id text not null,
  target_name text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fleets_room_updated
  on public.fleets (room_code, updated_at desc);

create index if not exists idx_interactions_room_status
  on public.interactions (room_code, status, updated_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.rooms to anon, authenticated;
grant select, insert, update, delete on public.fleets to anon, authenticated;
grant select, insert, update, delete on public.interactions to anon, authenticated;

alter table public.rooms enable row level security;
alter table public.fleets enable row level security;
alter table public.interactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rooms' and policyname = 'Allow classroom read rooms') then
    create policy "Allow classroom read rooms" on public.rooms for select to anon, authenticated using (char_length(room_code) between 1 and 40);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rooms' and policyname = 'Allow classroom insert rooms') then
    create policy "Allow classroom insert rooms" on public.rooms for insert to anon, authenticated with check (char_length(room_code) between 1 and 40 and phase in ('waiting', 'playing', 'finished'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rooms' and policyname = 'Allow classroom update rooms') then
    create policy "Allow classroom update rooms" on public.rooms for update to anon, authenticated using (char_length(room_code) between 1 and 40) with check (char_length(room_code) between 1 and 40 and phase in ('waiting', 'playing', 'finished'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rooms' and policyname = 'Allow classroom delete rooms') then
    create policy "Allow classroom delete rooms" on public.rooms for delete to anon, authenticated using (char_length(room_code) between 1 and 40);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fleets' and policyname = 'Allow classroom read fleets') then
    create policy "Allow classroom read fleets" on public.fleets for select to anon, authenticated using (char_length(room_code) between 1 and 40);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fleets' and policyname = 'Allow classroom insert fleets') then
    create policy "Allow classroom insert fleets" on public.fleets for insert to anon, authenticated with check (char_length(room_code) between 1 and 40 and char_length(client_id) between 1 and 60);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fleets' and policyname = 'Allow classroom update fleets') then
    create policy "Allow classroom update fleets" on public.fleets for update to anon, authenticated using (char_length(room_code) between 1 and 40) with check (char_length(room_code) between 1 and 40 and char_length(client_id) between 1 and 60);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fleets' and policyname = 'Allow classroom delete fleets') then
    create policy "Allow classroom delete fleets" on public.fleets for delete to anon, authenticated using (char_length(room_code) between 1 and 40);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interactions' and policyname = 'Allow classroom read interactions') then
    create policy "Allow classroom read interactions" on public.interactions for select to anon, authenticated using (char_length(room_code) between 1 and 40);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interactions' and policyname = 'Allow classroom insert interactions') then
    create policy "Allow classroom insert interactions" on public.interactions for insert to anon, authenticated with check (char_length(room_code) between 1 and 40 and type in ('trade', 'battle'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interactions' and policyname = 'Allow classroom update interactions') then
    create policy "Allow classroom update interactions" on public.interactions for update to anon, authenticated using (char_length(room_code) between 1 and 40) with check (char_length(room_code) between 1 and 40 and status in ('pending', 'active', 'completed', 'declined', 'cancelled'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interactions' and policyname = 'Allow classroom delete interactions') then
    create policy "Allow classroom delete interactions" on public.interactions for delete to anon, authenticated using (char_length(room_code) between 1 and 40);
  end if;

  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fleets') then
    alter publication supabase_realtime add table public.fleets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'interactions') then
    alter publication supabase_realtime add table public.interactions;
  end if;
end $$;
