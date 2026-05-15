// STORAGE
const STORAGE_KEY = 'lumentech_erp_v1';
function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDB();
    const saved = JSON.parse(raw);
    const def = defaultDB();
    const merged = { ...def, ...saved };
    // Garantir arrays do CRM se vieram de versão antiga
    if (!merged.funis || merged.funis.length === 0) merged.funis = defaultFunis();
    if (!Array.isArray(merged.oportunidades)) merged.oportunidades = [];
    if (!Array.isArray(merged.tarefasCrm)) merged.tarefasCrm = [];
    if (!Array.isArray(merged.automacoes)) merged.automacoes = [];
    // Produtos
    if (!merged.categoriasProduto || merged.categoriasProduto.length === 0) merged.categoriasProduto = defaultCategoriasProduto();
    if (!Array.isArray(merged.marcasProduto)) merged.marcasProduto = [];
    if (!Array.isArray(merged.fabricantesProduto)) merged.fabricantesProduto = [];
    if (!Array.isArray(merged.tabelasPreco) || merged.tabelasPreco.length === 0) {
      merged.tabelasPreco = [{id:'tp_padrao', nome:'Tabela padrão', padrao:true, ajuste:0, descricao:'Preço de venda padrão'}];
    }
    // Fornecedores
    if (!merged.categoriasForn || merged.categoriasForn.length === 0) merged.categoriasForn = defaultCategoriasForn();
    // OS
    if (!Array.isArray(merged.veiculos)) merged.veiculos = [];
    if (!merged.configOS) merged.configOS = { precoCombustivel: 5.89, tiposServico: ['Medição','Instalação','Assistência técnica','Vistoria','Pós-venda','Manutenção preventiva','Projeto técnico'] };
    // Vendedores
    if (!Array.isArray(merged.vendedores)) merged.vendedores = [];
    // Usuários
    if (!Array.isArray(merged.usuarios) || merged.usuarios.length === 0) merged.usuarios = defaultUsuarios();
    if (!Array.isArray(merged.perfisAcesso) || merged.perfisAcesso.length === 0) merged.perfisAcesso = defaultPerfisAcesso();
    if (!Array.isArray(merged.logsAcesso)) merged.logsAcesso = [];
    // Trocas e Devoluções (garante presença mesmo em DBs antigos)
    if (!Array.isArray(merged.trocas)) merged.trocas = [];
    if (!Array.isArray(merged.devolucoes)) merged.devolucoes = [];
    if (!Array.isArray(merged.creditosCliente)) merged.creditosCliente = [];
    if (!Array.isArray(merged.prestacoesContas)) merged.prestacoesContas = [];
    if (!Array.isArray(merged.movimentacoes)) merged.movimentacoes = [];
    // Counters compatibility
    merged.counters = { ...def.counters, ...(saved.counters || {}) };
    return merged;
  } catch(e) { return defaultDB(); }
}
function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }
function defaultDB() {
  return {
    clientes: [], fornecedores: [], funcionarios: [], produtos: [], consultores: [],
    parceiros: [],    // Parceiros comerciais (arquitetos, engenheiros, etc) com comissão
    interacoes: [],   // Timeline de interações: {id, clienteId, tipo, data, descricao, usuario}
    orcamentos: [], pedidos: [], ops: [], osServicos: [],
    estoque: [], contasPagar: [], contasReceber: [], notas: [],
    // Trocas e Devoluções
    trocas: [],            // {id, pedidoId, clienteId, tipo:'garantia'|'comercial', motivo, itensOriginais:[], itensNovos:[], diferenca, formaPagamentoDif, status, requerAprovFinanc, criadoEm, criadoPor, aprovadoEm, aprovadoPor, recebidoEm, recebidoPor, orcamentoGeradoId, pedidoGeradoId, historico:[]}
    devolucoes: [],        // {id, pedidoId, clienteId, itens:[], motivo, valorPago, status, requerAprovFinanc, criadoEm, criadoPor, aprovadoEm, aprovadoPor, recebidoEm, recebidoPor, creditoGeradoId, historico:[]}
    creditosCliente: [],   // {id, clienteId, valor, valorUsado, origemTipo:'devolucao'|'troca', origemId, criadoEm, validadeEm, status:'ativo'|'usado'|'expirado'}
    prestacoesContas: [],  // {id, tipo:'troca'|'devolucao', referenciaId, status:'aguardando'|'validado', recebidoPor, localizacao:{deposito,corredor,prateleira,posicao,setor}, validadoEm, observacoes}
    // Estoque avançado
    movimentacoes: [],     // {id, tipo:entrada|saida|transferencia|ajuste, sku, qtd, motivo, doc, data, usuario, origem, destino, lote}
    lotes: [],             // {id, sku, numero, qtd, validade, fornecedor}
    depositos: [],         // {id, nome, tipo, endereco}
    enderecos: [],         // {id, depositoId, corredor, prateleira, posicao, capacidade, ocupado}
    pedidosCompra: [],     // {id, fornecedor, itens, total, status, data}
    inventarios: [],       // {id, tipo, status, data, itens, ajustes}
    transferencias: [],    // {id, origem, destino, sku, qtd, data, status}
    // CRM
    funis: defaultFunis(),       // [{id, nome, setor, etapas:[{id, nome, cor, ordem}]}]
    oportunidades: [],           // {id, funilId, etapaId, cliente, clienteId, valor, vendedor, prioridade, prevFechamento, status, tags, orcamentoId, pedidoId, criadoEm, historico:[], comentarios:[], anexos:[], checklist:[], obs}
    tarefasCrm: [],              // {id, oportunidadeId, titulo, descricao, prazo, status, responsavel, criadoEm, concluidoEm}
    automacoes: [],              // {id, funilId, etapaId, trigger, acao, ativa}
    // Produtos (cadastros auxiliares)
    categoriasProduto: defaultCategoriasProduto(),  // [{id, nome, prefixoSku, subcategorias:[{id, nome}]}]
    marcasProduto: [],                              // [{id, nome}]
    fabricantesProduto: [],                         // [{id, nome}]
    tabelasPreco: [{id:'tp_padrao', nome:'Tabela padrão', padrao:true, ajuste:0, descricao:'Preço de venda padrão'}],
    // Fornecedores (categorias e cadastros auxiliares)
    categoriasForn: defaultCategoriasForn(),        // [{id, nome}]
    // OS - Veículos
    veiculos: [],                                   // [{id, nome, tipo, placa, renavam, modelo, marca, ano, consumoKm, kmAtual, responsavel, ativo, criadoEm}]
    // Vendedores (cadastro simples comercial)
    vendedores: [],                                 // [{id, nome, email, telefone, foto, ativo, criadoEm}]
    configOS: {
      precoCombustivel: 5.89,                       // R$/litro padrão
      tiposServico: ['Medição','Instalação','Assistência técnica','Vistoria','Pós-venda','Manutenção preventiva','Projeto técnico'],
    },
    // Usuários, perfis e segurança
    usuarios: defaultUsuarios(),                    // [{id, nome, email, telefone, cargo, setor, foto, login, senhaHash, perfilId, ativo, ultimoAcesso, criadoEm}]
    perfisAcesso: defaultPerfisAcesso(),            // [{id, nome, descricao, padrao, permissoes:{modulo:{ver,criar,editar,excluir,aprovar}}}]
    logsAcesso: [],                                 // [{id, usuarioId, acao, modulo, detalhe, data, ip}]
    counters: { cli:1, orc:1, ped:1, op:1, os:1, exp:1, sku:1, cp:1, cr:1, nfs:1, prod:1, mov:1, lote:1, dep:1, end:1, pc:1, inv:1, tr:1, par:1, int:1, opp:1, task:1, auto:1, cat:1, marca:1, fab:1, forn:1, usu:1, perf:1, log:1, veic:1, med:1, vend:1 },
  };
}

