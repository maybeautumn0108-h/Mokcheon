-- Age of Sail Classroom Fleets Table
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

create index if not exists idx_fleets_room_updated
  on public.fleets (room_code, updated_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.fleets to anon, authenticated;

alter table public.fleets enable row level security;

drop policy if exists "Allow classroom read fleets" on public.fleets;
create policy "Allow classroom read fleets"
  on public.fleets for select
  to anon, authenticated
  using (char_length(room_code) between 1 and 40);

drop policy if exists "Allow classroom insert fleets" on public.fleets;
create policy "Allow classroom insert fleets"
  on public.fleets for insert
  to anon, authenticated
  with check (
    char_length(room_code) between 1 and 40
    and char_length(client_id) between 1 and 60
  );

drop policy if exists "Allow classroom update fleets" on public.fleets;
create policy "Allow classroom update fleets"
  on public.fleets for update
  to anon, authenticated
  using (char_length(room_code) between 1 and 40)
  with check (
    char_length(room_code) between 1 and 40
    and char_length(client_id) between 1 and 60
  );

drop policy if exists "Allow classroom delete fleets" on public.fleets;
create policy "Allow classroom delete fleets"
  on public.fleets for delete
  to anon, authenticated
  using (char_length(room_code) between 1 and 40);

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
