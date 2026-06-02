-- =====================================================================
-- 2026-06-02 — Sincroniza config de colunas: os_status + separacao_etapas
--
-- Eram config local-only (personalização das colunas dos kanbans de OS e
-- Logística). Agora sincronizam, pra que a personalização apareça pra todos.
-- As tabelas já nascem POPULADAS com os status/etapas padrão, pra não
-- esvaziar os kanbans. 'on conflict do nothing' = não mexe no que já existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- os_status — colunas do kanban de Ordem de Serviço
-- ---------------------------------------------------------------------
create table if not exists public.os_status (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists os_status_criado_em_idx on public.os_status (criado_em);
alter table public.os_status enable row level security;
drop policy if exists "os_status_select_auth" on public.os_status;
create policy "os_status_select_auth" on public.os_status for select to authenticated using (true);
drop policy if exists "os_status_write_auth" on public.os_status;
create policy "os_status_write_auth" on public.os_status for all to authenticated using (true) with check (true);

insert into public.os_status (id, dados) values
  ('aberta',         '{"id":"aberta","label":"Aberta","cor":"#808080","icon":"📋","ordem":1,"padrao":true}'),
  ('agendada',       '{"id":"agendada","label":"Agendada","cor":"#0369a1","icon":"📅","ordem":2,"padrao":true}'),
  ('a_caminho',      '{"id":"a_caminho","label":"Técnico a caminho","cor":"#7c3aed","icon":"🛵","ordem":3,"padrao":true}'),
  ('em_atendimento', '{"id":"em_atendimento","label":"Em atendimento","cor":"#d97706","icon":"🔧","ordem":4,"padrao":true}'),
  ('pausada',        '{"id":"pausada","label":"Pausada","cor":"#ca8a04","icon":"⏸","ordem":5,"padrao":true}'),
  ('finalizada',     '{"id":"finalizada","label":"Finalizada","cor":"#2E7D32","icon":"✅","ordem":6,"padrao":true}'),
  ('cancelada',      '{"id":"cancelada","label":"Cancelada","cor":"#B0241F","icon":"✕","ordem":7,"padrao":true}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- separacao_etapas — colunas do pipeline de Logística
-- ---------------------------------------------------------------------
create table if not exists public.separacao_etapas (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists separacao_etapas_criado_em_idx on public.separacao_etapas (criado_em);
alter table public.separacao_etapas enable row level security;
drop policy if exists "separacao_etapas_select_auth" on public.separacao_etapas;
create policy "separacao_etapas_select_auth" on public.separacao_etapas for select to authenticated using (true);
drop policy if exists "separacao_etapas_write_auth" on public.separacao_etapas;
create policy "separacao_etapas_write_auth" on public.separacao_etapas for all to authenticated using (true) with check (true);

insert into public.separacao_etapas (id, dados) values
  ('aguardando_aprov', '{"id":"aguardando_aprov","label":"Aguardando financeiro","cor":"#808080","ordem":1,"padrao":true}'),
  ('aprovado',         '{"id":"aprovado","label":"Aprovado · iniciar","cor":"#1E4F8F","ordem":2,"padrao":true}'),
  ('em_separacao',     '{"id":"em_separacao","label":"Em separação","cor":"#9A6A0A","ordem":3,"padrao":true}'),
  ('separado',         '{"id":"separado","label":"Separado · embalar","cor":"#9A6A0A","ordem":4,"padrao":true}'),
  ('em_embalagem',     '{"id":"em_embalagem","label":"Em embalagem","cor":"#1E4F8F","ordem":5,"padrao":true}'),
  ('armazenado',       '{"id":"armazenado","label":"Armazenado · NF","cor":"#1E4F8F","ordem":6,"padrao":true}'),
  ('nf_emitida',       '{"id":"nf_emitida","label":"NF emitida · expedir","cor":"#2E7D32","ordem":7,"padrao":true}')
on conflict (id) do nothing;
