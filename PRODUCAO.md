# Lumentech ERP — Checklist pra produção

Status em **2026-05-29**. O que ainda falta pra colocar no ar em produção real.

---

## ✅ Já feito (não precisa mexer)

- Auth real via Supabase (signInWithPassword, sessão persistente)
- Write-through pra ~40 entidades (saveDB local → debounce 800ms → upsert Supabase)
- Bootstrap resiliente (`_missingTables` ignora tabelas faltantes sem derrubar o login)
- 7 perfis padrão + logs de acesso
- Brandbook aplicado (Unbounded 200-500, paleta, ícones outline 1.5px)
- Página Início com atalhos
- Engrenagem padronizada em CRM/OS/Produção/Separação
- Modais Gerenciar Etapas (kanban editável por módulo)

---

## 🔴 BLOQUEADORES de produção (precisam ser resolvidos)

### 1. Senha antiga (`********`) ainda no histórico Git
- **Risco**: senha está em commits antigos (`5f1d9b2`) e era hardcoded no `auth.js` legado
- **Ação**: rodar `git filter-repo` + force push (instruções em [HANDOFF.md](HANDOFF.md):189)
- **Pré-requisito**: confirmar que a senha NOVA já está sendo usada e a antiga foi trocada em todos os serviços
- **Quem faz**: usuário (operação destrutiva no Git, requer autorização)

### 2. Aplicar a migration pendente no Supabase
- **Arquivo**: [supabase/migrations/2026-05-22_add_missing_jsonb_tables.sql](supabase/migrations/2026-05-22_add_missing_jsonb_tables.sql)
- **Cria**: `motivos_troca`, `pendencias_separacao`, `auditoria_exclusoes`, `motoristas`, `rotas` + policy do singleton `empresa` em `app_settings`
- **Sem isso**: o write-through dessas 5 tabelas é silenciosamente ignorado (mas os dados ficam só no localStorage)
- **Quem faz**: usuário — copiar SQL e rodar no painel Supabase → SQL Editor
- **NOVO**: precisa criar migration para `separacao_etapas`, `os_status`, `etapas_producao_v2` (configuração dos kanbans editáveis — atualmente só ficam no localStorage)

### 3. RLS habilitado em TODAS as tabelas
- **Estado**: nas tabelas novas tem RLS + policy de `authenticated` (linha 28 da migration). Confirmar que TODAS as tabelas JSONB criadas em fases anteriores também têm
- **Ação**: rodar no painel SQL:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = false;
  ```
  Qualquer linha que aparecer = problema. Habilitar com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` e criar policies.

### 4. Hospedagem
- **Estado**: sistema só roda local hoje (`file://` ou servidor local)
- **Opções recomendadas** (todas gratuitas, HTTPS automático, deploy via Git push):
  - **Vercel** — mais simples, deploy automático, custom domain grátis
  - **Netlify** — igual ao Vercel, mesma facilidade
  - **Cloudflare Pages** — performance global, CDN gratuito
- **Configs já preparadas**: `vercel.json` e `netlify.toml` neste repo trazem os security headers prontos
- **Quem decide**: usuário (qualquer um serve; Vercel é o mais rápido pra começar)

---

## 🟡 Importantes (não bloqueiam, mas devem entrar no MVP)

### 5. Backup automático no Supabase
- **Free tier**: 7 dias de PITR (Point-In-Time Recovery)
- **Pro tier**: 14 dias + backup diário
- **Ação**: verificar em Supabase → Database → Backups. Se estiver em Free, considerar Pro ($25/mês) pro projeto crítico

### 6. Recuperação de senha
- **Estado atual**: link "Esqueceu a senha?" no login está com `href="#"` morto
- **Implementação**: usar `supabase.auth.resetPasswordForEmail()` — built-in, manda email com link
- **Pré-requisito**: configurar SMTP em Supabase → Auth → Email Templates (pode usar SendGrid grátis até 100 emails/dia)
- ⚙️ **Em implementação nesta sessão**

### 7. Security headers via meta tag
- **Estado**: sem CSP, sem X-Frame-Options
- **Mínimo viável**: adicionar `<meta http-equiv="Content-Security-Policy" ...>` no `<head>` permitindo só os CDNs usados (fonts.googleapis.com, unpkg.com/leaflet, cdn.jsdelivr.net, *.supabase.co)
- ⚙️ **Em implementação nesta sessão**

### 8. User chip da sidebar (hardcoded)
- **Estado**: `<div class="user-chip">RR / Ronyel Rick / Administrador</div>` está fixo no HTML
- **Ação**: ler `authService.currentUser()` + `DB.usuarios.find(u => u.email === user.email)` e popular avatar/nome/cargo dinamicamente
- ⚙️ **Em implementação nesta sessão**

---

## 🟢 Pós-MVP (depois que estiver no ar)

### 9. Migrar fotos/anexos de base64 → Supabase Storage
- **Hoje**: imagens viram base64 dentro do `dados jsonb` — incha o tamanho da row, ineficiente
- **Solução**: bucket `lumentech-assets` com policy de leitura pública (ou signed URL), upload via `supabase.storage.from()`
- Vale a pena fazer só quando tiver volume real

### 10. Email transacional além de senha
- Comunicação de aprovação de orçamento, NF emitida, OS finalizada, etc
- Pode integrar com SendGrid, Resend, Mailtrap

### 11. Monitoramento de erros
- Sentry free tier dá conta (5k erros/mês)
- Adicionar `<script src="...sentry...">` + `Sentry.init({...})` antes do app

### 12. Permissões granulares enforcement
- Os 7 perfis estão cadastrados, mas o app não bloqueia/esconde nada com base neles ainda
- Já tem placeholder em `defaultPerfisAcesso()` em [js/db.js](js/db.js) — falta o gate em cada renderer e nos handlers de ação
- Trabalho de ~2-3 dias

### 13. Limpar arquivo duplicado
- `"lumentech-erp - Copia.html"` está na raiz como untracked. Apagar (ou mover pra fora do repo)

### 14. CSV import para dados iniciais
- Se a Lumentech tem cadastros antigos em planilha (clientes, produtos), criar um importador
- Pode ser feito pela tela de cada módulo: botão "Importar CSV" → preview → upsert em batch

---

## Roteiro sugerido (ordem de execução)

1. **Esta sessão (autônomo)**: CSP meta + recuperação de senha + user chip dinâmico + configs de hosting
2. **Usuário valida e roda no Supabase**:
   - SQL da migration pendente
   - SQL de checagem de RLS (e fix do que aparecer)
3. **Usuário escolhe host** e faz o primeiro deploy (via push pro Git)
4. **Limpar histórico Git** da senha antiga (com backup primeiro)
5. **Configurar SMTP** no Supabase pra ativar a recuperação de senha
6. **Anunciar pro time** que o sistema está em produção
7. **Pós-MVP**: storage de imagens, monitoramento, permissões granulares
