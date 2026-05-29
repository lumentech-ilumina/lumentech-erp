-- =====================================================================
-- 2026-05-29 — RLS server-side por PERFIL DE ACESSO
--
-- Até aqui as policies do Supabase eram "authenticated using (true)" —
-- ou seja, qualquer usuário logado lê/escreve qualquer tabela. A proteção
-- por perfil estava só no client-side (JS) e podia ser burlada por um
-- usuário malicioso editando window.CURRENT_USER no console.
--
-- Esta migration eleva a proteção PRA O BANCO. Mesmo que o atacante
-- chame a API direto com a anon key, o Postgres bloqueia a query.
--
-- Padrão usado:
--   1. Função helper public.usuario_tem_acesso(modulo, acao) -> boolean
--      Faz lookup em public.usuarios + public.perfis_acesso e retorna
--      se o usuário corrente (auth.uid()) pode fazer aquela ação no
--      módulo. Admin (admin=true) sempre passa.
--   2. Policies usam a função em vez de "using (true)".
--
-- Tabelas blindadas nesta migration (as mais sensíveis):
--   - contas_pagar / contas_receber (módulo financeiro)
--   - pedidos      (módulo pedidos)
--   - orcamentos   (módulo orcamentos)
--   - os_servicos  (módulo os)
--   - notas        (módulo fiscal)
--   - usuarios     (módulo usuarios — só admin)
--   - perfis_acesso(módulo usuarios — só admin)
--
-- Failsafe: se a tabela usuarios não tiver o perfil_id correto pro auth.uid()
-- corrente (ex: usuário ainda não cadastrado no app), a função retorna
-- false → acesso negado. Logo, criar usuário no Supabase Auth E vincular
-- no app são passos OBRIGATÓRIOS pra funcionar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Função helper — usuario_tem_acesso(modulo text, acao text) → boolean
-- ---------------------------------------------------------------------
create or replace function public.usuario_tem_acesso(modulo text, acao text default 'ver')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    boolean;
  v_perfil_id text;
  v_perm     jsonb;
begin
  -- 1.1) Admin sempre passa
  select coalesce(u.admin, false), u.perfil_id
    into v_admin, v_perfil_id
    from public.usuarios u
    where u.id = auth.uid();

  if v_admin is true then return true; end if;
  if v_perfil_id is null then return false; end if;

  -- 1.2) Lookup nas permissoes do perfil
  select p.permissoes -> modulo
    into v_perm
    from public.perfis_acesso p
    where p.id = v_perfil_id;

  if v_perm is null then return false; end if;
  return coalesce((v_perm ->> acao)::boolean, false);
end;
$$;

