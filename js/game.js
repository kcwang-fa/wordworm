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

/* ================= 音效（WebAudio 合成，零外部資源） ================= */
const AUDIO_MUTED_KEY = 'wordworm_audio_muted';
const MUSIC_MUTED_KEY = 'wordworm_music_muted';
const savedAudioMuted = localStorage.getItem(AUDIO_MUTED_KEY);
let AC = null, muted = savedAudioMuted === '1' || (savedAudioMuted === null && localStorage.getItem(MUSIC_MUTED_KEY) === '1'), bgmTimer = null;
let musicMuted = muted;
let audioUnlocked = false;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function playTone(freq, dur = .09, type = 'triangle', vol = .18, when = 0) {
  const ctx = ac(), o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + when + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + dur + .02);
}
function beep(freq, dur = .09, type = 'triangle', vol = .18, when = 0) {
  if (muted) return;
  playTone(freq, dur, type, vol, when);
}
const sfx = {
  pick: n => beep(320 + n * 45, .07, 'triangle', .14),          // 越選越高（原版精髓）
  ok: len => { for (let i = 0; i < Math.min(len, 7); i++) beep(420 + i * 90, .1, 'triangle', .16, i * .06); },
  bad: () => { beep(160, .18, 'sawtooth', .12); beep(120, .2, 'sawtooth', .1, .1); },
  burn: () => { beep(220, .25, 'square', .1); beep(180, .3, 'square', .09, .15); },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .16, 'triangle', .18, i * .1)),
  over: () => [400, 320, 240, 160].forEach((f, i) => beep(f, .3, 'sawtooth', .14, i * .2))
};
/* 合成式 BGM：經典模式一首，冒險模式每章切換不同主題 */
const BGM_THEMES = {
  classic: {
    notes: [392, 440, 523, 587, 523, 440, 392, 330, 392, 523, 587, 659, 587, 523, 440, 392],
    tempoMs: 380,
    wave: 'sine',
    noteDur: .22,
    volume: .05,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .4,
    bassVolume: .04,
  },
  'dusty-library': {
    notes: [392, 440, 523, 587, 523, 440, 392, 330, 392, 523, 587, 659, 587, 523, 440, 392],
    tempoMs: 380,
    wave: 'sine',
    noteDur: .22,
    volume: .052,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .4,
    bassVolume: .04,
  },
  'ink-gallery': {
    notes: [330, 392, 466, 523, 466, 392, 370, 311, 330, 392, 523, 587, 523, 466, 392, 330],
    tempoMs: 340,
    wave: 'triangle',
    noteDur: .2,
    volume: .048,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .34,
    bassVolume: .038,
  },
  'crooked-fairytale': {
    notes: [523, 659, 784, 880, 784, 659, 587, 523, 659, 784, 988, 880, 784, 698, 659, 523],
    tempoMs: 320,
    wave: 'triangle',
    noteDur: .18,
    volume: .045,
    bassEvery: 8,
    bassDivisor: 4,
    bassWave: 'sine',
    bassDur: .48,
    bassVolume: .035,
  },
  'star-chart-room': {
    notes: [262, 392, 523, 784, 698, 523, 392, 330, 294, 440, 587, 880, 784, 587, 440, 392],
    tempoMs: 440,
    wave: 'sine',
    noteDur: .3,
    volume: .043,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'triangle',
    bassDur: .55,
    bassVolume: .032,
  },
  'forbidden-greenhouse': {
    notes: [349, 392, 523, 392, 466, 523, 622, 523, 392, 466, 587, 466, 349, 392, 466, 392],
    tempoMs: 360,
    wave: 'triangle',
    noteDur: .24,
    volume: .047,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .44,
    bassVolume: .036,
  },
  'storm-index-harbor': {
    notes: [294, 349, 440, 523, 440, 349, 294, 262, 330, 392, 494, 587, 494, 392, 330, 294],
    tempoMs: 300,
    wave: 'square',
    noteDur: .16,
    volume: .032,
    bassEvery: 2,
    bassDivisor: 2,
    bassWave: 'sawtooth',
    bassDur: .22,
    bassVolume: .024,
  },
  'living-type-core': {
    notes: [196, 247, 294, 370, 440, 370, 294, 247, 220, 277, 330, 415, 494, 415, 330, 277],
    tempoMs: 280,
    wave: 'sawtooth',
    noteDur: .14,
    volume: .034,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'square',
    bassDur: .28,
    bassVolume: .026,
  },
};
let activeBgmThemeId = 'classic';
let activeBgmTheme = BGM_THEMES.classic;
let bgmStep = 0;
function setBgmTheme(themeId = 'classic') {
  const nextId = BGM_THEMES[themeId] ? themeId : 'classic';
  if (nextId === activeBgmThemeId) return;
  activeBgmThemeId = nextId;
  activeBgmTheme = BGM_THEMES[nextId];
  bgmStep = 0;
  if (bgmTimer) {
    stopBgm();
    startBgm();
  }
}
function setBgmThemeForLevel(level) {
  setBgmTheme(level && level.chapterId ? level.chapterId : 'classic');
}
function bgmTick() {
  const theme = activeBgmTheme || BGM_THEMES.classic;
  const notes = theme.notes || BGM_THEMES.classic.notes;
  const note = notes[bgmStep % notes.length];
  if (!muted && !musicMuted) {
    playTone(note, theme.noteDur || .22, theme.wave || 'sine', theme.volume || .05);
    if (theme.bassEvery && bgmStep % theme.bassEvery === 0) {
      playTone(note / (theme.bassDivisor || 2), theme.bassDur || .4, theme.bassWave || 'sine', theme.bassVolume || .04);
    }
  }
  bgmStep++;
}
function updateSoundButtons() {
  const buttons = [document.getElementById('mute'), document.getElementById('sound-toggle')].filter(Boolean);
  for (const btn of buttons) {
    btn.textContent = muted ? '🔊 開啟音效' : '🔇 關閉音效';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.title = muted ? '開啟音效' : '關閉音效';
  }
}
function setAudioMuted(nextMuted) {
  muted = !!nextMuted;
  musicMuted = muted;
  localStorage.setItem(AUDIO_MUTED_KEY, muted ? '1' : '0');
  localStorage.setItem(MUSIC_MUTED_KEY, muted ? '1' : '0');
  if (muted) stopBgm();
  else if (audioUnlocked) startBgm();
  updateSoundButtons();
}
function toggleAudioMuted() {
  setAudioMuted(!muted);
}
function stopBgm() {
  if (!bgmTimer) return;
  clearInterval(bgmTimer);
  bgmTimer = null;
}
function startBgm() {
  if (muted || musicMuted) return;
  stopBgm();
  bgmTimer = setInterval(bgmTick, (activeBgmTheme || BGM_THEMES.classic).tempoMs || 380);
}
document.addEventListener('pointerdown', function once() {
  audioUnlocked = true;
  ac().resume();
  startBgm();
  document.removeEventListener('pointerdown', once);
}, { once: true });
document.getElementById('mute').onclick = toggleAudioMuted;
document.getElementById('sound-toggle').onclick = toggleAudioMuted;
updateSoundButtons();

