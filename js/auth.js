const AUTH = { email: 'ronyelrick@gmail.com', password: '********' };

const authService = {
  login(email, password) {
    const e = (email || '').replace(/\s/g, '').toLowerCase();
    const p = (password || '').replace(/^\s+|\s+$/g, '');
    if (e !== AUTH.email) {
      return { ok: false, error: 'E-mail incorreto. Verifique e tente novamente.' };
    }
    if (p !== AUTH.password) {
      return { ok: false, error: 'Senha incorreta. Verifique e tente novamente.' };
    }
    return { ok: true };
  },
};
