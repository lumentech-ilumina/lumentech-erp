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
    if (!Array.isArray(merged.pendenciasSeparacao)) merged.pendenciasSeparacao = [];
    if (!Array.isArray(merged.motivosTroca) || merged.motivosTroca.length === 0) merged.motivosTroca = defaultMotivosTroca();
    if (!Array.isArray(merged.motivosDevolucao) || merged.motivosDevolucao.length === 0) merged.motivosDevolucao = defaultMotivosDevolucao();
    if (!Array.isArray(merged.etapasProducao) || merged.etapasProducao.length === 0) merged.etapasProducao = defaultEtapasProducao();
    if (!Array.isArray(merged.osStatus)       || merged.osStatus.length === 0)       merged.osStatus       = defaultOSStatus();
    if (!Array.isArray(merged.separacaoEtapas)|| merged.separacaoEtapas.length === 0) merged.separacaoEtapas = defaultSeparacaoEtapas();
    // Suprimentos
    if (!Array.isArray(merged.patrimonios)) merged.patrimonios = [];
    if (!Array.isArray(merged.impostos)) merged.impostos = [];
    if (!Array.isArray(merged.followUp)) merged.followUp = [];
    if (!Array.isArray(merged.ambientesPadrao)) merged.ambientesPadrao = [];
    // Logística e auditoria
    if (!Array.isArray(merged.motoristas)) merged.motoristas = [];
    if (!Array.isArray(merged.rotas)) merged.rotas = [];
    if (!Array.isArray(merged.auditoriaExclusoes)) merged.auditoriaExclusoes = [];
    // Vendas Externas (Field Sales CRM)
    if (!Array.isArray(merged.pontosComerciais)) merged.pontosComerciais = [];
    if (!Array.isArray(merged.visitasCampo)) merged.visitasCampo = [];
    if (!Array.isArray(merged.segmentosVendas) || merged.segmentosVendas.length === 0) merged.segmentosVendas = defaultSegmentosVendas();
    // Counters compatibility
    merged.counters = { ...def.counters, ...(saved.counters || {}) };
    return merged;
  } catch(e) { return defaultDB(); }
}
function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    return true;
  } catch (e) {
    // Quota exceeded — provavelmente imagens/anexos em base64 estouraram o limite (~5MB)
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message))) {
      console.error('Armazenamento cheio. Use Configurações → Análise de armazenamento.');
      // Toast amigável com instrução clara
      if (typeof toast === 'function') {
        toast('Armazenamento cheio. Vá em Configurações → Análise de armazenamento pra liberar espaço.', 'danger');
      }
      // Marca flag pra mostrar banner em qualquer renderização
      try { window._dbQuotaExceeded = true; } catch(_){}
      return false;
    }
    console.error('Erro inesperado ao salvar:', e);
    if (typeof toast === 'function') toast('Erro inesperado ao salvar — F12 → Console pra detalhes', 'danger');
    return false;
  }
}

// Análise: retorna o tamanho em bytes de cada chave do DB
function analisarTamanhoDB() {
  const out = [];
  for (const k of Object.keys(DB)) {
    try {
      const bytes = new Blob([JSON.stringify(DB[k] || null)]).size;
      out.push({ chave: k, bytes, kb: +(bytes/1024).toFixed(1) });
    } catch(_) {}
  }
  out.sort((a,b) => b.bytes - a.bytes);
  return out;
}