/* ================= 拼字規則切換（相鄰連線 / 全盤任選，經典模式限定） ================= */
function renderModeBtn() {
  document.getElementById('mode').textContent = easyMode ? '😌 任選拼字' : '🔗 相鄰拼字';
}
document.getElementById('mode').onclick = () => {
  easyMode = !easyMode;
  localStorage.setItem('wordworm_easymode', easyMode ? '1' : '0');
  renderModeBtn();
  sel = []; render(); updateCurrent();
  pickBonusWord();
  toast(easyMode ? '😌 任選拼字：整個棋盤的字母都能任意選！' : '🔗 相鄰拼字：只能連相鄰的字母', 2200);
};

/* ================= 存檔（localStorage 自動存） ================= */
// 存檔完整性檢查共用：grid 形狀／每格 letter 合法，防損毀存檔讓 render 之後 crash
function isValidGrid(g, cols, rows) {
  if (!Array.isArray(g) || g.length !== cols) return false;
  for (const col of g) {
    if (!Array.isArray(col) || col.length !== rows) return false;
    for (const t of col) {
      if (!t || typeof t.letter !== 'string' || !t.letter) return false;
      if ('burning' in t && typeof t.burning !== 'boolean') return false;
      if ('locked' in t && typeof t.locked !== 'boolean') return false;
      if ('cursed' in t && typeof t.cursed !== 'boolean') return false;
      if ('negativeTurns' in t && (!Number.isFinite(Number(t.negativeTurns)) || Number(t.negativeTurns) < 0)) return false;
      if ('gem' in t && t.gem !== null && !['green', 'gold', 'sapphire', 'diamond'].includes(t.gem)) return false;
    }
  }
  return true;
}

const SAVE_KEY = 'wordworm_save_v1', HI_KEY = 'wordworm_hiscore';
function saveGame() {
  if (over) { localStorage.removeItem(SAVE_KEY); return; }
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    grid: grid.map(col => col.map(t => ({ letter: t.letter, burning: t.burning, gem: t.gem }))),
    score, wordCount, bestWord, bestWordScore, weakStreak, level
  }));
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || !isValidGrid(s.grid, COLS, ROWS)) return false;
    if (typeof s.score !== 'number' || typeof s.wordCount !== 'number' || typeof s.level !== 'number') return false;
    grid = s.grid.map(col => col.map(t => ({ ...t, fresh: false })));
    score = s.score; wordCount = s.wordCount; bestWord = s.bestWord;
    bestWordScore = s.bestWordScore; weakStreak = s.weakStreak; level = s.level;
    return true;
  } catch { return false; }
}
function hiScore() { return +localStorage.getItem(HI_KEY) || 0; }

