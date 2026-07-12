/*
 * 每日挑戰星等門檻模擬（平衡工具，遊戲不會載入這支）
 * ============================
 * 用法:node tools/daily-sim.js
 * 目的:用「和 js/daily.js 一模一樣」的 seeded 棋盤生成邏輯,生 100 張日期棋盤,
 * 模擬各種玩家策略拼到 300 分所需的磚數分布,據此定星等門檻。
 * ⚠️ 若改了 js/daily.js 的生成邏輯或計分公式,這裡要同步改,否則模擬失真。
 *
 * 策略定義(Vickie 指定 + 對照組):
 *   greedy     = 每一步拼「當下可拼的最高分字」→ 原始高手模型(結論:其實很費磚,見下)
 *   randFull   = 從「全字典中可拼的字」均勻隨機挑一個 → 代表亂玩的休閒玩家
 *   randCefr   = 同上但只認得 CEFR A1+A2+B1 常見字(約 270 字)→ 貼近台灣玩家詞彙量的對照組
 *   greedyEff  = 每一步拼「每磚分數比最高的字」→ 修正後的省磚高手模型(檔尾)
 *
 * 2026-07 定案:⭐≤31、⭐⭐≤27、⭐⭐⭐≤24
 * (依據:一星≈randFull P75+1、二星=randFull P25、三星≈greedyEff 低分位;
 *  「最高分字」貪心反而費磚——長字塞滿 1 分常見字母,每磚效率輸給
 *  用 J/X/Z/Qu 拼的短字,所以三星依據採 greedyEff 而非 greedy。
 *  注意:合併 modern/extra 字表後 greedyEff 分布右移(med 25→31),
 *  因為補充字表混入羅馬數字/縮寫等高效率雜字擾動貪心路徑;
 *  randFull 的 P25/P75(門檻錨點)不受影響,定案門檻維持不變。
 *  字表清理後建議重跑本工具複核。)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');   // repo 根目錄(本檔在 tools/ 底下)

/* ---------- seeded RNG(與正式實作將完全相同的演算法) ---------- */
// xmur3:把任意字串攪成 32-bit 種子。只用 Math.imul / 位移,跨瀏覽器逐位元一致
function xmur3(str) {
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
// mulberry32:32-bit 種子 → [0,1) 亂數序列,同種子在任何 JS 引擎產出相同序列
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dailyRng = (ds) => mulberry32(xmur3('wordworm-daily-' + ds)());

/* ---------- 遊戲常數(照抄 game.js,數值不能偏差) ---------- */
const BOGGLE_DICE = [
  'AAEEGN','ABBJOO','ACHOPS','AFFKPS','AOOTTW','CIMOTU','DEILRX','DELRVY',
  'DISTTY','EEGHNW','EEINSU','EHRTVW','EIOSST','ELRTTY','HIMNQU','HLNNRZ'
];
const LETTER_SCORE = { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10 };
const VOWELS = 'AEIOU';
const VOWEL_FLOOR_RATIO = 0.32;
const BOARD_TILES = 49;      // 7×7
const GOAL_SCORE = 300;

/* ---------- 字母編碼:0-25 = A-Z,26 = Qu 磚 ---------- */
const QU = 26;
const idx = (ch) => ch.charCodeAt(0) - 65;

/*
 * 把單字解析成「磚需求」:
 * - 字裡的 "QU" 消耗 1 顆 Qu 磚(棋盤上沒有單獨 Q 磚,Q 一律以 Qu 形式存在)
 * - 落單的 Q(後面不是 U)永遠拼不出來 → 回傳 null 直接剔除
 * 回傳 { pairs: [[磚編號, 數量]...], tiles: 磚數, score: 分數 }
 * 分數 = 字長×10 + 每個字母的 LETTER_SCORE(Qu 貢獻 Q=10 + U=1,字長也算 2)
 */
function parseWord(w) {
  const need = new Int32Array(27);
  let tiles = 0;
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (ch < 'A' || ch > 'Z') return null;
    if (ch === 'Q') {
      if (w[i + 1] !== 'U') return null; // 落單 Q,不可拼
      need[QU]++; tiles++; i++;          // 吃掉 QU 兩個字母 = 1 顆 Qu 磚
    } else {
      need[idx(ch)]++; tiles++;
    }
  }
  let score = w.length * 10;
  for (const ch of w) score += LETTER_SCORE[ch];
  const pairs = [];
  for (let k = 0; k < 27; k++) if (need[k]) pairs.push([k, need[k]]);
  return { pairs, tiles, score };
}

// 庫存夠不夠拼這個字(全盤任選 = 純字母多重集包含)
function spellable(pairs, stock) {
  for (const [k, n] of pairs) if (stock[k] < n) return false;
  return true;
}

