/* ============================================================
 * cloud-save.js —— Supabase Auth + 雲端存檔
 * 內容：Google 登入/登出、顯示登入者、每 10 秒檢查目前玩家
 *       存檔內容；內容 hash 不變就不上傳。
 * ============================================================ */

const WORDWORM_CLOUD_LAST_HASH_PREFIX = 'wordworm_cloud_last_hash_v1__';
const WORDWORM_CLOUD_DEVICE_ID_KEY = 'wordworm_cloud_device_id_v1';

let wordwormCloudClient = null;
let wordwormCloudSession = null;
let wordwormCloudTimer = null;
let wordwormCloudUploadInFlight = false;
let wordwormCloudConfigured = false;
const wordwormCloudPausedUploadProfiles = new Set();

function wordwormCloudConfig() {
  return window.WORDWORM_CLOUD_CONFIG || {};
}

function wordwormCloudIsConfigured() {
  const config = wordwormCloudConfig();
  return !!(config.supabaseUrl && config.supabasePublishableKey);
}

function wordwormCloudStatus(message) {
  const status = document.getElementById('cloud-status');
  if (status) status.textContent = message || '';
}

function wordwormCloudSetAuthText(message) {
  const label = document.getElementById('cloud-auth-status');
  if (label) label.textContent = message || '尚未登入 Google';
}

function wordwormCloudUserLabel() {
  const user = wordwormCloudSession && wordwormCloudSession.user;
  return user && (user.email || (user.user_metadata && user.user_metadata.full_name)) || '';
}

function wordwormCloudCurrentProfileId() {
  return typeof wordwormActiveProfileId === 'function' ? wordwormActiveProfileId() : 'default';
}

function wordwormCloudCurrentProfileName() {
  return typeof wordwormCurrentProfileName === 'function' ? wordwormCurrentProfileName() : '玩家 1';
}

function wordwormCloudLastHashKey(userId, profileId = wordwormCloudCurrentProfileId()) {
  return WORDWORM_CLOUD_LAST_HASH_PREFIX + encodeURIComponent(userId) + '__' + encodeURIComponent(profileId);
}

function wordwormCloudProfileKey(userId, profileId = wordwormCloudCurrentProfileId()) {
  return encodeURIComponent(userId) + '__' + encodeURIComponent(profileId);
}

function wordwormCloudDeviceId() {
  let id = localStorage.getItem(WORDWORM_CLOUD_DEVICE_ID_KEY);
  if (!id) {
    id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(WORDWORM_CLOUD_DEVICE_ID_KEY, id);
  }
  return id;
}

function wordwormCloudStableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(wordwormCloudStableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => (
    JSON.stringify(key) + ':' + wordwormCloudStableStringify(value[key])
  )).join(',') + '}';
}

async function wordwormCloudHash(value) {
  const text = typeof value === 'string' ? value : wordwormCloudStableStringify(value);
  if (window.crypto && crypto.subtle && window.TextEncoder) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
}

function wordwormCloudPersistCurrentRun() {
  if (typeof persistCurrentRunBeforeSync === 'function') persistCurrentRunBeforeSync();
  else if (typeof wordwormPersistCurrentRunBeforeProfileChange === 'function') wordwormPersistCurrentRunBeforeProfileChange();
}

function wordwormCloudPayloadContent(payload, profileId = wordwormCloudCurrentProfileId()) {
  return {
    type: payload.type,
    version: payload.version,
    profileId,
    profileName: payload.profileName,
    saves: payload.saves,
  };
}

async function wordwormCloudCurrentPayloadAndHash() {
  wordwormCloudPersistCurrentRun();
  if (typeof collectSyncPayload !== 'function') throw new Error('collectSyncPayload is not available');
  const payload = collectSyncPayload();
  const profileId = wordwormCloudCurrentProfileId();
  const payloadHash = await wordwormCloudHash(wordwormCloudPayloadContent(payload, profileId));
  return { payload, payloadHash, profileId };
}