/* ================= 冒險模式存檔（獨立於經典模式，互不干擾） ================= */
const ADV_SAVE_KEY = 'wordworm_save_adventure_v1', ADV_PROGRESS_KEY = 'wordworm_adv_progress';
const ADV_PROGRESS_VERSION = 4;
const ADV_HERO_BASE_HP = 100;
const ADV_HERO_HP_PER_LEVEL = 6;
const ADV_HERO_ATTACK_STEP = 3;
const ADV_HERO_LEVEL_CAP = 30;
const ADV_NEGATIVE_TILE_TURNS = 3;
function advHeroExpToNext(heroLevel) {
  return 60 + Math.max(0, heroLevel - 1) * 25;
}
function advHeroMaxHp(heroLevel) {
  return ADV_HERO_BASE_HP + Math.max(0, heroLevel - 1) * ADV_HERO_HP_PER_LEVEL;
}
function advHeroAttackBonus(heroLevel) {
  return Math.floor(Math.max(0, heroLevel - 1) / ADV_HERO_ATTACK_STEP);
}
function normaliseAdvHero(progress = {}) {
  let heroLevel = Math.max(1, Math.min(ADV_HERO_LEVEL_CAP, Math.floor(Number(progress.heroLevel) || 1)));
  let heroExp = Math.max(0, Math.floor(Number(progress.heroExp) || 0));
  while (heroLevel < ADV_HERO_LEVEL_CAP && heroExp >= advHeroExpToNext(heroLevel)) {
    heroExp -= advHeroExpToNext(heroLevel);
    heroLevel++;
  }
  if (heroLevel >= ADV_HERO_LEVEL_CAP) heroExp = 0;
  return {
    heroLevel,
    heroExp,
    heroExpToNext: advHeroExpToNext(heroLevel),
    heroMaxHp: advHeroMaxHp(heroLevel),
    heroAttackBonus: advHeroAttackBonus(heroLevel),
  };
}
function adventureExpReward(level) {
  if (!level) return 0;
  if (level.boss || level.isBoss) return 70 + level.chapterIdx * 15;
  return 20 + Math.round(level.globalIdx * 2.5);
}
function grantAdvHeroExp(progress, expAmount) {
  const before = normaliseAdvHero(progress);
  progress.heroLevel = before.heroLevel;
  progress.heroExp = before.heroExp + Math.max(0, Math.floor(Number(expAmount) || 0));
  const after = normaliseAdvHero(progress);
  progress.heroLevel = after.heroLevel;
  progress.heroExp = after.heroExp;
  return {
    expGained: Math.max(0, Math.floor(Number(expAmount) || 0)),
    oldLevel: before.heroLevel,
    newLevel: after.heroLevel,
    levelsGained: after.heroLevel - before.heroLevel,
    hpGained: after.heroMaxHp - before.heroMaxHp,
  };
}
function advHeroSummary(progress) {
  return 'Lex Lv.' + progress.heroLevel + '　HP ' + progress.heroMaxHp + '　傷害 +' + progress.heroAttackBonus;
}
function clampedAdventureHp(hp, maxHp) {
  const nextHp = Number(hp);
  return Math.max(1, Math.min(maxHp, Math.floor(Number.isFinite(nextHp) ? nextHp : maxHp)));
}
function isNegativeTile(tile) {
  return !!(tile && (tile.locked || tile.cursed));
}
function negativeTileTurns(tile) {
  if (!isNegativeTile(tile)) return 0;
  const turns = Math.floor(Number(tile.negativeTurns));
  return Number.isFinite(turns) && turns > 0 ? Math.min(turns, ADV_NEGATIVE_TILE_TURNS) : ADV_NEGATIVE_TILE_TURNS;
}
function normaliseAdventureGridStatuses() {
  for (let c = 0; c < grid.length; c++) for (let r = 0; r < grid[c].length; r++) {
    const tile = grid[c][r];
    if (isNegativeTile(tile)) tile.negativeTurns = negativeTileTurns(tile);
    else tile.negativeTurns = 0;
  }
}
function saveAdventure() {
  if (over) { localStorage.removeItem(ADV_SAVE_KEY); return; }
  const nextAdv = normaliseAdvState(adv);
  if (!nextAdv || !isValidAdvState(nextAdv)) return;
  adv = nextAdv;
  localStorage.setItem(ADV_SAVE_KEY, JSON.stringify({
    grid: grid.map(col => col.map(t => ({
      letter: t.letter,
      gem: t.gem,
      locked: !!t.locked,
      cursed: !!t.cursed,
      negativeTurns: negativeTileTurns(t),
    }))),
    adv: nextAdv
  }));
}
function adventureLevelById(id) {
  return ADVENTURE_LEVELS.find(level => level.id === id) || null;
}
function adventureLevelByLegacy(chapterIdx, monsterIdx) {
  return ADVENTURE_LEVELS.find(level => level.chapterIdx === chapterIdx && level.levelIdx === monsterIdx) || null;
}
function normaliseAdvState(a) {
  if (!a || typeof a !== 'object') return null;
  const level = adventureLevelById(a.levelId) || adventureLevelByLegacy(a.chapterIdx, a.monsterIdx);
  if (!level) return null;
  const hasItemShape = a.items && typeof a.items === 'object';
  const progress = advBestProgress();
  const playerMaxHp = progress.heroMaxHp || ADV_HERO_BASE_HP;
  const previousMaxHp = Number.isFinite(a.playerMaxHp) && a.playerMaxHp > 0 ? a.playerMaxHp : playerMaxHp;
  let playerHp = Number.isFinite(a.playerHp) ? a.playerHp : playerMaxHp;
  if (playerMaxHp > previousMaxHp) playerHp += playerMaxHp - previousMaxHp;
  playerHp = Math.max(0, Math.min(playerMaxHp, Math.floor(playerHp)));
  return {
    ...a,
    levelId: level.id,
    levelIdx: level.globalIdx,
    chapterIdx: level.chapterIdx,
    monsterIdx: level.levelIdx,
    playerHp,
    playerMaxHp,
    items: normaliseAdvItems(a.items, hasItemShape ? emptyAdvItems() : defaultAdvItems()),
  };
}
// 數值型別＋關卡索引邊界檢查，防損毀存檔 resume 到不存在的關卡讓冒險流程炸掉
function isValidAdvState(a) {
  const state = normaliseAdvState(a);
  if (!state) return false;
  const numFields = ['playerHp', 'playerMaxHp', 'monsterHp', 'monsterMaxHp', 'monsterAtk', 'chapterIdx', 'monsterIdx', 'levelIdx', 'totalKills'];
  for (const f of numFields) if (!Number.isFinite(state[f])) return false;
  if (state.chapterIdx < 0 || state.monsterIdx < 0 || state.levelIdx < 0) return false;
  if (state.playerMaxHp <= 0 || state.monsterMaxHp <= 0 || state.monsterAtk < 0) return false;
  if (state.playerHp < 0 || state.playerHp > state.playerMaxHp) return false;
  if (state.monsterHp < 0 || state.monsterHp > state.monsterMaxHp) return false;
  return true;
}
function loadAdventure() {
  try {
    const s = JSON.parse(localStorage.getItem(ADV_SAVE_KEY));
    const nextAdv = normaliseAdvState(s && s.adv);
    if (!s || !isValidGrid(s.grid, COLS, ROWS) || !isValidAdvState(nextAdv)) return false;
    grid = s.grid.map(col => col.map(t => ({ ...t, fresh: false })));
    normaliseAdventureGridStatuses();
    adv = nextAdv;
    return true;
  } catch { return false; }
}
// 最佳進度（最深章節＋累計擊敗數），跟經典模式的 hiScore 概念平行但獨立
function defaultAdvProgress() {
  return withAdvProgressDerived({ version: ADV_PROGRESS_VERSION, completedLevelIds: [], items: defaultAdvItems(), heroLevel: 1, heroExp: 0 });
}
function withAdvProgressDerived(progress) {
  const seen = new Set();
  const completedLevelIds = (Array.isArray(progress.completedLevelIds) ? progress.completedLevelIds : [])
    .filter(id => adventureLevelById(id) && !seen.has(id) && seen.add(id))
    .sort((a, b) => adventureLevelById(a).globalIdx - adventureLevelById(b).globalIdx);
  const completed = new Set(completedLevelIds);
  let unlockedIdx = 0;
  while (unlockedIdx < ADVENTURE_LEVELS.length - 1 && completed.has(ADVENTURE_LEVELS[unlockedIdx].id)) unlockedIdx++;
  const unlocked = ADVENTURE_LEVELS[unlockedIdx];
  const hasItemShape = progress.items && typeof progress.items === 'object';
  const hero = normaliseAdvHero(progress);
  return {
    version: ADV_PROGRESS_VERSION,
    completedLevelIds,
    unlockedLevelId: unlocked.id,
    chapter: unlocked.chapterIdx + 1,
    kills: completedLevelIds.length,
    heroLevel: hero.heroLevel,
    heroExp: hero.heroExp,
    heroExpToNext: hero.heroExpToNext,
    heroMaxHp: hero.heroMaxHp,
    heroAttackBonus: hero.heroAttackBonus,
    items: normaliseAdvItems(progress.items, hasItemShape ? emptyAdvItems() : defaultAdvItems()),
  };
}
function normaliseAdvProgress(raw) {
  if (!raw || typeof raw !== 'object') return defaultAdvProgress();
  if (raw.version === 2 || raw.version === 3 || raw.version === ADV_PROGRESS_VERSION) return withAdvProgressDerived(raw);
  const legacyKills = Number.isFinite(raw.kills) ? Math.max(0, Math.floor(raw.kills)) : 0;
  return withAdvProgressDerived({
    version: ADV_PROGRESS_VERSION,
    completedLevelIds: ADVENTURE_LEVELS.slice(0, Math.min(legacyKills, ADVENTURE_LEVELS.length)).map(level => level.id),
    items: defaultAdvItems(),
    heroLevel: 1,
    heroExp: 0,
  });
}
function advBestProgress() {
  try { return normaliseAdvProgress(JSON.parse(localStorage.getItem(ADV_PROGRESS_KEY))); }
  catch { return defaultAdvProgress(); }
}
function hasAdventureProgressRecord() {
  const raw = localStorage.getItem(ADV_PROGRESS_KEY);
  if (!raw) return false;
  try {
    const progress = normaliseAdvProgress(JSON.parse(raw));
    return progress.completedLevelIds.length > 0
      || progress.heroLevel > 1
      || progress.heroExp > 0
      || advItemTotal(progress.items) !== advItemTotal(defaultAdvItems());
  } catch {
    return false;
  }
}
function saveAdvProgress(progress) {
  const next = withAdvProgressDerived(progress);
  localStorage.setItem(ADV_PROGRESS_KEY, JSON.stringify(next));
  return next;
}
function updateAdvBestProgress(levelId, items) {
  const progress = advBestProgress();
  if (items) progress.items = normaliseAdvItems(items, emptyAdvItems());
  if (levelId && adventureLevelById(levelId) && !progress.completedLevelIds.includes(levelId)) {
    progress.completedLevelIds.push(levelId);
  }
  return saveAdvProgress(progress);
}
function completeAdventureLevel(level, items) {
  const progress = advBestProgress();
  const alreadyCompleted = !level || progress.completedLevelIds.includes(level.id);
  if (items) progress.items = normaliseAdvItems(items, emptyAdvItems());
  let heroGain = { expGained: 0, oldLevel: progress.heroLevel, newLevel: progress.heroLevel, levelsGained: 0, hpGained: 0 };
  if (level && !alreadyCompleted) {
    progress.completedLevelIds.push(level.id);
    heroGain = grantAdvHeroExp(progress, adventureExpReward(level));
  }
  return {
    progress: saveAdvProgress(progress),
    alreadyCompleted,
    ...heroGain,
  };
}
function adventureUnlockedIndex(progress = advBestProgress()) {
  return adventureLevelById(progress.unlockedLevelId).globalIdx;
}
function isAdventureLevelUnlocked(levelId, progress = advBestProgress()) {
  const level = adventureLevelById(levelId);
  return !!level && level.globalIdx <= adventureUnlockedIndex(progress);
}