grant execute on function public.usuario_tem_acesso(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. contas_pagar — módulo financeiro
-- ---------------------------------------------------------------------
drop policy if exists "contas_pagar_select_auth" on public.contas_pagar;
drop policy if exists "contas_pagar_write_auth"  on public.contas_pagar;

create policy "contas_pagar_select_perfil"
  on public.contas_pagar for select
  to authenticated using (public.usuario_tem_acesso('financeiro','ver'));

create policy "contas_pagar_insert_perfil"
  on public.contas_pagar for insert
  to authenticated with check (public.usuario_tem_acesso('financeiro','criar'));

create policy "contas_pagar_update_perfil"
  on public.contas_pagar for update
  to authenticated
  using  (public.usuario_tem_acesso('financeiro','editar'))
  with check (public.usuario_tem_acesso('financeiro','editar'));

create policy "contas_pagar_delete_perfil"
  on public.contas_pagar for delete
  to authenticated using (public.usuario_tem_acesso('financeiro','excluir'));


-- ---------------------------------------------------------------------
-- 3. contas_receber — módulo financeiro
-- ---------------------------------------------------------------------
drop policy if exists "contas_receber_select_auth" on public.contas_receber;
drop policy if exists "contas_receber_write_auth"  on public.contas_receber;

create policy "contas_receber_select_perfil"
  on public.contas_receber for select
  to authenticated using (public.usuario_tem_acesso('financeiro','ver'));

create policy "contas_receber_insert_perfil"
  on public.contas_receber for insert
  to authenticated with check (public.usuario_tem_acesso('financeiro','criar'));

create policy "contas_receber_update_perfil"
  on public.contas_receber for update
  to authenticated
  using  (public.usuario_tem_acesso('financeiro','editar'))
  with check (public.usuario_tem_acesso('financeiro','editar'));

create policy "contas_receber_delete_perfil"
  on public.contas_receber for delete
  to authenticated using (public.usuario_tem_acesso('financeiro','excluir'));


-- ---------------------------------------------------------------------
-- 4. pedidos
-- ---------------------------------------------------------------------
drop policy if exists "pedidos_select_auth" on public.pedidos;
drop policy if exists "pedidos_write_auth"  on public.pedidos;

create policy "pedidos_select_perfil"
  on public.pedidos for select
  to authenticated using (public.usuario_tem_acesso('pedidos','ver'));

create policy "pedidos_insert_perfil"
  on public.pedidos for insert
  to authenticated with check (public.usuario_tem_acesso('pedidos','criar'));

create policy "pedidos_update_perfil"
  on public.pedidos for update
  to authenticated
  using  (public.usuario_tem_acesso('pedidos','editar'))
  with check (public.usuario_tem_acesso('pedidos','editar'));

create policy "pedidos_delete_perfil"
  on public.pedidos for delete
  to authenticated using (public.usuario_tem_acesso('pedidos','excluir'));


-- ---------------------------------------------------------------------
-- 5. orcamentos
-- ---------------------------------------------------------------------
drop policy if exists "orcamentos_select_auth" on public.orcamentos;
drop policy if exists "orcamentos_write_auth"  on public.orcamentos;

create policy "orcamentos_select_perfil"
  on public.orcamentos for select
  to authenticated using (public.usuario_tem_acesso('orcamentos','ver'));

create policy "orcamentos_insert_perfil"
  on public.orcamentos for insert
  to authenticated with check (public.usuario_tem_acesso('orcamentos','criar'));

create policy "orcamentos_update_perfil"
  on public.orcamentos for update
  to authenticated
  using  (public.usuario_tem_acesso('orcamentos','editar'))
  with check (public.usuario_tem_acesso('orcamentos','editar'));

create policy "orcamentos_delete_perfil"
  on public.orcamentos for delete
  to authenticated using (public.usuario_tem_acesso('orcamentos','excluir'));


-- ---------------------------------------------------------------------
-- 6. os_servicos
-- ---------------------------------------------------------------------
drop policy if exists "os_servicos_select_auth" on public.os_servicos;
drop policy if exists "os_servicos_write_auth"  on public.os_servicos;

create policy "os_servicos_select_perfil"
  on public.os_servicos for select
  to authenticated using (public.usuario_tem_acesso('os','ver'));

create policy "os_servicos_insert_perfil"
  on public.os_servicos for insert
  to authenticated with check (public.usuario_tem_acesso('os','criar'));

create policy "os_servicos_update_perfil"
  on public.os_servicos for update
  to authenticated
  using  (public.usuario_tem_acesso('os','editar'))
  with check (public.usuario_tem_acesso('os','editar'));

create policy "os_servicos_delete_perfil"
  on public.os_servicos for delete
  to authenticated using (public.usuario_tem_acesso('os','excluir'));


-- ---------------------------------------------------------------------
-- 7. notas (fiscal)
-- ---------------------------------------------------------------------
drop policy if exists "notas_select_auth" on public.notas;
drop policy if exists "notas_write_auth"  on public.notas;

create policy "notas_select_perfil"
  on public.notas for select
  to authenticated using (public.usuario_tem_acesso('fiscal','ver'));

create policy "notas_insert_perfil"
  on public.notas for insert
  to authenticated with check (public.usuario_tem_acesso('fiscal','criar'));

create policy "notas_update_perfil"
  on public.notas for update
  to authenticated
  using  (public.usuario_tem_acesso('fiscal','editar'))
  with check (public.usuario_tem_acesso('fiscal','editar'));

create policy "notas_delete_perfil"
  on public.notas for delete
  to authenticated using (public.usuario_tem_acesso('fiscal','excluir'));


-- ---------------------------------------------------------------------
-- 8. usuarios — só admin pode gerenciar usuários, mas qualquer um vê o próprio
-- ---------------------------------------------------------------------
-- As policies originais de usuarios já existem; vamos só substituir as de write.

drop policy if exists "usuarios_update_self" on public.usuarios;
create policy "usuarios_update_self"
  on public.usuarios for update
  to authenticated
  using ( id = auth.uid() OR public.usuario_tem_acesso('usuarios','editar') )
  with check ( id = auth.uid() OR public.usuario_tem_acesso('usuarios','editar') );

drop policy if exists "usuarios_insert_admin" on public.usuarios;
create policy "usuarios_insert_admin"
  on public.usuarios for insert
  to authenticated with check (public.usuario_tem_acesso('usuarios','criar'));

drop policy if exists "usuarios_delete_admin" on public.usuarios;
create policy "usuarios_delete_admin"
  on public.usuarios for delete
  to authenticated using (public.usuario_tem_acesso('usuarios','excluir'));


-- ---------------------------------------------------------------------
-- 9. perfis_acesso — só admin
-- ---------------------------------------------------------------------
drop policy if exists "perfis_acesso_write_auth" on public.perfis_acesso;
drop policy if exists "perfis_acesso_insert_admin" on public.perfis_acesso;
drop policy if exists "perfis_acesso_update_admin" on public.perfis_acesso;
drop policy if exists "perfis_acesso_delete_admin" on public.perfis_acesso;

create policy "perfis_acesso_insert_admin"
  on public.perfis_acesso for insert
  to authenticated with check (public.usuario_tem_acesso('usuarios','criar'));

create policy "perfis_acesso_update_admin"
  on public.perfis_acesso for update
  to authenticated
  using  (public.usuario_tem_acesso('usuarios','editar'))
  with check (public.usuario_tem_acesso('usuarios','editar'));

create policy "perfis_acesso_delete_admin"
  on public.perfis_acesso for delete
  to authenticated using (public.usuario_tem_acesso('usuarios','excluir'));


-- =====================================================================
-- TESTE DE FUMAÇA
-- Depois de rodar, abra o painel SQL e teste:
--   select public.usuario_tem_acesso('financeiro','ver');
-- Logado como admin: true.
-- Logado como vendedor: false (porque o perfil 'pf_vendedor' tem financeiro: nenhuma).
-- =====================================================================
