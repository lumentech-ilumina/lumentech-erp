// Camada de acesso a dados.
//
// Duas estratégias coexistem aqui:
// 1) Repos dedicados (Fase 1): usuarios, perfis_acesso, logs_acesso — escrita explícita por chamada.
// 2) Entidades JSONB write-through (Fase 2+): clientes, fornecedores, parceiros, vendedores,
//    consultores, funcionarios, interacoes. saveDB() local é interceptado e dispara um sync
//    debounced que faz batch upsert + delete-missing contra o Supabase. Permite migrar 168
//    call sites sem reescrever cada um — DB.X continua sendo a fonte em memória.

const repo = (() => {
  const sb = () => window.supabaseClient;

  // ====================================================
  // FASE 1 — repos dedicados
  // ====================================================
  function fromDbUsuario(row) {
    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone || '',
      cargo: row.cargo || '',
      setor: row.setor || '',
      foto: row.foto || '',
      perfilId: row.perfil_id,
      ativo: row.ativo,
      ultimoAcesso: row.ultimo_acesso,
      criadoEm: row.criado_em,
      admin: row.admin,
      login: row.email,
      senhaHash: '',
    };
  }
  function toDbUsuario(u) {
    return {
      nome: u.nome,
      email: u.email,
      telefone: u.telefone || '',
      cargo: u.cargo || '',
      setor: u.setor || '',
      foto: u.foto || '',
      perfil_id: u.perfilId,
      ativo: u.ativo !== false,
    };
  }
  function fromDbPerfil(row) {
    return {
      id: row.id,
      nome: row.nome,
      descricao: row.descricao || '',
      padrao: !!row.padrao,
      sistema: !!row.sistema,
      permissoes: row.permissoes || {},
      restricoesEspeciais: row.restricoes_especiais || [],
      criadoEm: row.criado_em,
    };
  }
  function toDbPerfil(p) {
    return {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao || '',
      padrao: !!p.padrao,
      sistema: !!p.sistema,
      permissoes: p.permissoes || {},
      restricoes_especiais: p.restricoesEspeciais || [],
    };
  }
  function fromDbLog(row) {
    return {
      id: String(row.id),
      usuarioId: row.usuario_id,
      acao: row.acao,
      modulo: row.modulo || '',
      detalhe: row.detalhe || '',
      data: row.data,
      ip: row.ip || '',
    };
  }

  async function listUsuarios() {
    const { data, error } = await sb().from('usuarios').select('*').order('criado_em', { ascending: true });
    if (error) throw error;
    return (data || []).map(fromDbUsuario);
  }
  async function updateUsuario(id, patch) {
    const { data, error } = await sb().from('usuarios').update(toDbUsuario(patch)).eq('id', id).select().single();
    if (error) throw error;
    return fromDbUsuario(data);
  }
  // Chama a Edge Function admin-usuarios e devolve o corpo já tratado.
  // functions.invoke NÃO coloca o corpo em `data` quando o status é non-2xx —
  // ele entrega um FunctionsHttpError com o Response em `error.context`.
  // Lemos esse corpo pra mostrar a mensagem real (ex.: "Sem permissão...")
  // em vez do genérico "Edge Function returned a non-2xx status code".
  async function invokeAdminUsuarios(body, fallbackMsg) {
    const { data, error } = await sb().functions.invoke('admin-usuarios', { body });
    if (error) {
      let msg = error.message || fallbackMsg;
      try {
        if (error.context && typeof error.context.json === 'function') {
          const corpo = await error.context.json();
          if (corpo?.error) msg = corpo.error;
        }
      } catch (_) { /* corpo não-JSON: mantém msg */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  // Criação de usuário precisa da service_role (cria no Auth) -> via Edge Function.
  async function createUsuario(u) {
    const data = await invokeAdminUsuarios({
      action: 'create',
      nome: u.nome,
      email: u.email,
      password: u.password,
      telefone: u.telefone || '',
      cargo: u.cargo || '',
      setor: u.setor || '',
      foto: u.foto || '',
      perfilId: u.perfilId || null,
      ativo: u.ativo !== false,
    }, 'Falha ao criar usuário.');
    return fromDbUsuario(data.usuario);
  }
  // Reset de senha de outro usuário também exige service_role.
  async function resetSenhaUsuario(id, password) {
    await invokeAdminUsuarios({ action: 'resetPassword', id, password }, 'Falha ao redefinir senha.');
    return true;
  }
  async function deleteUsuario(id) {
    // Remove do Auth E da tabela (service_role) — senão sobra login órfão.
    await invokeAdminUsuarios({ action: 'delete', id }, 'Falha ao excluir usuário.');
  }
  async function setUsuarioAtivo(id, ativo) {
    const { data, error } = await sb().from('usuarios').update({ ativo }).eq('id', id).select().single();
    if (error) throw error;
    return fromDbUsuario(data);
  }

  async function listPerfis() {
    const { data, error } = await sb().from('perfis_acesso').select('*').order('criado_em', { ascending: true });
    if (error) throw error;
    return (data || []).map(fromDbPerfil);
  }
  async function upsertPerfil(perfil) {
    const { data, error } = await sb().from('perfis_acesso').upsert(toDbPerfil(perfil)).select().single();
    if (error) throw error;
    return fromDbPerfil(data);
  }
  async function deletePerfil(id) {
    const { error } = await sb().from('perfis_acesso').delete().eq('id', id);
    if (error) throw error;
  }

  async function listLogs(limit = 500) {
    const { data, error } = await sb().from('logs_acesso').select('*').order('data', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(fromDbLog);
  }
  async function pushLog({ usuarioId, acao, modulo, detalhe }) {
    const { data, error } = await sb().from('logs_acesso').insert({
      usuario_id: usuarioId || null,
      acao,
      modulo: modulo || null,
      detalhe: detalhe || null,
    }).select().single();
    if (error) throw error;
    return fromDbLog(data);
  }
  async function clearLogs() {
    const { error } = await sb().from('logs_acesso').delete().gte('id', 0);
    if (error) throw error;
  }

  // ====================================================
  // FASE 2 — entidades JSONB write-through
  // ====================================================
  // Lista das tabelas-entidade que seguem o padrão (id text, dados jsonb).
  // Cada entrada é uma string (table === key) OU {table, key} quando a tabela Supabase
  // está em snake_case e a propriedade em DB está em camelCase.
  const JSONB_ENTITIES = [
    // Fase 2 — Comercial
    'clientes', 'fornecedores', 'parceiros', 'vendedores',
    'consultores', 'funcionarios', 'interacoes',
    // Fase 3 — Produtos
    'produtos',
    { table: 'categorias_produto',  key: 'categoriasProduto' },
    { table: 'marcas_produto',      key: 'marcasProduto' },
    { table: 'fabricantes_produto', key: 'fabricantesProduto' },
    { table: 'tabelas_preco',       key: 'tabelasPreco' },
    // Fase 4 — Vendas
    'orcamentos', 'pedidos',
    // Fase 5 — Estoque
    'estoque', 'movimentacoes', 'lotes', 'depositos', 'enderecos',
    { table: 'pedidos_compra', key: 'pedidosCompra' },
    'inventarios', 'transferencias',
    // Fase 6 — Financeiro
    { table: 'contas_pagar',   key: 'contasPagar' },
    { table: 'contas_receber', key: 'contasReceber' },
    // Fase 7 — Produção & OS
    'ops',
    { table: 'os_servicos', key: 'osServicos' },
    'veiculos',
    // Fase 7 — CRM
    'funis', 'oportunidades', 'automacoes',
    { table: 'tarefas_crm', key: 'tarefasCrm' },
    // Fase 7 — Pós-venda
    'trocas', 'devolucoes',
    { table: 'creditos_cliente',  key: 'creditosCliente' },
    { table: 'prestacoes_contas', key: 'prestacoesContas' },
    // Fase 7 — Fiscal
    'notas',
    // Fase 7 — Auxiliares
    { table: 'categorias_forn', key: 'categoriasForn' },
    // Fase 9 — Suprimentos
    'patrimonios', 'impostos',
    { table: 'follow_up', key: 'followUp' },
    // Fase 10 — Ambientes padrão (para orçamentos do tipo Projeto)
    { table: 'ambientes_padrao', key: 'ambientesPadrao' },
    // Fase 11 — Logística e pós-venda complementares
    { table: 'motivos_troca',         key: 'motivosTroca' },
    { table: 'motivos_devolucao',     key: 'motivosDevolucao' },
    { table: 'etapas_producao',       key: 'etapasProducao' },
    { table: 'os_status',             key: 'osStatus' },
    { table: 'separacao_etapas',      key: 'separacaoEtapas' },
    { table: 'pendencias_separacao',  key: 'pendenciasSeparacao' },
    { table: 'auditoria_exclusoes',   key: 'auditoriaExclusoes' },
    'motoristas',
    'rotas',
    'transportadoras',
    // Fase 12 — Vendas Externas (Field Sales CRM)
    { table: 'pontos_comerciais',  key: 'pontosComerciais' },
    { table: 'visitas_campo',      key: 'visitasCampo' },
    { table: 'segmentos_vendas',   key: 'segmentosVendas' },
    { table: 'metas_comerciais',   key: 'metasComerciais' },
    { table: 'centros_custo',        key: 'centrosCusto' },
    { table: 'separacoes',           key: 'separacoes' },
    { table: 'locais_armazenamento', key: 'locaisArmazenamento' },
  ];

  function _entityTable(e) { return typeof e === 'string' ? e : e.table; }
  function _entityKey(e)   { return typeof e === 'string' ? e : e.key; }

  // Singletons: configurações que não são arrays. Armazenadas em app_settings (chave/valor).
  // DB[key] é um objeto, não array.
  // automacoesProducao e dreAjustes são objetos de config (não-arrays) → app_settings,
  // pra que a configuração de automações e os ajustes de DRE apareçam pra equipe.
  const SINGLETON_KEYS = ['configOS', 'counters', 'empresa', 'automacoesProducao', 'dreAjustes'];
  const _lastSyncedSingletonHash = {};

  // Snapshot dos IDs presentes no servidor (por entidade). Usado pra detectar deletes locais.
  const _serverIds = {};
  // Hash do estado local após último sync (por entidade). Usado pra evitar upserts redundantes.
  const _lastSyncedHash = {};
  // Tabelas que sabemos estar ausentes no Supabase (descobertas no bootstrap). Pula sync delas
  // pra não poluir o console com o mesmo erro a cada saveDB.
  const _missingTables = new Set();

  function _entityHash(items) {
    return JSON.stringify(items || []);
  }

  async function loadJsonbEntity(tbl) {
    const { data, error } = await sb().from(tbl).select('id, dados').order('criado_em', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => {
      const obj = r.dados || {};
      return { ...obj, id: r.id };
    });
  }

  async function syncJsonbEntity(entity) {
    if (!window.DB) return;
    const tbl = _entityTable(entity);
    const key = _entityKey(entity);
    if (_missingTables.has(tbl)) return; // tabela ainda não criada — não tenta
    const items = window.DB[key] || [];
    const hash = _entityHash(items);
    if (_lastSyncedHash[tbl] === hash) return; // sem mudanças

    const rows = items
      .filter(item => item && item.id != null)
      .map(item => ({ id: String(item.id), dados: item }));

    // Upsert em LOTES POR TAMANHO. Produtos carregam imagens base64 inline e um upsert
    // único de todo o catálogo estoura o limite de tamanho da requisição — o erro
    // derrubava o sync inteiro e o registro nunca chegava ao servidor (e depois o
    // bootstrap o apagava). Quebramos por bytes (não por contagem) porque uma única
    // foto pesada já pode encher um lote. Se um lote falhar, o erro propaga (caller
    // registra) e o hash NÃO é marcado, então o próximo saveDB tenta de novo.
    if (rows.length > 0) {
      const LIMITE_LOTE = 1_500_000; // ~1.5MB por requisição (folga sob o limite do PostgREST)
      let lote = [];
      let bytes = 0;
      const enviar = async () => {
        if (!lote.length) return;
        const { error } = await sb().from(tbl).upsert(lote, { onConflict: 'id' });
        if (error) throw error;
        lote = []; bytes = 0;
      };
      for (const row of rows) {
        const tam = JSON.stringify(row).length;
        if (lote.length && bytes + tam > LIMITE_LOTE) await enviar();
        lote.push(row);
        bytes += tam;
      }
      await enviar();
    }

    const localIds = new Set(rows.map(r => r.id));
    const prevIds = _serverIds[tbl] || new Set();
    const toDelete = [...prevIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      const { error } = await sb().from(tbl).delete().in('id', toDelete);
      if (error) throw error;
    }

    _serverIds[tbl] = localIds;
    _lastSyncedHash[tbl] = hash;
  }

  async function loadSingletons() {
    const { data, error } = await sb().from('app_settings').select('chave, dados');
    if (error) throw error;
    const out = {};
    (data || []).forEach(row => { out[row.chave] = row.dados || {}; });
    return out;
  }

  async function syncSingleton(key) {
    if (!window.DB || !sb()) return;
    const value = window.DB[key];
    if (value == null) return;
    const hash = JSON.stringify(value);
    if (_lastSyncedSingletonHash[key] === hash) return;
    const { error } = await sb().from('app_settings').upsert(
      { chave: key, dados: value },
      { onConflict: 'chave' }
    );
    if (error) throw error;
    _lastSyncedSingletonHash[key] = hash;
  }

  async function syncAll() {
    if (!window.DB || !sb()) return;
    for (const entity of JSONB_ENTITIES) {
      try {
        await syncJsonbEntity(entity);
      } catch (err) {
        console.error('Sync ' + _entityTable(entity) + ' falhou:', err);
      }
    }
    for (const key of SINGLETON_KEYS) {
      try {
        await syncSingleton(key);
      } catch (err) {
        console.error('Sync singleton ' + key + ' falhou:', err);
      }
    }
  }

  let _syncTimer = null;
  let _syncInFlight = false;
  function syncAllDebounced(delay = 800) {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      _syncTimer = null;
      if (_syncInFlight) { syncAllDebounced(250); return; }
      _syncInFlight = true;
      try { await syncAll(); }
      finally { _syncInFlight = false; }
    }, delay);
  }

  function hookSaveDB() {
    const original = window.saveDB;
    if (!original || original._lumentechWrapped) return;
    const wrapped = function lumentechSaveDB() {
      const r = original.apply(this, arguments);
      if (sb()) syncAllDebounced();
      return r;
    };
    wrapped._lumentechWrapped = true;
    window.saveDB = wrapped;
  }

  // ====================================================
  // Bootstrap — hidrata DB com tudo o que vive no Supabase
  // ====================================================
  async function bootstrap() {
    // Fase 1
    const [usuarios, perfisAcesso, logsAcesso] = await Promise.all([
      listUsuarios(), listPerfis(), listLogs(),
    ]);
    if (window.DB) {
      window.DB.usuarios = usuarios;
      window.DB.perfisAcesso = perfisAcesso;
      window.DB.logsAcesso = logsAcesso;
    }

    // Fase 2+ — jsonb entities + singletons EM PARALELO (uma rodada de rede a menos).
    // Carregamento resiliente: tabela faltante não derruba o login.
    const [results, settings] = await Promise.all([
      Promise.all(JSONB_ENTITIES.map(async e => {
        try {
          return { ok: true, items: await loadJsonbEntity(_entityTable(e)) };
        } catch (err) {
          const msg = (err && (err.message || err.error_description || '')) + '';
          const tabelaFaltante = /Could not find the table|relation .* does not exist|schema cache/i.test(msg);
          if (tabelaFaltante) {
            console.warn(`[repo] Tabela "${_entityTable(e)}" ainda não existe no Supabase — usando lista vazia. Rode a migration SQL pra criar.`);
            _missingTables.add(_entityTable(e));
          } else {
            console.error(`[repo] Falha ao carregar "${_entityTable(e)}":`, err);
          }
          return { ok: false, items: [] };
        }
      })),
      loadSingletons().catch(err => { console.error('Falha ao carregar singletons:', err); return null; }),
    ]);
    // Entidades de CONFIG que têm valores padrão embutidos: se o servidor vier
    // vazio (tabela recém-criada ou ausente), NÃO esvazia — mantém os padrões
    // locais (eles sobem no próximo saveDB). Evita quebrar kanbans.
    // Entidades que NÃO devem ser esvaziadas se o servidor vier vazio:
    // - config com padrões embutidos;
    // - 'metasComerciais': metas lançadas localmente antes do sync — preserva e
    //   sobe pro servidor no próximo saveDB (em vez de perder o que foi digitado).
    const _backedByDefaults = new Set([
      'osStatus', 'separacaoEtapas', 'etapasProducao', 'motivosTroca', 'motivosDevolucao',
      'segmentosVendas', 'categoriasProduto', 'categoriasForn', 'tabelasPreco', 'funis',
      'metasComerciais',
      // coleções da equipe que eram local-only (preserva o que já existe e sobe no próximo save)
      'centrosCusto', 'separacoes', 'locaisArmazenamento',
    ]);
    JSONB_ENTITIES.forEach((entity, i) => {
      const tbl = _entityTable(entity);
      const key = _entityKey(entity);
      const { ok, items } = results[i];

      // CARREGAMENTO FALHOU (tabela ausente / erro de rede): NUNCA sobrescreve o
      // que já está em memória. Um erro transitório jamais pode apagar dado local.
      // (Antes o código zerava DB[key] aqui — era uma das causas de "cadastrei e sumiu".)
      if (!ok) return;

      const serverIds = new Set(items.map(x => String(x.id)));

      if (_backedByDefaults.has(key)) {
        // Config com padrões embutidos: servidor manda; se vier vazio, mantém o padrão local.
        const manterPadrao = items.length === 0
          && Array.isArray(window.DB?.[key]) && window.DB[key].length > 0;
        if (window.DB && !manterPadrao) window.DB[key] = items;
      } else {
        // ENTIDADES DE DADOS (produtos, clientes, pedidos...): preserva registros
        // criados localmente que AINDA NÃO subiram pro servidor — senão o bootstrap
        // (que roda no login E a cada 60s no auto-refresh) apagaria o que a pessoa
        // acabou de cadastrar antes do sync debounced concluir.
        //
        // Critério de "pendente de upload": id que não está no servidor agora E que
        // nunca foi conhecido como existente no servidor (_serverIds anterior). Se o id
        // ESTAVA no servidor e sumiu, foi deletado em outro dispositivo → respeita o
        // delete e não ressuscita. Se nunca esteve, foi criado aqui → mantém.
        const prevServer = _serverIds[tbl] || new Set();
        const locais = Array.isArray(window.DB?.[key]) ? window.DB[key] : [];
        const pendentes = locais.filter(x =>
          x && x.id != null &&
          !serverIds.has(String(x.id)) &&
          !prevServer.has(String(x.id))
        );
        if (window.DB) window.DB[key] = pendentes.length ? items.concat(pendentes) : items;
      }

      // Estado de sync reflete o que o SERVIDOR tem. Como DB[key] pode conter pendentes
      // (hash diferente), o próximo saveDB dispara o upsert e eles sobem de verdade.
      _serverIds[tbl] = serverIds;
      _lastSyncedHash[tbl] = _entityHash(items);
    });

    // Singletons (configOS, counters, empresa) — já carregados acima em paralelo.
    if (settings) {
      SINGLETON_KEYS.forEach(key => {
        if (key === 'counters' && window.DB) {
          // CONTADORES NUNCA REGRIDEM. app_settings é last-write-wins: um dispositivo
          // atrasado podia sobrescrever o contador por um valor menor → IDs repetidos
          // (e produtos "sumindo" porque o upsert por id sobrescrevia o anterior).
          // Merge por MÁXIMO: o efetivo é sempre o maior entre local e servidor.
          const local  = window.DB.counters || {};
          const remoto = settings[key] || {};
          const merged = { ...local };
          for (const k of Object.keys(remoto)) {
            merged[k] = Math.max(Number(local[k] || 0), Number(remoto[k] || 0));
          }
          window.DB.counters = merged;
          // NÃO marca o hash como sincronizado de propósito: assim o merge (>=) sobe
          // pro servidor no próximo saveDB e o servidor converge pra cima também.
        } else if (settings[key] && window.DB) {
          // Veio do servidor → aplica e marca como sincronizado.
          window.DB[key] = settings[key];
          _lastSyncedSingletonHash[key] = JSON.stringify(window.DB[key] || {});
        }
        // configOS/empresa local-only (sem valor no servidor): NÃO marca o hash,
        // pra subir no próximo saveDB em vez de ficar preso só no navegador.
      });
    }

    if (typeof window.saveDB === 'function') window.saveDB();
    return { usuarios, perfisAcesso, logsAcesso };
  }

  // Tentar fazer flush antes de fechar a aba. Não é 100% confiável (promises async em
  // beforeunload são limitadas) mas evita perda de saves no caminho feliz.
  window.addEventListener('beforeunload', () => {
    if (_syncTimer) {
      clearTimeout(_syncTimer);
      _syncTimer = null;
      syncAll().catch(() => {});
    }
  });

  hookSaveDB();

  // ====================================================
  // AUDITORIA DE AÇÕES — trilha forense de criar/editar/excluir/aprovar
  // ====================================================
  // Falha silenciosa: se a tabela ainda não existe (migration não rodada)
  // ou se a inserção falhar, NÃO bloqueia a ação do usuário — log é "best effort".

  let _auditMissing = false;

  async function logAcao({ acao, entidade, entidadeId, resumo, dados }) {
    if (_auditMissing) return null;
    if (!sb()) return null;
    const u = window.CURRENT_USER || {};
    const row = {
      usuario_id:   u.id || null,
      usuario_nome: u.nome || u.email || null,
      acao,
      entidade,
      entidade_id:  entidadeId != null ? String(entidadeId) : null,
      resumo:       resumo || null,
      dados:        dados || null,
      user_agent:   typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 500) : null,
    };
    try {
      const { error } = await sb().from('auditoria_acoes').insert(row);
      if (error) {
        const msg = (error.message || '') + '';
        if (/Could not find the table|relation .* does not exist|schema cache/i.test(msg)) {
          _auditMissing = true;
          console.warn('[audit] tabela auditoria_acoes não existe — rode a migration 2026-05-29_audit_log.sql');
        } else {
          console.warn('[audit] falha ao logar ação:', msg);
        }
        return null;
      }
    } catch (err) {
      console.warn('[audit] erro inesperado:', err);
    }
    return row;
  }

  async function listAuditoria({ limit = 200, entidade = null, entidadeId = null, usuarioId = null } = {}) {
    if (_auditMissing || !sb()) return [];
    let q = sb().from('auditoria_acoes').select('*').order('criado_em', { ascending: false }).limit(limit);
    if (entidade)   q = q.eq('entidade', entidade);
    if (entidadeId) q = q.eq('entidade_id', String(entidadeId));
    if (usuarioId)  q = q.eq('usuario_id', usuarioId);
    const { data, error } = await q;
    if (error) { console.warn('[audit] list falhou:', error.message); return []; }
    return data || [];
  }

  // Numeração atômica server-side (NF, romaneio): devolve um número único via RPC
  // (lock de linha no servidor). Retorna null se offline/erro — o chamador então
  // cai no contador local como último recurso (ver _proximoNumeroSeguro no app).
  async function proximoNumero(tipo) {
    if (!sb()) return null;
    const { data, error } = await sb().rpc('proximo_numero', { p_tipo: tipo });
    if (error) { console.warn('proximo_numero falhou:', error); return null; }
    return typeof data === 'number' ? data : Number(data);
  }

  return {
    usuarios: { list: listUsuarios, create: createUsuario, update: updateUsuario, delete: deleteUsuario, setAtivo: setUsuarioAtivo, resetSenha: resetSenhaUsuario },
    perfis:   { list: listPerfis,   upsert: upsertPerfil, delete: deletePerfil },
    logs:     { list: listLogs,     push: pushLog,        clear: clearLogs },
    audit:    { log: logAcao,       list: listAuditoria },
    bootstrap,
    sync: { all: syncAll, allDebounced: syncAllDebounced, entity: syncJsonbEntity },
    proximoNumero,
    JSONB_ENTITIES,
  };
})();

window.repo = repo;