/* ================= 初始化 ================= */
// 死局檢測：抽查 A1 常見字，可拼數太少代表爛盤
function boardPlayable() {
  let ok = 0;
  const sample = [...CEFR.a1].sort(() => Math.random() - .5).slice(0, 40);
  for (const w of sample) { if (canSpell(w)) ok++; if (ok >= 4) return true; }
  return false;
}
function freshBoard() {
  for (let tries = 0; tries < 6; tries++) {
    grid = [];
    grid = Array.from({length: COLS}, () => Array.from({length: ROWS}, newTile));
    ensureBoardVowelFloor(grid);
    if (boardPlayable()) return;
  }
}
function freshBoardAdventure() {
  for (let tries = 0; tries < 40; tries++) {
    const board = Array.from({length: COLS}, () => Array.from({length: ROWS}, () => null));
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        board[c][r] = newTileAdventure(board);
      }
    }
    grid = board;
    if (adventureBoardBalanced(grid) && boardPlayable()) return;
  }
}
function init(fromSave = false) {
  setBgmTheme('classic');
  if (!fromSave || !loadGame()) {
    localStorage.removeItem(SAVE_KEY);
    freshBoard();
    sel = []; score = 0; wordCount = 0; bestWord = ''; bestWordScore = 0;
    weakStreak = 0; level = 1;
  }
  sel = []; over = false; burnPhase = 0;
  document.getElementById('gameover').classList.remove('show');
  setFace('normal'); renderModeBtn();
  if (DICT) pickBonusWord();
  render(); updateHud(); checkLevelUp();
  if (fromSave && score > 0) toast('讀取存檔，歡迎回來 🐛', 1600);
}

