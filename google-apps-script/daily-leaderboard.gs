/**
 * Word Worm 每日挑戰排行榜 Google Apps Script
 *
 * 使用方式：
 * 1. 建立一份 Google Sheet。
 * 2. 開啟 Extensions → Apps Script，貼上本檔內容。
 * 3. 執行 setupDailyLeaderboardSheets() 一次，授權存取試算表。
 * 4. Deploy → New deployment → Web app：
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. 把 Web App URL 填到 js/daily-leaderboard-config.js 的
 *    WORDWORM_DAILY_LEADERBOARD_API_URL。
 */

const WW_DAILY_HEADERS = [
  'date', 'dayNo', 'playerId', 'playerName', 'score', 'reached',
  'stars', 'goalTiles', 'wordCount', 'streak', 'submittedAt'
];
const WW_ALL_TIME_HEADERS = [
  'playerId', 'playerName', 'daysPlayed', 'daysReached', 'totalScore',
  'bestScore', 'threeStarCount', 'twoStarCount', 'oneStarCount',
  'zeroStarReachedCount', 'failedCount', 'lastPlayedDate', 'updatedAt'
];
const WW_SUBMISSION_LIMIT_HEADERS = ['date', 'playerId', 'count', 'updatedAt'];
const WW_TODAY_SHEET = 'today';
const WW_YESTERDAY_SHEET = 'yesterday';
const WW_ALL_TIME_SHEET = 'all_time';
const WW_SUBMISSION_LIMIT_SHEET = 'submission_limits';
const WW_PROP_TODAY_DATE = 'wordworm_today_date';
const WW_MAX_DAILY_SUBMISSIONS_PER_PLAYER = 20;

function setupDailyLeaderboardSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, WW_TODAY_SHEET, WW_DAILY_HEADERS);
  ensureSheet_(ss, WW_YESTERDAY_SHEET, WW_DAILY_HEADERS);
  ensureSheet_(ss, WW_ALL_TIME_SHEET, WW_ALL_TIME_HEADERS);
  ensureSheet_(ss, WW_SUBMISSION_LIMIT_SHEET, WW_SUBMISSION_LIMIT_HEADERS);
  const props = PropertiesService.getDocumentProperties();
  if (!props.getProperty(WW_PROP_TODAY_DATE)) {
    props.setProperty(WW_PROP_TODAY_DATE, todayString_());
  }
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = cleanCallback_(params.callback);
  let response;
  if (params.action === 'leaderboards') {
    const date = normaliseDate_(params.date) || todayString_();
    const limit = clamp_(Number(params.limit) || 50, 1, 100);
    rolloverIfNeeded_(date);
    response = leaderboardsResponse_(limit);
  } else if (params.action === 'submitDaily') {
    response = handleSubmit_(parsePayloadParam_(params.payload), Number(params.limit) || 50);
  } else {
    response = { ok: false, error: 'Unknown action' };
  }
  return callback ? jsonp_(callback, response) : json_(response);
}

function doPost(e) {
  return json_({ ok: false, error: 'POST submissions are disabled' });
}

function handleSubmit_(body, limit) {
  const payload = normaliseSubmission_(body);
  if (!payload) return { ok: false, error: 'Invalid submission' };

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    return leaderboardsResponse_(limit, { accepted: false, reason: 'Server is busy' });
  }

  try {
    rolloverIfNeeded_(payload.date);
    const dates = currentLeaderboardDates_();
    let target = null;
    if (payload.date === dates.today) target = WW_TODAY_SHEET;
    else if (payload.date === dates.yesterday) target = WW_YESTERDAY_SHEET;
    else return leaderboardsResponse_(limit, { accepted: false, reason: 'Date is not today or yesterday' });

    const ss = SpreadsheetApp.getActive();
    const limitSheet = ensureSheet_(ss, WW_SUBMISSION_LIMIT_SHEET, WW_SUBMISSION_LIMIT_HEADERS);
    const rateLimit = recordDailySubmission_(limitSheet, payload);
    if (!rateLimit.allowed) {
      return leaderboardsResponse_(limit, {
        accepted: false,
        reason: 'Daily submission limit reached',
        submissionLimit: WW_MAX_DAILY_SUBMISSIONS_PER_PLAYER
      });
    }

    const sheet = ensureSheet_(ss, target, WW_DAILY_HEADERS);
    const upsert = upsertDailyRow_(sheet, payload);
    if (upsert.changed) updateAllTime_(ensureSheet_(ss, WW_ALL_TIME_SHEET, WW_ALL_TIME_HEADERS), payload, upsert.previous);

    return leaderboardsResponse_(limit, { accepted: upsert.changed });
  } finally {
    lock.releaseLock();
  }
}

