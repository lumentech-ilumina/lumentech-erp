// Teste do bootstrap não-destrutivo (carrega o repo.js REAL em Node).
// Reproduz "cadastra produto e some depois" e prova que agora o registro local
// pendente de sync sobrevive ao bootstrap (login + auto-refresh de 60s).
//
// Rodar:  node scripts/test-bootstrap-sync.js
const fs = require('fs');
const path = require('path');

let falhas = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.log('  ✗ FALHOU: ' + msg); falhas++; }
}

// ---- Servidor falso (estado persistente entre bootstraps) ----
const server = {
  usuarios: [{ id: 'usu_admin', nome: 'Ronyel', email: 'r@x.io', admin: true, perfil_id: 'pf_admin', ativo: true, criado_em: '2026-01-01' }],
  perfis_acesso: [{ id: 'pf_admin', nome: 'Admin', permissoes: {}, criado_em: '2026-01-01' }],
  logs_acesso: [],
  app_settings: [],
};
// tabelas que devem lançar erro no SELECT (simula tabela ausente / rede caída)
let tabelasComErro = new Set();

function jsonbRows(tbl) {
  return (server[tbl] || []).map(r =>
    r.dados !== undefined ? r : { id: r.id, dados: r }
  );
}

// Query builder thenable, imitando o PostgrestBuilder do supabase-js.
function makeBuilder(tbl) {
  const b = {
    _filterIn: null,
    select() { return b; },
    order() { return b; },
    limit() { return b; },
    eq() { return b; },
    gte() { return b; },
    in(_col, vals) { b._filterIn = vals; return b; },
    single() { b._single = true; return b; },
    async upsert(rows) {
      if (!server[tbl]) server[tbl] = [];
      const arr = Array.isArray(rows) ? rows : [rows];
      for (const row of arr) {
        const idx = server[tbl].findIndex(x => String(x.id) === String(row.id));
        if (idx >= 0) server[tbl][idx] = row; else server[tbl].push(row);
      }
      return { data: arr, error: null };
    },
    async delete() {
      // delete().in('id', [...]) — devolve um objeto com .in que aplica
      return {
        in(_col, vals) {
          server[tbl] = (server[tbl] || []).filter(x => !vals.includes(String(x.id)));
          return Promise.resolve({ error: null });
        },
        gte() { server[tbl] = []; return Promise.resolve({ error: null }); },
      };
    },
    then(resolve) {
      if (tabelasComErro.has(tbl)) {
        // erro de REDE genérico (não casa com o regex de "tabela ausente") — é o caso
        // silencioso que ANTES apagava os dados locais.
        return resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } });
      }
      let data;
      if (tbl === 'usuarios' || tbl === 'perfis_acesso' || tbl === 'logs_acesso' || tbl === 'app_settings') {
        data = server[tbl] || [];
      } else {
        data = jsonbRows(tbl); // {id, dados}
      }
      return resolve({ data, error: null });
    },
  };
  return b;
}

const fakeClient = {
  from(tbl) { return makeBuilder(tbl); },
  rpc() { return Promise.resolve({ data: null, error: null }); },
  functions: { invoke() { return Promise.resolve({ data: null, error: null }); } },
};

// ---- Ambiente global mínimo p/ carregar repo.js ----
global.window = {
  _listeners: {},
  addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
  supabaseClient: fakeClient,
  CURRENT_USER: { id: 'usu_admin' },
};
global.navigator = { userAgent: 'node-test' };
global.window.saveDB = function () { return true; }; // saveDB local (no-op no teste)

// Carrega o repo.js REAL
const repoSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'repo.js'), 'utf8');
eval(repoSrc); // define window.repo
const repo = global.window.repo;

// Helper: roda bootstrap e devolve os ids de produtos resultantes
async function bootstrapEReadProdutos() {
  await repo.bootstrap();
  return (global.window.DB.produtos || []).map(p => String(p.id)).sort();
}

(async () => {
  console.log('\n=== CENÁRIO A — cadastra produto, sync ainda não subiu, bootstrap NÃO pode apagar ===');
  // Login fresco: servidor sem produtos; usuário acabou de cadastrar localmente.
  server.produtos = []; // sync nunca chegou ao servidor
  global.window.DB = { produtos: [{ id: '1', nome: 'Lustre Cristal' }] };
  let ids = await bootstrapEReadProdutos();
  assert(ids.includes('1'), 'produto recém-criado sobrevive ao bootstrap de login (antes era apagado)');

  console.log('\n=== CENÁRIO B — auto-refresh (60s) rodando enquanto 2º produto é criado ===');
  // 1º produto já está no servidor; usuário cria o 2º; auto-refresh dispara bootstrap.
  server.produtos = [{ id: '1', nome: 'Lustre Cristal' }];
  global.window.DB.produtos = [
    { id: '1', nome: 'Lustre Cristal' },
    { id: '2', nome: 'Pendente novo' },   // criado local, ainda não sincronizado
  ];
  ids = await bootstrapEReadProdutos();
  assert(ids.includes('1') && ids.includes('2'), 'os DOIS produtos sobrevivem (pendente local preservado)');

  console.log('\n=== CENÁRIO C — produto deletado em OUTRO dispositivo NÃO ressuscita ===');
  // Primeiro o servidor PASSA a conhecer 1 e 2 (bootstrap registra _serverIds={1,2})...
  server.produtos = [{ id: '1', nome: 'Lustre Cristal' }, { id: '2', nome: 'Pendente novo' }];
  global.window.DB.produtos = [{ id: '1', nome: 'Lustre Cristal' }, { id: '2', nome: 'Pendente novo' }];
  await repo.bootstrap();
  // ...agora outro dispositivo DELETA o 2 no servidor; local ainda tem os dois.
  server.produtos = [{ id: '1', nome: 'Lustre Cristal' }];
  global.window.DB.produtos = [{ id: '1', nome: 'Lustre Cristal' }, { id: '2', nome: 'Pendente novo' }];
  ids = await bootstrapEReadProdutos();
  assert(ids.includes('1') && !ids.includes('2'), 'delete remoto é respeitado (2 some, sem ressuscitar)');

  console.log('\n=== CENÁRIO D — produto pendente realmente SOBE pro servidor no próximo sync ===');
  server.produtos = [];
  global.window.DB.produtos = [{ id: '7', nome: 'Vai subir' }];
  await repo.bootstrap();           // preserva o pendente
  await repo.sync.all();            // dispara o upsert
  const noServidor = (server.produtos || []).map(r => String(r.id));
  assert(noServidor.includes('7'), 'produto pendente foi enviado ao servidor (equipe enxerga)');

  console.log('\n=== CENÁRIO E — falha de carregamento (rede caída) NÃO apaga local ===');
  // erro de REDE (não "tabela ausente") — não entra em _missingTables, mas também não pode apagar.
  tabelasComErro.add('produtos');
  global.window.DB.produtos = [{ id: '9', nome: 'Só existe local' }];
  ids = await bootstrapEReadProdutos();
  assert(ids.includes('9'), 'erro ao carregar produtos preserva o que estava em memória');
  tabelasComErro.delete('produtos');

  console.log('\n' + (falhas === 0
    ? '✅ TODOS OS CENÁRIOS PASSARAM'
    : `❌ ${falhas} cenário(s) falharam`));
  process.exit(falhas === 0 ? 0 : 1);
})();
