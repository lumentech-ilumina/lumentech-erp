// Cliente Supabase do Lumentech ERP.
// URL e publishable key são públicas por design (RLS protege os dados).
const SUPABASE_URL = 'https://cghvbxashqjrehvurmkk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_a--JbF2dAh4iTp_VXAndvQ_Ok61WMLl';

if (!window.supabase || !window.supabase.createClient) {
  throw new Error('SDK do Supabase não carregou. Verifique a tag <script> do @supabase/supabase-js.');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'lumentech_erp_supabase_auth',
  },
});

window.supabaseClient = supabaseClient;
