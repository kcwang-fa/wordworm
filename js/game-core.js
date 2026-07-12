/* ================= 字典載入 ================= */
const WORDWORM_ASSET_VERSION = '20260712f';
let DICT = null;
function dictionaryWordsFromText(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim().toLowerCase())
    .filter(w => w.length >= 3 && !w.startsWith('#') && /^[a-z]+$/.test(w));
}

function versionedAssetUrl(path) {
  const url = new URL(path, document.baseURI);
  url.searchParams.set('v', WORDWORM_ASSET_VERSION);
  return url;
}

async function fetchTextAsset(path, options = {}) {
  const { required = false } = options;
  const response = await fetch(versionedAssetUrl(path), { cache: 'no-cache' });
  if (!response.ok) {
    if (!required) return '';
    throw new Error(path + ' HTTP ' + response.status);
  }
  return response.text();
}

/* ================= 常數 ================= */
let COLS = 7, ROWS = 7;
/* ================= 遊戲模式（經典／冒險／每日挑戰） ================= */
let gameMode = localStorage.getItem('wordworm_gamemode') || 'classic';
// localStorage 可能被手改成怪值；不認得的模式一律當經典（原本的 fallback 行為）
if (!['classic', 'adventure', 'daily', 'kids'].includes(gameMode)) gameMode = 'classic';
function setBoardSize() {
  if (gameMode === 'adventure') { COLS = 4; ROWS = 4; }
  else { COLS = 7; ROWS = 7; }  // 經典與每日挑戰都是 7×7
}
function applyModeClass() {
  document.body.classList.toggle('mode-adventure', gameMode === 'adventure');
  document.body.classList.toggle('mode-classic', gameMode === 'classic');
  document.body.classList.toggle('mode-daily', gameMode === 'daily');
  document.body.classList.toggle('mode-kids', gameMode === 'kids');
  document.getElementById('modesel-classic').classList.toggle('active', gameMode === 'classic');
  document.getElementById('modesel-adventure').classList.toggle('active', gameMode === 'adventure');
  document.getElementById('modesel-daily').classList.toggle('active', gameMode === 'daily');
  document.getElementById('modesel-kids').classList.toggle('active', gameMode === 'kids');
  document.getElementById('submit').textContent = gameMode === 'adventure' ? 'Attack / 攻擊' : '拼字！';
  document.getElementById('clear').textContent = gameMode === 'adventure' ? '清除選字' : '清除';
  document.getElementById('shuffle').textContent = '洗牌 (-燃燒)';
  document.getElementById('shuffle').hidden = gameMode !== 'classic';  // 洗牌是經典限定（每日挑戰磚數固定不能洗）
}
function selectGameMode(mode) {
  const wasHomeScreen = document.body.classList.contains('home-screen');
  document.body.classList.remove('home-screen');
  if (mode === gameMode) {
    if (wasHomeScreen && mode === 'adventure') initAdventure(true);
    if (wasHomeScreen && mode === 'daily') initDaily(true);
    if (wasHomeScreen && mode === 'kids' && window.initKidsMode) window.initKidsMode(true);
    return;
  }
  gameMode = mode;
  localStorage.setItem('wordworm_gamemode', mode);
  applyModeClass();
  setBoardSize();
  sel = [];
  if (mode === 'adventure') initAdventure(true);
  else if (mode === 'daily') initDaily(true);
  else if (mode === 'kids' && window.initKidsMode) window.initKidsMode(true);
  else init(true);
}
function returnHome() {
  sel = [];
  document.body.classList.add('home-screen');
  document.getElementById('gameover').classList.remove('show');
  document.getElementById('daily-gameover').classList.remove('show');
  document.getElementById('daily-rules').classList.remove('show');
  document.getElementById('adv-gameover').classList.remove('show');
  document.getElementById('adv-story-modal').classList.remove('show');
  if (window.closeKidsPanels) window.closeKidsPanels();
  if (gameMode !== 'kids') {
    render();
    updateCurrent();
  }
}
// 字母出現權重（近似英文頻率，Qu 合併為一磚）
const LETTER_POOL = (
  'EEEEEEEEEEEE' + 'AAAAAAAAA' + 'IIIIIIIII' + 'OOOOOOOO' + 'NNNNNN' +
  'RRRRRR' + 'TTTTTT' + 'LLLL' + 'SSSS' + 'UUUU' +
  'DDDD' + 'GGG' + 'BB' + 'CC' + 'MM' + 'PP' + 'FF' + 'HH' + 'VV' + 'WW' + 'YY' +
  'K' + 'J' + 'X' + 'Q' + 'Z'
);
// 字母分值（仿 Scrabble 精神）
const LETTER_SCORE = { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10 };