function wordwormCloudUpdateUi() {
  const open = document.getElementById('cloud-open');
  const login = document.getElementById('cloud-login');
  const logout = document.getElementById('cloud-logout');
  const syncNow = document.getElementById('cloud-sync-now');
  const configured = wordwormCloudConfigured;
  const signedIn = !!wordwormCloudSession;

  if (open) {
    open.textContent = signedIn ? '☁️ 已登入' : '☁️ 雲端存檔';
    open.classList.toggle('active', signedIn);
  }
  if (login) {
    login.disabled = !configured || signedIn;
    login.hidden = signedIn;
  }
  if (logout) {
    logout.disabled = !configured || !signedIn;
    logout.hidden = !signedIn;
  }
  if (syncNow) syncNow.disabled = !configured || !signedIn;

  if (!configured) {
    wordwormCloudSetAuthText('尚未設定 Supabase，雲端存檔未啟用。');
    wordwormCloudStatus('請先在 js/cloud-config.js 填入 Supabase Project URL 與 publishable key。');
    return;
  }
  if (!wordwormCloudClient) {
    wordwormCloudSetAuthText('Supabase SDK 未載入。');
    wordwormCloudStatus('請確認 vendor/supabase.min.js 有正確載入。');
    return;
  }
  wordwormCloudSetAuthText(signedIn ? '已登入：' + wordwormCloudUserLabel() : '尚未登入 Google');
  if (!signedIn) wordwormCloudStatus('登入後會每 10 秒檢查一次目前玩家，有變更才上傳雲端。');
}

async function wordwormCloudLoadRemoteHash() {
  if (!wordwormCloudClient || !wordwormCloudSession) return;
  const userId = wordwormCloudSession.user.id;
  const profileId = wordwormCloudCurrentProfileId();
  const profileKey = wordwormCloudProfileKey(userId, profileId);
  const tableName = wordwormCloudConfig().tableName || 'wordworm_cloud_saves';
  const { data, error } = await wordwormCloudClient
    .from(tableName)
    .select('payload_hash, server_updated_at')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    wordwormCloudStatus('讀取雲端狀態失敗：' + error.message);
    return;
  }
  const localLastHash = localStorage.getItem(wordwormCloudLastHashKey(userId, profileId)) || '';
  const local = await wordwormCloudCurrentPayloadAndHash();
  if (data && data.payload_hash) {
    localStorage.setItem(wordwormCloudLastHashKey(userId, profileId), data.payload_hash);
    const at = data.server_updated_at ? new Date(data.server_updated_at).toLocaleString('zh-TW') : '';
    if (data.payload_hash !== local.payloadHash && localLastHash !== data.payload_hash) {
      wordwormCloudPausedUploadProfiles.add(profileKey);
      wordwormCloudStatus('雲端已有不同存檔' + (at ? '，上次同步：' + at : '') + '。已暫停自動覆蓋，若要用本機覆蓋雲端請按「立即檢查上傳」。');
    } else {
      wordwormCloudPausedUploadProfiles.delete(profileKey);
      wordwormCloudStatus('已讀取雲端狀態' + (at ? '，上次同步：' + at : '。'));
    }
  } else {
    wordwormCloudPausedUploadProfiles.delete(profileKey);
    localStorage.removeItem(wordwormCloudLastHashKey(userId, profileId));
    wordwormCloudStatus('這個玩家還沒有雲端存檔；下次偵測到內容會自動上傳。');
  }
}

async function wordwormCloudSyncCurrentProfile(options = {}) {
  const force = !!options.force;
  if (!wordwormCloudConfigured || !wordwormCloudClient || !wordwormCloudSession) return false;
  if (wordwormCloudUploadInFlight) return false;

  wordwormCloudUploadInFlight = true;
  try {
    const user = wordwormCloudSession.user;
    const { payload, payloadHash, profileId } = await wordwormCloudCurrentPayloadAndHash();
    const profileKey = wordwormCloudProfileKey(user.id, profileId);
    if (wordwormCloudPausedUploadProfiles.has(profileKey)) {
      if (options.reason !== 'manual') return false;
      if (!confirm('雲端已有不同的「' + wordwormCloudCurrentProfileName() + '」存檔。確定要用這台裝置的進度覆蓋雲端嗎？')) {
        wordwormCloudStatus('已保留雲端存檔，沒有上傳。');
        return false;
      }
      wordwormCloudPausedUploadProfiles.delete(profileKey);
    }
    const hashKey = wordwormCloudLastHashKey(user.id, profileId);
    const lastHash = localStorage.getItem(hashKey) || '';
    if (!force && payloadHash === lastHash) {
      if (options.reason === 'manual') wordwormCloudStatus('存檔內容沒有變，不需要上傳。');
      return false;
    }

    const now = new Date().toISOString();
    const tableName = wordwormCloudConfig().tableName || 'wordworm_cloud_saves';
    const { error } = await wordwormCloudClient
      .from(tableName)
      .upsert({
        user_id: user.id,
        profile_id: profileId,
        profile_name: wordwormCloudCurrentProfileName(),
        payload_version: payload.version || 1,
        payload,
        payload_hash: payloadHash,
        client_updated_at: payload.exportedAt || now,
        server_updated_at: now,
        device_id: wordwormCloudDeviceId(),
        deleted_at: null,
      }, { onConflict: 'user_id,profile_id' });

    if (error) throw error;
    localStorage.setItem(hashKey, payloadHash);
    wordwormCloudStatus('已上傳目前玩家「' + wordwormCloudCurrentProfileName() + '」到雲端：' + new Date().toLocaleTimeString('zh-TW'));
    return true;
  } catch (e) {
    wordwormCloudStatus('雲端上傳失敗：' + (e && e.message ? e.message : '未知錯誤'));
    return false;
  } finally {
    wordwormCloudUploadInFlight = false;
  }
}

