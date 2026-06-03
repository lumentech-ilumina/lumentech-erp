// Testa a geração de títulos do "Pagamento futuro" usando a função REAL
// lancarFinanceiroPedido extraída do lumentech-erp.html.
// Rodar: node scripts/test-pagamento-futuro.js
const fs = require('fs');
const path = require('path');

let falhas = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FALHOU: ' + msg); falhas++; }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'lumentech-erp.html'), 'utf8');
const ini = html.indexOf('function lancarFinanceiroPedido(');
const fim = html.indexOf('function cancelarFinanceiroPedido(');
if (ini < 0 || fim < 0 || fim <= ini) { console.log('❌ Não localizei lancarFinanceiroPedido no HTML'); process.exit(1); }
const fnSrc = html.slice(ini, fim);

// Stubs do ambiente
let _crSeq = 0;
global.nextId = (k, p) => (p || k) + '-' + String(++_crSeq).padStart(3, '0');
global.adicionarTimelinePedido = () => {};
global.DB = { contasReceber: [], orcamentos: [] };

eval(fnSrc); // define lancarFinanceiroPedido

function reset() { _crSeq = 0; global.DB.contasReceber = []; }

(function () {
  console.log('\n=== Entrada (Pix) agora + saldo "Pagamento futuro" com data de cobrança ===');
  reset();
  const pedido = { id: 'PED-1', cliente: 'Fulano', valor: 1000, criadoEm: '2026-06-03T10:00:00Z' };
  const orc = {
    id: 'ORC-1', dataIso: '2026-06-03',
    pagamentos: [
      { forma: 'Pix', valor: 300, parcelas: 1 },
      { forma: 'Pagamento futuro', valor: 700, dataCobranca: '2026-09-01' },
    ],
  };
  lancarFinanceiroPedido(pedido, orc);
  const crs = global.DB.contasReceber;
  assert(crs.length === 2, 'gerou 2 títulos (entrada + saldo futuro)');
  const entrada = crs.find(c => c.formaPagamento === 'Pix');
  const futuro = crs.find(c => c.pagamentoFuturo);
  assert(!!entrada && entrada.valor === 300, 'entrada Pix de R$ 300');
  assert(!!entrada && entrada.vencimento === '2026-07-03', 'entrada vence em +30 dias (2026-07-03)');
  assert(!!entrada && !entrada.pagamentoFuturo, 'entrada NÃO é marcada como pagamento futuro');
  assert(!!futuro && futuro.valor === 700, 'saldo futuro de R$ 700');
  assert(!!futuro && futuro.vencimento === '2026-09-01', 'saldo vence na DATA DE COBRANÇA (2026-09-01)');
  assert(!!futuro && futuro.formaPagamento === 'Pagamento futuro', 'saldo mantém forma "Pagamento futuro"');
  assert(!!futuro && futuro.status === 'A receber', 'saldo fica EM ABERTO (A receber)');
  assert(!!futuro && /Pagamento futuro \(saldo\)/.test(futuro.descricao), 'descrição identifica o saldo futuro');

  console.log('\n=== Sem data de cobrança: cai no fallback +30 dias (não quebra) ===');
  reset();
  lancarFinanceiroPedido(
    { id: 'PED-2', cliente: 'Beltrano', valor: 500, criadoEm: '2026-06-03T10:00:00Z' },
    { id: 'ORC-2', dataIso: '2026-06-03', pagamentos: [{ forma: 'Pagamento futuro', valor: 500 }] }
  );
  const f2 = global.DB.contasReceber.find(c => c.pagamentoFuturo);
  assert(!!f2 && f2.vencimento === '2026-07-03', 'sem data → vence em +30 dias');
  assert(!!f2 && f2.pagamentoFuturo === true, 'continua marcado como pagamento futuro');

  console.log('\n=== Pagamento futuro NÃO parcela (mesmo com parcelas no objeto) ===');
  reset();
  lancarFinanceiroPedido(
    { id: 'PED-3', cliente: 'Ciclano', valor: 900, criadoEm: '2026-06-03T10:00:00Z' },
    { id: 'ORC-3', dataIso: '2026-06-03', pagamentos: [{ forma: 'Pagamento futuro', valor: 900, parcelas: 6, dataCobranca: '2026-12-01' }] }
  );
  assert(global.DB.contasReceber.length === 1, 'gera um único título (não fatia em parcelas)');
  assert(global.DB.contasReceber[0].vencimento === '2026-12-01', 'usa a data de cobrança');
})();

console.log('\n' + (falhas === 0 ? '✅ PAGAMENTO FUTURO OK' : `❌ ${falhas} verificação(ões) falharam`));
process.exit(falhas === 0 ? 0 : 1);