// Remove imagens/anexos pesados (base64 dataURLs) — última instância pra liberar quota
function limparAnexosPesados() {
  let liberados = 0;
  // Logo da empresa
  if (DB.empresa && DB.empresa.logo && DB.empresa.logo.length > 100) {
    liberados += DB.empresa.logo.length;
    DB.empresa.logo = '';
  }
  // Imagens dos produtos
  (DB.produtos || []).forEach(p => {
    if (Array.isArray(p.imagens)) {
      p.imagens.forEach(img => { if (typeof img === 'string' && img.startsWith('data:')) liberados += img.length; });
      p.imagens = [];
    }
  });
  // Anexos do CRM (comentários e timeline)
  (DB.oportunidades || []).forEach(opp => {
    (opp.comentarios || []).forEach(c => {
      if (Array.isArray(c.anexos)) {
        c.anexos.forEach(a => { if (a.dataUrl && a.dataUrl.startsWith('data:')) liberados += a.dataUrl.length; });
        c.anexos = [];
      }
    });
    if (Array.isArray(opp.anexos)) {
      opp.anexos.forEach(a => { if (a.dataUrl && a.dataUrl.startsWith('data:')) liberados += a.dataUrl.length; });
      opp.anexos = [];
    }
  });
  // Anexos internos do orçamento
  (DB.orcamentos || []).forEach(o => {
    if (Array.isArray(o.anexosInternos)) {
      o.anexosInternos.forEach(a => { if (a.dataUrl && a.dataUrl.startsWith('data:')) liberados += a.dataUrl.length; });
      o.anexosInternos = [];
    }
  });
  // Anexos das OPs e OS
  (DB.ops || []).forEach(op => {
    if (Array.isArray(op.anexos)) {
      op.anexos.forEach(a => { if (a.dataUrl && a.dataUrl.startsWith('data:')) liberados += a.dataUrl.length; });
      op.anexos = [];
    }
  });
  (DB.osServicos || []).forEach(os => {
    if (Array.isArray(os.anexos)) {
      os.anexos.forEach(a => { if (a.dataUrl && a.dataUrl.startsWith('data:')) liberados += a.dataUrl.length; });
      os.anexos = [];
    }
  });
  return Math.round(liberados / 1024); // KB liberados
}
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
    // Pendências de compra: itens com conferência parcial (separado < pedido) que aguardam material novo
    pendenciasSeparacao: [], // {id, pedidoId, clienteId, produtoId, sku, qtdSolicitada, qtdSeparada, qtdPendencia, dataPedido, dataPendencia, status:'aberta'|'oc_emitida'|'atendida', ordemCompraId, previsaoChegada, atendidoEm, historico:[{data, usuario, evento, detalhe}]}
    motivosTroca: defaultMotivosTroca(), // [{id, nome, padrao:boolean}] — lista personalizável de motivos pra troca
    motivosDevolucao: defaultMotivosDevolucao(), // [{id, nome, padrao:boolean}] — lista personalizável de motivos pra devolução
    etapasProducao: defaultEtapasProducao(), // [{id, nome, cor, ordem, padrao:boolean}] — etapas personalizáveis do kanban de produção
    osStatus: defaultOSStatus(),             // [{id, label, cor, icon, ordem, padrao:boolean}] — status personalizáveis do kanban de Ordem de Serviço
    separacaoEtapas: defaultSeparacaoEtapas(), // [{id, label, cor, ordem, padrao}] — label/cor editáveis das colunas do pipeline de Logística
    // Vendas Externas (Field Sales CRM)
    pontosComerciais: [],    // [{id, nome, segmentoId, categoria, endereco, cidade, uf, lat, lng, telefone, email, observacoes, criadoEm}]
    visitasCampo: [],        // [{id, pontoId, clienteId, vendedorId, status, dataAgendada, checkinEm, checkinLat, checkinLng, checkoutEm, fotos[], fotoVendedor, resumo, interesse, produtosInteresse, concorrentes, proximaAcao, oportunidadeVenda, observacoes, historico[]}]
    segmentosVendas: defaultSegmentosVendas(),  // [{id, nome, categorias[]}]
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
    // Logística - Motoristas e rotas de expedição
    motoristas: [],                                 // [{id, nome, cpf, cnh, categoriaCnh, telefone, email, foto, status:'ativo'|'inativo'|'em_rota', ultimaLat, ultimaLng, ultimaPosicaoEm, criadoEm}]
    rotas: [],                                      // [{id, motoristaId, veiculoId, pedidos:[pedidoId], paradas:[{pedidoId, ordem, endereco, lat, lng, entregueEm, obs}], status:'planejada'|'em_rota'|'concluida'|'cancelada', kmEstimado, kmReal, polyline, criadoEm, criadoPor, iniciadoEm, concluidoEm, obs}]
    geocodeCache: {},                               // {cacheKey: {lat, lng, label, atualizadoEm}}  — cache de geocodificação por endereço pra evitar chamadas repetidas no Nominatim
    // Vendedores (cadastro simples comercial)
    vendedores: [],                                 // [{id, nome, email, telefone, foto, ativo, criadoEm}]
    configOS: {
      precoCombustivel: 5.89,                       // R$/litro padrão
      tiposServico: ['Medição','Instalação','Assistência técnica','Vistoria','Pós-venda','Manutenção preventiva','Projeto técnico'],
    },
    // Comunicação visual da empresa (logo, cores, identidade) — aplicado em headers, PDFs, prints
    empresa: {
      nome: '',                                     // Nome da empresa
      slogan: '',                                   // Subtítulo opcional
      logo: '',                                     // Data URL base64 (PNG/JPG/SVG)
      corPrimaria: '',                              // Sobrescreve --info se preenchida (ex: #1E4F8F)
      corAcento: '',                                // Sobrescreve --ink-2 se preenchida
      cnpj: '',
      endereco: '',
      telefone: '',
      email: '',
      site: '',
    },
    // Usuários, perfis e segurança
    usuarios: defaultUsuarios(),                    // [{id, nome, email, telefone, cargo, setor, foto, login, senhaHash, perfilId, ativo, ultimoAcesso, criadoEm}]
    perfisAcesso: defaultPerfisAcesso(),            // [{id, nome, descricao, padrao, permissoes:{modulo:{ver,criar,editar,excluir,aprovar}}}]
    logsAcesso: [],                                 // [{id, usuarioId, acao, modulo, detalhe, data, ip}]
    // Suprimentos
    patrimonios: [],                                // [{id, codigo, nome, tipo, valorAquisicao, dataAquisicao, fornecedor, localizacao, responsavel, nf, status, observacoes, criadoEm}]
    impostos: [],                                   // [{id, nome, tipo, aliquota, ncm, cfop, descricao, ativo}]
    followUp: [],                                   // [{id, ordemCompraId, ordemCompraNumero, fornecedor, statusAtual, dataPrevista, observacao, contatoEm, contatoPor, criadoEm}]
    // Ambientes padrão (orçamentos do tipo Projeto)
    ambientesPadrao: [],                            // [{id, nome, ordem}]
    counters: { cli:1, orc:1, ped:1, op:1, os:1, exp:1, sku:1, cp:1, cr:1, nfs:1, prod:1, mov:1, lote:1, dep:1, end:1, pc:1, inv:1, tr:1, par:1, int:1, opp:1, task:1, auto:1, cat:1, marca:1, fab:1, forn:1, usu:1, perf:1, log:1, veic:1, med:1, vend:1, pat:1, imp:1, fup:1, mot:1, rot:1 },
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
    senhaHash: '',
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

