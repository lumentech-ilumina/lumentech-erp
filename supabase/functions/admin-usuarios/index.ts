// =====================================================================
// Edge Function: admin-usuarios
//
// Gerencia usuários que exigem a service_role key (criação no Auth,
// reset de senha, exclusão definitiva) — coisas que NUNCA podem rodar
// no navegador. O front chama via supabaseClient.functions.invoke().
//
// Segurança em camadas:
//   1. Exige Authorization (JWT do usuário logado).
//   2. Confirma a identidade com a anon key + o JWT do chamador.
//   3. Reaproveita a função do banco public.usuario_tem_acesso(modulo,acao)
//      pra exigir a permissão certa do PERFIL (criar/editar/excluir em
//      'usuarios'). Admin sempre passa. Atacante sem perfil é barrado.
//   4. Só então usa a service_role pra executar a ação privilegiada.
//
// Ações (body.action):
//   'create'        -> cria no Auth + insere em public.usuarios
//   'resetPassword' -> troca a senha de um usuário existente
//   'delete'        -> remove do Auth + de public.usuarios
//
// Env injetadas automaticamente pelo Supabase (não precisa setar secret):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Mapeia cada ação para a permissão exigida no módulo 'usuarios'.
const ACAO_PERMISSAO: Record<string, string> = {
  create: 'criar',
  resetPassword: 'editar',
  delete: 'excluir',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Exige o JWT do chamador
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Não autenticado.' }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  const action = String(payload?.action || '');
  const permNecessaria = ACAO_PERMISSAO[action];
  if (!permNecessaria) return json({ error: 'Ação desconhecida.' }, 400);

  // 2) Cliente do CHAMADOR (anon + JWT) — confirma quem é
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Sessão inválida.' }, 401);
  }

  // 3) Permissão por PERFIL (reaproveita a função do banco)
  const { data: temAcesso, error: permErr } = await caller.rpc('usuario_tem_acesso', {
    modulo: 'usuarios',
    acao: permNecessaria,
  });
  if (permErr) return json({ error: 'Falha ao checar permissão: ' + permErr.message }, 500);
  if (temAcesso !== true) {
    return json({ error: 'Sem permissão para esta ação.' }, 403);
  }

  // 4) Cliente ADMIN (service_role) — executa a ação privilegiada
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (action === 'create') {
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');
      const nome = String(payload.nome || '').trim();
      if (!email) return json({ error: 'Informe o e-mail.' }, 400);
      if (password.length < 6) return json({ error: 'Senha deve ter ao menos 6 caracteres.' }, 400);
      if (!nome) return json({ error: 'Informe o nome.' }, 400);

      // 4a) Cria no Auth (já confirmado — loga na hora)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (createErr || !created?.user) {
        const msg = (createErr?.message || '').toLowerCase();
        if (msg.includes('already')) return json({ error: 'E-mail já cadastrado no Auth.' }, 409);
        return json({ error: createErr?.message || 'Falha ao criar no Auth.' }, 400);
      }

      const novoId = created.user.id;

      // 4b) Insere o perfil na tabela (id = uid do Auth)
      const row = {
        id: novoId,
        nome,
        email,
        telefone: String(payload.telefone || ''),
        cargo: String(payload.cargo || ''),
        setor: String(payload.setor || ''),
        foto: String(payload.foto || ''),
        perfil_id: payload.perfilId || null,
        ativo: payload.ativo !== false,
        admin: false,
      };
      const { data: inserted, error: insErr } = await admin
        .from('usuarios')
        .insert(row)
        .select()
        .single();

      if (insErr) {
        // Rollback: desfaz o usuário do Auth pra não deixar órfão
        await admin.auth.admin.deleteUser(novoId).catch(() => {});
        return json({ error: 'Falha ao gravar perfil: ' + insErr.message }, 500);
      }

      return json({ ok: true, usuario: inserted });
    }

    if (action === 'resetPassword') {
      const id = String(payload.id || '');
      const password = String(payload.password || '');
      if (!id) return json({ error: 'ID ausente.' }, 400);
      if (password.length < 6) return json({ error: 'Senha deve ter ao menos 6 caracteres.' }, 400);

      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'delete') {
      const id = String(payload.id || '');
      if (!id) return json({ error: 'ID ausente.' }, 400);

      // Não deixa um admin se autoexcluir por engano
      if (id === userData.user.id) {
        return json({ error: 'Você não pode excluir o próprio usuário.' }, 400);
      }

      await admin.from('usuarios').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (err) {
    return json({ error: 'Erro interno: ' + (err?.message || String(err)) }, 500);
  }
});
