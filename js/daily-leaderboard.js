/* ============================================================
 * daily-leaderboard.js —— 每日挑戰全球排行榜
 * 透過 Google Apps Script Web App 讀寫 Google Sheet。
 * 失敗時只影響排行榜，不阻擋每日挑戰結算。
 * ============================================================ */

const DAILY_LEADERBOARD_ID_KEY = 'wordworm_daily_leaderboard_id_v1';
const DAILY_LEADERBOARD_CACHE_MS = 30000;
const DAILY_LEADERBOARD_LIMIT = 50;
const DAILY_LEADERBOARD_TABS = ['today', 'yesterday', 'all_time'];

let dailyLeaderboardActiveTab = 'today';
let dailyLeaderboardCache = null;
let dailyLeaderboardCacheAt = 0;
let dailyLeaderboardLoading = false;
let dailyLeaderboardJsonpSeq = 0;

function dailyLeaderboardEndpoint() {
  return String(window.WORDWORM_DAILY_LEADERBOARD_API_URL || '').trim();
}

function dailyLeaderboardPlayerId() {
  const key = profileStorageKey(DAILY_LEADERBOARD_ID_KEY);
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = 'ww_' + (
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
    );
    localStorage.setItem(key, id);
    return id;
  } catch (e) {
    return 'ww_ephemeral_' + Date.now().toString(36);
  }
}

function cleanDailyLeaderboardName(name) {
  return String(name || '匿名書蟲')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20) || '匿名書蟲';
}

function currentDailyLeaderboardName() {
  try {
    return cleanDailyLeaderboardName(wordwormCurrentProfileName());
  } catch (e) {
    return '匿名書蟲';
  }
}

function dailyLeaderboardDates() {
  const today = dateStrDaily();
  return { today, yesterday: prevDateStrDaily(today) };
}

function dailyLeaderboardRequestUrl(action, callbackName, payload) {
  const endpoint = dailyLeaderboardEndpoint();
  if (!endpoint) return '';
  const url = new URL(endpoint);
  const dates = dailyLeaderboardDates();
  url.searchParams.set('action', action);
  url.searchParams.set('date', dates.today);
  url.searchParams.set('limit', String(DAILY_LEADERBOARD_LIMIT));
  url.searchParams.set('playerId', dailyLeaderboardPlayerId());
  if (callbackName) url.searchParams.set('callback', callbackName);
  if (payload) url.searchParams.set('payload', JSON.stringify(payload));
  return url.href;
}

function requestDailyLeaderboard(action, payload) {
  return new Promise((resolve, reject) => {
    let script = null;
    const callbackName = '__wordwormDailyLeaderboard' + Date.now() + '_' + (++dailyLeaderboardJsonpSeq);
    const cleanup = () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Leaderboard request timeout'));
    }, 12000);
    window[callbackName] = data => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };
    try {
      script = document.createElement('script');
      script.src = dailyLeaderboardRequestUrl(action, callbackName, payload);
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        cleanup();
        reject(new Error('Leaderboard request failed'));
      };
      document.head.appendChild(script);
    } catch (e) {
      clearTimeout(timer);
      cleanup();
      reject(e);
    }
  });
}

function normaliseDailyLeaderboardResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const leaderboards = data.leaderboards;
  if (!leaderboards || typeof leaderboards !== 'object') return null;
  return {
    today: Array.isArray(leaderboards.today) ? leaderboards.today : [],
    yesterday: Array.isArray(leaderboards.yesterday) ? leaderboards.yesterday : [],
    all_time: Array.isArray(leaderboards.all_time) ? leaderboards.all_time : [],
    dates: data.dates && typeof data.dates === 'object' ? data.dates : dailyLeaderboardDates(),
  };
}

function setDailyLeaderboardStatus(message) {
  const el = document.getElementById('daily-leaderboard-status');
  if (el) el.textContent = message || '';
}

