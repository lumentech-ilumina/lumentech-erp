# Handoff — Integração Supabase do Lumentech ERP

Cola este documento inteiro no início de uma **nova sessão do Claude Code** (não `--continue`, sessão nova mesmo) — assim o MCP do Supabase fica disponível desde o começo.

---

## Contexto do projeto

- **Repositório:** https://github.com/ronyelrick-maker/lumentech-erp (privado)
- **Working dir:** `C:\Users\ronyel.rick\Documents\LUMENTECH_ERP`
- **Stack atual:** HTML único + vanilla JS + localStorage. Sem build step. Bibliotecas via CDN: Chart.js, Leaflet, qrcode-generator.
- **Domínio:** ERP completo para a Lumentech (fabricante de iluminação customizada em Fortaleza/CE).
- **Objetivo:** Deixar o sistema **production-ready** com banco real (Supabase), auth real, RLS, hospedagem.

## Estado atual (commit `fdc579a` no main)

**O que já foi feito (sessões anteriores):**

1. Repositório criado e versionado (`5f1d9b2` → `fdc579a`)
2. Refactor de organização — extraído do HTML monolítico:
   - `styles.css` — bloco principal de CSS (3474 linhas)
   - `js/db.js` — `STORAGE_KEY`, `loadDB`, `saveDB`, `defaultDB`, helpers `default*`, `DB` global, `nextId`. Comportamento inalterado (continua localStorage)
   - `js/auth.js` — `AUTH` constante e `authService.login()` como fachada
   - Login handler usa `authService.login()` em vez de comparar `AUTH.email/password` direto
3. `.gitignore` configurado (`.claude/`, `.env*`, editores, OS)
4. MCP do Supabase conectado em Claude Code (`plugin:supabase:supabase` via OAuth)

**Arquivos atuais:**

```
LUMENTECH_ERP/
├── lumentech-erp.html      (~28.770 linhas — restante do app)
├── styles.css              (CSS principal)
├── js/
│   ├── db.js               (state management, localStorage)
│   └── auth.js             (AUTH hardcoded + authService.login)
├── scripts/
│   └── refactor-split.ps1  (utilitário usado no refactor)
├── .gitignore
└── HANDOFF.md              (este arquivo)
```

## ⚠️ Alertas de segurança a tratar

1. **Senha em texto puro no histórico Git:** `********` está em commits antigos (`5f1d9b2`) hardcoded em `AUTH = { email: 'ronyelrick@gmail.com', password: '********' }`. Quando a auth real estiver pronta, executar `git filter-repo` para reescrever histórico e force-push.
2. **PAT do Supabase já revogado** (se ainda não, revogar em Supabase → Account → Access Tokens).
3. **Senha ******** deve ser trocada** em qualquer outro serviço onde o usuário a use.

## Decisões já tomadas (NÃO re-perguntar)

| Tópico | Decisão |
|---|---|
| Tenancy | **Single-tenant** (só Lumentech usa) |
| Migração de dados | **Começar do zero** (não importar localStorage) |
| Entidade piloto da Fase 1 | **Usuários + Perfis** (resolve auth + perfis junto) |
| Arquitetura | Manter vanilla JS, **sem framework por enquanto**. Refactor pesado fica para depois. |
| Camada de acesso | `js/db.js` é a fachada. Não substituir 168 call sites em massa — migrar incrementalmente por entidade. |
| Idioma | Português brasileiro |

## Roadmap completo (multi-sessão)

### Fase 1 (esta próxima sessão): Auth real + Usuários/Perfis

1. **Listar projetos Supabase** via MCP e identificar o projeto Lumentech
2. **Pegar Project URL + anon key** via MCP (não pedir pro usuário)
3. **Criar tabelas:**
   - `perfis_acesso` (id, nome, descricao, padrao bool, sistema bool, permissoes jsonb, restricoes_especiais text[], criado_em timestamptz)
   - `usuarios` (id uuid PK referência `auth.users`, nome, email unique, telefone, cargo, setor, foto, perfil_id FK perfis_acesso, ativo bool, ultimo_acesso timestamptz, criado_em timestamptz, admin bool)
   - `logs_acesso` (id, usuario_id FK, acao, modulo, detalhe, data, ip)
