// Autenticação real via Supabase Auth.
// authService é a fachada usada pelo HTML — preserva a forma { ok, error } no login.

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
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('invalid login')) return { ok: false, error: 'E-mail ou senha incorretos.' };
      if (msg.includes('email not confirmed')) return { ok: false, error: 'E-mail ainda não confirmado.' };
      return { ok: false, error: error.message || 'Falha ao autenticar.' };
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
    if (error) return { ok: false, error: error.message || 'Falha ao enviar email.' };
    return { ok: true };
  },

  // Aplica a nova senha (após o usuário clicar no link recebido por email).
  // Supabase coloca a sessão temporária automaticamente quando a URL tem o token.
  async updatePassword(newPassword) {
    const p = (newPassword || '').replace(/^\s+|\s+$/g, '');
    if (p.length < 8) return { ok: false, error: 'A senha precisa ter no mínimo 8 caracteres.' };
    const { error } = await window.supabaseClient.auth.updateUser({ password: p });
    if (error) return { ok: false, error: error.message || 'Falha ao atualizar a senha.' };
    return { ok: true };
  },
};

window.authService = authService;
