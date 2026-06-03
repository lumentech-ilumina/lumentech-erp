// Testa a lógica de período da Agenda financeira (dia/semana/mês) com o código real.
// Rodar: node scripts/test-agenda-periodo.js
const fs = require('fs');
const path = require('path');

let falhas = 0;
function assert(cond, msg) { if (cond) console.log('  ✓ ' + msg); else { console.log('  ✗ FALHOU: ' + msg); falhas++; } }

const html = fs.readFileSync(path.join(__dirname, '..', 'lumentech-erp.html'), 'utf8');
const ini = html.indexOf('function _agFinIso(d) {');
const fim = html.indexOf('function renderAgendaFinanceira(parent) {');
if (ini < 0 || fim < 0) { console.log('❌ Não localizei os helpers da agenda'); process.exit(1); }
const bloco = html.slice(ini, fim);

global.isoToBR = s => s; // identidade pro teste

const teste = `
;(function(){
  // 2026-06-03 (meio-dia local) — referência
  global._agFinData = new Date('2026-06-03T12:00:00');

  console.log('\\n=== Visão MÊS ===');
  global._agFinView = 'mes';
  let p = _agFinPeriodo();
  assert(p.ini === '2026-06-03'.slice(0,8)+'01', 'mês começa em 2026-06-01 (' + p.ini + ')');
  assert(p.fim === '2026-06-30', 'mês termina em 2026-06-30 (' + p.fim + ')');

  console.log('\\n=== Visão DIA ===');
  global._agFinView = 'dia';
  p = _agFinPeriodo();
  assert(p.ini === '2026-06-03' && p.fim === '2026-06-03', 'dia = 2026-06-03 (ini=fim)');

  console.log('\\n=== Visão SEMANA (domingo→sábado) ===');
  global._agFinView = 'semana';
  p = _agFinPeriodo();
  const dIni = new Date(p.ini + 'T12:00:00');
  const dFim = new Date(p.fim + 'T12:00:00');
  assert(dIni.getDay() === 0, 'semana começa no domingo (getDay=0, foi ' + dIni.getDay() + ' em ' + p.ini + ')');
  assert(dFim.getDay() === 6, 'semana termina no sábado (getDay=6, foi ' + dFim.getDay() + ' em ' + p.fim + ')');
  assert((dFim - dIni) / 86400000 === 6, 'semana tem 7 dias (ini..fim = 6 dias de diferença)');
  assert(p.ini <= '2026-06-03' && '2026-06-03' <= p.fim, '2026-06-03 está dentro da semana');

  console.log('\\n=== Limite de mês: 2026-02 (ano não bissexto) termina em 28 ===');
  global._agFinData = new Date('2026-02-15T12:00:00');
  global._agFinView = 'mes';
  p = _agFinPeriodo();
  assert(p.fim === '2026-02-28', 'fevereiro/2026 termina em 28 (' + p.fim + ')');

  console.log('\\n=== Semana que cruza a virada do mês ===');
  global._agFinData = new Date('2026-07-01T12:00:00'); // 1º de julho
  global._agFinView = 'semana';
  p = _agFinPeriodo();
  assert(p.ini < '2026-07-01' && p.fim >= '2026-07-01', 'semana cruza junho→julho sem quebrar (' + p.ini + ' – ' + p.fim + ')');
})();
`;

eval(bloco + teste);
console.log('\n' + (falhas === 0 ? '✅ PERÍODOS DA AGENDA OK' : `❌ ${falhas} verificação(ões) falharam`));
process.exit(falhas === 0 ? 0 : 1);