/* ---------- 棋盤生成(照計畫中 freshBoardDaily 的邏輯) ---------- */
// 生一顆磚:隨機挑一顆 Boggle 骰擲一面;Q → Qu 磚
function newTileDaily(rng) {
  const die = BOGGLE_DICE[Math.floor(rng() * 16)];
  const ch = die[Math.floor(rng() * 6)];
  return ch === 'Q' ? QU : idx(ch);
}
// 母音保底:少於 32% 就把隨機幾顆子音換成隨機母音(Fisher-Yates 也吃 rng,保持確定性)
function ensureVowelFloor(tiles, rng) {
  const isVowel = (t) => t !== QU && VOWELS.includes(String.fromCharCode(65 + t));
  let vowels = 0; const consIdx = [];
  tiles.forEach((t, i) => { if (isVowel(t)) vowels++; else consIdx.push(i); });
  let need = Math.ceil(tiles.length * VOWEL_FLOOR_RATIO) - vowels;
  if (need <= 0) return;
  need = Math.min(need, consIdx.length);
  for (let i = consIdx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [consIdx[i], consIdx[j]] = [consIdx[j], consIdx[i]];
  }
  for (let i = 0; i < need; i++) tiles[consIdx[i]] = idx(VOWELS[Math.floor(rng() * 5)]);
}
function tilesToStock(tiles) {
  const s = new Int32Array(27);
  for (const t of tiles) s[t]++;
  return s;
}
// 可玩性保底:固定順序掃 A1 常見字,可拼 ≥10 個才算好盤;最多重骰 8 次(同一 rng 流,確定性)
function freshBoardDaily(ds, a1Parsed) {
  const rng = dailyRng(ds);
  let tiles = null;
  for (let tries = 0; tries < 8; tries++) {
    tiles = Array.from({ length: BOARD_TILES }, () => newTileDaily(rng));
    ensureVowelFloor(tiles, rng);
    const stock = tilesToStock(tiles);
    let ok = 0;
    for (const w of a1Parsed) { if (spellable(w.pairs, stock)) ok++; if (ok >= 10) return tiles; }
  }
  return tiles; // 8 次都不合格就用最後一張(極罕見)
}

/* ---------- 載入字典與 CEFR 字表 ----------
 * 與 js/game.js 的字典載入一致:enable1 + modern-words + extra-words 三檔合併,
 * 過濾規則同 dictionaryWordsFromText()(去空白、跳過 # 註解、純字母、長度 ≥3)。 */
function readDictFile(name) {
  let text = '';
  try { text = fs.readFileSync(path.join(ROOT, name), 'utf8'); } catch (e) { /* 檔案不存在就當空的,跟遊戲的 fetch fallback 一樣 */ }
  return text.split(/\r?\n/)
    .map(line => line.trim().toUpperCase())
    .filter(w => w.length >= 3 && !w.startsWith('#') && /^[A-Z]+$/.test(w));
}
const dictWords = [...new Set([
  ...readDictFile('enable1.txt'),
  ...readDictFile('modern-words.txt'),
  ...readDictFile('extra-words.txt'),
])];
// 從 game.js 原始碼直接抽 CEFR 常數,避免手抄出入
const gameSrc = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
const cefrMatch = gameSrc.match(/const CEFR = (\{[\s\S]*?\});/);
if (!cefrMatch) { console.error('抽不到 CEFR 常數'); process.exit(1); }
const CEFR = eval('(' + cefrMatch[1] + ')');

// 預解析:每個字算好磚需求/磚數/分數(剔除拼不出的落單 Q 字)
const words = [];
for (const w of dictWords) { const p = parseWord(w); if (p) words.push({ w, ...p }); }
// 貪心用:按分數由高到低排序的索引
const byScoreDesc = words.map((_, i) => i).sort((a, b) => words[b].score - words[a].score);
const dictSet = new Set(dictWords);
const a1Parsed = CEFR.a1.map(w => parseWord(w.toUpperCase())).filter(Boolean);
const cefrWords = [...new Set([...CEFR.a1, ...CEFR.a2, ...CEFR.b1].map(w => w.toUpperCase()))]
  .filter(w => w.length >= 3 && dictSet.has(w))
  .map(w => ({ w, ...parseWord(w) })).filter(p => p.pairs);