/* ================= 狀態 ================= */
let grid = [];        // grid[c][r] = {letter, burning, gem}
let sel = [];         // 已選 [{c,r}]
let score = 0, wordCount = 0, bestWord = '', bestWordScore = 0;
let weakStreak = 0;   // 連續拼短字計數 → 生成燃燒磚
let over = false;
let level = 1;
let burnPhase = 0;   // Lv3-4 慢速燃燒計相位

/* ===== 關卡制（仿原版：分數門檻遞增、稱號、難度隨級升） ===== */
const RANKS = ['見習書蟲','抄寫員','圖書助理','句讀學徒','辭條編輯','副館長','館長','拼字大師','活字典','傳說書蟲 Lex'];
function levelThreshold(L) { return Math.round(1200 * Math.pow(L, 1.6)); }  // 升到 L+1 所需累積分
function rankTitle() { return RANKS[Math.min(level - 1, RANKS.length - 1)]; }
function checkLevelUp() {
  const oldLevel = level;
  while (score >= levelThreshold(level)) {
    level++;
    sfx.levelup(); setFace('happy');
    pickBonusWord();
  }
  const levelsGained = level - oldLevel;
  if (levelsGained > 0) {
    const prefix = levelsGained === 1 ? '升級！' : '連升 ' + levelsGained + ' 級！';
    toast('🎉 ' + prefix + 'Lv.' + level + '「' + rankTitle() + '」', 2200);
  }
  const prev = level === 1 ? 0 : levelThreshold(level - 1);
  const prog = (score - prev) / (levelThreshold(level) - prev) * 100;
  document.getElementById('lvprog').value = Math.min(100, prog);
  document.getElementById('ranktitle').textContent = 'Lv.' + level + '　' + rankTitle();
  document.getElementById('level').textContent = level;
}

/* ================= 工具 ================= */
const boardEl = document.getElementById('board');
const rand = a => a[Math.floor(Math.random() * a.length)];
const VOWELS = 'AEIOU';
const VOWEL_FLOOR_RATIO = .32;
const ADVENTURE_VOWEL_FLOOR_RATIO = .25;
const ADVENTURE_VOWEL_CEIL_RATIO = .38;
const ADVENTURE_MAX_SAME_VOWEL = 2;
const ADVENTURE_MAX_SAME_CONSONANT = 2;
/* Boggle 經典 16 骰面配方（公開設計，母音與常見組合分佈經數十年驗證）
   每次生磚＝隨機挑一顆骰擲一面，比純頻率隨機更常出「拼得起來」的盤面 */
