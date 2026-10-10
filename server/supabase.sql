-- Ejecutar en el SQL Editor del proyecto Stones. No modifica otras tablas.
create table if not exists public.stones_worlds (
  id text primary key,
  revision uuid not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.stones_worlds enable row level security;
revoke all on public.stones_worlds from public, anon, authenticated;
grant select, insert, update on public.stones_worlds to service_role;
comment on table public.stones_worlds is 'Mundos de Stones; acceso exclusivo del servidor, sin lectura pública';
