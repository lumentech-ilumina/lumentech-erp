// Autenticação real via Supabase Auth.
// authService é a fachada usada pelo HTML — preserva a forma { ok, error } no login.

// Traduz mensagens cruas do Supabase (sempre em inglês) pro português, na voz do produto.
function traduzErroAuth(raw) {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('current password required'))                return 'O link de redefinição expirou ou não foi reconhecido. Solicite um novo e-mail e abra o link mais recente.';
  if (msg.includes('invalid login'))                            return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed'))                      return 'E-mail ainda não confirmado.';
  if (msg.includes('token has expired') || msg.includes('expired')) return 'O link expirou. Solicite um novo e-mail de redefinição.';
  if (msg.includes('same') && msg.includes('password'))         return 'A nova senha precisa ser diferente da anterior.';
  if (msg.includes('should be different'))                      return 'A nova senha precisa ser diferente da atual.';
  if (msg.includes('weak password') || msg.includes('password should be')) return 'Senha muito fraca. Use ao menos 8 caracteres.';
  if (msg.includes('rate limit') || msg.includes('too many'))   return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (msg.includes('user not found'))                           return 'Usuário não encontrado.';
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'Falha de conexão. Verifique sua internet e tente de novo.';
  return raw || 'Falha na autenticação.';
}
window.traduzErroAuth = traduzErroAuth;

const authService = {
  async login(email, password) {
    const e = (email || '').replace(/\s/g, '').toLowerCase();
    const p = (password || '').replace(/^\s+|\s+$/g, '');
    if (!e) return { ok: false, error: 'Informe o e-mail.' };
    if (!p) return { ok: false, error: 'Informe a senha.' };

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: e,
      password: p,
    });
    if (error) {
      return { ok: false, error: traduzErroAuth(error.message) };
    }
    return { ok: true, user: data.user, session: data.session };
  },

  async logout() {
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) throw error;
  },

  async currentUser() {
    const { data } = await window.supabaseClient.auth.getUser();
    return data?.user || null;
  },

  async currentSession() {
    const { data } = await window.supabaseClient.auth.getSession();
    return data?.session || null;
  },

  // Dispara o email de reset do Supabase. O usuário recebe um link mágico que
  // abre a página atual com tokens na URL — o handler de reset processa.
  async sendPasswordReset(email) {
    const e = (email || '').replace(/\s/g, '').toLowerCase();
    if (!e) return { ok: false, error: 'Informe o e-mail.' };
    const redirectTo = window.location.origin + window.location.pathname + '?reset=1';
    const { error } = await window.supabaseClient.auth.resetPasswordForEmail(e, { redirectTo });
    if (error) return { ok: false, error: traduzErroAuth(error.message) };
    return { ok: true };
  },

  // Aplica a nova senha (após o usuário clicar no link recebido por email).
  // Supabase coloca a sessão temporária automaticamente quando a URL tem o token.
  async updatePassword(newPassword) {
    const p = (newPassword || '').replace(/^\s+|\s+$/g, '');
    if (p.length < 8) return { ok: false, error: 'A senha precisa ter no mínimo 8 caracteres.' };
    const { error } = await window.supabaseClient.auth.updateUser({ password: p });
    if (error) return { ok: false, error: traduzErroAuth(error.message) };
    return { ok: true };
  },
};

window.authService = authService;
