/* Настройки облака (Supabase). Эти два значения ПУБЛИЧНЫЕ — их можно хранить в репозитории:
   данные защищены правилами Row Level Security в базе (см. supabase/schema.sql).
   Пока значения пустые, сайт работает без входа — всё хранится только в браузере.
   Где взять: Supabase → Project Settings → API (Project URL и anon public key). */
window.FREEFORK_CONFIG = {
  supabaseUrl: 'https://lsuwlbrerillgqrgelna.supabase.co',
  supabaseAnonKey: 'sb_publishable_XY5t1VB9AKsBGsxyrIt4QQ_jtL0GxCL',
  google: false,      // включите true после настройки Google в Supabase (Authentication → Providers)
};
