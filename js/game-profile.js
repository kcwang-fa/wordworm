/* ============================================================
 * game-profile.js —— 本機玩家檔案
 * 內容：同一台裝置上的多玩家切換、舊版固定 key 存檔遷移、
 *       以及把各玩法的 localStorage key 轉成目前玩家專屬 key。
 * ============================================================ */

const WORDWORM_PROFILE_LIST_KEY = 'wordworm_profiles_v1';
const WORDWORM_ACTIVE_PROFILE_KEY = 'wordworm_active_profile_v1';
const WORDWORM_PROFILE_MIGRATION_KEY = 'wordworm_profiles_migrated_v1';
const WORDWORM_DEFAULT_PROFILE_ID = 'default';
const WORDWORM_PROFILE_BASE_KEYS = [
  'wordworm_save_v1',
  'wordworm_hiscore',
  'wordworm_save_adventure_v1',
  'wordworm_adv_progress',
  'wordworm_daily_save_v1',
  'wordworm_daily_meta_v1',
  'wordworm_kids_save_v1',
  'wordworm_kids_volume',
  'ww_favorite_words',
  'wordworm_gamemode',
  'wordworm_easymode',
  'wordworm_story_intro_seen_v1',
];

function wordwormProfileScopedKey(baseKey, profileId = wordwormActiveProfileId()) {
  return 'wordworm_profile_' + encodeURIComponent(profileId) + '__' + baseKey;
}

function profileStorageKey(baseKey, profileId = wordwormActiveProfileId()) {
  return wordwormProfileScopedKey(baseKey, profileId);
}

function wordwormSafeJsonParse(value, fallback) {
  try { return JSON.parse(value); }
  catch { return fallback; }
}

function wordwormCleanProfileName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 20);
}

function wordwormNewProfileId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function wordwormReadProfiles() {
  const raw = wordwormSafeJsonParse(localStorage.getItem(WORDWORM_PROFILE_LIST_KEY), null);
  const input = raw && Array.isArray(raw.profiles) ? raw.profiles : [];
  const seen = new Set();
  const profiles = input
    .map(profile => ({
      id: String(profile && profile.id || '').trim(),
      name: wordwormCleanProfileName(profile && profile.name),
    }))
    .filter(profile => profile.id && profile.name && !seen.has(profile.id) && seen.add(profile.id));
  if (!profiles.length) profiles.push({ id: WORDWORM_DEFAULT_PROFILE_ID, name: '玩家 1' });
  return profiles;
}

function wordwormSaveProfiles(profiles) {
  localStorage.setItem(WORDWORM_PROFILE_LIST_KEY, JSON.stringify({ version: 1, profiles }));
}

function wordwormActiveProfileId() {
  const profiles = wordwormReadProfiles();
  const active = localStorage.getItem(WORDWORM_ACTIVE_PROFILE_KEY);
  if (profiles.some(profile => profile.id === active)) return active;
  localStorage.setItem(WORDWORM_ACTIVE_PROFILE_KEY, profiles[0].id);
  return profiles[0].id;
}

function wordwormGetProfiles() {
  return wordwormReadProfiles();
}

function wordwormCurrentProfile() {
  const profiles = wordwormReadProfiles();
  const activeId = wordwormActiveProfileId();
  return profiles.find(profile => profile.id === activeId) || profiles[0];
}

function wordwormCurrentProfileName() {
  return wordwormCurrentProfile().name;
}

function wordwormMigrateLegacyStorage() {
  if (localStorage.getItem(WORDWORM_PROFILE_MIGRATION_KEY) === '1') return;
  const targetProfileId = wordwormReadProfiles()[0].id;
  for (const baseKey of WORDWORM_PROFILE_BASE_KEYS) {
    const legacyValue = localStorage.getItem(baseKey);
    const scopedKey = profileStorageKey(baseKey, targetProfileId);
    if (legacyValue !== null && localStorage.getItem(scopedKey) === null) {
      localStorage.setItem(scopedKey, legacyValue);
    }
  }
  localStorage.setItem(WORDWORM_PROFILE_MIGRATION_KEY, '1');
}

function wordwormEnsureProfiles() {
  const profiles = wordwormReadProfiles();
  wordwormSaveProfiles(profiles);
  wordwormActiveProfileId();
  wordwormMigrateLegacyStorage();
}

function wordwormPersistCurrentRunBeforeProfileChange() {
  try {
    if (typeof gameMode === 'undefined') return;
    if (gameMode === 'classic' && typeof saveGame === 'function') saveGame();
    else if (gameMode === 'adventure' && typeof saveAdventure === 'function') saveAdventure();
    else if (gameMode === 'daily' && typeof saveDaily === 'function') saveDaily();
  } catch (e) {
    // 切換玩家不該因為暫存失敗卡住；localStorage 本來就可能被瀏覽器限制。
  }
}

function wordwormSwitchProfile(profileId) {
  const profiles = wordwormReadProfiles();
  if (!profiles.some(profile => profile.id === profileId)) return false;
  if (profileId === wordwormActiveProfileId()) return true;
  wordwormPersistCurrentRunBeforeProfileChange();
  localStorage.setItem(WORDWORM_ACTIVE_PROFILE_KEY, profileId);
  location.reload();
  return true;
}

