-- =====================================================================
-- 2026-05-22 — Tabelas JSONB pendentes + singleton "empresa"
--
-- Estas entidades foram adicionadas ao app depois da Fase 7 e ainda
-- não tinham tabelas Supabase correspondentes, portanto não estavam
-- entrando no write-through do repo.js:
--
--   motivos_troca, pendencias_separacao, auditoria_exclusoes,
--   motoristas, rotas
--
-- Padrão JSONB seguido: (id text PK, dados jsonb, criado_em timestamptz).
-- O cliente faz upsert por id e delete-missing pra refletir o estado local.
--
-- O singleton "empresa" passa a viver em app_settings (mesma tabela usada
-- por configOS e counters) — nada novo a criar pra ele, só policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. motivos_troca — lista personalizável de motivos no formulário de troca
-- ---------------------------------------------------------------------
create table if not exists public.motivos_troca (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists motivos_troca_criado_em_idx on public.motivos_troca (criado_em);

alter table public.motivos_troca enable row level security;

drop policy if exists "motivos_troca_select_auth" on public.motivos_troca;
create policy "motivos_troca_select_auth"
  on public.motivos_troca for select
  to authenticated using (true);

drop policy if exists "motivos_troca_write_auth" on public.motivos_troca;
create policy "motivos_troca_write_auth"
  on public.motivos_troca for all
  to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
-- 2. pendencias_separacao — pendências geradas em conferência parcial
-- ---------------------------------------------------------------------
create table if not exists public.pendencias_separacao (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists pendencias_separacao_criado_em_idx on public.pendencias_separacao (criado_em);

alter table public.pendencias_separacao enable row level security;

drop policy if exists "pendencias_separacao_select_auth" on public.pendencias_separacao;
create policy "pendencias_separacao_select_auth"
  on public.pendencias_separacao for select
  to authenticated using (true);

drop policy if exists "pendencias_separacao_write_auth" on public.pendencias_separacao;
create policy "pendencias_separacao_write_auth"
  on public.pendencias_separacao for all
  to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
-- 3. auditoria_exclusoes — trilha de quem excluiu/reverteu trocas/devs/créd
-- ---------------------------------------------------------------------
create table if not exists public.auditoria_exclusoes (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists auditoria_exclusoes_criado_em_idx on public.auditoria_exclusoes (criado_em);

alter table public.auditoria_exclusoes enable row level security;

-- Auditoria: todos veem, todos inserem. Apenas admin pode deletar (preserva trilha).
drop policy if exists "auditoria_exclusoes_select_auth" on public.auditoria_exclusoes;
create policy "auditoria_exclusoes_select_auth"
  on public.auditoria_exclusoes for select
  to authenticated using (true);

drop policy if exists "auditoria_exclusoes_insert_auth" on public.auditoria_exclusoes;
create policy "auditoria_exclusoes_insert_auth"
  on public.auditoria_exclusoes for insert
  to authenticated with check (true);

drop policy if exists "auditoria_exclusoes_update_auth" on public.auditoria_exclusoes;
create policy "auditoria_exclusoes_update_auth"
  on public.auditoria_exclusoes for update
  to authenticated using (true) with check (true);

drop policy if exists "auditoria_exclusoes_delete_admin" on public.auditoria_exclusoes;
create policy "auditoria_exclusoes_delete_admin"
  on public.auditoria_exclusoes for delete
  to authenticated
  using (exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.admin = true
  ));


-- ---------------------------------------------------------------------
-- 4. motoristas — cadastro de motoristas pra rotas de expedição
-- ---------------------------------------------------------------------
create table if not exists public.motoristas (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists motoristas_criado_em_idx on public.motoristas (criado_em);

alter table public.motoristas enable row level security;

drop policy if exists "motoristas_select_auth" on public.motoristas;
create policy "motoristas_select_auth"
  on public.motoristas for select
  to authenticated using (true);

drop policy if exists "motoristas_write_auth" on public.motoristas;
create policy "motoristas_write_auth"
  on public.motoristas for all
  to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
-- 5. rotas — rotas de expedição planejadas/em curso/concluídas
-- ---------------------------------------------------------------------
create table if not exists public.rotas (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists rotas_criado_em_idx on public.rotas (criado_em);

alter table public.rotas enable row level security;

drop policy if exists "rotas_select_auth" on public.rotas;
create policy "rotas_select_auth"
  on public.rotas for select
  to authenticated using (true);

drop policy if exists "rotas_write_auth" on public.rotas;
create policy "rotas_write_auth"
  on public.rotas for all
  to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
-- 6. empresa (singleton em app_settings)
-- ---------------------------------------------------------------------
-- app_settings já existe (usado por configOS e counters). Nenhuma
-- migração de schema necessária — só registramos o novo key como
-- documentação. A policy de app_settings já permite o write.
--
-- Se houver dúvida sobre o estado atual, rode:
--   select chave from app_settings where chave = 'empresa';