// Segmentos padrão de vendas externas (editáveis pelo usuário)
function defaultSegmentosVendas() {
  return [
    { id: 'seg_iluminacao',    nome: 'Iluminação',       categorias: ['Lojas de iluminação','Distribuidores','Atacadistas','Showrooms'] },
    { id: 'seg_construcao',    nome: 'Construção civil', categorias: ['Construtoras','Empreiteiras','Materiais de construção','Engenharia'] },
    { id: 'seg_industria',     nome: 'Indústrias',       categorias: ['Fábricas','Galpões','Plantas industriais'] },
    { id: 'seg_varejo',        nome: 'Varejo',           categorias: ['Lojas','Comércio em geral','Franquias'] },
    { id: 'seg_arquitetura',   nome: 'Arquitetura',      categorias: ['Escritórios de arquitetura','Designers'] },
  ];
}

// Motivos padrão de troca (editáveis pelo usuário)
function defaultMotivosTroca() {
  return [
    { id: 'mt_defeito',    nome: 'Defeito de fabricação',  padrao: true },
    { id: 'mt_dano_trans', nome: 'Dano em transporte',     padrao: true },
    { id: 'mt_dano_inst',  nome: 'Dano na instalação',     padrao: true },
    { id: 'mt_incorreto',  nome: 'Produto incorreto enviado', padrao: true },
    { id: 'mt_arrependi',  nome: 'Arrependimento do cliente', padrao: true },
    { id: 'mt_dimensoes',  nome: 'Dimensões fora do esperado', padrao: true },
    { id: 'mt_cor',        nome: 'Cor ou acabamento divergente', padrao: true },
  ];
}

// Status padrão do kanban de Ordem de Serviço (editáveis pelo usuário)
function defaultOSStatus() {
  return [
    { id: 'aberta',         label: 'Aberta',            cor: '#808080', icon: '📋', ordem: 1, padrao: true },
    { id: 'agendada',       label: 'Agendada',          cor: '#0369a1', icon: '📅', ordem: 2, padrao: true },
    { id: 'a_caminho',      label: 'Técnico a caminho', cor: '#7c3aed', icon: '🛵', ordem: 3, padrao: true },
    { id: 'em_atendimento', label: 'Em atendimento',    cor: '#d97706', icon: '🔧', ordem: 4, padrao: true },
    { id: 'pausada',        label: 'Pausada',           cor: '#ca8a04', icon: '⏸', ordem: 5, padrao: true },
    { id: 'finalizada',     label: 'Finalizada',        cor: '#2E7D32', icon: '✅', ordem: 6, padrao: true },
    { id: 'cancelada',      label: 'Cancelada',         cor: '#B0241F', icon: '✕', ordem: 7, padrao: true },
  ];
}