/* ================= 相鄰判定（整齊方格、含斜角 8 方向） ================= */
let easyMode = localStorage.getItem('wordworm_easymode') === '1';
function adjacent(a, b) {
  if (gameMode === 'adventure' || gameMode === 'daily' || easyMode) return !(a.c === b.c && a.r === b.r);  // 冒險／每日／輕鬆模式：全盤任選
  const dc = Math.abs(b.c - a.c), dr = Math.abs(b.r - a.r);
  return dc <= 1 && dr <= 1 && (dc + dr > 0);
}

/* ================= 渲染 ================= */
function render() {
  boardEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const colEl = document.createElement('div');
    colEl.className = 'col';
    for (let r = 0; r < ROWS; r++) {
      const t = grid[c][r];
      const el = document.createElement('div');
      el.className = 'tile';
      if (t.burning) el.classList.add('burning');
      if (t.gem) el.classList.add('gem-' + t.gem);
      if (t.locked) el.classList.add('locked');
      if (t.cursed) el.classList.add('cursed');
      if (t.used) el.classList.add('used');    // 每日挑戰的洞（磚用掉不補）；經典／冒險的磚沒有這個欄位
      if (t.fresh) { el.classList.add('falling'); t.fresh = false; }
      if (sel.some(s => s.c === c && s.r === r)) el.classList.add('sel');
      el.textContent = t.letter;
      if (isNegativeTile(t)) {
        const count = document.createElement('span');
        count.className = 'tile-status-count';
        count.textContent = negativeTileTurns(t);
        count.title = '剩餘 ' + negativeTileTurns(t) + ' 次有效攻擊後解除';
        el.appendChild(count);
      }
      el.dataset.c = c; el.dataset.r = r;
      colEl.appendChild(el);
    }
    boardEl.appendChild(colEl);
  }
}

/* ================= 選字互動（點選 + 拖曳） ================= */
let dragging = false;
function tileAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const tile = el && el.closest ? el.closest('.tile') : null;
  return tile && boardEl.contains(tile) ? { c: +tile.dataset.c, r: +tile.dataset.r } : null;
}
function pick(p) {
  if (over || !p) return;
  if (grid[p.c][p.r].locked || grid[p.c][p.r].used) return;  // 鎖定磚（冒險技能）與洞（每日消磚）不可選取
  const i = sel.findIndex(s => s.c === p.c && s.r === p.r);
  if (i !== -1) {
    if (i === sel.length - 2 && dragging) sel.pop();      // 拖回上一格 = 反悔
    else if (!dragging) sel = sel.slice(0, i);            // 點已選的 = 截斷到該處之前
  } else if (sel.length === 0 || adjacent(sel[sel.length - 1], p)) {
    sel.push(p);
    sfx.pick(sel.length);
  } else if (!dragging) {
    sel = [p];                                            // 點不相鄰的 = 重新開始選
  }
  render(); updateCurrent();
}
boardEl.addEventListener('pointerdown', e => { dragging = true; pick(tileAt(e.clientX, e.clientY)); });
boardEl.addEventListener('pointermove', e => { if (dragging) pick(tileAt(e.clientX, e.clientY)); });
window.addEventListener('pointerup', () => { dragging = false; });