// Categorias padrão de fornecedores
function defaultCategoriasForn() {
  return [
    { id: 'cf_industria', nome: 'Indústria' },
    { id: 'cf_distribuidor', nome: 'Distribuidor' },
    { id: 'cf_atacado', nome: 'Atacadista' },
    { id: 'cf_servico', nome: 'Prestador de serviço' },
    { id: 'cf_importador', nome: 'Importador' },
    { id: 'cf_representante', nome: 'Representante comercial' },
    { id: 'cf_terceirizacao', nome: 'Terceirização' },
  ];
}

// Usuário admin padrão (Ronyel)
function defaultUsuarios() {
  return [{
    id: 'usu_admin',
    nome: 'Ronyel Rick',
    email: 'ronyelrick@gmail.com',
    telefone: '',
    cargo: 'Diretor',
    setor: 'Administrativo',
    foto: '',
    login: 'ronyelrick@gmail.com',
    senhaHash: '********',
    perfilId: 'pf_admin',
    ativo: true,
    ultimoAcesso: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    admin: true,
  }];
}

// Perfis padrão com permissões pré-configuradas
function defaultPerfisAcesso() {
  // Todas as ações: ver, criar, editar, excluir, aprovar
  const todas = { ver: true, criar: true, editar: true, excluir: true, aprovar: true };
  const verApenas = { ver: true, criar: false, editar: false, excluir: false, aprovar: false };
  const verCriar = { ver: true, criar: true, editar: true, excluir: false, aprovar: false };
  const verCriarApr = { ver: true, criar: true, editar: true, excluir: false, aprovar: true };
  const nenhuma = { ver: false, criar: false, editar: false, excluir: false, aprovar: false };

  const todosModulos = ['dashboard','crm','clientes','parceiros','orcamentos','pedidos','producao','os','expedicao','produtos','fornecedores','estoque','financeiro','fiscal','cadastros','relatorios','usuarios','config'];

  const permTodos = {};
  todosModulos.forEach(m => permTodos[m] = todas);

  return [
    {
      id: 'pf_admin', nome: 'Administrador', padrao: true, sistema: true,
      descricao: 'Acesso total ao sistema, incluindo gestão de usuários e configurações',
      permissoes: permTodos,
    },
    {
      id: 'pf_gerente', nome: 'Gerente', sistema: true,
      descricao: 'Acesso amplo, sem permissão para gerenciar usuários',
      permissoes: {
        ...permTodos,
        usuarios: verApenas,
        config: verCriar,
      },
    },
    {
      id: 'pf_vendedor', nome: 'Vendedor', sistema: true,
      descricao: 'Acesso ao CRM, orçamentos e clientes. Sem acesso a custos ou financeiro.',
      permissoes: {
        dashboard: verApenas,
        crm: todas,
        clientes: verCriar,
        parceiros: verApenas,
        orcamentos: verCriarApr,
        pedidos: verApenas,
        producao: nenhuma,
        os: verApenas,
        expedicao: verApenas,
        produtos: verApenas,
        fornecedores: nenhuma,
        estoque: verApenas,
        financeiro: nenhuma,
        fiscal: nenhuma,
        cadastros: verApenas,
        relatorios: verApenas,
        usuarios: nenhuma,
        config: nenhuma,
      },
      restricoesEspeciais: ['ocultarCustos', 'apenasProprios'],
    },
    {
      id: 'pf_financeiro', nome: 'Financeiro', sistema: true,
      descricao: 'Acesso completo ao financeiro, fiscal e relatórios',
      permissoes: {
        dashboard: verApenas,
        crm: verApenas,
        clientes: verApenas,
        parceiros: verApenas,
        orcamentos: verApenas,
        pedidos: verApenas,
        producao: nenhuma,
        os: nenhuma,
        expedicao: nenhuma,
        produtos: verApenas,
        fornecedores: verCriar,
        estoque: verApenas,
        financeiro: todas,
        fiscal: todas,
        cadastros: verApenas,
        relatorios: todas,
        usuarios: nenhuma,
        config: nenhuma,
      },
    },
    {
      id: 'pf_producao', nome: 'Produção', sistema: true,
      descricao: 'Acesso a ordens de produção, estoque de matéria-prima e expedição',
      permissoes: {
        dashboard: verApenas,
        crm: nenhuma,
        clientes: verApenas,
        parceiros: nenhuma,
        orcamentos: verApenas,
        pedidos: verApenas,
        producao: todas,
        os: verCriar,
        expedicao: verCriar,
        produtos: verApenas,
        fornecedores: verApenas,
        estoque: verCriar,
        financeiro: nenhuma,
        fiscal: nenhuma,
        cadastros: verApenas,
        relatorios: verApenas,
        usuarios: nenhuma,
        config: nenhuma,
      },
    },
    {
      id: 'pf_estoque', nome: 'Estoque & Compras', sistema: true,
      descricao: 'Gerencia estoque, movimentações, compras e fornecedores',
      permissoes: {
        dashboard: verApenas,
        crm: nenhuma,
        clientes: verApenas,
        parceiros: nenhuma,
        orcamentos: verApenas,
        pedidos: verApenas,
        producao: verApenas,
        os: verApenas,
        expedicao: verCriar,
        produtos: verCriar,
        fornecedores: todas,
        estoque: todas,
        financeiro: verApenas,
        fiscal: verApenas,
        cadastros: verApenas,
        relatorios: verApenas,
        usuarios: nenhuma,
        config: nenhuma,
      },
    },
    {
      id: 'pf_tecnico', nome: 'Técnico / SAC', sistema: true,
      descricao: 'Atendimento e ordens de serviço (instalação, manutenção)',
      permissoes: {
        dashboard: verApenas,
        crm: verCriar,
        clientes: verCriar,
        parceiros: verApenas,
        orcamentos: verApenas,
        pedidos: verApenas,
        producao: verApenas,
        os: todas,
        expedicao: verApenas,
        produtos: verApenas,
        fornecedores: nenhuma,
        estoque: verApenas,
        financeiro: nenhuma,
        fiscal: nenhuma,
        cadastros: verApenas,
        relatorios: verApenas,
        usuarios: nenhuma,
        config: nenhuma,
      },
    },
  ];
}

