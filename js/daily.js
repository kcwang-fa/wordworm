/* ================= 每日挑戰模式（daily） =================
 *
 * 載入順序：story.js → adventure-data.js → daily.js → game.js
 * （daily.js 排在 game.js 前面，game.js 開機段才呼叫得到 initDaily）
 *
 * 本檔守則（重要）：
 * - 頂層只宣告自己的常數／狀態、掛 #daily-* 元素的事件。
 * - 不得在「頂層」呼叫 game.js 的函式或全域（grid、render、toast⋯），
 *   因為 game.js 還沒載入；但「函式體內」可以自由使用——
 *   函式被呼叫時所有 script 都已載完，頂層 let/const 是跨檔可見的全域綁定。
 * - 只寫兩個自己的 localStorage key，絕不碰經典／冒險的存檔。
 *
 * 玩法摘要：
 * - 每天全球同一張 7×7 棋盤（日期字串當亂數種子），一天只能完整玩一次。
 * - 全盤任選拼字；磚用掉永久消失不補（欄內下落壓縮，洞疊上方）。
 * - 拼到 DAILY_GOAL_SCORE 分達標，達標當下的累計用磚數決定星等；
 *   之後進入「加賽」，用剩下的磚衝總分。
 */

/* ---------- 可調參數（平衡改這裡；調整前先跑 tools/daily-sim.js 看分布） ---------- */
const DAILY_GOAL_SCORE = 300;              // 主挑戰目標分數
const DAILY_STAR_TIERS = [24, 27, 31];     // [⭐⭐⭐, ⭐⭐, ⭐] 磚數上限（2026-07 模擬定案）
const DAILY_EPOCH = '2026-07-11';          // 題號 #1 的日期
const DAILY_MIN_TILES_LEFT = 3;            // 剩磚少於這個數就自動結算（拼字至少要 3 磚）
const DAILY_SAVE_KEY = profileStorageKey('wordworm_daily_save_v1');   // 進行中的局（結算時移除）
const DAILY_META_KEY = profileStorageKey('wordworm_daily_meta_v1');   // 歷史結果 + streak

/* ---------- 模組狀態 ---------- */
let dailyState = null;          // 進行中的局：{date, score, tilesUsed, wordCount, goalTiles, words}
let dailyCountdownTimer = null; // 鎖定畫面的倒數 setInterval handle
let dailyLastResult = null;     // 最近一次結算結果（結算 modal 的複製鈕用）

/* 測試鉤子：?dailydate=YYYY-MM-DD 可假裝今天是別天（也可在 console 直接設
 * DAILY_DATE_OVERRIDE 再呼叫 initDaily(true)）。正式玩家不會用到。 */
window.DAILY_DATE_OVERRIDE =
  new URLSearchParams(location.search).get('dailydate') || null;

