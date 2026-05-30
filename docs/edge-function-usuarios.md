# Edge Function `admin-usuarios` — criar usuários direto no ERP

Permite que o admin crie usuários, redefina senhas e exclua logins **direto pela tela
Usuários & Acessos**, sem abrir o painel Supabase. A criação de login no Auth exige a
`service_role` key — que nunca pode ficar no navegador — então roda nesta função
server-side.

## O que ela faz

| Ação | O que executa | Permissão exigida (módulo `usuarios`) |
|---|---|---|
| `create` | Cria no Auth (já confirmado) + insere em `usuarios` com `id` = uid | `criar` |
| `resetPassword` | Troca a senha de um usuário existente | `editar` |
| `delete` | Remove do Auth **e** da tabela `usuarios` | `excluir` |

Segurança: a função confirma o JWT do chamador e reaproveita a função do banco
`public.usuario_tem_acesso(modulo, acao)` pra exigir a permissão do perfil. Admin sempre passa.

## Pré-requisitos (uma vez)

1. **Supabase CLI** instalado: https://supabase.com/docs/guides/cli
2. Logar e vincular o projeto:
   ```powershell
   supabase login
   supabase link --project-ref cghvbxashqjrehvurmkk
   ```

## Deploy

Da raiz do projeto:

```powershell
supabase functions deploy admin-usuarios
```

> **Não precisa setar secret.** O Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
> `SUPABASE_SERVICE_ROLE_KEY` automaticamente nas Edge Functions.

A função não usa o gateway de verificação de JWT do próprio Supabase (ela mesma valida o
token e a permissão). Se o deploy reclamar, pode rodar com:

```powershell
supabase functions deploy admin-usuarios --no-verify-jwt
```

## Testar

1. Entre no ERP como **admin**.
2. **Usuários & Acessos → Novo usuário** → preencha nome, e-mail, perfil e senha → **Criar usuário**.
3. Saia e entre com o novo login — o menu deve respeitar o perfil escolhido.
4. Edite o usuário, preencha só a senha → salva e redefine a senha de verdade.

## Se der erro

- **"Sem permissão para esta ação"** → o usuário logado não é admin nem tem `criar` em `usuarios`.
- **"E-mail já cadastrado no Auth"** → já existe esse login; use outro e-mail ou exclua o antigo.
- **CORS / function não encontrada** → a função não foi deployada, ou o nome difere de `admin-usuarios`.
- Logs em tempo real: `supabase functions logs admin-usuarios`.
