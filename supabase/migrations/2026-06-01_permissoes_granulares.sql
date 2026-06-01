-- =====================================================================
-- 2026-06-01 — Permissões GRANULARES por entidade
--
-- As permissões deixaram de ser por "módulo agrupado" (cadastros, expedicao,
-- financeiro...) e passaram a ser por ENTIDADE (transportadoras, contas-pagar,
-- log-separacao, etc). Esta migration adapta o lado servidor:
--
--   1. usuario_tem_acesso(modulo, acao) ganha HERANÇA filho → pai: se o perfil
--      ainda não tem a chave granular (perfil legado), cai na chave agrupada
--      antiga. Assim ninguém perde acesso antes de o admin reconfigurar.
--   2. As policies de contas_pagar / contas_receber passam a checar as chaves
--      granulares 'contas-pagar' / 'contas-receber' (antes: 'financeiro').
--
-- As demais policies (pedidos, orcamentos, os_servicos, notas, usuarios) já
-- usam chaves que continuam existindo iguais — não precisam mudar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Função com herança filho → pai
-- ---------------------------------------------------------------------
create or replace function public.usuario_tem_acesso(modulo text, acao text default 'ver')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin     boolean;
  v_perfil_id text;
  v_perm      jsonb;
  v_pai       text;
begin
  -- Admin sempre passa
  select coalesce(u.admin, false), u.perfil_id
    into v_admin, v_perfil_id
    from public.usuarios u
    where u.id = auth.uid();

  if v_admin is true then return true; end if;
  if v_perfil_id is null then return false; end if;

  -- 1) Chave granular direta
  select p.permissoes -> modulo
    into v_perm
    from public.perfis_acesso p
    where p.id = v_perfil_id;

  -- 2) Herança: perfil legado só tem a chave agrupada (pai)
  if v_perm is null then
    v_pai := case modulo
      when 'contas-pagar'      then 'financeiro'
      when 'contas-receber'    then 'financeiro'
      when 'centros-custo'     then 'financeiro'
      when 'fin-creditos'      then 'financeiro'
      when 'comissao'          then 'financeiro'
      when 'fluxo-caixa'       then 'financeiro'
      when 'dre'               then 'financeiro'
      when 'transportadoras'   then 'cadastros'
      when 'motoristas'        then 'cadastros'
      when 'veiculos'          then 'cadastros'
      when 'vendedores'        then 'cadastros'
      when 'ambientes'         then 'cadastros'
      when 'marcas'            then 'cadastros'
      when 'log-separacao'     then 'expedicao'
      when 'log-pendencias'    then 'expedicao'
      when 'log-armazenado'    then 'expedicao'
      when 'log-expedicao'     then 'expedicao'
      when 'prestacao-contas'  then 'expedicao'
      when 'trocas'            then 'pedidos'
      when 'devolucoes'        then 'pedidos'
      when 'creditos'          then 'pedidos'
      when 'sup-ordens-compra' then 'fornecedores'
      when 'sup-followup'      then 'fornecedores'
      when 'sup-patrimonio'    then 'fornecedores'
      when 'vendas-ext'        then 'crm'
      else null
    end;

    if v_pai is not null then
      select p.permissoes -> v_pai
        into v_perm
        from public.perfis_acesso p
        where p.id = v_perfil_id;
    end if;
  end if;

  if v_perm is null then return false; end if;
  return coalesce((v_perm ->> acao)::boolean, false);
end;
$$;

grant execute on function public.usuario_tem_acesso(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. contas_pagar → chave granular 'contas-pagar'
-- ---------------------------------------------------------------------
drop policy if exists "contas_pagar_select_perfil" on public.contas_pagar;
drop policy if exists "contas_pagar_insert_perfil" on public.contas_pagar;
drop policy if exists "contas_pagar_update_perfil" on public.contas_pagar;
drop policy if exists "contas_pagar_delete_perfil" on public.contas_pagar;

create policy "contas_pagar_select_perfil"
  on public.contas_pagar for select
  to authenticated using (public.usuario_tem_acesso('contas-pagar','ver'));

create policy "contas_pagar_insert_perfil"
  on public.contas_pagar for insert
  to authenticated with check (public.usuario_tem_acesso('contas-pagar','criar'));

create policy "contas_pagar_update_perfil"
  on public.contas_pagar for update
  to authenticated
  using  (public.usuario_tem_acesso('contas-pagar','editar'))
  with check (public.usuario_tem_acesso('contas-pagar','editar'));

create policy "contas_pagar_delete_perfil"
  on public.contas_pagar for delete
  to authenticated using (public.usuario_tem_acesso('contas-pagar','excluir'));


-- ---------------------------------------------------------------------
-- 3. contas_receber → chave granular 'contas-receber'
-- ---------------------------------------------------------------------
drop policy if exists "contas_receber_select_perfil" on public.contas_receber;
drop policy if exists "contas_receber_insert_perfil" on public.contas_receber;
drop policy if exists "contas_receber_update_perfil" on public.contas_receber;
drop policy if exists "contas_receber_delete_perfil" on public.contas_receber;

create policy "contas_receber_select_perfil"
  on public.contas_receber for select
  to authenticated using (public.usuario_tem_acesso('contas-receber','ver'));

create policy "contas_receber_insert_perfil"
  on public.contas_receber for insert
  to authenticated with check (public.usuario_tem_acesso('contas-receber','criar'));

create policy "contas_receber_update_perfil"
  on public.contas_receber for update
  to authenticated
  using  (public.usuario_tem_acesso('contas-receber','editar'))
  with check (public.usuario_tem_acesso('contas-receber','editar'));

create policy "contas_receber_delete_perfil"
  on public.contas_receber for delete
  to authenticated using (public.usuario_tem_acesso('contas-receber','excluir'));


-- =====================================================================
-- TESTE DE FUMAÇA (rode logado como admin no SQL Editor com impersonação,
-- ou confie no app):
--   select public.usuario_tem_acesso('contas-pagar','ver');
-- Perfil legado com 'financeiro: ver' → true (herança).
-- Perfil granular com 'contas-pagar: ver' → true (direto).
-- =====================================================================