// Categorias padrão para Lumentech
function defaultCategoriasProduto() {
  return [
    { id: 'cat_iluminacao', nome: 'Iluminação', prefixoSku: 'ILU', subcategorias: [
      {id:'sc_perfil', nome:'Perfil LED'}, {id:'sc_fita', nome:'Fita LED'}, {id:'sc_pendente', nome:'Pendente'}, {id:'sc_spot', nome:'Spot'}, {id:'sc_plafon', nome:'Plafon'}
    ]},
    { id: 'cat_eletrica', nome: 'Elétrica', prefixoSku: 'ELE', subcategorias: [
      {id:'sc_fonte', nome:'Fonte'}, {id:'sc_driver', nome:'Driver'}, {id:'sc_dimmer', nome:'Dimmer'}, {id:'sc_cabo', nome:'Cabo'}, {id:'sc_conector', nome:'Conector'}
    ]},
    { id: 'cat_vidro', nome: 'Vidro', prefixoSku: 'VID', subcategorias: [
      {id:'sc_vd_temp', nome:'Temperado'}, {id:'sc_vd_lam', nome:'Laminado'}, {id:'sc_vd_comum', nome:'Comum'}, {id:'sc_vd_jat', nome:'Jateado'}
    ]},
    { id: 'cat_aluminio', nome: 'Alumínio', prefixoSku: 'ALU', subcategorias: [
      {id:'sc_alu_perfil', nome:'Perfil'}, {id:'sc_alu_chapa', nome:'Chapa'}, {id:'sc_alu_tubo', nome:'Tubo'}, {id:'sc_alu_acab', nome:'Acabamento'}
    ]},
    { id: 'cat_ferragem', nome: 'Ferragens', prefixoSku: 'FER', subcategorias: [
      {id:'sc_dobr', nome:'Dobradiça'}, {id:'sc_fech', nome:'Fechadura'}, {id:'sc_parafuso', nome:'Parafuso'}, {id:'sc_acab', nome:'Acabamento'}
    ]},
    { id: 'cat_servico', nome: 'Serviços', prefixoSku: 'SRV', subcategorias: [
      {id:'sc_inst', nome:'Instalação'}, {id:'sc_manut', nome:'Manutenção'}, {id:'sc_proj', nome:'Projeto'}, {id:'sc_consult', nome:'Consultoria'}
    ]},
  ];
}