function parsePayloadParam_(payload) {
  if (!payload) return {};
  try {
    const obj = JSON.parse(payload);
    obj.action = 'submitDaily';
    return obj;
  } catch (err) {
    return {};
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, obj) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function cleanCallback_(value) {
  const s = String(value || '').trim();
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(s) ? s : '';
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const width = headers.length;
  const firstRow = sheet.getRange(1, 1, 1, width).getValues()[0];
  const same = headers.every((h, i) => firstRow[i] === h);
  if (!same) {
    sheet.getRange(1, 1, 1, width).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  headers.forEach((header, idx) => {
    if (['date', 'lastPlayedDate', 'submittedAt', 'updatedAt'].includes(header)) {
      sheet.getRange(2, idx + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('@');
    }
  });
  return sheet;
}

function normaliseSubmission_(raw) {
  const date = normaliseDate_(raw.date);
  const playerId = cleanId_(raw.playerId);
  if (!date || !playerId) return null;
  const reached = raw.reached === true || raw.reached === 'true';
  const score = Math.floor(Number(raw.score));
  const dayNo = Math.floor(Number(raw.dayNo));
  const stars = Math.floor(Number(raw.stars));
  const wordCount = Math.floor(Number(raw.wordCount));
  const streak = Math.floor(Number(raw.streak));
  const goalTiles = raw.goalTiles === null || raw.goalTiles === '' || raw.goalTiles === undefined
    ? ''
    : Math.floor(Number(raw.goalTiles));
  if (!Number.isFinite(score) || score < 0 || score > 100000) return null;
  if (!Number.isFinite(dayNo) || dayNo < 1 || dayNo > 100000) return null;
  if (!Number.isFinite(stars) || stars < 0 || stars > 3) return null;
  if (!Number.isFinite(wordCount) || wordCount < 0 || wordCount > 49) return null;
  if (!Number.isFinite(streak) || streak < 1 || streak > 100000) return null;
  if (goalTiles !== '' && (!Number.isFinite(goalTiles) || goalTiles < 3 || goalTiles > 49)) return null;
  if (reached && goalTiles === '') return null;
  return {
    date,
    dayNo,
    playerId,
    playerName: cleanName_(raw.playerName),
    score,
    reached,
    stars,
    goalTiles,
    wordCount,
    streak,
    submittedAt: new Date().toISOString()
  };
}

function upsertDailyRow_(sheet, payload) {
  const rows = getRows_(sheet, WW_DAILY_HEADERS);
  const idx = rows.findIndex(row => sheetDateString_(row.date) === payload.date && row.playerId === payload.playerId);
  const values = dailyValues_(payload);
  if (idx < 0) {
    sheet.appendRow(values);
    return { changed: true, previous: null };
  }

  const previous = rowToDaily_(rows[idx]);
  if (!isBetterDaily_(payload, previous)) {
    return { changed: false, previous };
  }

  sheet.getRange(idx + 2, 1, 1, WW_DAILY_HEADERS.length).setValues([values]);
  return { changed: true, previous };
}

function recordDailySubmission_(sheet, payload) {
  const rows = getRows_(sheet, WW_SUBMISSION_LIMIT_HEADERS);
  const idx = rows.findIndex(row => sheetDateString_(row.date) === payload.date && row.playerId === payload.playerId);
  const now = new Date().toISOString();
  if (idx < 0) {
    sheet.appendRow([payload.date, payload.playerId, 1, now]);
    return { allowed: true, count: 1 };
  }

  const currentCount = Math.max(0, Math.floor(Number(rows[idx].count) || 0));
  if (currentCount >= WW_MAX_DAILY_SUBMISSIONS_PER_PLAYER) {
    return { allowed: false, count: currentCount };
  }

  const nextCount = currentCount + 1;
  sheet.getRange(idx + 2, 3, 1, 2).setValues([[nextCount, now]]);
  return { allowed: true, count: nextCount };
}

function dailyValues_(row) {
  return [
    row.date, row.dayNo, row.playerId, row.playerName, row.score, row.reached,
    row.stars, row.goalTiles, row.wordCount, row.streak, row.submittedAt
  ];
}

function isBetterDaily_(a, b) {
  const aa = dailyRankVector_(a);
  const bb = dailyRankVector_(b);
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return aa[i] > bb[i];
  }
  return false;
}

function dailyRankVector_(row) {
  return [
    row.reached ? 1 : 0,
    Number(row.stars) || 0,
    Number(row.score) || 0,
    -(Number(row.goalTiles) || 999),
    -(Number(row.wordCount) || 999),
    -Date.parse(row.submittedAt || '9999-12-31T00:00:00Z')
  ];
}

function updateAllTime_(sheet, current, previous) {
  const rows = getRows_(sheet, WW_ALL_TIME_HEADERS);
  const idx = rows.findIndex(row => row.playerId === current.playerId);
  let row = idx >= 0 ? rowToAllTime_(rows[idx]) : emptyAllTime_(current);
  if (previous) row = applyAllTimeDelta_(row, previous, -1);
  row = applyAllTimeDelta_(row, current, 1);
  row.playerName = current.playerName;
  row.bestScore = Math.max(Number(row.bestScore) || 0, Number(current.score) || 0);
  row.lastPlayedDate = maxDate_(row.lastPlayedDate, current.date);
  row.updatedAt = new Date().toISOString();

  const values = allTimeValues_(row);
  if (idx < 0) sheet.appendRow(values);
  else sheet.getRange(idx + 2, 1, 1, WW_ALL_TIME_HEADERS.length).setValues([values]);
}

function emptyAllTime_(current) {
  return {
    playerId: current.playerId,
    playerName: current.playerName,
    daysPlayed: 0,
    daysReached: 0,
    totalScore: 0,
    bestScore: 0,
    threeStarCount: 0,
    twoStarCount: 0,
    oneStarCount: 0,
    zeroStarReachedCount: 0,
    failedCount: 0,
    lastPlayedDate: '',
    updatedAt: ''
  };
}

function applyAllTimeDelta_(row, daily, sign) {
  row.daysPlayed = Math.max(0, Number(row.daysPlayed || 0) + sign);
  row.daysReached = Math.max(0, Number(row.daysReached || 0) + (daily.reached ? sign : 0));
  row.totalScore = Math.max(0, Number(row.totalScore || 0) + sign * Number(daily.score || 0));
  if (daily.reached && Number(daily.stars) === 3) row.threeStarCount = Math.max(0, Number(row.threeStarCount || 0) + sign);
  else if (daily.reached && Number(daily.stars) === 2) row.twoStarCount = Math.max(0, Number(row.twoStarCount || 0) + sign);
  else if (daily.reached && Number(daily.stars) === 1) row.oneStarCount = Math.max(0, Number(row.oneStarCount || 0) + sign);
  else if (daily.reached) row.zeroStarReachedCount = Math.max(0, Number(row.zeroStarReachedCount || 0) + sign);
  else row.failedCount = Math.max(0, Number(row.failedCount || 0) + sign);
  return row;
}

function allTimeValues_(row) {
  return WW_ALL_TIME_HEADERS.map(h => row[h]);
}

function leaderboardsResponse_(limit, extra) {
  const ss = SpreadsheetApp.getActive();
  const todayRows = getRows_(ensureSheet_(ss, WW_TODAY_SHEET, WW_DAILY_HEADERS), WW_DAILY_HEADERS)
    .map(rowToDaily_)
    .sort(compareDailyRows_)
    .slice(0, limit);
  const yesterdayRows = getRows_(ensureSheet_(ss, WW_YESTERDAY_SHEET, WW_DAILY_HEADERS), WW_DAILY_HEADERS)
    .map(rowToDaily_)
    .sort(compareDailyRows_)
    .slice(0, limit);
  const allTimeRows = getRows_(ensureSheet_(ss, WW_ALL_TIME_SHEET, WW_ALL_TIME_HEADERS), WW_ALL_TIME_HEADERS)
    .map(rowToAllTime_)
    .sort(compareAllTimeRows_)
    .slice(0, limit);
  return Object.assign({
    ok: true,
    dates: currentLeaderboardDates_(),
    leaderboards: {
      today: todayRows,
      yesterday: yesterdayRows,
      all_time: allTimeRows
    }
  }, extra || {});
}

function getRows_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

function rowToDaily_(row) {
  return {
    date: sheetDateString_(row.date),
    dayNo: Number(row.dayNo) || 0,
    playerId: String(row.playerId || ''),
    playerName: cleanName_(row.playerName),
    score: Number(row.score) || 0,
    reached: row.reached === true || row.reached === 'TRUE' || row.reached === 'true',
    stars: Number(row.stars) || 0,
    goalTiles: row.goalTiles === '' ? null : Number(row.goalTiles),
    wordCount: Number(row.wordCount) || 0,
    streak: Number(row.streak) || 0,
    submittedAt: String(row.submittedAt || '')
  };
}

function rowToAllTime_(row) {
  return {
    playerId: String(row.playerId || ''),
    playerName: cleanName_(row.playerName),
    daysPlayed: Number(row.daysPlayed) || 0,
    daysReached: Number(row.daysReached) || 0,
    totalScore: Number(row.totalScore) || 0,
    bestScore: Number(row.bestScore) || 0,
    threeStarCount: Number(row.threeStarCount) || 0,
    twoStarCount: Number(row.twoStarCount) || 0,
    oneStarCount: Number(row.oneStarCount) || 0,
    zeroStarReachedCount: Number(row.zeroStarReachedCount) || 0,
    failedCount: Number(row.failedCount) || 0,
    lastPlayedDate: sheetDateString_(row.lastPlayedDate),
    updatedAt: String(row.updatedAt || '')
  };
}

function compareDailyRows_(a, b) {
  const aa = dailyRankVector_(a);
  const bb = dailyRankVector_(b);
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return bb[i] - aa[i];
  }
  return cleanName_(a.playerName).localeCompare(cleanName_(b.playerName));
}

function compareAllTimeRows_(a, b) {
  return (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0)
    || (Number(b.daysReached) || 0) - (Number(a.daysReached) || 0)
    || (Number(b.threeStarCount) || 0) - (Number(a.threeStarCount) || 0)
    || (Number(b.bestScore) || 0) - (Number(a.bestScore) || 0)
    || cleanName_(a.playerName).localeCompare(cleanName_(b.playerName));
}

function rolloverIfNeeded_(requestedDate) {
  const props = PropertiesService.getDocumentProperties();
  const current = normaliseDate_(props.getProperty(WW_PROP_TODAY_DATE)) || requestedDate;
  if (dateNumber_(requestedDate) <= dateNumber_(current)) {
    props.setProperty(WW_PROP_TODAY_DATE, current);
    setupDailyLeaderboardSheets();
    return;
  }

  const ss = SpreadsheetApp.getActive();
  const todaySheet = ensureSheet_(ss, WW_TODAY_SHEET, WW_DAILY_HEADERS);
  const yesterdaySheet = ensureSheet_(ss, WW_YESTERDAY_SHEET, WW_DAILY_HEADERS);
  clearData_(yesterdaySheet, WW_DAILY_HEADERS.length);
  if (prevDate_(requestedDate) === current) {
    const lastRow = todaySheet.getLastRow();
    if (lastRow >= 2) {
      const values = todaySheet.getRange(2, 1, lastRow - 1, WW_DAILY_HEADERS.length).getValues();
      yesterdaySheet.getRange(2, 1, values.length, WW_DAILY_HEADERS.length).setValues(values);
    }
  }
  clearData_(todaySheet, WW_DAILY_HEADERS.length);
  props.setProperty(WW_PROP_TODAY_DATE, requestedDate);
}

function clearData_(sheet, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) sheet.getRange(2, 1, lastRow - 1, width).clearContent();
}

function currentLeaderboardDates_() {
  const today = normaliseDate_(PropertiesService.getDocumentProperties().getProperty(WW_PROP_TODAY_DATE)) || todayString_();
  return { today, yesterday: prevDate_(today) };
}

function todayString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normaliseDate_(value) {
  const s = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function sheetDateString_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return normaliseDate_(value);
}

function dateNumber_(date) {
  return Number(date.replace(/-/g, ''));
}

function prevDate_(date) {
  const parts = date.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]) - 86400000);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function maxDate_(a, b) {
  if (!a) return b || '';
  if (!b) return a || '';
  return dateNumber_(a) >= dateNumber_(b) ? a : b;
}

function cleanName_(value) {
  const s = String(value || '匿名書蟲')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  return s || '匿名書蟲';
}

function cleanId_(value) {
  const s = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(s) ? s : '';
}

function clamp_(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
