-- =====================================================================
-- 2026-06-02 — Tabela metas_comerciais (Metas Comerciais passam a ser compartilhadas)
--
-- As metas (mensais e anual mês a mês) eram salvas só no localStorage de quem
-- definia — por isso a equipe não via. Agora sincronizam: o gerente define e
-- todos enxergam. Padrão JSONB: (id text PK, dados jsonb, criado_em).
-- =====================================================================

create table if not exists public.metas_comerciais (
  id          text primary key,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);
create index if not exists metas_comerciais_criado_em_idx on public.metas_comerciais (criado_em);

alter table public.metas_comerciais enable row level security;

drop policy if exists "metas_comerciais_select_auth" on public.metas_comerciais;
create policy "metas_comerciais_select_auth"
  on public.metas_comerciais for select to authenticated using (true);

drop policy if exists "metas_comerciais_write_auth" on public.metas_comerciais;
create policy "metas_comerciais_write_auth"
  on public.metas_comerciais for all to authenticated using (true) with check (true);