/* ================= 目前單字與計分 ================= */
function currentWord() { return sel.map(s => grid[s.c][s.r].letter).join(''); }
function wordScore(word, tiles) {
  let base = 0;
  for (const ch of word.toUpperCase()) base += LETTER_SCORE[ch] || 0;
  // 長度加成：4字x1.5、5字x2、6字x3、7+字x4（取整）
  const L = word.length;
  const mult = L >= 7 ? 4 : L >= 6 ? 3 : L >= 5 ? 2 : L >= 4 ? 1.5 : 1;
  let s = Math.round(base * mult * 10);
  // 寶石加成
  for (const p of tiles) {
    const g = grid[p.c][p.r].gem;
    if (g === 'green') s += 100;
    if (g === 'gold') s += 250;
    if (g === 'sapphire') s += 500;
    if (g === 'diamond') s += 1000;
  }
  return s;
}
function updateCurrent() {
  if (gameMode === 'daily') { updateCurrentDaily(); return; }  // 每日模式用自己的計分預覽（js/daily.js）
  if (gameMode === 'kids') return;
  const w = currentWord();
  const cur = document.getElementById('current');
  if (!w) {
    cur.innerHTML = '&nbsp;';
    if (gameMode === 'adventure') renderAdvFloatingWord();
    return;
  }
  const valid = DICT && DICT.has(w.toLowerCase());
  cur.classList.toggle('invalid', !valid);
  cur.innerHTML = w + (valid ? ' <span class="score-preview">+' + wordScore(w, sel) + '</span>' : '');
  if (gameMode === 'adventure') renderAdvFloatingWord();
}


/* ================= 蟲蟲台詞 ================= */
const QUIPS = {
  short: ['嗯⋯⋯這樣也算啦', '三個字母？我牙縫都塞不滿🐛', '小菜。真的很小。', '好，暖身而已對吧？', '省著點拼，燃燒磚在看著你喔'],
  mid: ['不錯嘛，有在動腦！', '嗯嗯，這個有書卷味了', '好吃好吃🐛', '及格！繼續保持', '我開始對你有點期待了'],
  long: ['哇喔！！這個字我要裱框！', '你的字彙量是吃字典長大的嗎！', '太漂亮了，我要感動落淚🥹', '這就是傳說中的高手嗎', '請收下書蟲的膝蓋（如果我有的話）'],
  bad: ['呃，這個字典裡沒有耶', '你發明新單字了嗎？很有創意但不行', '嗯？拼歪了拼歪了', '我讀過十七萬個字，沒看過這個🐛'],
  bonus: ['🎊 Bonus Word！！你抓到了！', '獎勵單字達成！今天的你發光了✨']
};
const quip = arr => arr[Math.floor(Math.random() * arr.length)];
function speechBubble(msg, ms = 2000) {
  const b = document.getElementById('speech-bubble');
  b.textContent = msg; b.classList.add('show');
  clearTimeout(b._h); b._h = setTimeout(() => b.classList.remove('show'), ms);
}
const bubble = msg => speechBubble(msg);