/* ================= 日期／題號工具 ================= */
// 今天的本地日期字串 'YYYY-MM-DD'。用本地時區（跟 Wordle 一樣）：
// 午夜換題、倒數直觀；代價是不同時區的玩家在同一瞬間可能玩到不同題。
function dateStrDaily() {
  if (window.DAILY_DATE_OVERRIDE) return window.DAILY_DATE_OVERRIDE;
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
// 把日期字串轉成 UTC 毫秒。之後算「差幾天」都用 UTC 毫秒相減，
// 避免夏令時間讓某天變 23/25 小時導致除法出錯。
function dailyDateUTC(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
// 題號：DAILY_EPOCH 那天是 #1
function dayNumberDaily(ds) {
  return Math.round((dailyDateUTC(ds) - dailyDateUTC(DAILY_EPOCH)) / 86400000) + 1;
}
// 前一天的日期字串（streak 判斷「昨天有沒有玩」用）
function prevDateStrDaily(ds) {
  const d = new Date(dailyDateUTC(ds) - 86400000);
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/* ================= Seeded RNG =================
 * 全球同一天要看到同一張棋盤，所以棋盤生成不能用 Math.random()
 * （每台機器結果都不同）。改用「日期字串 → 種子 → 亂數序列」：
 * xmur3 把字串攪成 32-bit 種子，mulberry32 從種子產生亂數序列。
 * 兩者都只用 Math.imul／位元運算／IEEE-754 除法，規格保證所有
 * 瀏覽器逐位元一致。（兩個都是 public-domain 的常見實作。） */
function xmur3Daily(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32Daily(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 種子加上 'wordworm-daily-' 前綴「加鹽」：就算別的遊戲也拿日期當種子，
// 也不會跟我們產生一樣的亂數序列。
function dailyRng(ds) {
  return mulberry32Daily(xmur3Daily('wordworm-daily-' + ds)());
}

/* ================= 棋盤生成（seeded 平行版） =================
 * 刻意「不」共用 newTile()/ensureBoardVowelFloor()/boardPlayable()：
 * 原版內部用 Math.random()，動了會影響經典／冒險模式，
 * 所以複製一份演算法相同、但亂數全部吃 rng 參數的版本。
 * ⚠️ 這裡的演算法與 tools/daily-sim.js 必須保持一致，
 *    否則星等門檻的模擬依據就失真了。 */

// 生一顆磚：隨機挑一顆 Boggle 骰擲一面（BOGGLE_DICE 定義在 game.js）。
// Q 一律以 'Qu' 磚呈現（英文裡 Q 幾乎都接 U，原版 Boggle 的設計）。
// 不做 newTile() 那個「看場上母音比例動態補母音」的分支——
// 那會讓結果依賴當下盤面，破壞確定性；母音改由下面的保底函式處理。
function newTileDaily(rng) {
  const die = BOGGLE_DICE[Math.floor(rng() * BOGGLE_DICE.length)];
  const ch = die[Math.floor(rng() * die.length)];
  return { letter: ch === 'Q' ? 'Qu' : ch, used: false, fresh: true };
}
// 母音保底：全盤母音低於 32% 就隨機把幾顆子音換成隨機母音。
// 演算法同 game.js 的 ensureBoardVowelFloor，但洗牌與選母音都吃 rng。
function ensureBoardVowelFloorDaily(board, rng) {
  let vowels = 0, total = 0;
  const consonants = [];
  for (const col of board) {
    for (const t of col) {
      total++;
      if (VOWELS.includes(t.letter[0])) vowels++;
      else consonants.push(t);
    }
  }
  let need = Math.ceil(total * VOWEL_FLOOR_RATIO) - vowels;
  if (need <= 0) return board;
  need = Math.min(need, consonants.length);
  for (let i = consonants.length - 1; i > 0; i--) {  // Fisher-Yates 洗牌
    const j = Math.floor(rng() * (i + 1));
    [consonants[i], consonants[j]] = [consonants[j], consonants[i]];
  }
  for (let i = 0; i < need; i++) consonants[i].letter = VOWELS[Math.floor(rng() * VOWELS.length)];
  return board;
}
// 把棋盤數成「字母庫存」物件，例如 {A:3, E:5, Qu:1, ...}
// 只數還活著的磚（used 的洞不算）。
function dailyBoardStock(board) {
  const stock = {};
  for (const col of board) for (const t of col) {
    if (t.used) continue;
    stock[t.letter] = (stock[t.letter] || 0) + 1;
  }
  return stock;
}
// 全盤任選之下「這個字拼不拼得出來」＝純字母庫存夠不夠：
// - 字裡的 "QU" 消耗 1 顆 Qu 磚（棋盤上沒有單獨的 Q 磚）
// - 落單的 Q（後面不是 U）永遠拼不出來 → false
function canSpellFromStockDaily(word, stock) {
  const need = {};
  const W = word.toUpperCase();
  for (let i = 0; i < W.length; i++) {
    const ch = W[i];
    if (ch === 'Q') {
      if (W[i + 1] !== 'U') return false;
      need['Qu'] = (need['Qu'] || 0) + 1;
      i++; // QU 兩個字母吃掉一顆 Qu 磚
    } else {
      need[ch] = (need[ch] || 0) + 1;
    }
  }
  for (const k in need) if ((stock[k] || 0) < need[k]) return false;
  return true;
}
// 可玩性保底：固定順序掃 CEFR A1 常見字表（定義在 game.js），
// 可拼 ≥10 個才算好盤。原版 boardPlayable() 用 Math.random 抽樣字表，
// 結果不確定，所以這裡改成固定順序全掃——同一張盤永遠得到同一個結論。
function boardPlayableDaily(board) {
  const stock = dailyBoardStock(board);
  let ok = 0;
  for (const w of CEFR.a1) {
    if (canSpellFromStockDaily(w, stock)) ok++;
    if (ok >= 10) return true;
  }
  return false;
}
// 生成當日棋盤：整個流程共用「同一條」rng 序列（含重骰），
// 所以任何瀏覽器在同一天都會走完全相同的重試路徑 → 同一張盤。
function freshBoardDaily(ds) {
  const rng = dailyRng(ds);
  let board = null;
  for (let tries = 0; tries < 8; tries++) {
    board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => newTileDaily(rng)));
    ensureBoardVowelFloorDaily(board, rng);
    if (boardPlayableDaily(board)) return board;
  }
  return board; // 8 次都不合格就用最後一張（機率極低；0★達標層會吸收爛盤）
}

/* ================= 計分 =================
 * 每日模式計分＝字長×10 ＋ 每個字母的 LETTER_SCORE（Scrabble 式分值）。
 * 為什麼不用經典模式的公式：星等比的是「省磚」，需要每一磚的價值
 * 有差異（挑 J/X/Z/Qu 這種高分磚才拚得到三星）；純字長制每磚固定
 * 10 分，三星門檻在數學上達不到。門檻數值見 tools/daily-sim.js。
 * 注意：'Qu' 磚佔 1 顆磚（星等算磚數），但字裡貢獻 Q+U 兩個字母分。 */
function wordScoreDaily(w) {
  let s = w.length * 10;
  for (const ch of w.toUpperCase()) s += LETTER_SCORE[ch] || 0;
  return s;
}
// 達標磚數 → 星數（沒達標的呼叫端自己處理，不會進來）
function dailyStarsFor(goalTiles) {
  if (goalTiles <= DAILY_STAR_TIERS[0]) return 3;
  if (goalTiles <= DAILY_STAR_TIERS[1]) return 2;
  if (goalTiles <= DAILY_STAR_TIERS[2]) return 1;
  return 0; // 超過門檻但有達標：✅ 無星
}

/* ================= 存讀檔（防禦性驗證） =================
 * 風格仿照 game-save.js 的 grid 驗證與 isValidAdvState()：
 * localStorage 內容可能被手改、被舊版寫壞，讀進來前逐欄驗證，
 * 驗證失敗一律當作「沒有存檔」，回到乾淨進場頁，絕不 crash。 */
const DAILY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 每日棋盤有自己的驗證器，不共用經典／冒險 grid 驗證：
// 每日的「洞」是 {letter:'', used:true}，空字串 letter 會被經典／冒險驗證打槍。
function isValidDailyGrid(g) {
  if (!Array.isArray(g) || g.length !== 7) return false;
  for (const col of g) {
    if (!Array.isArray(col) || col.length !== 7) return false;
    for (const t of col) {
      if (!t || typeof t.letter !== 'string') return false;
      if (typeof t.used !== 'boolean') return false;
      if (!t.used && !t.letter) return false; // 活磚一定要有字母
    }
  }
  return true;
}
function isValidDailySave(s) {
  if (!s || typeof s !== 'object') return false;
  if (typeof s.date !== 'string' || !DAILY_DATE_RE.test(s.date)) return false;
  if (!isValidDailyGrid(s.grid)) return false;
  for (const f of ['score', 'tilesUsed', 'wordCount'])
    if (!Number.isFinite(s[f]) || s[f] < 0) return false;
  if (s.goalTiles !== null && (!Number.isFinite(s.goalTiles) || s.goalTiles < 0)) return false;
  if (!Array.isArray(s.words) || s.words.some(w => typeof w !== 'string')) return false;
  return true;
}
function isValidDailyMeta(m) {
  if (!m || typeof m !== 'object') return false;
  if (typeof m.lastPlayedDate !== 'string' || !DAILY_DATE_RE.test(m.lastPlayedDate)) return false;
  if (!Number.isFinite(m.streak) || m.streak < 1) return false;
  const r = m.lastResult;
  if (!r || typeof r !== 'object') return false;
  if (typeof r.date !== 'string' || !DAILY_DATE_RE.test(r.date)) return false;
  for (const f of ['dayNo', 'score', 'wordCount'])
    if (!Number.isFinite(r[f])) return false;
  if (!Number.isFinite(r.stars) || r.stars < 0 || r.stars > 3) return false;
  if (typeof r.reached !== 'boolean') return false;
  if (r.goalTiles !== null && !Number.isFinite(r.goalTiles)) return false;
  return true;
}
// 讀取一律 try/catch + 驗證；localStorage 被停用或內容壞掉都回 null
function loadDailySave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(DAILY_SAVE_KEY)); } catch (e) { return null; }
  return isValidDailySave(s) ? s : null;
}
function loadDailyMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(DAILY_META_KEY)); } catch (e) { return null; }
  return isValidDailyMeta(m) ? m : null;
}
// 寫入也包 try/catch：localStorage 满了或被停用時遊戲照玩，只是存不住
function saveDaily() {
  if (!dailyState) return;
  const data = {
    date: dailyState.date,
    // 只存 letter/used 兩欄，fresh 之類的動畫旗標不進存檔
    grid: grid.map(col => col.map(t => ({ letter: t.letter, used: !!t.used }))),
    score: dailyState.score,
    tilesUsed: dailyState.tilesUsed,
    wordCount: dailyState.wordCount,
    goalTiles: dailyState.goalTiles,
    words: dailyState.words,
  };
  try { localStorage.setItem(DAILY_SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 存不住就算了 */ }
}

/* ================= Streak（連續遊玩天數） ================= */
// 結算時更新：昨天有結算 → +1；今天已經算過（理論上不會發生）→ 不變；
// 其他（中斷過或第一次玩）→ 重新從 1 開始。
function updateDailyStreak(playedDate, result) {
  const meta = loadDailyMeta();
  let streak = 1;
  if (meta) {
    if (meta.lastPlayedDate === prevDateStrDaily(playedDate)) streak = meta.streak + 1;
    else if (meta.lastPlayedDate === playedDate) streak = meta.streak;
  }
  try {
    localStorage.setItem(DAILY_META_KEY, JSON.stringify({
      lastPlayedDate: playedDate, streak, lastResult: result,
    }));
  } catch (e) { /* 存不住就算了 */ }
  return streak;
}
// 進場頁顯示用：最後一次結算是今天或昨天，streak 才「活著」，否則顯示 0
function dailyCurrentStreak(today) {
  const meta = loadDailyMeta();
  if (!meta) return 0;
  if (meta.lastPlayedDate === today || meta.lastPlayedDate === prevDateStrDaily(today)) return meta.streak;
  return 0;
}

/* ================= 進場／流程 ================= */
// 切每日模式的子畫面：entry（進場規則頁）/ play（對局）/ locked（今日已完成）
// CSS 全部用 body.mode-daily.daily-view-* 複合選擇器，
// 所以就算離開每日模式時這些 class 留在 body 上也不會影響其他模式。
function setDailyView(view) {
  document.body.classList.toggle('daily-view-entry', view === 'entry');
  document.body.classList.toggle('daily-view-play', view === 'play');
  document.body.classList.toggle('daily-view-locked', view === 'locked');
}

// 每日模式進場（game.js 的 selectGameMode / 開機段呼叫）。
// 判斷順序：進行中存檔 → 今天已結算 → 全新進場頁。
function initDaily(fromSave = true) {
  stopDailyCountdown();
  document.getElementById('daily-gameover').classList.remove('show');
  toggleDailyRules(false);
  const today = dateStrDaily();

  // (a) 有進行中的局 → 續玩。就算存檔日期已是「昨天」也照樣續玩：
  //     局錨定在開局日，跨午夜不重骰、結算也記在開局日（見 settleDaily）。
  const save = fromSave ? loadDailySave() : null;
  if (save) {
    dailyState = {
      date: save.date, score: save.score, tilesUsed: save.tilesUsed,
      wordCount: save.wordCount, goalTiles: save.goalTiles, words: save.words.slice(),
    };
    grid = save.grid.map(col => col.map(t => ({ letter: t.letter, used: t.used })));
    sel = []; over = false;
    setDailyView('play');
    render(); updateCurrent(); renderDailyHud();
    return;
  }

  // 沒有進行中的局：棋盤照樣先生成（畫面上隱藏）。
  // 為什麼：字典載入完成的 async callback 會跑 pickBonusWord() 掃 grid，
  // 這裡保證 grid 永遠是合法 7×7，不會讓共用程式掃到空盤 crash。
  grid = freshBoardDaily(today);
  sel = []; over = true; // over=true 擋住 pick/submit，進場頁與鎖定頁都不能拼字

  const meta = loadDailyMeta();
  if (meta && meta.lastPlayedDate === today) {
    // (b) 今天已經玩完 → 鎖定畫面 + 倒數
    setDailyView('locked');
    renderDailyLocked(meta.lastResult);
    startDailyCountdown();
  } else {
    // (c) 全新的一天 → 進場規則頁
    setDailyView('entry');
    renderDailyEntry(today, meta);
  }
}

// 按「開始今日挑戰」：正式開局
function startDailyRun() {
  const today = dateStrDaily(); // 進場頁若掛過午夜，以按下當下的日期為準
  grid = freshBoardDaily(today);
  dailyState = { date: today, score: 0, tilesUsed: 0, wordCount: 0, goalTiles: null, words: [] };
  sel = []; over = false;
  setDailyView('play');
  render(); updateCurrent(); renderDailyHud();
  saveDaily(); // 開局立刻存：之後刷新頁面會續玩這一局，不會重骰
}

/* ================= 拼字提交（由 game.js 的 submit() 分派過來） =================
 * 進來時 submit() 已驗過：字長 ≥3、DICT 裡有這個字。 */
function submitDaily(w) {
  const gained = wordScoreDaily(w);
  const tilesSpent = sel.length; // Qu 磚佔一格，sel 長度就是「磚數」
  dailyState.score += gained;
  dailyState.tilesUsed += tilesSpent;
  dailyState.wordCount++;
  dailyState.words.push(w.toUpperCase());

  // 首次跨越目標分數 → 凍結達標磚數（星等就看這個數字），進入加賽
  if (dailyState.goalTiles === null && dailyState.score >= DAILY_GOAL_SCORE) {
    dailyState.goalTiles = dailyState.tilesUsed;
    sfx.levelup(); setFace('happy');
    const stars = dailyStarsFor(dailyState.goalTiles);
    toast('🎉 ' + dailyState.goalTiles + ' 磚達標' + (stars ? '，' + '⭐'.repeat(stars) : '') + '！剩下的磚自由加賽衝總分～', 3000);
    setTimeout(() => setFace('normal'), 1600);
  } else {
    sfx.ok(w.length); setFace('happy');
    if (w.length >= 6) bubble(quip(QUIPS.long));
    setTimeout(() => setFace('normal'), 900);
  }

  removeTilesDaily(sel);
  sel = [];
  render(); updateCurrent(); renderDailyHud();
  saveDaily();

  // 剩磚湊不出一個字（最短 3 字母）就自動結算
  if (dailyTilesRemaining() < DAILY_MIN_TILES_LEFT) settleDaily('depleted');
}

// 消磚（每日版）：磚用掉「不補」。同一欄裡活磚往下沉、洞疊到上方——
// 鏡射經典 removeTiles() 的重力方向（grid[c][0] 是畫面最上格），
// 但新進來的不是新磚而是永久的洞 {letter:'', used:true}。
function removeTilesDaily(tiles) {
  const cols = [...new Set(tiles.map(p => p.c))];
  for (const c of cols) {
    const usedRows = new Set(tiles.filter(p => p.c === c).map(p => p.r));
    const keptLive = [];
    for (let r = 0; r < 7; r++) {
      const t = grid[c][r];
      if (t.used || usedRows.has(r)) continue; // 舊洞與剛用掉的磚都不保留
      keptLive.push(t);
    }
    const holes = Array.from({ length: 7 - keptLive.length }, () => ({ letter: '', used: true }));
    grid[c] = [...holes, ...keptLive];
  }
}
// 場上還剩幾顆活磚
function dailyTilesRemaining() {
  let n = 0;
  for (const col of grid) for (const t of col) if (!t.used) n++;
  return n;
}

/* ================= 結算 ================= */
function settleDaily(reason) {
  over = true; sel = [];
  const g = dailyState.goalTiles;
  const reached = g !== null;
  const result = {
    date: dailyState.date,
    dayNo: dayNumberDaily(dailyState.date), // 用「開局日」算題號，跨午夜也記對天
    score: dailyState.score,
    goalTiles: g,
    stars: reached ? dailyStarsFor(g) : 0,
    reached,
    wordCount: dailyState.wordCount,
  };
  const streak = updateDailyStreak(dailyState.date, result);
  try { localStorage.removeItem(DAILY_SAVE_KEY); } catch (e) { /* 沒差 */ }
  dailyLastResult = result;
  render(); renderDailyHud();
  sfx.levelup();
  showDailyGameover(result, streak);
}

// 結算 modal（樣式同 #gameover 的 .show 顯示機制）
function showDailyGameover(result, streak) {
  document.getElementById('daily-f-no').textContent = '#' + result.dayNo;
  document.getElementById('daily-f-stars').textContent =
    result.reached ? (result.stars ? '⭐'.repeat(result.stars) : '✅') : '❌';
  document.getElementById('daily-f-line').textContent = dailyResultLine(result);
  document.getElementById('daily-f-words').textContent =
    '拼出 ' + result.wordCount + ' 個單字｜🔥 連續 ' + streak + ' 天';
  document.getElementById('daily-gameover').classList.add('show');
}

/* ================= 分享文字 ================= */
// 結果行（畫面顯示與複製共用）。刻意不含棋盤字母，避免劇透當日題目。
function dailyResultLine(result) {
  if (!result.reached) return '未達標｜總分 ' + result.score;
  return result.goalTiles + '磚達標｜總分 ' + result.score;
}
function dailyShareText(result) {
  const prefix = result.reached ? (result.stars ? '⭐'.repeat(result.stars) : '✅') : '❌';
  return 'Word Worm 每日挑戰 #' + result.dayNo + '\n' +
    prefix + ' ' + dailyResultLine(result).replace('｜', '|');
}
// 複製到剪貼簿：新式 API → 失敗退回隱藏 textarea + execCommand →
// 再失敗就請玩家長按畫面上的結果文字自己複製（結果本來就顯示在畫面上）。
function copyDailyResult(result) {
  if (!result) return;
  const text = dailyShareText(result);
  const ok = () => toast('已複製結果 📋 拿去炫耀吧！');
  const legacy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const done = document.execCommand('copy');
      document.body.removeChild(ta);
      done ? ok() : toast('複製失敗，請長按結果文字手動複製', 2600);
    } catch (e) {
      toast('複製失敗，請長按結果文字手動複製', 2600);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, legacy);
  } else {
    legacy();
  }
}

