-- =====================================================================
-- 2026-06-02 — BLINDAGEM RLS TOTAL
--
-- Objetivo: garantir que NENHUMA tabela do schema public fique acessível
-- sem login (a chave publishable é exposta por design — quem protege é a RLS).
--
-- O que faz, de forma idempotente e SEM quebrar o app:
--   1. Liga Row Level Security (RLS) em TODA tabela do schema public.
--   2. Em tabelas que ainda NÃO têm nenhuma policy, cria uma baseline que
--      exige usuário autenticado (login). NÃO toca nas tabelas que já têm
--      policies (ex.: as financeiras/usuarios já têm RLS por perfil).
--
-- Resultado: dados deixam de ser acessíveis por usuários anônimos / pela
-- chave pública sem login. As policies estritas por perfil (financeiro,
-- usuários, pedidos, etc.) continuam intactas.
--
-- Importante: combine com DESLIGAR o cadastro público no painel
-- (Authentication > Sign In/Providers > Email > "Allow new users to sign up"),
-- pra que "autenticado" signifique apenas funcionários.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    -- 1) Liga RLS (no-op se já estiver ligada)
    execute format('alter table public.%I enable row level security', r.tablename);

    -- 2) Se a tabela não tem NENHUMA policy, cria baseline "somente autenticado".
    --    (Não sobrescreve tabelas que já têm policy por perfil.)
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = r.tablename
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        r.tablename || '_auth_baseline', r.tablename
      );
      raise notice 'Baseline autenticado criada em: %', r.tablename;
    end if;
  end loop;
end $$;

-- =====================================================================
-- DIAGNÓSTICO — rode pra conferir que TODAS as tabelas estão com RLS ligada
-- (rls_ativa deve ser true em todas; policies >= 1 em todas):
--
--   select tablename, rowsecurity as rls_ativa,
--          (select count(*) from pg_policies p
--             where p.schemaname='public' and p.tablename=t.tablename) as policies
--   from pg_tables t
--   where schemaname='public'
--   order by rls_ativa, tablename;
-- =====================================================================