/* ================= Bonus Word（CEFR 分級 + 棋盤可拼保底） ================= */
// 依等級出題：Lv1-2 A1、Lv3-4 A2、Lv5-6 B1、Lv7-8 B2、Lv9+ 完整字典
const CEFR = {
  a1: ['cat','dog','sun','rain','book','food','milk','fish','bird','tree','door','hand','head','blue','red','green','girl','boy','name','game','play','read','walk','talk','eat','swim','love','like','good','nice','big','small','old','new','hot','cold','day','night','week','year','home','room','bed','desk','pen','cup','egg','tea','rice','meat','ball','shoe','hat','bag','bus','car','map','sea','sky','star','moon','baby','mom','dad','one','two','ten','leg','arm','eye','ear','nose','face','hair','water','apple','happy','table','chair','house','sleep','smile','dance','sing','run','jump','open','stop','help','look','find','give','take','make','come','know'],
  a2: ['angry','beach','bread','bridge','carry','catch','cloud','dream','drive','early','earth','field','fight','floor','fruit','glass','grass','heavy','horse','hotel','island','knife','laugh','learn','light','lucky','money','month','mouth','music','party','plant','pocket','quiet','river','round','sharp','shirt','short','smart','snake','sound','space','sport','stone','store','storm','story','sugar','sweet','teach','thick','thin','tired','tooth','town','train','uncle','visit','voice','wait','wall','warm','wash','watch','wear','wind','winter','worry','write','wrong','young','clean','clever','close','cook','corner','count','cross','crowd','dance','dinner','dirty','doctor','double','draw','dress','drink','drop'],
  b1: ['ability','absence','account','achieve','advance','advice','afford','amount','ancient','announce','annual','anxious','appear','approve','arrange','arrival','article','attempt','attract','average','balance','battery','behave','belief','belong','benefit','border','breath','brief','burden','calm','campaign','capable','capture','career','careful','castle','casual','cause','celebrate','century','certain','chain','challenge','chance','channel','chapter','charge','charity','chase','cheap','check','cheerful','choice','citizen','claim','climate','collect','college','combine','comfort','comment','common','compare','compete','complain','complete','concern','confirm','connect','consider','contain','contest','continue','control','convince','correct','courage','create','culture','curious','current','custom','damage','danger','decade','decide','declare','defend','degree','deliver','demand'],
  b2: ['abandon','absorb','abstract','abundant','accompany','accurate','acquire','adequate','adjacent','advocate','aesthetic','aggregate','ambiguous','ambitious','analyse','anticipate','apparent','appetite','appliance','appropriate','arbitrary','articulate','assemble','assess','asset','assume','assure','attain','attribute','authentic','autonomy','barrier','bearing','bias','bond','boost','breach','browse','bulk','bureau','capacity','ceiling','cite','clarify','coherent','coincide','collapse','commence','commodity','compatible','compel','compensate','competent','compile','complement','component','compound','comprise','conceive','concept','concise','conduct','confine','conflict','conform','confront','consent','conserve','consist','constant','constitute','constrain','construct','consult','consume','contempt','contract','contrary','contrast','contribute','convert','convey','cope','crucial','cultivate','decline','dedicate','deduce','defect','deficit','denote','depict','deprive','derive','designate','deteriorate']
};
let bonusWord = '';
function cefrPool() {
  if (level <= 2) return CEFR.a1;
  if (level <= 4) return CEFR.a2;
  if (level <= 6) return CEFR.b1;
  if (level <= 8) return CEFR.b2;
  return null; // Lv9+ 用完整字典
}
// 檢查棋盤能否拼出 word：經典模式=DFS 相鄰路徑；輕鬆模式=字母庫存數量足夠
function canSpell(word) {
  const W = word.toUpperCase().replace(/QU/g, 'Q');  // Qu 磚以 Q 代表
  const letterAt = (c, r) => grid[c][r].letter === 'Qu' ? 'Q' : grid[c][r].letter;
  if (gameMode === 'adventure' || easyMode) {
    const stock = {};
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
      stock[letterAt(c, r)] = (stock[letterAt(c, r)] || 0) + 1;
    const need = {};
    for (const ch of W) need[ch] = (need[ch] || 0) + 1;
    return Object.entries(need).every(([ch, n]) => (stock[ch] || 0) >= n);
  }
  const dfs = (i, c, r, used) => {
    if (letterAt(c, r) !== W[i]) return false;
    if (i === W.length - 1) return true;
    used.add(c * 100 + r);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (used.has(nc * 100 + nr)) continue;
      if (dfs(i + 1, nc, nr, used)) { used.delete(c * 100 + r); return true; }
    }
    used.delete(c * 100 + r);
    return false;
  };
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
    if (dfs(0, c, r, new Set())) return true;
  return false;
}
function pickBonusWord() {
  if (!DICT) return;
  const pool = cefrPool() || [...DICT].filter(w => w.length >= 4 && w.length <= 6);
  // 隨機挑，直到找到棋盤真的拼得出來的字（保底：試 200 次後放寬到任何可拼字典字）
  const shuffled = [...pool].sort(() => Math.random() - .5);
  for (const w of shuffled.slice(0, 200)) {
    if (w.length >= 3 && DICT.has(w.toLowerCase()) && canSpell(w)) {
      bonusWord = w.toUpperCase();
      document.getElementById('bonusword').textContent = bonusWord;
      return;
    }
  }
  bonusWord = '';
  document.getElementById('bonusword').textContent = '—';
}
// 棋盤變動後檢查目前題目是否仍可拼，不行就換題
function revalidateBonus() {
  if (bonusWord && !canSpell(bonusWord)) pickBonusWord();
}

function submit() {
  if (over) return;
  const w = currentWord();
  // Boggle 慣例：Qu 磚貢獻 Q+U 兩個字母；這裡檢查的是字母數，不是磚數。
  if (w.length < 3) { toast('至少 3 個字母'); return; }
  if (!DICT) { toast('字典還在載入…'); return; }
  if (!DICT.has(w.toLowerCase())) { sfx.bad(); setFace('sad'); bubble(quip(QUIPS.bad)); shake();
    setTimeout(() => setFace('normal'), 1200); return; }
  if (gameMode === 'adventure') { submitAdventure(w); return; }
  if (gameMode === 'daily') { submitDaily(w); return; }  // 每日挑戰計分（js/daily.js）
  submitClassic(w);
}

