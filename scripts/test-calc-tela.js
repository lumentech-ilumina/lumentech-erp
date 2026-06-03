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
  console.log('\\n=== Cost-plus: itens só custo → preço sai da margem ===');
  const s = {
    tela:     { qtd: 10, custo: 50 },   // 500
    aluminio: { qtd: 20, custo: 15 },   // 300
    pvc:      { qtd: 5,  custo: 8 },    // 40
    baguete:  { qtd: 12, custo: 6 },   // 72
    maoObra:  { horasPorM2: 0.5, valorHora: 40 },  // 5h × 40 = 200
    comissaoPct: 5, margemDesejadaPct: 30,
  };
  const r = _calcTelaCompute(s);
  assert(quase(r.area, 10), 'Área total = 10 m²');
  assert(quase(r.custoItens, 912), 'Custo dos itens = 500+300+40+72 = R$ 912');
  assert(quase(r.custoMaoObra, 200), 'Custo mão de obra = 5 × 40 = R$ 200');
  assert(quase(r.custoTotal, 1112), 'Custo total = 912+200 = R$ 1.112');
  assert(quase(r.precoVenda, 1710.77, 0.05), 'Preço de venda = 1112 / (1−0,05−0,30) = 1112/0,65 ≈ R$ 1.710,77');
  assert(quase(r.vendaBruta, r.precoVenda), 'Venda = preço calculado');
  assert(quase(r.comissao, 85.54, 0.05), 'Comissão = preço × 5% ≈ R$ 85,54');
  assert(quase(r.margemReal, 30, 0.05), 'Margem real = margem desejada = 30% (por construção)');
  assert(quase(r.lucroLiquido, 513.23, 0.1), 'Lucro líquido = preço − custo − comissão ≈ R$ 513,23');

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

  console.log('\\n=== Membranas + Sistema LED (estoque) + Serviço + Custo fixo (só custo) ===');
  const r2 = _calcTelaCompute({
    tela:     { qtd: 10, custo: 50 },  // 500
    impressa: { qtd: 5,  custo: 40 },  // 200
    linho:    { qtd: 0,  custo: 0 },
    custoFixo: 150,
    maoObra: { horasPorM2: 0, valorHora: 0 },
    temLed: true,
    led: { m2: 15, fundoCm: 5,
      fontes: [{ qtd: 2, custo: 30 }],   // 60
      fitas:  [{ qtd: 8, custo: 25 }] }, // 200
    temServico: true,
    servico: {
      cabo:     { qtd: 10, custo: 3 },   // 30
      parafuso: { qtd: 20, custo: 0.5 }, // 10
      maoObraM2: 20,        // 20 × área(15) = 300
      custosVariaveis: 80,
    },
    comissaoPct: 0, margemDesejadaPct: 20,
  });
  assert(quase(r2.area, 15), 'área total = membrana 10 + impressa 5 = 15 m²');
  assert(quase(r2.ledCusto, 260), 'LED custo = 60 (fontes) + 200 (fitas) = R$ 260');
  assert(quase(r2.custoMaoObraM2, 300), 'mão de obra por m² = 20 × 15 = R$ 300');
  assert(quase(r2.custoItens, 1000), 'custoItens = 700 (membranas) + 260 (LED) + 40 (cabo+parafuso) = R$ 1.000');
  assert(quase(r2.custoTotal, 1530), 'custo total = itens 1000 + moM² 300 + fixo 150 + variáveis 80 = R$ 1.530');
  assert(quase(r2.precoVenda, 1912.5, 0.1), 'preço de venda = 1530 / (1−0,20) = R$ 1.912,50');
  assert(quase(r2.margemReal, 20, 0.05), 'margem real = 20% (margem desejada)');
  const off = _calcTelaCompute({ tela:{qtd:10,custo:50}, led:{fitas:[{qtd:99,custo:99}]}, servico:{maoObraM2:99,custosVariaveis:99} });
  assert(off.ledCusto === 0 && off.custoMaoObraM2 === 0 && off.custosVariaveis === 0, 'toggles desligados: LED e serviço NÃO entram no cálculo');

  console.log('\\n=== Margem inviável (comissão+margem ≥ 100%) cai no custo, sem quebrar ===');
  const inv = _calcTelaCompute(Object.assign(_calcTelaNovo(), { tela:{qtd:1,custo:10}, comissaoPct: 60, margemDesejadaPct: 50 }));
  assert(inv.precoSugerido === null, 'preço sugerido null quando denominador ≤ 0');
  assert(quase(inv.precoVenda, 10), 'preço de venda cai no custo (R$ 10), sem número negativo');
})();
`;

eval(bloco + teste);

console.log('\n' + (falhas === 0 ? '✅ TODOS OS CÁLCULOS CONFEREM' : `❌ ${falhas} verificação(ões) falharam`));
process.exit(falhas === 0 ? 0 : 1);