// Etapas padrão do pipeline de Separação/Logística (label e cor editáveis pelo usuário).
// Os ids são fixos porque cada um está amarrado a uma transição de negócio (timestamp no pedido).
function defaultSeparacaoEtapas() {
  return [
    { id: 'aguardando_aprov', label: 'Aguardando financeiro',  cor: '#808080', ordem: 1, padrao: true },
    { id: 'aprovado',         label: 'Aprovado · iniciar',     cor: '#1E4F8F', ordem: 2, padrao: true },
    { id: 'em_separacao',     label: 'Em separação',           cor: '#9A6A0A', ordem: 3, padrao: true },
    { id: 'separado',         label: 'Separado · embalar',     cor: '#9A6A0A', ordem: 4, padrao: true },
    { id: 'em_embalagem',     label: 'Em embalagem',           cor: '#1E4F8F', ordem: 5, padrao: true },
    { id: 'armazenado',       label: 'Armazenado · NF',        cor: '#1E4F8F', ordem: 6, padrao: true },
    { id: 'nf_emitida',       label: 'NF emitida · expedir',   cor: '#2E7D32', ordem: 7, padrao: true },
  ];
}

// Etapas padrão do kanban de Produção (editáveis pelo usuário)
function defaultEtapasProducao() {
  return [
    { id: 'ep_aguard_sep',  nome: 'Aguardando separação', cor: '#808080', ordem: 1, padrao: true },
    { id: 'ep_aguard_oper', nome: 'Aguardando operador',  cor: '#9A6A0A', ordem: 2, padrao: true },
    { id: 'ep_em_prod',     nome: 'Em produção',          cor: '#1E4F8F', ordem: 3, padrao: true },
    { id: 'ep_inspecao',    nome: 'Inspeção',             cor: '#7C3AED', ordem: 4, padrao: true },
    { id: 'ep_embalagem',   nome: 'Embalagem',            cor: '#0369A1', ordem: 5, padrao: true },
    { id: 'ep_armazenado',  nome: 'Armazenado',           cor: '#2E7D32', ordem: 6, padrao: true },
    { id: 'ep_entregue',    nome: 'Entregue',             cor: '#2E7D32', ordem: 7, padrao: true },
  ];
}