function wordwormCloudStartTimer() {
  if (wordwormCloudTimer) clearInterval(wordwormCloudTimer);
  const interval = Math.max(3000, Number(wordwormCloudConfig().uploadIntervalMs) || 10000);
  wordwormCloudTimer = setInterval(() => {
    wordwormCloudSyncCurrentProfile({ reason: 'interval' });
  }, interval);
}

function wordwormCloudStopTimer() {
  if (wordwormCloudTimer) clearInterval(wordwormCloudTimer);
  wordwormCloudTimer = null;
}

async function wordwormCloudLogin() {
  if (!wordwormCloudClient) return;
  const redirectTo = wordwormCloudConfig().redirectTo || (location.origin + location.pathname);
  wordwormCloudStatus('正在開啟 Google 登入...');
  const { error } = await wordwormCloudClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) wordwormCloudStatus('Google 登入失敗：' + error.message);
}

async function wordwormCloudLogout() {
  if (!wordwormCloudClient) return;
  wordwormCloudStatus('正在登出...');
  const { error } = await wordwormCloudClient.auth.signOut();
  if (error) wordwormCloudStatus('登出失敗：' + error.message);
}

function wordwormCloudOpenPanel() {
  if (typeof openSyncModal === 'function') openSyncModal();
  else document.getElementById('sync-open')?.click();
}

async function wordwormCloudHandleSession(nextSession) {
  wordwormCloudSession = nextSession;
  wordwormCloudUpdateUi();
  if (wordwormCloudSession) {
    wordwormCloudStartTimer();
    await wordwormCloudLoadRemoteHash();
    await wordwormCloudSyncCurrentProfile({ reason: 'auth' });
  } else {
    wordwormCloudStopTimer();
    wordwormCloudStatus(wordwormCloudConfigured ? '已登出；本機存檔仍會照常保存。' : '');
  }
  wordwormCloudUpdateUi();
}

function wordwormCloudBindUi() {
  const open = document.getElementById('cloud-open');
  const login = document.getElementById('cloud-login');
  const logout = document.getElementById('cloud-logout');
  const syncNow = document.getElementById('cloud-sync-now');
  if (open) open.addEventListener('click', wordwormCloudOpenPanel);
  if (login) login.addEventListener('click', wordwormCloudLogin);
  if (logout) logout.addEventListener('click', wordwormCloudLogout);
  if (syncNow) syncNow.addEventListener('click', () => wordwormCloudSyncCurrentProfile({ force: false, reason: 'manual' }));
  wordwormCloudUpdateUi();
}

function wordwormCloudWrapProfileSwitch() {
  if (typeof wordwormSwitchProfile !== 'function') return;
  const originalSwitchProfile = wordwormSwitchProfile;
  wordwormSwitchProfile = async function wrappedWordwormSwitchProfile(profileId) {
    if (profileId !== wordwormCloudCurrentProfileId()) {
      await wordwormCloudSyncCurrentProfile({ reason: 'profile-change' });
    }
    return originalSwitchProfile(profileId);
  };
}

async function wordwormCloudInit() {
  wordwormCloudConfigured = wordwormCloudIsConfigured();
  wordwormCloudWrapProfileSwitch();
  document.addEventListener('DOMContentLoaded', wordwormCloudBindUi);

  if (!wordwormCloudConfigured) {
    wordwormCloudUpdateUi();
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    wordwormCloudUpdateUi();
    return;
  }

  const config = wordwormCloudConfig();
  wordwormCloudClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  wordwormCloudClient.auth.onAuthStateChange((_event, session) => {
    wordwormCloudHandleSession(session);
  });
  const { data, error } = await wordwormCloudClient.auth.getSession();
  if (error) wordwormCloudStatus('讀取登入狀態失敗：' + error.message);
  await wordwormCloudHandleSession(data && data.session);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') wordwormCloudSyncCurrentProfile({ reason: 'hidden' });
});
window.addEventListener('pagehide', () => {
  wordwormCloudSyncCurrentProfile({ reason: 'pagehide' });
});

window.wordwormCloudSyncCurrentProfile = wordwormCloudSyncCurrentProfile;
window.wordwormCloudLogin = wordwormCloudLogin;
window.wordwormCloudLogout = wordwormCloudLogout;

wordwormCloudInit();