4. **Habilitar RLS em todas** + criar policies:
   - `perfis_acesso`: SELECT para todos autenticados; INSERT/UPDATE/DELETE só admins
   - `usuarios`: SELECT autenticados veem todos; UPDATE só admin OU próprio registro; INSERT/DELETE só admin
   - `logs_acesso`: INSERT por qualquer autenticado; SELECT só admin
5. **Seed dos 7 perfis padrão** (extraídos de `defaultPerfisAcesso()` em `js/db.js`):
   - `pf_admin`, `pf_gerente`, `pf_vendedor`, `pf_financeiro`, `pf_producao`, `pf_estoque`, `pf_tecnico`
6. **Criar primeiro admin** via Supabase Auth (email `ronyelrick@gmail.com`, senha **nova e forte**, NÃO a antiga)
   - Inserir registro correspondente em `usuarios` com `perfil_id = 'pf_admin'`
7. **Integrar SDK Supabase no HTML** (CDN):
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```
8. **Criar `js/supabase-client.js`** com a init do client (URL + anon key, ambas públicas por design):
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```
9. **Reescrever `js/auth.js`** — `authService.login()` agora é async e chama `supabase.auth.signInWithPassword`. Adicionar `authService.logout()`, `authService.currentUser()`. Remover constante `AUTH` hardcoded.
10. **Login handler em `lumentech-erp.html`** vira async/await.
11. **Migrar `DB.usuarios` e `DB.perfisAcesso`** para queries Supabase via `db.usuarios.list()`, `db.usuarios.create()`, etc. Identificar os call sites com `grep` e migrar.
12. **Testar:** login com email/senha, listar usuários, criar novo usuário (admin cria pelo painel "Usuários & Acessos"), logout.
13. **Commitar** com mensagem descritiva, push.

### Fase 2+: Demais entidades (sessões futuras, mesma fórmula)

Migrar em pacotes atômicos por entidade. Sugestão de ordem:
- Clientes + Fornecedores + Parceiros + Vendedores
- Produtos + Categorias + Marcas + Fabricantes + Tabelas de preço
- Orçamentos + Pedidos
- Produção (OPs) + OS de Serviço
- Estoque + Movimentações + Lotes + Depósitos + Endereços + Pedidos de Compra + Inventários + Transferências
- Financeiro (Contas Pagar/Receber, Centros de Custo, Fluxo de Caixa, DRE)
- Fiscal (Notas)
- CRM (Funis, Oportunidades, Tarefas, Automações)
- Trocas + Devoluções + Créditos + Prestações de Contas

Todas as entidades estão definidas em `defaultDB()` em [js/db.js](js/db.js). Total: **~40 entidades**.

### Fase 3: Storage, Hospedagem, Produção

- Supabase Storage para fotos de produtos/logos/anexos
- Hospedar em Vercel/Netlify/Cloudflare Pages (domínio custom + HTTPS)
- Limpar histórico Git da senha
- Configurar PITR/backups no Supabase
- Monitoramento de erros (Sentry?)
- Email transacional (recuperar senha — Supabase já tem built-in)

## Como executar a Fase 1 (instruções para a próxima sessão)

**Verifique primeiro que o MCP do Supabase está disponível:**

Use `ToolSearch` com query `+supabase` ou tente chamar qualquer tool do `plugin:supabase:supabase`. Se não houver tools, o usuário precisa autenticar via `/mcp` e iniciar sessão nova.

**Sequência:**

