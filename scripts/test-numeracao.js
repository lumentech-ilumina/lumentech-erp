// Teste do nextId auto-curável (carrega o db.js REAL em Node).
// Prova que números NUNCA repetem, mesmo com contador regredido ou IDs vindos de
// outro dispositivo. Rodar: node scripts/test-numeracao.js
const fs = require('fs');
const path = require('path');

let falhas = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FALHOU: ' + msg); falhas++; }
}

// Stubs mínimos p/ carregar db.js
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.window = {};

// Carrega db.js + roda os testes no MESMO escopo (eval direto enxerga nextId/DB)
const dbSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8');

const teste = `
;(function runTests(){
  console.log('\\n=== CENÁRIO A — contador regrediu (servidor antigo) mas já existem IDs altos ===');
  DB.produtos = [{id:'10'},{id:'11'},{id:'12'}];
  DB.counters.prod = 5;            // contador voltou atrás (bug do app_settings)
  const idA = nextId('prod','PRD');
  assert(Number(idA) > 12, 'nextId pula pra frente do maior ID existente (gerou ' + idA + ', > 12)');
  assert(!DB.produtos.some(p => p.id === idA), 'ID gerado NÃO colide com nenhum existente');

  console.log('\\n=== CENÁRIO B — 100 criações seguidas nunca repetem ===');
  DB.produtos = [];
  DB.counters.prod = 1;
  const vistos = new Set();
  let repetiu = false;
  for (let i=0;i<100;i++){ const id = nextId('prod','PRD'); if (vistos.has(id)) repetiu = true; vistos.add(id); DB.produtos.push({id}); }
  assert(!repetiu && vistos.size === 100, '100 IDs únicos, zero repetição');

  console.log('\\n=== CENÁRIO C — contador regride NO MEIO da sessão (auto-refresh 60s) ===');
  // emite alguns, regride o counter (como se o bootstrap puxasse um servidor menor),
  // e confirma que NÃO repete graças ao high-water mark de sessão.
  DB.pedidos = [];
  DB.counters.ped = 1;
  const a = nextId('ped','PED');   // 1
  const b = nextId('ped','PED');   // 2
  DB.counters.ped = 1;             // REGRESSÃO forçada
  const c = nextId('ped','PED');   // não pode ser 1 nem 2
  assert(c !== a && c !== b, 'após regressão do contador, novo número não repete (' + a + ',' + b + ' -> ' + c + ')');

  console.log('\\n=== CENÁRIO D — orçamentos com IDs prefixados/mistos ===');
  DB.orcamentos = [{id:'7'},{id:'8'}];
  DB.counters.orc = 2;
  const o = nextId('orc','ORC');
  assert(Number(o) > 8, 'orçamento pula pra frente do maior existente (' + o + ')');

  console.log('\\n=== CENÁRIO E — SKU (nextNum) acompanha o maior SKU em uso (campo != id) ===');
  DB.produtos = [{id:'1', sku:'ILU-0050'},{id:'2', sku:'ELE-0051'}];
  DB.counters.sku = 3;                 // contador atrás dos SKUs existentes
  const n1 = nextNum('sku');
  assert(n1 > 51, 'SKU não reusa: pula pra frente do maior em uso (gerou ' + n1 + ', > 51)');

  console.log('\\n=== CENÁRIO F — gerar SKU (preview) reserva o número: 2 cliques não repetem ===');
  const p1 = nextNum('sku');
  const p2 = nextNum('sku');
  assert(p1 !== p2 && p2 === p1 + 1, 'cliques consecutivos geram números distintos (' + p1 + ' != ' + p2 + ')');
  // E o produto salvo a seguir também não pega um já usado:
  DB.produtos.push({id:'3', sku:'PRD-' + String(p1).padStart(4,'0')});
  const p3 = nextNum('sku');
  assert(p3 > p1 && p3 > p2, 'próximo SKU após salvar não colide (' + p3 + ')');
})();
`;

eval(dbSrc + teste);

console.log('\n' + (falhas === 0 ? '✅ TODOS OS CENÁRIOS PASSARAM' : `❌ ${falhas} cenário(s) falharam`));
process.exit(falhas === 0 ? 0 : 1);
