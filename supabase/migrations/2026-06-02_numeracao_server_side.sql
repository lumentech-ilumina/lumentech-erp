-- =====================================================================
-- 2026-06-02 — Numeração atômica server-side (NF e Romaneio)
--
-- Antes: DB.nfSequencia / DB.romaneioSeq eram contadores no localStorage de
-- cada usuário → dois usuários podiam gerar o MESMO número (colisão).
-- Agora: uma sequência no servidor entrega cada número uma única vez, de forma
-- atômica (lock de linha no UPDATE). Semeada a partir do maior número já usado
-- nos pedidos, pra nunca reemitir um número existente.
-- =====================================================================

create table if not exists public.numero_sequencias (
  tipo  text primary key,
  valor bigint not null
);

alter table public.numero_sequencias enable row level security;
-- Leitura liberada pra autenticados (consulta/diagnóstico). A escrita acontece
-- só pela função abaixo (security definer), nunca direto pelo cliente.
drop policy if exists "numero_sequencias_select_auth" on public.numero_sequencias;
create policy "numero_sequencias_select_auth"
  on public.numero_sequencias for select to authenticated using (true);

-- Semeia 'nf' com o maior nfNumero já presente em pedidos (ou 1000).
insert into public.numero_sequencias (tipo, valor)
values ('nf', greatest(1000, coalesce((
  select max((dados->>'nfNumero')::bigint)
  from public.pedidos
  where dados->>'nfNumero' ~ '^[0-9]+$'
), 1000)))
on conflict (tipo) do nothing;

-- Semeia 'romaneio' com o maior número já presente (formato ROM-000123).
insert into public.numero_sequencias (tipo, valor)
values ('romaneio', greatest(1000, coalesce((
  select max((substring(dados->'expedicao'->>'romaneio' from '[0-9]+$'))::bigint)
  from public.pedidos
  where dados->'expedicao'->>'romaneio' ~ 'ROM-[0-9]+'
), 1000)))
on conflict (tipo) do nothing;

-- Função atômica: incrementa e devolve o próximo número. O UPDATE pega lock da
-- linha, então chamadas concorrentes são serializadas — nunca repetem número.
create or replace function public.proximo_numero(p_tipo text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v bigint;
begin
  insert into public.numero_sequencias (tipo, valor)
    values (p_tipo, 1001)
    on conflict (tipo) do update set valor = public.numero_sequencias.valor + 1
    returning valor into v;
  return v;
end;
$$;

revoke all on function public.proximo_numero(text) from public, anon;
grant execute on function public.proximo_numero(text) to authenticated;