/* ================= UI 渲染 ================= */
// 規則說明（進場頁與對局中「?」浮層共用同一份，改門檻只改這裡）
function dailyRulesHtml() {
  const [s3, s2, s1] = DAILY_STAR_TIERS;
  return '<ul class="daily-rules-list">' +
    '<li>🌍 每天全球同一張 49 磚棋盤，一天只能完整玩一次</li>' +
    '<li>🖐️ 全盤任選拼字（不用相鄰）；磚用掉就消失，不會補</li>' +
    '<li>🎯 拼到 <b>' + DAILY_GOAL_SCORE + ' 分</b>達標。計分＝字長×10＋字母分（罕見字母分高）</li>' +
    '<li>⭐ 用越少磚達標星星越多：⭐⭐⭐ ≤' + s3 + '磚｜⭐⭐ ≤' + s2 + '磚｜⭐ ≤' + s1 + '磚（Qu 算 1 磚）</li>' +
    '<li>🏁 達標後進入加賽，用剩下的磚衝總分</li>' +
    '<li>📋 結算可複製成績分享，不會劇透棋盤內容</li>' +
    '</ul>';
}
function renderDailyEntry(today, meta) {
  document.getElementById('daily-entry-no').textContent = '#' + dayNumberDaily(today);
  document.getElementById('daily-entry-rules').innerHTML = dailyRulesHtml();
  document.getElementById('daily-entry-streak').innerHTML =
    '🔥 連續挑戰 <b>' + dailyCurrentStreak(today) + '</b> 天';
}
// 對局中的上方資訊列
function renderDailyHud() {
  if (!dailyState) return;
  const prog = document.getElementById('daily-progress');
  if (dailyState.goalTiles === null) {
    prog.innerHTML = '分數 <b>' + dailyState.score + '</b> / ' + DAILY_GOAL_SCORE;
  } else {
    const stars = dailyStarsFor(dailyState.goalTiles);
    prog.innerHTML = '已達標 ' + (stars ? '⭐'.repeat(stars) : '✅') +
      '（' + dailyState.goalTiles + '磚）｜總分 <b>' + dailyState.score + '</b>';
  }
  document.getElementById('daily-tiles').innerHTML =
    '已用 <b>' + dailyState.tilesUsed + '</b> 磚｜剩 <b>' + dailyTilesRemaining() + '</b> 磚';
}
// 每日版拼字預覽（updateCurrent 開頭分派過來）：
// 用每日計分公式，不顯示經典模式的寶石加成。
function updateCurrentDaily() {
  const w = currentWord();
  const cur = document.getElementById('current');
  if (!w) { cur.innerHTML = '&nbsp;'; return; }
  const valid = DICT && DICT.has(w.toLowerCase());
  cur.classList.toggle('invalid', !valid);
  cur.innerHTML = w + (valid ? ' <span class="score-preview">+' + wordScoreDaily(w) + '</span>' : '');
}
// 鎖定畫面（今天已完成）
function renderDailyLocked(result) {
  dailyLastResult = result;
  const el = document.getElementById('daily-locked-result');
  if (result) {
    const prefix = result.reached ? (result.stars ? '⭐'.repeat(result.stars) : '✅') : '❌';
    el.innerHTML = '<div class="daily-locked-stars">' + prefix + '</div>' +
      '<div>每日挑戰 #' + result.dayNo + '　' + dailyResultLine(result) + '</div>';
  } else {
    el.textContent = ''; // meta 壞掉時仍能顯示倒數,不 crash
  }
}
// 規則說明浮層開關
function toggleDailyRules(show) {
  const el = document.getElementById('daily-rules');
  const want = show === undefined ? !el.classList.contains('show') : !!show;
  if (want) document.getElementById('daily-rules-body').innerHTML = dailyRulesHtml();
  el.classList.toggle('show', want);
}

