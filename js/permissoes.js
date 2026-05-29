// Permissões granulares do Lumentech ERP.
//
// Modelo:
//   - Cada usuário tem um perfilId (vendedor, financeiro, etc).
//   - Cada perfil tem um mapa { modulo: { ver, criar, editar, excluir, aprovar } }
//   - Os 18 módulos canônicos vêm de defaultPerfisAcesso() em db.js.
//   - O sidebar tem muito mais itens (~35) — esse arquivo faz o mapeamento.
//
// Fluxo:
//   - Login: CURRENT_USER recebe perfilId.
//   - renderNav(): filtra itens onde o usuário não tem `ver` no módulo correspondente.
//   - navigate(pageId): bloqueia direto se não tem `ver`.
//   - Botões "Novo/Editar/Excluir": usar `temAcesso(modulo, acao)` no momento do render.
//
// Admin (admin === true OU perfilId === 'pf_admin') tem acesso a tudo, sempre.

(function () {
  'use strict';

  // De qual módulo de permissão cada item do sidebar/router pertence.
  // Se um item não estiver mapeado, é considerado livre (acesso garantido) — failsafe pra não
  // quebrar funcionalidades que ainda não classificamos.
  const MENU_ID_TO_MODULE = {
    // Top-level
    inicio:               null,      // sempre liberado
    dashboard:            'dashboard',

    // Vendas
    crm:                  'crm',
    orcamentos:           'orcamentos',
    pedidos:              'pedidos',
    trocas:               'pedidos',  // trocas ficam dentro de pedidos
    devolucoes:           'pedidos',
    creditos:             'pedidos',

    // Cadastros
    clientes:             'clientes',
    parceiros:            'parceiros',
    fornecedores:         'fornecedores',
    transportadoras:      'cadastros',
    motoristas:           'cadastros',
    veiculos:             'cadastros',
    vendedores:           'cadastros',
    ambientes:            'cadastros',
    marcas:               'cadastros',

    // Logística (todos sob expedicao)
    'log-separacao':      'expedicao',
    'log-pendencias':     'expedicao',
    'log-armazenado':     'expedicao',
    'log-expedicao':      'expedicao',
    'prestacao-contas':   'expedicao',
    separacao:            'expedicao',
    expedicao:            'expedicao',

    // Operacional
    producao:             'producao',
    os:                   'os',
    'vendas-ext':         'crm',     // Vendas externas é uma extensão de CRM

    // Estoque
    produtos:             'produtos',
    estoque:              'estoque',

    // Suprimentos (compras) — sob fornecedores
    'sup-ordens-compra':  'fornecedores',
    'sup-followup':       'fornecedores',
    'sup-patrimonio':     'fornecedores',

    // Financeiro
    'centros-custo':      'financeiro',
    'contas-pagar':       'financeiro',
    'contas-receber':     'financeiro',
    'fin-creditos':       'financeiro',
    comissao:             'financeiro',
    'fluxo-caixa':        'financeiro',
    dre:                  'financeiro',
    fiscal:               'fiscal',

    // Sistema
    usuarios:             'usuarios',
    config:               'config',
    cadastros:            'cadastros',
    relatorios:           'relatorios',
  };

  function _getPerfilDoUsuario() {
    const u = window.CURRENT_USER;
    if (!u) return null;
    if (u.admin) return { _isAdmin: true };
    if (!Array.isArray(window.DB?.perfisAcesso)) return null;
    return window.DB.perfisAcesso.find(p => p.id === u.perfilId) || null;
  }

  // temAcesso(modulo, acao = 'ver') — retorna true se o usuário corrente pode fazer
  // aquela ação naquele módulo. Admin sempre true. Sem perfil definido = false
  // (failsafe: na dúvida, bloqueia em vez de liberar).
  function temAcesso(modulo, acao) {
    acao = acao || 'ver';
    const perfil = _getPerfilDoUsuario();
    if (!perfil) return false;
    if (perfil._isAdmin) return true;
    if (!perfil.permissoes) return false;
    const m = perfil.permissoes[modulo];
    if (!m) return false;
    return m[acao] === true;
  }

  // Versão por id do menu (faz o mapeamento). Útil pro renderNav() e navigate().
  function podeAcessarPagina(pageId) {
    const mod = MENU_ID_TO_MODULE[pageId];
    if (mod === null) return true;     // mapeado como livre (ex: inicio)
    if (mod === undefined) return true; // não mapeado = sem restrição (failsafe)
    return temAcesso(mod, 'ver');
  }

  // Filtra um menu (MENU_GRUPOS ou MENU plano) tirando itens sem permissão.
  // - Item simples sem ver = removido
  // - Grupo: filtra filhos; se sobrar 0, remove o grupo inteiro
  // - Separadores: mantidos como estão
  function filtrarMenuPorPermissao(menu) {
    if (!Array.isArray(menu)) return menu;
    return menu
      .map(entrada => {
        if (entrada.tipo === 'separador') return entrada;
        if (entrada.tipo === 'grupo') {
          const filhosFiltrados = (entrada.filhos || []).filter(f => podeAcessarPagina(f.id));
          if (filhosFiltrados.length === 0) return null;
          return { ...entrada, filhos: filhosFiltrados };
        }
        // tipo === 'item' OU formato MENU plano sem `tipo`
        return podeAcessarPagina(entrada.id) ? entrada : null;
      })
      .filter(Boolean);
  }

  // Retorna a primeira página acessível pelo usuário. Usado quando o landing default
  // (inicio) por algum motivo virou inacessível.
  function primeiraPaginaAcessivel() {
    if (podeAcessarPagina('inicio')) return 'inicio';
    if (Array.isArray(window.MENU_GRUPOS)) {
      for (const g of window.MENU_GRUPOS) {
        if (g.tipo === 'item' && podeAcessarPagina(g.id)) return g.id;
        if (g.tipo === 'grupo') {
          for (const f of (g.filhos || [])) {
            if (podeAcessarPagina(f.id)) return f.id;
          }
        }
      }
    }
    return 'inicio';
  }

  // Helper pra usar dentro de template literals dos renderers:
  //   ${gateBtn('orcamentos', 'criar', `<button>Novo</button>`)}
  // Se o usuário não tem a permissão, devolve string vazia — o botão nem aparece no DOM.
  function gateBtn(modulo, acao, html) {
    if (!temAcesso(modulo, acao)) return '';
    return html;
  }

  // Guarda de handler: chama no início de funções de criar/editar/excluir.
  // Retorna true se pode prosseguir; false (+ toast) se bloqueado.
  //
  // Exemplo:
  //   function openOrcamentoModal() {
  //     if (!exigeAcesso('orcamentos', 'criar')) return;
  //     ...
  //   }
  function exigeAcesso(modulo, acao) {
    if (temAcesso(modulo, acao)) return true;
    const msgs = {
      ver:     'Você não tem permissão pra visualizar isso.',
      criar:   'Você não tem permissão pra criar.',
      editar:  'Você não tem permissão pra editar.',
      excluir: 'Você não tem permissão pra excluir.',
      aprovar: 'Você não tem permissão pra aprovar.',
    };
    if (typeof toast === 'function') toast(msgs[acao] || 'Acesso negado.', 'danger');
    return false;
  }

  // Expõe globalmente
  window.permissoes = {
    temAcesso,
    podeAcessarPagina,
    filtrarMenuPorPermissao,
    primeiraPaginaAcessivel,
    gateBtn,
    exigeAcesso,
    MENU_ID_TO_MODULE,
  };
  // Atalhos de conveniência usados em vários cantos do app
  window.temAcesso  = temAcesso;
  window.gateBtn    = gateBtn;
  window.exigeAcesso = exigeAcesso;
})();