function submitClassic(w) {
  let s = wordScore(w, sel);
  const isBonus = w.toUpperCase() === bonusWord;
  if (isBonus) s *= 3;
  score += s; wordCount++;
  if (s > bestWordScore) { bestWordScore = s; bestWord = w; }

  sfx.ok(w.length); setFace('happy');
  const face = document.getElementById('wormface');
  face.style.transform = 'scale(1.25)'; setTimeout(() => face.style.transform = '', 250);

  if (isBonus) { toast('🎊 BONUS ×3！+' + s, 2000); setTimeout(() => bubble(quip(QUIPS.bonus)), 800); pickBonusWord(); }
  else {
    toast('+' + s + '　' + praise(w.length), 1100);
    if (Math.random() < .45) setTimeout(() => bubble(quip(w.length <= 3 ? QUIPS.short : w.length <= 5 ? QUIPS.mid : QUIPS.long)), 900);
  }

  // 燃燒磚壓力：短字累積、長字洩壓
  if (w.length <= 3) weakStreak++;
  else if (w.length >= 5) weakStreak = Math.max(0, weakStreak - 2);
  const gemTier = isBonus ? 'diamond' : w.length >= 8 ? 'diamond' : w.length >= 7 ? 'sapphire' : w.length >= 6 ? 'gold' : w.length >= 5 ? 'green' : null;

  removeTiles(sel, gemTier);
  sel = [];
  /* 難度曲線：
     Lv1-2 蜜月期＝不生燃燒磚、不燒；
     Lv3-4 慢速期＝燃燒磚每 2 次提交才下沉一格；
     Lv5+ 正常＋隨等級遞增 */
  if (level >= 3) {
    burnPhase++;
    if (level >= 5 || burnPhase % 2 === 0) advanceBurning();
    const streakLimit = Math.max(2, 5 - Math.floor(level / 4));
    if (weakStreak >= streakLimit) { spawnBurning(); weakStreak = 0; }
    else if (level >= 5 && Math.random() < (level - 4) * 0.015) spawnBurning();
  }
  revalidateBonus();
  render(); updateCurrent(); updateHud();
  checkLevelUp();
  saveGame();
  checkOver();
}

function praise(L) {
  return L >= 8 ? '傳說單字！💎' : L >= 7 ? '藍寶石級！' : L >= 6 ? '黃金單字！' : L >= 5 ? '漂亮！' : '不錯！';
}
function shake() {
  boardEl.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}], {duration:200});
}

/* ================= 磚塊移除 / 掉落補充 ================= */
function removeTiles(tiles, gemTier) {
  // 依欄分組，由該欄底部往上壓縮
  const byCol = {};
  for (const p of tiles) (byCol[p.c] ||= []).push(p.r);
  let gemPlaced = !gemTier;
  for (const c in byCol) {
    const col = grid[c];
    const remove = new Set(byCol[c]);
    const kept = col.filter((_, r) => !remove.has(r));
    const need = ROWS - kept.length;
    const fresh = Array.from({length: need}, newTile);
    if (!gemPlaced && fresh.length) { fresh[0].gem = gemTier; gemPlaced = true; }
    grid[c] = [...fresh, ...kept];
  }
}
// 冒險模式：拼掉的磚原地生成新磚（不做欄位掉落壓縮，棋盤形狀固定 4×4）
function removeTilesAdventure(tiles, gemTier) {
  let gemPlaced = !gemTier;
  for (const p of tiles) grid[p.c][p.r] = null;
  for (const p of tiles) {
    const t = newTileAdventure();
    if (!gemPlaced) { t.gem = gemTier; gemPlaced = true; }
    grid[p.c][p.r] = t;
  }
}

/* ================= 燃燒磚 ================= */
function spawnBurning() {
  const c = Math.floor(Math.random() * COLS);
  grid[c][0].burning = true;
  sfx.burn();
  toast('🔥 燃燒磚出現了！拼長一點的字！', 1600);
}
function advanceBurning() {
  // 每次提交後，所有燃燒磚往下燒一格（把下面那格變燃燒，自己熄滅成新磚）
  const moves = [];
  for (let c = 0; c < COLS; c++)
    for (let r = ROWS - 1; r >= 0; r--)
      if (grid[c][r].burning) moves.push({c, r});
  for (const {c, r} of moves) {
    if (r === ROWS - 1) { over = true; return; }  // 燒到底
    grid[c][r] = newTile();
    grid[c][r + 1].burning = true;
  }
}
function shuffle() {
  if (over) return;
  // 洗牌代價：生成一顆燃燒磚（原版精神：躲避是有代價的）
  const letters = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) letters.push(grid[c][r]);
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  let i = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c][r] = letters[i++];
  sel = [];
  if (level >= 3) spawnBurning();
  else toast('洗好了～（Lv.3 之後洗牌會有燃燒磚代價喔）', 1800);
  revalidateBonus();
  render(); updateCurrent();
  saveGame();
}

/* ================= HUD / 結束 ================= */
function updateHud() {
  document.getElementById('score').textContent = score.toLocaleString();
  document.getElementById('wordcount').textContent = wordCount;
  document.getElementById('bestword').textContent = bestWord || '—';
}
function checkOver() {
  if (!over) return;
  sfx.over(); setFace('sad');
  localStorage.removeItem(SAVE_KEY);
  const hi = hiScore();
  if (score > hi) { localStorage.setItem(HI_KEY, score); }
  document.getElementById('fhiscore').textContent =
    score > hi ? '🎉 新紀錄！' : '歷史最高：' + hi.toLocaleString();
  document.getElementById('flevel').textContent = level;
  document.getElementById('frank').textContent = rankTitle();
  document.getElementById('fscore').textContent = score.toLocaleString();
  document.getElementById('fwords').textContent = wordCount;
  document.getElementById('fbest').textContent = bestWord || '—';
  document.getElementById('gameover').classList.add('show');
}