/* ================= 倒數計時（到本地午夜換題） ================= */
function startDailyCountdown() {
  stopDailyCountdown();
  const el = document.getElementById('daily-countdown');
  const tick = () => {
    if (gameMode !== 'daily') { stopDailyCountdown(); return; } // 切走模式就自清
    const now = new Date();
    // 明天 00:00:00（本地）。Date 會自動處理跨月／跨年。
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const ms = midnight - now;
    if (ms <= 0) { stopDailyCountdown(); initDaily(true); return; } // 跨日 → 換新題
    const p = n => String(n).padStart(2, '0');
    el.textContent = p(Math.floor(ms / 3600000)) + ':' + p(Math.floor(ms / 60000) % 60) + ':' + p(Math.floor(ms / 1000) % 60);
  };
  tick(); // 先跑一次，不然畫面會停在 --:--:-- 一秒
  dailyCountdownTimer = setInterval(tick, 1000);
}
function stopDailyCountdown() {
  if (dailyCountdownTimer) { clearInterval(dailyCountdownTimer); dailyCountdownTimer = null; }
}

/* ================= 事件掛載（頂層只碰 #daily-* 元素，安全） ================= */
document.getElementById('daily-start').onclick = () => startDailyRun();
document.getElementById('daily-endrun').onclick = () => {
  if (over || !dailyState) return;
  const warn = dailyState.goalTiles === null
    ? '還沒達標喔！現在結算會以「未達標」收場，今天就不能再玩了。確定要結束嗎？'
    : '現在結算今天的挑戰嗎？結算後要等明天才有新題目。';
  if (confirm(warn)) settleDaily('manual');
};
document.getElementById('daily-help').onclick = () => toggleDailyRules();
document.getElementById('daily-rules').onclick = e => {
  // 點背景或關閉鈕都收起浮層
  if (e.target.id === 'daily-rules' || e.target.id === 'daily-rules-close') toggleDailyRules(false);
};
document.getElementById('daily-copy').onclick = () => copyDailyResult(dailyLastResult);
document.getElementById('daily-locked-copy').onclick = () => copyDailyResult(dailyLastResult);
document.getElementById('daily-close').onclick = () => initDaily(true); // 關結算 → 鎖定頁（或跨日後的新進場頁）