const BOGGLE_DICE = [
  'AAEEGN','ABBJOO','ACHOPS','AFFKPS','AOOTTW','CIMOTU','DEILRX','DELRVY',
  'DISTTY','EEGHNW','EEINSU','EHRTVW','EIOSST','ELRTTY','HIMNQU','HLNNRZ'
];
function isVowelLetter(letter) {
  return !!letter && VOWELS.includes(letter[0]);
}
function boardVowelRatio(board = grid) {
  let v = 0, n = 0;
  for (const col of board) for (const t of col) {
    if (!t || !t.letter) continue;
    n++;
    if (isVowelLetter(t.letter)) v++;
  }
  return n ? v / n : .4;
}
function ensureBoardVowelFloor(board, minRatio = VOWEL_FLOOR_RATIO) {
  let vowels = 0, total = 0;
  const consonants = [];
  for (const col of board) {
    for (const t of col) {
      total++;
      if (isVowelLetter(t.letter)) vowels++;
      else consonants.push(t);
    }
  }
  let need = Math.ceil(total * minRatio) - vowels;
  if (need <= 0) return board;
  need = Math.min(need, consonants.length);
  for (let i = consonants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [consonants[i], consonants[j]] = [consonants[j], consonants[i]];
  }
  for (let i = 0; i < need; i++) consonants[i].letter = rand(VOWELS);
  return board;
}
function newTile() {
  // Boggle 骰子生成；遊戲中補磚時若盤面母音偏低，額外提高母音機率
  let ch;
  if (grid.length && boardVowelRatio() < VOWEL_FLOOR_RATIO && Math.random() < .65) ch = rand(VOWELS);
  else ch = rand(rand(BOGGLE_DICE));
  return { letter: ch === 'Q' ? 'Qu' : ch, burning: false, gem: null, fresh: true };
}
function randomBoggleLetter() {
  const ch = rand(rand(BOGGLE_DICE));
  return ch === 'Q' ? 'Qu' : ch;
}
function boardLetterStats(board = grid) {
  const counts = {};
  let total = 0, vowels = 0;
  for (const col of board) for (const t of col) {
    if (!t || !t.letter) continue;
    counts[t.letter] = (counts[t.letter] || 0) + 1;
    total++;
    if (isVowelLetter(t.letter)) vowels++;
  }
  return { counts, total, vowels };
}
function adventureVowelLimits(total = COLS * ROWS) {
  return {
    min: Math.ceil(total * ADVENTURE_VOWEL_FLOOR_RATIO),
    max: Math.max(1, Math.floor(total * ADVENTURE_VOWEL_CEIL_RATIO)),
  };
}
function adventureLetterLimit(letter) {
  return isVowelLetter(letter) ? ADVENTURE_MAX_SAME_VOWEL : ADVENTURE_MAX_SAME_CONSONANT;
}
function adventureCanAddLetter(letter, board = grid) {
  const stats = boardLetterStats(board);
  const limits = adventureVowelLimits(COLS * ROWS);
  if ((stats.counts[letter] || 0) >= adventureLetterLimit(letter)) return false;
  if (isVowelLetter(letter) && stats.vowels >= limits.max) return false;
  return true;
}
function newTileAdventure(board = grid) {
  const limits = adventureVowelLimits(COLS * ROWS);
  for (let i = 0; i < 80; i++) {
    const stats = boardLetterStats(board);
    const slotsLeft = COLS * ROWS - stats.total;
    const vowelsNeeded = Math.max(0, limits.min - stats.vowels);
    const mustUseVowel = vowelsNeeded >= slotsLeft;
    const preferVowel = stats.vowels < limits.min && Math.random() < .75;
    const letter = (mustUseVowel || preferVowel) ? rand(VOWELS) : randomBoggleLetter();
    if (adventureCanAddLetter(letter, board)) {
      return { letter, burning: false, gem: null, fresh: true };
    }
  }

  const stats = boardLetterStats(board);
  const slotsLeft = COLS * ROWS - stats.total;
  const vowelsNeeded = Math.max(0, limits.min - stats.vowels);
  const mustUseVowel = vowelsNeeded >= slotsLeft;
  const fallbackPool = (mustUseVowel ? VOWELS : BOGGLE_DICE.join(''))
    .split('')
    .map(ch => ch === 'Q' ? 'Qu' : ch)
    .filter(letter => adventureCanAddLetter(letter, board));
  const letter = fallbackPool.length ? rand(fallbackPool) : randomBoggleLetter();
  return { letter, burning: false, gem: null, fresh: true };
}
function adventureBoardBalanced(board = grid) {
  const stats = boardLetterStats(board);
  const limits = adventureVowelLimits(stats.total || COLS * ROWS);
  if (stats.total !== COLS * ROWS) return false;
  if (stats.vowels < limits.min || stats.vowels > limits.max) return false;
  for (const letter in stats.counts) {
    if (stats.counts[letter] > adventureLetterLimit(letter)) return false;
  }
  return true;
}
function toast(msg, ms = 1400) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

/* ================= 蟲蟲表情 ================= */
function setFace(mood) {
  document.getElementById('worm-eyes-normal').style.display = mood === 'happy' ? 'none' : '';
  document.getElementById('worm-eyes-happy').style.display = mood === 'happy' ? '' : 'none';
  document.getElementById('worm-mouth').setAttribute('d',
    mood === 'happy' ? 'M31 27 Q35 33 39 27' : mood === 'sad' ? 'M32 30 Q35 27 38 30' : 'M32 28 Q35 31 38 28');
  if (mood === 'happy') setTimeout(() => setFace('normal'), 1500);
}

