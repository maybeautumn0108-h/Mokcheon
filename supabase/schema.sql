-- Run this SQL once in your Supabase Dashboard -> SQL Editor
create table if not exists public.fleets (
  room_code text not null,
  client_id text not null,
  team_name text not null,
  turn integer not null default 1,
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

alter table public.fleets enable row level security;

drop policy if exists "Allow classroom read fleets" on public.fleets;
create policy "Allow classroom read fleets"
  on public.fleets for select
  using (true);

drop policy if exists "Allow classroom upsert fleets" on public.fleets;
create policy "Allow classroom upsert fleets"
  on public.fleets for insert
  with check (true);

drop policy if exists "Allow classroom update fleets" on public.fleets;
create policy "Allow classroom update fleets"
  on public.fleets for update
  using (true);

drop policy if exists "Allow classroom delete fleets" on public.fleets;
create policy "Allow classroom delete fleets"
  on public.fleets for delete
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fleets'
  ) then
    alter publication supabase_realtime add table public.fleets;
  end if;
end $$;
