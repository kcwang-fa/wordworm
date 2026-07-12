/* ============================================================
 * game-sync.js —— 裝置間進度同步（無後端：同步碼／同步連結）
 * 內容：進度打包/還原、同步碼編解碼、#sync= 連結處理。
 * 依賴 game-save.js 的 key 常數，載入順序必須在它之後。
 * ============================================================ */


/* ================= 裝置間進度同步（無後端：同步碼 / 同步連結） ================= */
const SYNC_PAYLOAD_VERSION = 1;
const SYNC_HASH_PREFIX = '#sync=';
const SYNC_STORAGE_KEYS = [
  SAVE_KEY,
  HI_KEY,
  ADV_SAVE_KEY,
  ADV_PROGRESS_KEY,
  'wordworm_daily_save_v1',
  'wordworm_daily_meta_v1',
  'wordworm_kids_save_v1',
  'wordworm_kids_volume',
  'ww_favorite_words',
  'wordworm_gamemode',
  'wordworm_easymode',
  'wordworm_story_intro_seen_v1',
];
let lastSyncCode = '';
let lastSyncLink = '';

function syncBytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function syncBase64UrlToBytes(code) {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function encodeSyncPayload(payload) {
  return syncBytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}
function decodeSyncPayload(code) {
  const text = new TextDecoder().decode(syncBase64UrlToBytes(code));
  return JSON.parse(text);
}
function persistCurrentRunBeforeSync() {
  try {
    if (gameMode === 'classic') saveGame();
    else if (gameMode === 'adventure') saveAdventure();
    else if (gameMode === 'daily' && typeof saveDaily === 'function') saveDaily();
  } catch (e) {
    // 匯出失敗不該中斷 UI；下面會照 localStorage 目前內容打包。
  }
}
function collectSyncPayload() {
  persistCurrentRunBeforeSync();
  const saves = {};
  for (const key of SYNC_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) saves[key] = value;
  }
  return {
    type: 'wordworm-progress',
    version: SYNC_PAYLOAD_VERSION,
    exportedAt: new Date().toISOString(),
    saves,
  };
}
function normaliseSyncPayload(payload) {
  if (!payload || payload.type !== 'wordworm-progress' || payload.version !== SYNC_PAYLOAD_VERSION) return null;
  if (!payload.saves || typeof payload.saves !== 'object' || Array.isArray(payload.saves)) return null;
  const saves = {};
  for (const key of SYNC_STORAGE_KEYS) {
    if (!(key in payload.saves)) continue;
    if (typeof payload.saves[key] !== 'string') return null;
    saves[key] = payload.saves[key];
  }
  return { ...payload, saves };
}
function syncLinkForCode(code) {
  return location.href.split('#')[0] + SYNC_HASH_PREFIX + code;
}
function extractSyncCode(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const hashIdx = raw.indexOf(SYNC_HASH_PREFIX);
  const code = hashIdx >= 0 ? raw.slice(hashIdx + SYNC_HASH_PREFIX.length) : raw;
  return code.trim();
}
function setSyncStatus(message) {
  const status = document.getElementById('sync-status');
  if (status) status.textContent = message || '';
}
function openSyncModal(prefill = '') {
  const modal = document.getElementById('sync-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.classList.add('show');
  setSyncStatus(prefill ? '偵測到同步連結。確認要覆蓋這台裝置的進度後，按「匯入進度」。' : '');
  if (prefill) document.getElementById('sync-import-code').value = prefill;
}
function closeSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.hidden = true;
}
async function copySyncText(text, label) {
  if (!text) {
    setSyncStatus('請先產生同步資料。');
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setSyncStatus(label + '已複製。到手機貼上或打開連結就可以匯入。');
  } catch (e) {
    setSyncStatus('瀏覽器不允許自動複製，請手動選取文字複製。');
  }
}
function exportSyncData() {
  try {
    lastSyncCode = encodeSyncPayload(collectSyncPayload());
    lastSyncLink = syncLinkForCode(lastSyncCode);
    document.getElementById('sync-export-code').value = lastSyncCode;
    setSyncStatus('同步資料已產生。最方便是複製同步連結傳到手機。');
  } catch (e) {
    setSyncStatus('產生同步資料失敗，可能是瀏覽器儲存被限制。');
  }
}
function refreshAfterSyncImport() {
  const nextMode = localStorage.getItem('wordworm_gamemode');
  gameMode = ['classic', 'adventure', 'daily', 'kids'].includes(nextMode) ? nextMode : 'classic';
  easyMode = localStorage.getItem('wordworm_easymode') === '1';
  setBoardSize();
  applyModeClass();
  document.getElementById('gameover').classList.remove('show');
  document.getElementById('daily-gameover').classList.remove('show');
  document.getElementById('adv-gameover').classList.remove('show');
  if (gameMode === 'adventure') initAdventure(true);
  else if (gameMode === 'daily') initDaily(true);
  else if (gameMode === 'kids' && window.initKidsMode) window.initKidsMode(true);
  else init(true);
}
function importSyncData(input) {
  const code = extractSyncCode(input);
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    setSyncStatus('同步碼格式不對。請貼上完整同步碼或同步連結。');
    return;
  }
  try {
    const payload = normaliseSyncPayload(decodeSyncPayload(code));
    if (!payload) {
      setSyncStatus('這不是 Word Worm 的同步資料，或版本不相容。');
      return;
    }
    if (!confirm('匯入會覆蓋這台裝置的 Word Worm 進度。確定要匯入嗎？')) return;
    for (const key of SYNC_STORAGE_KEYS) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(payload.saves)) localStorage.setItem(key, value);
    history.replaceState(null, '', location.href.split('#')[0]);
    refreshAfterSyncImport();
    closeSyncModal();
    toast('進度已匯入。', 1800);
  } catch (e) {
    setSyncStatus('讀取同步資料失敗。請確認同步碼有完整複製。');
  }
}
document.getElementById('sync-open').onclick = () => openSyncModal();
document.getElementById('sync-close').onclick = closeSyncModal;
document.getElementById('sync-modal').onclick = e => { if (e.target.id === 'sync-modal') closeSyncModal(); };
document.getElementById('sync-export').onclick = exportSyncData;
document.getElementById('sync-copy-link').onclick = () => {
  const code = lastSyncCode || document.getElementById('sync-export-code').value.trim();
  copySyncText(code ? (lastSyncLink || syncLinkForCode(code)) : '', '同步連結');
};
document.getElementById('sync-copy-code').onclick = () => copySyncText(lastSyncCode || document.getElementById('sync-export-code').value.trim(), '同步碼');
document.getElementById('sync-import').onclick = () => importSyncData(document.getElementById('sync-import-code').value);
if (location.hash.startsWith(SYNC_HASH_PREFIX)) openSyncModal(location.href);
