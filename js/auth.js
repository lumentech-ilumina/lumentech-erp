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
};

window.authService = authService;