1. **Liste projetos Supabase** via MCP (`list_projects` ou equivalente) e confirme qual é o do Lumentech.
2. **Obtenha URL e anon key** desse projeto via MCP (`get_project_api_keys` ou similar).
3. **Execute SQL via MCP** para criar tabelas (`perfis_acesso`, `usuarios`, `logs_acesso`) com FKs corretas e índices.
4. **Habilite RLS e crie policies** via MCP (`execute_sql` com os comandos `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` e `CREATE POLICY`).
5. **Seed** dos 7 perfis: copie o conteúdo de `defaultPerfisAcesso()` em [js/db.js:117](js/db.js#L117) (aprox) e adapte para INSERT SQL.
6. **Crie o admin via Auth:** use a tool do MCP que gerencia auth.users, OU instrua o usuário a criar via painel Supabase → Authentication → Add user. Depois insira o registro em `usuarios` com `id = auth.users.id` e `perfil_id = 'pf_admin'`.
7. **Atualize o código:**
   - Adicione `<script src="..."></script>` do supabase-js no `<head>` do HTML
   - Crie `js/supabase-client.js` com URL+anon key (commitar normalmente, são públicas)
   - Adicione `<script src="js/supabase-client.js"></script>` antes de `js/db.js` e `js/auth.js`
   - Reescreva `js/auth.js` (tornar `login` async, usar Supabase Auth)
   - Atualize o handler do `#login-form` em `lumentech-erp.html` (linha ~28739) para async
   - Migrar leituras/escritas de `DB.usuarios` e `DB.perfisAcesso` pra queries Supabase
8. **Teste no preview** — login, listar usuários, criar usuário, logout
9. **Commit + push**

## Padrões e convenções a manter

- **Sem framework.** Continua vanilla JS.
- **Sem TypeScript.** Continua JS puro.
- **Português** em nomes de tabelas/colunas (consistente com o código).
- **Snake_case** para nomes SQL (`perfis_acesso`, `criado_em`).
- **Camel_case** para identificadores JS (que o código já usa).
- **JSDoc opcional** — não exigir.
- **Sem comentários** explicando o quê — só o porquê quando não óbvio.
- **Mensagens de commit em português**, descritivas, com porquê.

## Preferências do usuário (não re-perguntar)

- Idioma: pt-BR
- Email no Claude: `contato@sysled.io`
- Email no GitHub/Supabase: `ronyelrick@gmail.com`
- Usuário GitHub: `ronyelrick-maker`
- Estilo de comunicação: direto, prático, sem overhead
- Tolera transparência sobre riscos/decisões mas quer recomendação clara

## Lista completa de entidades (referência rápida)

De `defaultDB()` em [js/db.js](js/db.js):

```
clientes, fornecedores, funcionarios, produtos, consultores, parceiros,
interacoes, orcamentos, pedidos, ops, osServicos, estoque, contasPagar,
contasReceber, notas, trocas, devolucoes, creditosCliente, prestacoesContas,
movimentacoes, lotes, depositos, enderecos, pedidosCompra, inventarios,
transferencias, funis, oportunidades, tarefasCrm, automacoes,
categoriasProduto, marcasProduto, fabricantesProduto, tabelasPreco,
categoriasForn, veiculos, vendedores, configOS, usuarios, perfisAcesso,
logsAcesso, counters
```

## Arquivos críticos para o trabalho

| Arquivo | Linhas | O quê tem |
|---|---|---|
| `js/db.js` | 370 | Toda definição de schema e seed atual em localStorage |
| `js/auth.js` | 15 | AUTH hardcoded + authService.login() |
| `lumentech-erp.html:28739` | ~17 | Handler do login form |
| `lumentech-erp.html:109-110` | 2 | Tags `<script>` que carregam db.js e auth.js |

## Última coisa

A senha atual (`********`) está no histórico Git. **Antes de declarar produção**, executar:

```bash
# Backup primeiro
git clone --mirror git@github.com:ronyelrick-maker/lumentech-erp.git backup.git

# Limpar histórico (instalar git-filter-repo se necessário)
git filter-repo --replace-text <(echo "********==>***REMOVED***")
git push --force --all
```

**Não fazer isso até a auth real estar funcionando e a senha estar trocada em todos os outros serviços onde ela é usada.**
