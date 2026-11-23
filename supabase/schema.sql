-- Age of Sail Classroom Rooms & Fleets Schema
create table if not exists public.rooms (
  room_code text primary key,
  host_client_id text not null,
  phase text not null default 'waiting',
  current_turn integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.fleets (
  room_code text not null,
  client_id text not null,
  team_name text not null,
  turn integer not null default 1,
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
  updated_at timestamptz not null default now(),
  primary key (room_code, client_id)
);

alter table public.fleets
  add column if not exists completed_turn integer not null default 0;

create index if not exists idx_fleets_room_updated
  on public.fleets (room_code, updated_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.rooms to anon, authenticated;
grant select, insert, update, delete on public.fleets to anon, authenticated;

alter table public.rooms enable row level security;
alter table public.fleets enable row level security;

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

  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fleets') then
    alter publication supabase_realtime add table public.fleets;
  end if;
end $$;
