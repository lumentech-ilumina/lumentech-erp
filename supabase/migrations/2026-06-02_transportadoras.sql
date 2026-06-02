-- =====================================================================
-- 2026-06-02 — Tabela transportadoras (estava faltando no sync)
--
-- transportadoras era a única entidade de Cadastros que NÃO tinha tabela
-- Supabase nem entrava no write-through do repo.js — ficava só no
-- localStorage de cada navegador, então uma transportadora cadastrada por
-- um usuário não aparecia para os outros.
--
-- Padrão JSONB: (id text PK, dados jsonb, criado_em timestamptz).
-- =====================================================================

create table if not exists public.transportadoras (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists transportadoras_criado_em_idx on public.transportadoras (criado_em);

alter table public.transportadoras enable row level security;

drop policy if exists "transportadoras_select_auth" on public.transportadoras;
create policy "transportadoras_select_auth"
  on public.transportadoras for select
  to authenticated using (true);

drop policy if exists "transportadoras_write_auth" on public.transportadoras;
create policy "transportadoras_write_auth"
  on public.transportadoras for all
  to authenticated using (true) with check (true);