function setDailyLeaderboardTab(tab) {
  dailyLeaderboardActiveTab = DAILY_LEADERBOARD_TABS.includes(tab) ? tab : 'today';
  document.querySelectorAll('.daily-leaderboard-tab').forEach(button => {
    const active = button.dataset.dailyLeaderboardTab === dailyLeaderboardActiveTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderDailyLeaderboard();
}

function dailyLeaderboardTabLabel(tab, dates) {
  if (tab === 'today') return '今天 ' + (dates.today || '');
  if (tab === 'yesterday') return '昨天 ' + (dates.yesterday || '');
  return '累計成績';
}

function dailyLeaderboardStars(row) {
  if (!row || !row.reached) return '未達標';
  const stars = Math.max(0, Math.min(3, Math.floor(Number(row.stars) || 0)));
  return stars ? '⭐'.repeat(stars) : '✅';
}

function dailyLeaderboardScoreText(row, tab) {
  if (tab === 'all_time') return Number(row.totalScore || 0).toLocaleString() + ' 分';
  return Number(row.score || 0).toLocaleString() + ' 分';
}

function dailyLeaderboardSubText(row, tab) {
  if (tab === 'all_time') {
    return '完成 ' + Number(row.daysReached || 0).toLocaleString() +
      ' 天｜三星 ' + Number(row.threeStarCount || 0).toLocaleString() +
      ' 次｜最佳 ' + Number(row.bestScore || 0).toLocaleString();
  }
  const parts = [dailyLeaderboardStars(row)];
  if (row.reached && row.goalTiles !== null && row.goalTiles !== undefined) parts.push(row.goalTiles + ' 磚達標');
  parts.push('單字 ' + Number(row.wordCount || 0).toLocaleString() + ' 個');
  if (row.streak) parts.push('連續 ' + Number(row.streak).toLocaleString() + ' 天');
  return parts.join('｜');
}

function renderDailyLeaderboardRows(rows, tab) {
  const playerId = dailyLeaderboardPlayerId();
  if (!rows.length) {
    return '<div class="daily-leaderboard-empty">目前還沒有榜單資料。<br>第一隻書蟲通常都要負責踩開場地，辛苦但光榮。</div>';
  }
  return rows.map((row, idx) => {
    const mine = row.playerId === playerId ? ' mine' : '';
    const name = cleanDailyLeaderboardName(row.playerName);
    return '<div class="daily-leaderboard-row' + mine + '">' +
      '<div class="daily-leaderboard-rank">#' + (idx + 1) + '</div>' +
      '<div class="daily-leaderboard-player">' +
        '<div class="daily-leaderboard-name">' + escapeDailyLeaderboardHtml(name) + (mine ? '（你）' : '') + '</div>' +
        '<div class="daily-leaderboard-sub">' + escapeDailyLeaderboardHtml(dailyLeaderboardSubText(row, tab)) + '</div>' +
      '</div>' +
      '<div class="daily-leaderboard-score">' + escapeDailyLeaderboardHtml(dailyLeaderboardScoreText(row, tab)) + '</div>' +
    '</div>';
  }).join('');
}

function escapeDailyLeaderboardHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDailyLeaderboard() {
  const list = document.getElementById('daily-leaderboard-list');
  const dateEl = document.getElementById('daily-leaderboard-date');
  if (!list || !dateEl) return;
  const dates = dailyLeaderboardCache && dailyLeaderboardCache.dates ? dailyLeaderboardCache.dates : dailyLeaderboardDates();
  dateEl.textContent = dailyLeaderboardTabLabel(dailyLeaderboardActiveTab, dates);

  if (!dailyLeaderboardEndpoint()) {
    setDailyLeaderboardStatus('尚未設定排行榜 API。部署 Google Apps Script 後，把 Web App URL 填進 js/daily-leaderboard-config.js。');
    list.innerHTML = '<div class="daily-leaderboard-empty">排行榜前端已就位，但還沒有接上 Google Sheet。<br>先不要緊張，這只是插頭還沒插。</div>';
    return;
  }

  if (!dailyLeaderboardCache) {
    setDailyLeaderboardStatus(dailyLeaderboardLoading ? '排行榜載入中…' : '按重新載入取得排行榜。');
    list.innerHTML = '';
    return;
  }

  const rows = dailyLeaderboardCache[dailyLeaderboardActiveTab] || [];
  setDailyLeaderboardStatus(dailyLeaderboardLoading ? '排行榜更新中…' : '');
  list.innerHTML = renderDailyLeaderboardRows(rows, dailyLeaderboardActiveTab);
}

async function loadDailyLeaderboard(options = {}) {
  const { force = false } = options;
  if (!dailyLeaderboardEndpoint()) {
    renderDailyLeaderboard();
    return null;
  }
  const now = Date.now();
  if (!force && dailyLeaderboardCache && now - dailyLeaderboardCacheAt < DAILY_LEADERBOARD_CACHE_MS) {
    renderDailyLeaderboard();
    return dailyLeaderboardCache;
  }
  if (dailyLeaderboardLoading) return dailyLeaderboardCache;
  dailyLeaderboardLoading = true;
  renderDailyLeaderboard();
  try {
    const normalised = normaliseDailyLeaderboardResponse(await requestDailyLeaderboard('leaderboards'));
    if (!normalised) throw new Error('Invalid leaderboard response');
    dailyLeaderboardCache = normalised;
    dailyLeaderboardCacheAt = Date.now();
  } catch (e) {
    setDailyLeaderboardStatus('排行榜暫時讀不到。遊戲照玩，榜單晚點再看。');
  } finally {
    dailyLeaderboardLoading = false;
    renderDailyLeaderboard();
  }
  return dailyLeaderboardCache;
}

function openDailyLeaderboard(tab = 'today') {
  const modal = document.getElementById('daily-leaderboard-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.classList.add('show');
  setDailyLeaderboardTab(tab);
  loadDailyLeaderboard();
}

function closeDailyLeaderboard() {
  const modal = document.getElementById('daily-leaderboard-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.hidden = true;
}

function dailyLeaderboardSubmitPayload(result, streak) {
  return {
    action: 'submitDaily',
    playerId: dailyLeaderboardPlayerId(),
    playerName: currentDailyLeaderboardName(),
    date: result.date,
    dayNo: result.dayNo,
    score: result.score,
    reached: !!result.reached,
    stars: result.stars,
    goalTiles: result.goalTiles,
    wordCount: result.wordCount,
    streak: streak || 1,
  };
}

async function submitDailyLeaderboard(result, streak) {
  if (!result || !dailyLeaderboardEndpoint()) return;
  try {
    const normalised = normaliseDailyLeaderboardResponse(
      await requestDailyLeaderboard('submitDaily', dailyLeaderboardSubmitPayload(result, streak))
    );
    if (normalised) {
      dailyLeaderboardCache = normalised;
      dailyLeaderboardCacheAt = Date.now();
      renderDailyLeaderboard();
    }
  } catch (e) {
    if (document.getElementById('daily-leaderboard-modal')?.classList.contains('show')) {
      setDailyLeaderboardStatus('成績送出失敗。可能是網路或 Google Sheet 暫時不理人。');
    }
  }
}

function bindDailyLeaderboardClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.onclick = handler;
}

bindDailyLeaderboardClick('daily-leaderboard-open', () => openDailyLeaderboard('today'));
bindDailyLeaderboardClick('daily-play-leaderboard', () => openDailyLeaderboard('today'));
bindDailyLeaderboardClick('daily-locked-leaderboard', () => openDailyLeaderboard('today'));
bindDailyLeaderboardClick('daily-f-leaderboard', () => openDailyLeaderboard('today'));
bindDailyLeaderboardClick('daily-leaderboard-menu', () => openDailyLeaderboard('today'));
bindDailyLeaderboardClick('daily-leaderboard-close', closeDailyLeaderboard);
bindDailyLeaderboardClick('daily-leaderboard-modal', e => {
  if (e.target.id === 'daily-leaderboard-modal') closeDailyLeaderboard();
});
document.querySelectorAll('.daily-leaderboard-tab').forEach(button => {
  button.onclick = () => {
    setDailyLeaderboardTab(button.dataset.dailyLeaderboardTab);
    loadDailyLeaderboard();
  };
});

window.openDailyLeaderboard = openDailyLeaderboard;
window.submitDailyLeaderboard = submitDailyLeaderboard;
