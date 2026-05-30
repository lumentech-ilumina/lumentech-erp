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
    { table: 'pendencias_separacao',  key: 'pendenciasSeparacao' },
    { table: 'auditoria_exclusoes',   key: 'auditoriaExclusoes' },
    'motoristas',
    'rotas',
    // Fase 12 — Vendas Externas (Field Sales CRM)
    { table: 'pontos_comerciais',  key: 'pontosComerciais' },
    { table: 'visitas_campo',      key: 'visitasCampo' },
    { table: 'segmentos_vendas',   key: 'segmentosVendas' },
  ];

  function _entityTable(e) { return typeof e === 'string' ? e : e.table; }
  function _entityKey(e)   { return typeof e === 'string' ? e : e.key; }

  // Singletons: configurações que não são arrays. Armazenadas em app_settings (chave/valor).
  // DB[key] é um objeto, não array.
  const SINGLETON_KEYS = ['configOS', 'counters', 'empresa'];
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

    if (rows.length > 0) {
      const { error } = await sb().from(tbl).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
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

    // Fase 2+ — jsonb entities (carregamento resiliente: tabela faltante não derruba o login)
    const results = await Promise.all(JSONB_ENTITIES.map(async e => {
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
    }));
    JSONB_ENTITIES.forEach((entity, i) => {
      const tbl = _entityTable(entity);
      const key = _entityKey(entity);
      const { ok, items } = results[i];
      if (window.DB) window.DB[key] = items;
      // Só registra estado de sync se carregou de verdade — assim a tabela ausente não vira
      // delete-missing no próximo sync (que apagaria dados locais por engano).
      if (ok) {
        _serverIds[tbl] = new Set(items.map(x => String(x.id)));
        _lastSyncedHash[tbl] = _entityHash(items);
      }
    });

    // Singletons (configOS, counters)
    try {
      const settings = await loadSingletons();
      SINGLETON_KEYS.forEach(key => {
        if (settings[key] && window.DB) {
          window.DB[key] = settings[key];
        }
        if (window.DB) _lastSyncedSingletonHash[key] = JSON.stringify(window.DB[key] || {});
      });
    } catch (err) {
      console.error('Falha ao carregar singletons:', err);
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

  return {
    usuarios: { list: listUsuarios, create: createUsuario, update: updateUsuario, delete: deleteUsuario, setAtivo: setUsuarioAtivo, resetSenha: resetSenhaUsuario },
    perfis:   { list: listPerfis,   upsert: upsertPerfil, delete: deletePerfil },
    logs:     { list: listLogs,     push: pushLog,        clear: clearLogs },
    audit:    { log: logAcao,       list: listAuditoria },
    bootstrap,
    sync: { all: syncAll, allDebounced: syncAllDebounced, entity: syncJsonbEntity },
    JSONB_ENTITIES,
  };
})();

window.repo = repo;