/* ---------- 三種策略,各自模擬「拼到 300 分」 ---------- */
// 回傳達標用磚數,卡死(無字可拼)回傳 null
function simGreedy(stock) {
  let score = 0, used = 0;
  while (score < GOAL_SCORE) {
    let hit = -1;
    for (const i of byScoreDesc) { if (spellable(words[i].pairs, stock)) { hit = i; break; } }
    if (hit === -1) return null;
    const wd = words[hit];
    for (const [k, n] of wd.pairs) stock[k] -= n;
    score += wd.score; used += wd.tiles;
  }
  return used;
}
function simRandFull(stock, rng) {
  let score = 0, used = 0;
  while (score < GOAL_SCORE) {
    let hit = -1;
    // 均勻抽樣:隨機挑字、不可拼就重抽 → 等價於在「可拼集合」上均勻隨機
    for (let t = 0; t < 20000; t++) {
      const i = Math.floor(rng() * words.length);
      if (spellable(words[i].pairs, stock)) { hit = i; break; }
    }
    if (hit === -1) { // 抽不到就全掃確認是不是真的沒字了
      for (let i = 0; i < words.length; i++) if (spellable(words[i].pairs, stock)) { hit = i; break; }
      if (hit === -1) return null;
    }
    const wd = words[hit];
    for (const [k, n] of wd.pairs) stock[k] -= n;
    score += wd.score; used += wd.tiles;
  }
  return used;
}
function simRandCefr(stock, rng) {
  let score = 0, used = 0;
  while (score < GOAL_SCORE) {
    const ok = cefrWords.filter(wd => spellable(wd.pairs, stock));
    if (!ok.length) return null; // 常見字用罄 → 休閒玩家卡住
    const wd = ok[Math.floor(rng() * ok.length)];
    for (const [k, n] of wd.pairs) stock[k] -= n;
    score += wd.score; used += wd.tiles;
  }
  return used;
}

/* ---------- 跑 100 張日期棋盤 ---------- */
const N_BOARDS = 100, N_RAND_RUNS = 5;
const start = Date.UTC(2026, 6, 11); // 2026-07-11 起連續 100 天
const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);
const res = { greedy: [], randFull: [], randCefr: [] };
const fails = { greedy: 0, randFull: 0, randCefr: 0 };
const stratRng = mulberry32(xmur3('strategy-sim')()); // 策略端亂數也固定種子,結果可重現

for (let b = 0; b < N_BOARDS; b++) {
  const ds = fmt(start + b * 86400000);
  const tiles = freshBoardDaily(ds, a1Parsed);
  const baseStock = tilesToStock(tiles);
  const g = simGreedy(baseStock.slice());
  g === null ? fails.greedy++ : res.greedy.push(g);
  for (let r = 0; r < N_RAND_RUNS; r++) {
    const f = simRandFull(baseStock.slice(), stratRng);
    f === null ? fails.randFull++ : res.randFull.push(f);
    const c = simRandCefr(baseStock.slice(), stratRng);
    c === null ? fails.randCefr++ : res.randCefr.push(c);
  }
}

/* ---------- 統計輸出 ---------- */
function stats(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const q = (p) => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))];
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  return { n: a.length, mean: +mean.toFixed(1), min: a[0], p25: q(.25), med: q(.5), p75: q(.75), max: a[a.length - 1] };
}
console.log('=== 每日挑戰 300 分達標磚數模擬(100 張日期棋盤)===');
console.log('字典字數:', words.length, '|CEFR 常見字數:', cefrWords.length);
for (const k of ['greedy', 'randFull', 'randCefr']) {
  const label = { greedy: '貪心(高手)  ', randFull: '隨機全字典  ', randCefr: '隨機CEFR常見字' }[k];
  console.log(label, JSON.stringify(stats(res[k])), '卡死次數:', fails[k]);
}
const rf = stats(res.randFull), gr = stats(res.greedy);
console.log('\n=== 依 Vickie 公式的門檻建議 ===');
console.log('⭐   ≤', rf.p75, '磚(隨機全字典 P75)');
console.log('⭐⭐  ≤', rf.p25, '磚(隨機全字典 P25)');
console.log('⭐⭐⭐ ≤', gr.med, '磚(貪心中位數)');

/* ---------- 補充策略:效率貪心(每磚分數比最高的字)= 真正的省磚高手模型 ----------
 * 為什麼要補:上面「最高分字」貪心會挑超長字,長字塞滿 1 分的常見字母,
 * 每磚效率反而輸給隨機短字。省磚挑戰的高手行為是「分數/磚數」最大化。 */
const byEffDesc = words.map((_, i) => i)
  .sort((a, b) => (words[b].score / words[b].tiles) - (words[a].score / words[a].tiles)
    || words[b].score - words[a].score);
function simGreedyEff(stock) {
  let score = 0, used = 0;
  while (score < GOAL_SCORE) {
    let hit = -1;
    for (const i of byEffDesc) { if (spellable(words[i].pairs, stock)) { hit = i; break; } }
    if (hit === -1) return null;
    const wd = words[hit];
    for (const [k, n] of wd.pairs) stock[k] -= n;
    score += wd.score; used += wd.tiles;
  }
  return used;
}
const effRes = []; let effFail = 0;
for (let b = 0; b < N_BOARDS; b++) {
  const ds = fmt(start + b * 86400000);
  const tiles = freshBoardDaily(ds, a1Parsed);
  const g = simGreedyEff(tilesToStock(tiles));
  g === null ? effFail++ : effRes.push(g);
}
console.log('\n效率貪心(省磚高手)', JSON.stringify(stats(effRes)), '卡死次數:', effFail);