// Funis padrão (vendas, pós-venda, SAC, etc)
function defaultFunis() {
  return [
    {
      id: 'fnl_vendas', nome: 'Vendas', setor: 'vendas', padrao: true,
      etapas: [
        { id: 'et_lead', nome: 'Lead novo', cor: '#808080', ordem: 1 },
        { id: 'et_contato', nome: 'Contato feito', cor: '#0369a1', ordem: 2 },
        { id: 'et_qualificado', nome: 'Qualificado', cor: '#7c3aed', ordem: 3 },
        { id: 'et_proposta', nome: 'Proposta enviada', cor: '#d97706', ordem: 4 },
        { id: 'et_negociacao', nome: 'Em negociação', cor: '#ca8a04', ordem: 5 },
        { id: 'et_ganha', nome: 'Venda fechada', cor: '#2E7D32', ordem: 6, ganha: true },
        { id: 'et_perdida', nome: 'Perdida', cor: '#B0241F', ordem: 7, perdida: true },
      ],
    },
    {
      id: 'fnl_posvenda', nome: 'Pós-venda', setor: 'posvenda',
      etapas: [
        { id: 'et_pv_entregue', nome: 'Entregue', cor: '#0369a1', ordem: 1 },
        { id: 'et_pv_acomp', nome: 'Acompanhamento', cor: '#d97706', ordem: 2 },
        { id: 'et_pv_satis', nome: 'Pesquisa satisfação', cor: '#7c3aed', ordem: 3 },
        { id: 'et_pv_fidel', nome: 'Fidelizado', cor: '#2E7D32', ordem: 4, ganha: true },
      ],
    },
    {
      id: 'fnl_sac', nome: 'SAC', setor: 'sac',
      etapas: [
        { id: 'et_sac_aberto', nome: 'Aberto', cor: '#B0241F', ordem: 1 },
        { id: 'et_sac_andamento', nome: 'Em andamento', cor: '#d97706', ordem: 2 },
        { id: 'et_sac_aguard', nome: 'Aguardando cliente', cor: '#7c3aed', ordem: 3 },
        { id: 'et_sac_resolvido', nome: 'Resolvido', cor: '#2E7D32', ordem: 4, ganha: true },
      ],
    },
    {
      id: 'fnl_implant', nome: 'Implantação', setor: 'implantacao',
      etapas: [
        { id: 'et_imp_inicio', nome: 'Início', cor: '#808080', ordem: 1 },
        { id: 'et_imp_planej', nome: 'Planejamento', cor: '#0369a1', ordem: 2 },
        { id: 'et_imp_exec', nome: 'Execução', cor: '#d97706', ordem: 3 },
        { id: 'et_imp_concluido', nome: 'Concluído', cor: '#2E7D32', ordem: 4, ganha: true },
      ],
    },
    {
      id: 'fnl_fin', nome: 'Financeiro', setor: 'financeiro',
      etapas: [
        { id: 'et_fin_pendente', nome: 'Pendente', cor: '#d97706', ordem: 1 },
        { id: 'et_fin_neg', nome: 'Em negociação', cor: '#7c3aed', ordem: 2 },
        { id: 'et_fin_pago', nome: 'Pago', cor: '#2E7D32', ordem: 3, ganha: true },
        { id: 'et_fin_inadimp', nome: 'Inadimplente', cor: '#B0241F', ordem: 4, perdida: true },
      ],
    },
    {
      id: 'fnl_suporte', nome: 'Suporte técnico', setor: 'suporte',
      etapas: [
        { id: 'et_sup_chamado', nome: 'Chamado aberto', cor: '#B0241F', ordem: 1 },
        { id: 'et_sup_atend', nome: 'Em atendimento', cor: '#d97706', ordem: 2 },
        { id: 'et_sup_orcam', nome: 'Orçando peças', cor: '#7c3aed', ordem: 3 },
        { id: 'et_sup_finalizado', nome: 'Finalizado', cor: '#2E7D32', ordem: 4, ganha: true },
      ],
    },
  ];
}
let DB = loadDB();
function nextId(key, prefix, digits = 4) {
  const n = DB.counters[key] || 1;
  DB.counters[key] = n + 1;
  return `${prefix}-${String(n).padStart(digits, '0')}`;
}