// Motivos padrão de devolução (editáveis pelo usuário)
function defaultMotivosDevolucao() {
  return [
    { id: 'md_arrependi',     nome: 'Arrependimento do cliente',       padrao: true },
    { id: 'md_defeito',       nome: 'Defeito de fabricação',           padrao: true },
    { id: 'md_dano_trans',    nome: 'Dano em transporte',              padrao: true },
    { id: 'md_incorreto',     nome: 'Produto incorreto enviado',       padrao: true },
    { id: 'md_divergencia',   nome: 'Divergência de pedido',           padrao: true },
    { id: 'md_atraso',        nome: 'Atraso na entrega',               padrao: true },
    { id: 'md_dimensoes',     nome: 'Dimensões fora do esperado',      padrao: true },
    { id: 'md_qualidade',     nome: 'Qualidade abaixo do esperado',    padrao: true },
    { id: 'md_duplicidade',   nome: 'Pedido em duplicidade',           padrao: true },
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
var DB = loadDB();
window.DB = DB;
// Numeração simples (sem prefixo) para os módulos principais.
// Mantém prefixo legado para entidades internas/transversais (logs, movimentações, etc.)
// onde o prefixo ainda ajuda na rastreabilidade técnica.
const _SIMPLE_NUM_KEYS = new Set([
  // Operacionais
  'cli',   // Clientes
  'orc',   // Orçamentos
  'ped',   // Pedidos de venda
  'op',    // Ordens de produção
  'os',    // Ordens de serviço
  'prod',  // Produtos
  'sku',   // SKU de produto
  'rot',   // Rotas de expedição
  'sep',   // Separações
  // Cadastros
  'veic',  // Veículos
  'vend',  // Vendedores
  'mot',   // Motoristas
  'forn',  // Fornecedores
  'par',   // Parceiros
  'parc',  // Parceiros (alias)
  // CRM
  'opp',   // Oportunidades CRM
  'task',  // Tarefas CRM
  'fup',   // Follow-ups
  'auto',  // Automações
  'campo', // Campos customizados
  // Financeiro
  'cp',    // Contas a pagar
  'cr',    // Contas a receber
  'cred',  // Créditos de cliente
  'pc',    // Pedidos de compra / OC
  // Estoque/operação
  'dep',   // Depósitos
  'end',   // Endereços de estoque
  'inv',   // Inventários
  'tr',    // Transferências
  'dev',   // Devoluções
  'troca', // Trocas
  // Catálogo
  'marca', // Marcas
  'fab',   // Fabricantes
  // Fiscal
  'nfs',   // Notas fiscais de serviço
  // Patrimônio
  'pat',   // Patrimônio
  'imp',   // Impostos / itens fiscais
]);
// Mapa key -> [coleção, campo] onde o número aparece. Usado pra AUTO-CURAR o
// contador: nunca emitir um número <= ao maior já presente na coleção. Isso mata
// a repetição que acontecia quando o sync trazia registros de outro dispositivo
// com números mais altos (ou quando o contador regredia em app_settings).
const _COUNTER_COLECAO = {
  prod: ['produtos','id'],        sku:  ['produtos','sku'],
  orc:  ['orcamentos','id'],      ped:  ['pedidos','id'],
  op:   ['ops','id'],             os:   ['osServicos','id'],
  cli:  ['clientes','id'],        par:  ['parceiros','id'],
  forn: ['fornecedores','id'],    vend: ['vendedores','id'],
  cr:   ['contasReceber','id'],   cp:   ['contasPagar','id'],
  cred: ['creditosCliente','id'], pc:   ['pedidosCompra','id'],
  inv:  ['inventarios','id'],     tr:   ['transferencias','id'],
  dep:  ['depositos','id'],       end:  ['enderecos','id'],
  mov:  ['movimentacoes','id'],   veic: ['veiculos','id'],
  mot:  ['motoristas','id'],      rot:  ['rotas','id'],
  pat:  ['patrimonios','id'],     imp:  ['impostos','id'],
  fup:  ['followUp','id'],        nfs:  ['notas','id'],
  opp:  ['oportunidades','id'],   task: ['tarefasCrm','id'],
  auto: ['automacoes','id'],      troca:['trocas','id'],
  dev:  ['devolucoes','id'],
};
function _maxNumeroEmUso(key) {
  const m = _COUNTER_COLECAO[key];
  if (!m) return 0;
  const arr = DB[m[0]];
  if (!Array.isArray(arr)) return 0;
  let max = 0;
  for (const item of arr) {
    const v = item && item[m[1]];
    if (v == null) continue;
    const mt = String(v).match(/(\d+)\s*$/); // pega os dígitos finais (ID puro ou PREFIXO-0001)
    if (mt) { const num = parseInt(mt[1], 10); if (num > max) max = num; }
  }
  return max;
}
// High-water mark por sessão: o auto-refresh (60s) recarrega counters do servidor
// e poderia regredir o contador no meio da sessão. Isto impede regressão.
const _hwmContadores = {};
// Próximo NÚMERO monotônico de um contador (consome). SEMPRE maior que: o contador,
// o maior número já em uso na coleção e o último emitido nesta sessão. Garante que
// NUNCA repete (lacunas são aceitáveis; repetição não é). Use direto quando precisar
// só do número (ex.: SKU com prefixo dinâmico); use nextId() quando quiser o id pronto.
function nextNum(key) {
  const n = Math.max(
    Number(DB.counters[key] || 1),
    _maxNumeroEmUso(key) + 1,
    (_hwmContadores[key] || 0) + 1
  );
  DB.counters[key] = n + 1;
  _hwmContadores[key] = n;
  return n;
}
function nextId(key, prefix, digits = 4) {
  const n = nextNum(key);
  // Para os módulos principais, retorna só o número (1, 2, 3...)
  if (_SIMPLE_NUM_KEYS.has(key)) return String(n);
  // Demais entidades mantêm prefixo (compatibilidade legada)
  return `${prefix}-${String(n).padStart(digits, '0')}`;
}
