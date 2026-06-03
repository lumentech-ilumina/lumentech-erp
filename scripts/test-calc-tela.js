// Testa a lógica REAL da Calculadora de Tela Tensionada.
// Extrai as funções do lumentech-erp.html (do bloco do módulo) e roda asserts
// contra a especificação. Rodar: node scripts/test-calc-tela.js
const fs = require('fs');
const path = require('path');

let falhas = 0;
function quase(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.01 : tol); }
function assert(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FALHOU: ' + msg); falhas++; }
}

// Extrai o trecho do módulo (puro o suficiente: só definimos funções e chamamos as puras)
const html = fs.readFileSync(path.join(__dirname, '..', 'lumentech-erp.html'), 'utf8');
const ini = html.indexOf('let _calcTela = null;');
const fim = html.indexOf('const MENU_GRUPOS = [');
if (ini < 0 || fim < 0 || fim <= ini) { console.log('❌ Não localizei o bloco do módulo no HTML'); process.exit(1); }
const bloco = html.slice(ini, fim);

const teste = `
;(function(){
  console.log('\\n=== Exemplo trabalhado (confere cada fórmula da especificação) ===');
  const s = {
    tela:     { qtd: 10, custo: 50, venda: 120 },
    aluminio: { qtd: 20, custo: 15, venda: 30 },
    pvc:      { qtd: 5,  custo: 8,  venda: 18 },
    baguete:  { qtd: 12, custo: 6,  venda: 14 },
    maoObra:  { horasPorM2: 0.5, valorHora: 40 },
    comissaoPct: 5, margemDesejadaPct: 30,
  };
  const r = _calcTelaCompute(s);
  assert(quase(r.area, 10), 'Área total = 10 m²');
  assert(quase(r.metrosPerfis, 37), 'Metros de perfis = 20+5+12 = 37 m');
  assert(quase(r.horasTotais, 5), 'Horas totais = 10 × 0,5 = 5 h');
  assert(quase(r.custoMaoObra, 200), 'Custo mão de obra = 5 × 40 = R$ 200');
  assert(quase(r.custoMateriais, 912), 'Custo materiais = 500+300+40+72 = R$ 912');
  assert(quase(r.custoTotal, 1112), 'Custo total = 912+200 = R$ 1.112');
  assert(quase(r.vendaBruta, 2058), 'Venda bruta = 1200+600+90+168 = R$ 2.058');
  assert(quase(r.comissao, 102.9), 'Comissão = 2058 × 5% = R$ 102,90');
  assert(quase(r.lucroBruto, 946), 'Lucro bruto = 2058 − 1112 = R$ 946');
  assert(quase(r.lucroLiquido, 843.1), 'Lucro líquido = 946 − 102,90 = R$ 843,10');
  assert(quase(r.margemReal, 40.96, 0.05), 'Margem real ≈ 40,96%');
  assert(quase(r.precoSugerido, 1710.77, 0.05), 'Preço sugerido p/ 30% = 1112 / 0,65 ≈ R$ 1.710,77');

  console.log('\\n=== Indicadores de cor (verde > 30, âmbar 15–30, vermelho < 15) ===');
  assert(_calcTelaCorMargem(40).cor === '#1D9E75', '40% → verde');
  assert(_calcTelaCorMargem(20).cor === '#BA7517', '20% → âmbar');
  assert(_calcTelaCorMargem(10).cor === '#B0241F', '10% → vermelho');
  assert(_calcTelaCorMargem(30).cor === '#1D9E75', '30% exatos → verde (limite)');
  assert(_calcTelaCorMargem(15).cor === '#BA7517', '15% exatos → âmbar (limite)');

  console.log('\\n=== Robustez: vazio / divisão por zero ===');
  const z = _calcTelaCompute(_calcTelaNovo());
  assert(z.margemReal === 0 && z.vendaBruta === 0, 'sem dados: margem 0, sem NaN');
  assert(z.precoSugerido === null || isFinite(z.precoSugerido), 'preço sugerido não vira NaN/Infinito');

  console.log('\\n=== Margem desejada inviável (comissão+margem ≥ 100%) não quebra ===');
  const inv = _calcTelaCompute(Object.assign(_calcTelaNovo(), { tela:{qtd:1,custo:10,venda:20}, comissaoPct: 60, margemDesejadaPct: 50 }));
  assert(inv.precoSugerido === null, 'denominador ≤ 0 → preço sugerido null (sem número negativo)');
})();
`;

eval(bloco + teste);

console.log('\n' + (falhas === 0 ? '✅ TODOS OS CÁLCULOS CONFEREM' : `❌ ${falhas} verificação(ões) falharam`));
process.exit(falhas === 0 ? 0 : 1);