function wordwormDeleteProfileStorage(profileId) {
  for (const baseKey of WORDWORM_PROFILE_BASE_KEYS) {
    localStorage.removeItem(profileStorageKey(baseKey, profileId));
  }
}

function wordwormSetProfileStatus(message) {
  const status = document.getElementById('profile-status');
  if (status) status.textContent = message || '';
}

function wordwormRenderProfileButton() {
  const button = document.getElementById('profile-open');
  if (!button) return;
  button.textContent = '👤 玩家：' + wordwormCurrentProfileName();
}

function wordwormRenderProfileList() {
  const list = document.getElementById('profile-list');
  if (!list) return;
  const profiles = wordwormReadProfiles();
  const activeId = wordwormActiveProfileId();
  list.innerHTML = '';
  for (const profile of profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row' + (profile.id === activeId ? ' active' : '');

    const switchButton = document.createElement('button');
    switchButton.type = 'button';
    switchButton.className = 'profile-switch';
    switchButton.dataset.profileId = profile.id;
    switchButton.textContent = profile.name + (profile.id === activeId ? '（目前）' : '');

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'secondary profile-mini-btn';
    renameButton.dataset.renameProfileId = profile.id;
    renameButton.textContent = '改名';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary profile-mini-btn danger';
    deleteButton.dataset.deleteProfileId = profile.id;
    deleteButton.textContent = '刪除';
    deleteButton.disabled = profiles.length <= 1;

    row.append(switchButton, renameButton, deleteButton);
    list.appendChild(row);
  }
}

function wordwormOpenProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  wordwormRenderProfileButton();
  wordwormRenderProfileList();
  wordwormSetProfileStatus('');
  modal.hidden = false;
  modal.classList.add('show');
  const input = document.getElementById('profile-name-input');
  if (input) input.value = '';
}

function wordwormCloseProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.hidden = true;
}

function wordwormCreateProfileFromInput() {
  const input = document.getElementById('profile-name-input');
  const name = wordwormCleanProfileName(input && input.value);
  if (!name) {
    wordwormSetProfileStatus('請輸入玩家名稱。');
    return;
  }
  const profiles = wordwormReadProfiles();
  const profile = { id: wordwormNewProfileId(), name };
  profiles.push(profile);
  wordwormSaveProfiles(profiles);
  wordwormSetProfileStatus('已新增玩家，正在切換。');
  wordwormSwitchProfile(profile.id);
}

function wordwormRenameProfile(profileId) {
  const profiles = wordwormReadProfiles();
  const profile = profiles.find(item => item.id === profileId);
  if (!profile) return;
  const nextName = wordwormCleanProfileName(prompt('新的玩家名稱', profile.name));
  if (!nextName) return;
  profile.name = nextName;
  wordwormSaveProfiles(profiles);
  wordwormRenderProfileButton();
  wordwormRenderProfileList();
  wordwormSetProfileStatus('玩家名稱已更新。');
}

function wordwormDeleteProfile(profileId) {
  const profiles = wordwormReadProfiles();
  const profile = profiles.find(item => item.id === profileId);
  if (!profile || profiles.length <= 1) {
    wordwormSetProfileStatus('至少要保留一個玩家。');
    return;
  }
  if (!confirm('確定要刪除「' + profile.name + '」嗎？這個玩家的本機進度會一起刪除。')) return;
  const remaining = profiles.filter(item => item.id !== profileId);
  wordwormDeleteProfileStorage(profileId);
  wordwormSaveProfiles(remaining);
  if (profileId === wordwormActiveProfileId()) {
    localStorage.setItem(WORDWORM_ACTIVE_PROFILE_KEY, remaining[0].id);
    location.reload();
    return;
  }
  wordwormRenderProfileList();
  wordwormSetProfileStatus('已刪除玩家。');
}

function wordwormBindProfileUi() {
  wordwormRenderProfileButton();
  const open = document.getElementById('profile-open');
  const close = document.getElementById('profile-close');
  const modal = document.getElementById('profile-modal');
  const add = document.getElementById('profile-add');
  const input = document.getElementById('profile-name-input');
  const list = document.getElementById('profile-list');
  if (open) open.addEventListener('click', wordwormOpenProfileModal);
  if (close) close.addEventListener('click', wordwormCloseProfileModal);
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) wordwormCloseProfileModal(); });
  if (add) add.addEventListener('click', wordwormCreateProfileFromInput);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') wordwormCreateProfileFromInput(); });
  if (list) list.addEventListener('click', e => {
    const switchTarget = e.target.closest('[data-profile-id]');
    const renameTarget = e.target.closest('[data-rename-profile-id]');
    const deleteTarget = e.target.closest('[data-delete-profile-id]');
    if (switchTarget) wordwormSwitchProfile(switchTarget.dataset.profileId);
    else if (renameTarget) wordwormRenameProfile(renameTarget.dataset.renameProfileId);
    else if (deleteTarget) wordwormDeleteProfile(deleteTarget.dataset.deleteProfileId);
  });
}

wordwormEnsureProfiles();
document.addEventListener('DOMContentLoaded', wordwormBindProfileUi);
