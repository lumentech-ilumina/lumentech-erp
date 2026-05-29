-- =====================================================================
-- 2026-05-29 — Audit log granular
--
-- Trilha de auditoria pra rastrear quem fez o quê e quando.
-- Cobre as ações críticas: criar/editar/excluir/aprovar/cancelar nos
-- módulos financeiro, vendas, estoque, usuarios.
--
-- Estrutura:
--   - id          bigint serial (autoincrement, pra ordem temporal exata)
--   - usuario_id  uuid    referência ao usuario que executou
--   - usuario_nome text   redundância pra preservar histórico mesmo se
--                         o usuário for deletado
--   - acao        text    'criar' | 'editar' | 'excluir' | 'aprovar' | 'cancelar' | 'login' | etc
--   - entidade    text    'pedido' | 'orcamento' | 'os' | 'usuario' | etc
--   - entidade_id text    ID do registro afetado (pode ser id text ou uuid)
--   - resumo      text    descrição curta legível ('Aprovou pedido PED-42')
--   - dados       jsonb   diff completo (antes/depois) pra forense
--   - ip          text    captado quando possível
--   - user_agent  text    captado pra detectar fonte da ação
--   - criado_em   timestamptz
--
-- Padrão de retenção: nada deletado automaticamente. Admin pode arquivar
-- via UI quando necessário.
-- =====================================================================

create table if not exists public.auditoria_acoes (
  id            bigserial primary key,
  usuario_id    uuid,
  usuario_nome  text,
  acao          text not null,
  entidade      text not null,
  entidade_id   text,
  resumo        text,
  dados         jsonb,
  ip            text,
  user_agent    text,
  criado_em     timestamptz not null default now()
);

create index if not exists auditoria_acoes_criado_em_idx on public.auditoria_acoes (criado_em desc);
create index if not exists auditoria_acoes_usuario_idx   on public.auditoria_acoes (usuario_id, criado_em desc);
create index if not exists auditoria_acoes_entidade_idx  on public.auditoria_acoes (entidade, entidade_id, criado_em desc);
create index if not exists auditoria_acoes_acao_idx      on public.auditoria_acoes (acao);

alter table public.auditoria_acoes enable row level security;

-- Qualquer autenticado pode INSERIR (a aplicação loga em nome do usuário corrente).
-- Apenas ADMIN pode LER ou DELETAR. Updates não são permitidos (audit log é append-only).
drop policy if exists "auditoria_acoes_insert_auth" on public.auditoria_acoes;
create policy "auditoria_acoes_insert_auth"
  on public.auditoria_acoes for insert
  to authenticated with check (true);

drop policy if exists "auditoria_acoes_select_admin" on public.auditoria_acoes;
create policy "auditoria_acoes_select_admin"
  on public.auditoria_acoes for select
  to authenticated
  using (exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.admin = true
  ));

drop policy if exists "auditoria_acoes_delete_admin" on public.auditoria_acoes;
create policy "auditoria_acoes_delete_admin"
  on public.auditoria_acoes for delete
  to authenticated
  using (exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.admin = true
  ));

-- Sem policy de update — append-only.
