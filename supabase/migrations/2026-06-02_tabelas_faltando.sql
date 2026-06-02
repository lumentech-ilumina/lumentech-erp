-- =====================================================================
-- 2026-06-02 — Tabelas que faltavam no Supabase (estavam só no localStorage)
--
-- Detectadas pela varredura: etapas_producao, motivos_devolucao,
-- segmentos_vendas (têm padrões → nascem populadas), pontos_comerciais e
-- visitas_campo (vazias). Padrão JSONB: (id text PK, dados jsonb, criado_em).
-- =====================================================================

-- helper: cria tabela jsonb + RLS authenticated
-- (repetido inline por tabela pra ser idempotente e explícito)

-- ---------------------------------------------------------------------
-- etapas_producao (kanban de Produção) — populada
-- ---------------------------------------------------------------------
create table if not exists public.etapas_producao (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
alter table public.etapas_producao enable row level security;
drop policy if exists "etapas_producao_select_auth" on public.etapas_producao;
create policy "etapas_producao_select_auth" on public.etapas_producao for select to authenticated using (true);
drop policy if exists "etapas_producao_write_auth" on public.etapas_producao;
create policy "etapas_producao_write_auth" on public.etapas_producao for all to authenticated using (true) with check (true);
insert into public.etapas_producao (id, dados) values
  ('ep_aguard_sep',  '{"id":"ep_aguard_sep","nome":"Aguardando separação","cor":"#808080","ordem":1,"padrao":true}'),
  ('ep_aguard_oper', '{"id":"ep_aguard_oper","nome":"Aguardando operador","cor":"#9A6A0A","ordem":2,"padrao":true}'),
  ('ep_em_prod',     '{"id":"ep_em_prod","nome":"Em produção","cor":"#1E4F8F","ordem":3,"padrao":true}'),
  ('ep_inspecao',    '{"id":"ep_inspecao","nome":"Inspeção","cor":"#7C3AED","ordem":4,"padrao":true}'),
  ('ep_embalagem',   '{"id":"ep_embalagem","nome":"Embalagem","cor":"#0369A1","ordem":5,"padrao":true}'),
  ('ep_armazenado',  '{"id":"ep_armazenado","nome":"Armazenado","cor":"#2E7D32","ordem":6,"padrao":true}'),
  ('ep_entregue',    '{"id":"ep_entregue","nome":"Entregue","cor":"#2E7D32","ordem":7,"padrao":true}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- motivos_devolucao — populada
-- ---------------------------------------------------------------------
create table if not exists public.motivos_devolucao (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
alter table public.motivos_devolucao enable row level security;
drop policy if exists "motivos_devolucao_select_auth" on public.motivos_devolucao;
create policy "motivos_devolucao_select_auth" on public.motivos_devolucao for select to authenticated using (true);
drop policy if exists "motivos_devolucao_write_auth" on public.motivos_devolucao;
create policy "motivos_devolucao_write_auth" on public.motivos_devolucao for all to authenticated using (true) with check (true);
insert into public.motivos_devolucao (id, dados) values
  ('md_arrependi',   '{"id":"md_arrependi","nome":"Arrependimento do cliente","padrao":true}'),
  ('md_defeito',     '{"id":"md_defeito","nome":"Defeito de fabricação","padrao":true}'),
  ('md_dano_trans',  '{"id":"md_dano_trans","nome":"Dano em transporte","padrao":true}'),
  ('md_incorreto',   '{"id":"md_incorreto","nome":"Produto incorreto enviado","padrao":true}'),
  ('md_divergencia', '{"id":"md_divergencia","nome":"Divergência de pedido","padrao":true}'),
  ('md_atraso',      '{"id":"md_atraso","nome":"Atraso na entrega","padrao":true}'),
  ('md_dimensoes',   '{"id":"md_dimensoes","nome":"Dimensões fora do esperado","padrao":true}'),
  ('md_qualidade',   '{"id":"md_qualidade","nome":"Qualidade abaixo do esperado","padrao":true}'),
  ('md_duplicidade', '{"id":"md_duplicidade","nome":"Pedido em duplicidade","padrao":true}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- segmentos_vendas (Vendas Externas) — populada
-- ---------------------------------------------------------------------
create table if not exists public.segmentos_vendas (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
alter table public.segmentos_vendas enable row level security;
drop policy if exists "segmentos_vendas_select_auth" on public.segmentos_vendas;
create policy "segmentos_vendas_select_auth" on public.segmentos_vendas for select to authenticated using (true);
drop policy if exists "segmentos_vendas_write_auth" on public.segmentos_vendas;
create policy "segmentos_vendas_write_auth" on public.segmentos_vendas for all to authenticated using (true) with check (true);
insert into public.segmentos_vendas (id, dados) values
  ('seg_iluminacao', '{"id":"seg_iluminacao","nome":"Iluminação","categorias":["Lojas de iluminação","Distribuidores","Atacadistas","Showrooms"]}'),
  ('seg_construcao',  '{"id":"seg_construcao","nome":"Construção civil","categorias":["Construtoras","Empreiteiras","Materiais de construção","Engenharia"]}'),
  ('seg_industria',   '{"id":"seg_industria","nome":"Indústrias","categorias":["Fábricas","Galpões","Plantas industriais"]}'),
  ('seg_varejo',      '{"id":"seg_varejo","nome":"Varejo","categorias":["Lojas","Comércio em geral","Franquias"]}'),
  ('seg_arquitetura', '{"id":"seg_arquitetura","nome":"Arquitetura","categorias":["Escritórios de arquitetura","Designers"]}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- pontos_comerciais (Vendas Externas) — vazia
-- ---------------------------------------------------------------------
create table if not exists public.pontos_comerciais (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
create index if not exists pontos_comerciais_criado_em_idx on public.pontos_comerciais (criado_em);
alter table public.pontos_comerciais enable row level security;
drop policy if exists "pontos_comerciais_select_auth" on public.pontos_comerciais;
create policy "pontos_comerciais_select_auth" on public.pontos_comerciais for select to authenticated using (true);
drop policy if exists "pontos_comerciais_write_auth" on public.pontos_comerciais;
create policy "pontos_comerciais_write_auth" on public.pontos_comerciais for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- visitas_campo (Vendas Externas) — vazia
-- ---------------------------------------------------------------------
create table if not exists public.visitas_campo (
  id text primary key, dados jsonb not null, criado_em timestamptz not null default now()
);
create index if not exists visitas_campo_criado_em_idx on public.visitas_campo (criado_em);
alter table public.visitas_campo enable row level security;
drop policy if exists "visitas_campo_select_auth" on public.visitas_campo;
create policy "visitas_campo_select_auth" on public.visitas_campo for select to authenticated using (true);
drop policy if exists "visitas_campo_write_auth" on public.visitas_campo;
create policy "visitas_campo_write_auth" on public.visitas_campo for all to authenticated using (true) with check (true);
