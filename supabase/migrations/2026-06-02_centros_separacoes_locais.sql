-- =====================================================================
-- 2026-06-02 — Coleções que eram local-only (varredura ampla DB.<key>)
--
-- Detectadas cruzando TODOS os DB.<key> do código com o que sincroniza
-- (a varredura anterior só olhava o defaultDB e não pegava chaves criadas
-- dinamicamente). Eram só localStorage → a equipe não via:
--   centros_custo        (Financeiro — centros de custo, 38 usos)
--   separacoes           (Logística — separações de pedido)
--   locais_armazenamento (Armazenagem — locais)
-- Padrão JSONB: (id text PK, dados jsonb, criado_em). RLS authenticated.
-- Nascem vazias: a trava _backedByDefaults preserva o que já existe localmente
-- e sobe no próximo save (sem perder nada).
-- Obs: automacoesProducao e dreAjustes (objetos de config) vão pro app_settings
-- via SINGLETON_KEYS — não precisam de tabela nova.
-- =====================================================================

-- centros_custo --------------------------------------------------------
create table if not exists public.centros_custo (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
create index if not exists centros_custo_criado_em_idx on public.centros_custo (criado_em);
alter table public.centros_custo enable row level security;
drop policy if exists "centros_custo_select_auth" on public.centros_custo;
create policy "centros_custo_select_auth" on public.centros_custo for select to authenticated using (true);
drop policy if exists "centros_custo_write_auth" on public.centros_custo;
create policy "centros_custo_write_auth" on public.centros_custo for all to authenticated using (true) with check (true);

-- separacoes -----------------------------------------------------------
create table if not exists public.separacoes (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
create index if not exists separacoes_criado_em_idx on public.separacoes (criado_em);
alter table public.separacoes enable row level security;
drop policy if exists "separacoes_select_auth" on public.separacoes;
create policy "separacoes_select_auth" on public.separacoes for select to authenticated using (true);
drop policy if exists "separacoes_write_auth" on public.separacoes;
create policy "separacoes_write_auth" on public.separacoes for all to authenticated using (true) with check (true);

-- locais_armazenamento -------------------------------------------------
create table if not exists public.locais_armazenamento (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
create index if not exists locais_armazenamento_criado_em_idx on public.locais_armazenamento (criado_em);
alter table public.locais_armazenamento enable row level security;
drop policy if exists "locais_armazenamento_select_auth" on public.locais_armazenamento;
create policy "locais_armazenamento_select_auth" on public.locais_armazenamento for select to authenticated using (true);
drop policy if exists "locais_armazenamento_write_auth" on public.locais_armazenamento;
create policy "locais_armazenamento_write_auth" on public.locais_armazenamento for all to authenticated using (true) with check (true);
