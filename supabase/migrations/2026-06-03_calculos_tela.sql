-- =====================================================================
-- 2026-06-03 — Calculadora de tela tensionada (módulo Vendas)
--
-- Guarda os orçamentos/precificações salvos na calculadora. Padrão JSONB
-- (id text PK, dados jsonb, criado_em), igual às demais entidades. RLS
-- liberada pra autenticado (segue o resto do app). Sincroniza via repo.js
-- (JSONB_ENTITIES -> {table:'calculos_tela', key:'calculosTela'}).
-- =====================================================================

create table if not exists public.calculos_tela (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
create index if not exists calculos_tela_criado_em_idx on public.calculos_tela (criado_em);
alter table public.calculos_tela enable row level security;
drop policy if exists "calculos_tela_select_auth" on public.calculos_tela;
create policy "calculos_tela_select_auth" on public.calculos_tela for select to authenticated using (true);
drop policy if exists "calculos_tela_write_auth" on public.calculos_tela;
create policy "calculos_tela_write_auth" on public.calculos_tela for all to authenticated using (true) with check (true);
