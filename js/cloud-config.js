/* ============================================================
 * cloud-config.js —— Supabase 雲端存檔設定
 * 請只填 Supabase Project URL 與 publishable key / anon public key。
 * 不要把 service_role key 或任何 secret 放進前端檔案。
 * ============================================================ */

window.WORDWORM_CLOUD_CONFIG = {
  supabaseUrl: 'https://quwcujjdxrdasttrrcvl.supabase.co',
  supabasePublishableKey: 'sb_publishable_MOFcNRwo4qkKZtnftSB_jA_iqYCGCiv',
  tableName: 'wordworm_cloud_saves',
  uploadIntervalMs: 10000,
  redirectTo: location.origin + location.pathname,
};
