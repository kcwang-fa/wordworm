/* ================= 字典載入 ================= */
let DICT = null;
fetch('enable1.txt').then(r => r.text()).then(t => {
  DICT = new Set(t.split(/\r?\n/).filter(w => w.length >= 3));
  toast('字典就緒，開拼！(' + DICT.size.toLocaleString() + ' 字)');
  if (!bonusWord) pickBonusWord();
}).catch(() => toast('字典載入失敗，請重新整理', 4000));

/* ================= 常數 ================= */
let COLS = 7, ROWS = 7;
/* ================= 遊戲模式（經典／冒險） ================= */
let gameMode = localStorage.getItem('wordworm_gamemode') || 'classic';
function setBoardSize() {
  if (gameMode === 'adventure') { COLS = 4; ROWS = 4; }
  else { COLS = 7; ROWS = 7; }
}
function applyModeClass() {
  document.body.classList.toggle('mode-adventure', gameMode === 'adventure');
  document.body.classList.toggle('mode-classic', gameMode !== 'adventure');
  document.getElementById('modesel-classic').classList.toggle('active', gameMode === 'classic');
  document.getElementById('modesel-adventure').classList.toggle('active', gameMode === 'adventure');
  document.getElementById('submit').textContent = gameMode === 'adventure' ? 'Attack / 攻擊' : '拼字！';
  document.getElementById('clear').textContent = gameMode === 'adventure' ? '清除選字' : '清除';
  document.getElementById('shuffle').textContent = '洗牌 (-燃燒)';
  document.getElementById('shuffle').hidden = gameMode === 'adventure';
}
function selectGameMode(mode) {
  const wasHomeScreen = document.body.classList.contains('home-screen');
  document.body.classList.remove('home-screen');
  if (mode === gameMode) {
    if (wasHomeScreen && mode === 'adventure') initAdventure(true);
    return;
  }
  gameMode = mode;
  localStorage.setItem('wordworm_gamemode', mode);
  applyModeClass();
  setBoardSize();
  sel = [];
  if (mode === 'adventure') initAdventure(true);
  else init(true);
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
  while (score >= levelThreshold(level)) {
    level++;
    sfx.levelup(); setFace('happy');
    toast('🎉 升級！Lv.' + level + '「' + rankTitle() + '」', 2000);
    pickBonusWord();
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
/* Boggle 經典 16 骰面配方（公開設計，母音與常見組合分佈經數十年驗證）
   每次生磚＝隨機挑一顆骰擲一面，比純頻率隨機更常出「拼得起來」的盤面 */
const BOGGLE_DICE = [
  'AAEEGN','ABBJOO','ACHOPS','AFFKPS','AOOTTW','CIMOTU','DEILRX','DELRVY',
  'DISTTY','EEGHNW','EEINSU','EHRTVW','EIOSST','ELRTTY','HIMNQU','HLNNRZ'
];
function boardVowelRatio() {
  let v = 0, n = 0;
  for (const col of grid) for (const t of col) { n++; if (VOWELS.includes(t.letter[0])) v++; }
  return n ? v / n : .4;
}
function newTile() {
  // Boggle 骰子生成 + 母音平衡保底（母音比例 < 32% 時 65% 機率補母音）
  let ch;
  if (grid.length && boardVowelRatio() < .32 && Math.random() < .65) ch = rand(VOWELS);
  else ch = rand(rand(BOGGLE_DICE));
  return { letter: ch === 'Q' ? 'Qu' : ch, burning: false, gem: null, fresh: true };
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
const MUSIC_MUTED_KEY = 'wordworm_music_muted';
let AC = null, muted = false, bgmTimer = null;
let musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === '1';
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function beep(freq, dur = .09, type = 'triangle', vol = .18, when = 0) {
  if (muted) return;
  const ctx = ac(), o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + when + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + dur + .02);
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
    clearInterval(bgmTimer);
    bgmTimer = setInterval(bgmTick, activeBgmTheme.tempoMs || 380);
  }
}
function setBgmThemeForLevel(level) {
  setBgmTheme(level && level.chapterId ? level.chapterId : 'classic');
}
function bgmTick() {
  const theme = activeBgmTheme || BGM_THEMES.classic;
  const notes = theme.notes || BGM_THEMES.classic.notes;
  const note = notes[bgmStep % notes.length];
  if (!musicMuted) {
    beep(note, theme.noteDur || .22, theme.wave || 'sine', theme.volume || .05);
    if (theme.bassEvery && bgmStep % theme.bassEvery === 0) {
      beep(note / (theme.bassDivisor || 2), theme.bassDur || .4, theme.bassWave || 'sine', theme.bassVolume || .04);
    }
  }
  bgmStep++;
}
function updateMusicButton() {
  const btn = document.getElementById('mute');
  btn.textContent = musicMuted ? '🎵 開音樂' : '🎵 關音樂';
  btn.setAttribute('aria-pressed', musicMuted ? 'true' : 'false');
  btn.title = musicMuted ? '開啟背景音樂' : '關閉背景音樂';
}
function startBgm() { if (!bgmTimer) bgmTimer = setInterval(bgmTick, (activeBgmTheme || BGM_THEMES.classic).tempoMs || 380); }
document.addEventListener('pointerdown', function once() {
  ac().resume(); startBgm(); document.removeEventListener('pointerdown', once);
}, { once: true });
document.getElementById('mute').onclick = e => {
  musicMuted = !musicMuted;
  localStorage.setItem(MUSIC_MUTED_KEY, musicMuted ? '1' : '0');
  updateMusicButton();
};
updateMusicButton();

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
function saveAdventure() {
  if (over) { localStorage.removeItem(ADV_SAVE_KEY); return; }
  const nextAdv = normaliseAdvState(adv);
  if (!nextAdv || !isValidAdvState(nextAdv)) return;
  adv = nextAdv;
  localStorage.setItem(ADV_SAVE_KEY, JSON.stringify({
    grid: grid.map(col => col.map(t => ({ letter: t.letter, gem: t.gem, locked: !!t.locked, cursed: !!t.cursed }))),
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
    if (boardPlayable()) return;
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
  if (gameMode === 'adventure' || easyMode) return !(a.c === b.c && a.r === b.r);  // 冒險模式／輕鬆模式：全盤任選
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
      if (t.fresh) { el.classList.add('falling'); t.fresh = false; }
      if (sel.some(s => s.c === c && s.r === r)) el.classList.add('sel');
      el.textContent = t.letter;
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
  return el && el.classList.contains('tile') ? { c: +el.dataset.c, r: +el.dataset.r } : null;
}
function pick(p) {
  if (over || !p) return;
  if (grid[p.c][p.r].locked) return;  // 鎖定磚不可選取（冒險模式怪物技能）
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

/* ================= 拼字提交 ================= */
document.getElementById('submit').onclick = submit;
document.getElementById('clear').onclick = () => { sel = []; render(); updateCurrent(); };
document.getElementById('shuffle').onclick = shuffle;
document.getElementById('restart').onclick = init;
document.getElementById('modesel-classic').onclick = () => selectGameMode('classic');
document.getElementById('modesel-adventure').onclick = () => selectGameMode('adventure');
document.getElementById('adv-story-open').onclick = () => openAdventureStoryFromMap();
document.getElementById('adv-map-path').onclick = e => {
  const node = e.target.closest('.adv-map-node');
  if (!node || node.disabled) return;
  startAdventureLevel(node.dataset.levelId);
};
document.getElementById('adv-map-reset').onclick = restartAdventureGame;
document.getElementById('adv-battle-reset').onclick = restartAdventureGame;
document.getElementById('adv-back-map').onclick = showAdventureMap;
document.getElementById('adv-story-close').onclick = closeStoryModal;
document.getElementById('adv-story-modal').onclick = e => {
  if (e.currentTarget.classList.contains('has-comic') || e.target.id === 'adv-story-modal') closeStoryModal();
};
document.getElementById('adv-items-panel').onclick = e => {
  const btn = e.target.closest('[data-adv-item]');
  if (btn) useAdventureItem(btn.dataset.advItem);
};
document.getElementById('adv-mobile-drawers').onclick = e => {
  const btn = e.target.closest('[data-adv-item]');
  if (btn) useAdventureItem(btn.dataset.advItem);
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeStoryModal();
});

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
  if (w.length < 3) { toast('至少 3 個字母'); return; }
  if (!DICT) { toast('字典還在載入…'); return; }
  if (!DICT.has(w.toLowerCase())) { sfx.bad(); setFace('sad'); bubble(quip(QUIPS.bad)); shake();
    setTimeout(() => setFace('normal'), 1200); return; }
  if (gameMode === 'adventure') { submitAdventure(w); return; }
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
  for (const p of tiles) {
    const t = newTile();
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

/* ================= 冒險模式：戰鬥狀態 ================= */
let adv = null; // { chapterIdx, monsterIdx, playerHp, playerMaxHp, monsterHp, monsterMaxHp, monsterAtk, monsterName, monsterKind, isBoss }
let advAdvancing = false;
let advAdvanceTimer = null;
let advEncounterTimer = null;
let advStoryAfterClose = null;
const ADV_ADVANCE_MS = 1500;
const ADV_ENCOUNTER_MS = 620;

function emptyAdvItems() {
  const items = {};
  for (const id of ADV_ITEM_ORDER) items[id] = 0;
  return items;
}
function defaultAdvItems() {
  return { heal: 2, cleanse: 1, strike: 1 };
}
function normaliseAdvItems(items, fallback = emptyAdvItems()) {
  const next = {};
  for (const id of ADV_ITEM_ORDER) {
    const def = ADV_ITEM_DEFS[id];
    const value = Number(items && items[id]);
    const raw = Number.isFinite(value) ? value : fallback[id];
    next[id] = Math.max(0, Math.min(def.max, Math.floor(Number(raw) || 0)));
  }
  return next;
}
function advItemTotal(items) {
  return ADV_ITEM_ORDER.reduce((sum, id) => sum + (items[id] || 0), 0);
}
function syncAdvItemsToProgress() {
  if (!adv) return advBestProgress();
  adv.items = normaliseAdvItems(adv.items, emptyAdvItems());
  return updateAdvBestProgress(null, adv.items);
}
function addAdvItem(items, id, amount = 1) {
  const def = ADV_ITEM_DEFS[id];
  if (!def) return 0;
  const before = items[id] || 0;
  items[id] = Math.max(0, Math.min(def.max, before + amount));
  return items[id] - before;
}
function grantAdventureReward(level) {
  if (!adv) return [];
  adv.items = normaliseAdvItems(adv.items, emptyAdvItems());
  const rewards = level.isBoss || level.boss
    ? [['heal', 1], ['cleanse', 1], ['strike', 1]]
    : [[ADV_ITEM_ORDER[level.globalIdx % ADV_ITEM_ORDER.length], 1]];
  const gained = [];
  for (const [id, amount] of rewards) {
    const qty = addAdvItem(adv.items, id, amount);
    if (qty > 0) gained.push(ADV_ITEM_DEFS[id].name + ' ×' + qty);
  }
  return gained;
}
function currentAdvItemsForDisplay() {
  if (adv && adv.items) return normaliseAdvItems(adv.items, emptyAdvItems());
  return normaliseAdvItems(advBestProgress().items, defaultAdvItems());
}
function renderAdvItems() {
  const items = currentAdvItemsForDisplay();
  if (adv) adv.items = items;
  const total = advItemTotal(items);
  const tag = document.getElementById('adv-item-total-tag');
  if (tag) tag.textContent = total + ' 個';
  const summary = document.getElementById('adv-items-summary');
  if (summary) {
    summary.textContent = total
      ? ADV_ITEM_ORDER.map(id => ADV_ITEM_DEFS[id].name + '×' + items[id]).join(' / ')
      : '沒有道具';
  }

  for (const listId of ['adv-items-list', 'adv-mobile-items-list']) {
    const list = document.getElementById(listId);
    if (!list) continue;
    list.innerHTML = '';
    for (const id of ADV_ITEM_ORDER) {
      const def = ADV_ITEM_DEFS[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'adv-item-btn';
      btn.dataset.advItem = id;
      btn.disabled = !adv || over || (items[id] || 0) <= 0;
      btn.setAttribute('aria-label', def.name + '，剩餘 ' + (items[id] || 0) + ' 個，' + def.desc);

      const icon = document.createElement('span');
      icon.className = 'adv-item-icon';
      icon.textContent = def.icon;
      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'adv-item-name';
      name.textContent = def.name;
      const desc = document.createElement('span');
      desc.className = 'adv-item-desc';
      desc.textContent = def.short;
      body.append(name, desc);
      const count = document.createElement('span');
      count.className = 'adv-item-count';
      count.textContent = '×' + (items[id] || 0);
      btn.append(icon, body, count);
      list.appendChild(btn);
    }
  }
}
function advBattleStage() {
  return document.getElementById('adv-battle-stage');
}
function setAdvAdvanceBanner(text = '') {
  const banner = document.getElementById('adv-advance-banner');
  if (banner) banner.textContent = text;
}
function clearAdvStageMotion() {
  const stage = advBattleStage();
  clearTimeout(advEncounterTimer);
  if (!stage) return;
  stage.classList.remove('adv-advancing', 'adv-encountering');
  setAdvAdvanceBanner('');
}
function beginAdvAdvance(nextLevel) {
  const stage = advBattleStage();
  if (!stage || !nextLevel) return;
  stage.classList.remove('adv-encountering');
  stage.classList.add('adv-advancing');
  setAdvAdvanceBanner('前進到 ' + nextLevel.mapLabel + ' ' + nextLevel.name);
}
function beginAdvEncounter() {
  const stage = advBattleStage();
  if (!stage) return;
  stage.classList.remove('adv-advancing');
  stage.classList.add('adv-encountering');
  setAdvAdvanceBanner('');
  clearTimeout(advEncounterTimer);
  advEncounterTimer = setTimeout(() => stage.classList.remove('adv-encountering'), ADV_ENCOUNTER_MS);
}
function clearNegativeTiles() {
  let cleared = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (grid[c][r].locked || grid[c][r].cursed) {
      grid[c][r].locked = false;
      grid[c][r].cursed = false;
      cleared++;
    }
  }
  return cleared;
}
function useAdventureItem(id) {
  if (over || advAdvancing || !adv || adv.monsterHp <= 0) return;
  const def = ADV_ITEM_DEFS[id];
  if (!def) return;
  adv.items = normaliseAdvItems(adv.items, emptyAdvItems());
  if ((adv.items[id] || 0) <= 0) {
    toast(def.name + ' 已經用完了。', 1200);
    renderAdvItems();
    return;
  }

  let used = false;
  if (id === 'heal') {
    if (adv.playerHp >= adv.playerMaxHp) {
      toast('HP 已經滿了，先別浪費蜂蜜茶。', 1400);
      return;
    }
    const before = adv.playerHp;
    adv.playerHp = Math.min(adv.playerMaxHp, adv.playerHp + 25);
    toast('蜂蜜茶回復 +' + (adv.playerHp - before) + ' HP', 1300);
    used = true;
  } else if (id === 'cleanse') {
    const cleared = clearNegativeTiles();
    if (!cleared) {
      toast('場上沒有負面磚，橡皮擦先省著。', 1400);
      return;
    }
    toast('橡皮擦清掉 ' + cleared + ' 顆負面磚', 1300);
    used = true;
  } else if (id === 'strike') {
    const before = adv.monsterHp;
    adv.monsterHp = Math.max(0, adv.monsterHp - def.damage);
    toast('墨水彈造成 -' + (before - adv.monsterHp) + ' 傷害', 1300);
    used = true;
  }

  if (!used) return;
  adv.items[id]--;
  sel = [];
  syncAdvItemsToProgress();
  render(); updateCurrent(); renderAdvHud();
  if (adv.monsterHp <= 0) {
    defeatMonster();
    return;
  }
  saveAdventure();
}

function battleDamage(word, tiles) {
  let dmg = word.length * 3;
  for (const ch of word.toUpperCase()) dmg += (LETTER_SCORE[ch] || 0);
  dmg += advBestProgress().heroAttackBonus || 0;
  let cursed = false;
  for (const p of tiles) {
    const t = grid[p.c][p.r];
    if (t.gem) dmg += t.gem === 'diamond' ? 20 : t.gem === 'sapphire' ? 12 : t.gem === 'gold' ? 8 : 4;
    if (t.cursed) cursed = true;
  }
  if (cursed) dmg = Math.round(dmg * .5);  // 詛咒磚：本次攻擊減傷
  return Math.max(1, Math.round(dmg));
}
// 怪物技能：把場上 1-2 顆磚變成鎖定磚／詛咒磚（策略點：花回合清爛磚 vs 硬拼繞開）
function monsterSkillAlter() {
  const candidates = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
    if (!grid[c][r].locked && !grid[c][r].cursed) candidates.push({ c, r });
  const n = Math.min(candidates.length, Math.random() < .5 ? 1 : 2);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const p = candidates.splice(idx, 1)[0];
    if (Math.random() < .5) grid[p.c][p.r].locked = true;
    else grid[p.c][p.r].cursed = true;
  }
}
function monsterCounter() {
  if (!adv || adv.monsterHp <= 0) return;
  adv.playerHp = Math.max(0, adv.playerHp - adv.monsterAtk);
  sfx.burn();
  // 負面磚頻率（Vickie 2026-07-09 回饋：原 30%/50% 太頻繁，調慢一半）
  if (Math.random() < (adv.isBoss ? .25 : .15)) monsterSkillAlter();
}
function monsterSpriteSvg(kind, isBoss) {
  const assets = {
    critter: 'assets/characters/enemy-critter.png',
    blob: 'assets/characters/enemy-blob.png',
    book: 'assets/characters/enemy-book-boss.png',
  };
  const src = assets[kind] || assets.book;
  const bossClass = isBoss ? ' is-boss' : '';
  const alt = isBoss ? '日式奇幻 Boss 怪物' : '日式奇幻怪物';
  return '<img class="adv-character-img adv-monster-img' + bossClass + '" src="' + src + '" alt="' + alt + '">';
}
function renderAdvFloatingWord() {
  const wrap = document.getElementById('adv-floating-word');
  const preview = document.getElementById('adv-damage-preview');
  if (!wrap) return;
  wrap.innerHTML = '';
  const w = currentWord();
  if (!w) {
    if (preview) preview.textContent = '預估傷害 —';
    return;
  }
  for (const p of sel) {
    const chip = document.createElement('span');
    chip.className = 'adv-word-chip';
    chip.textContent = grid[p.c][p.r].letter;
    wrap.appendChild(chip);
  }
  if (preview) {
    const valid = DICT && DICT.has(w.toLowerCase());
    preview.textContent = valid && adv ? ('預估傷害 ' + battleDamage(w, sel)) : '拼字中';
  }
}
function renderAdvSkills(level) {
  const list = document.getElementById('adv-skills-list');
  if (!list) return;
  list.innerHTML = '';
  const skills = level.skills && level.skills.length ? level.skills : [
    { icon: 'L', name: '鎖定磚', desc: '隨機封住 1 格，無法選取。' },
    { icon: 'C', name: '詛咒磚', desc: '拼入後本次攻擊傷害降低。' },
    { icon: 'ATK', name: '反擊', desc: '未擊倒時回合結尾扣玩家 HP。' },
  ];
  for (const skill of skills) {
    const item = document.createElement('div');
    item.className = 'adv-skill';
    const icon = document.createElement('div');
    icon.className = 'adv-skill-icon';
    icon.textContent = skill.icon;
    const body = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = skill.name;
    const desc = document.createElement('span');
    desc.textContent = skill.desc;
    body.append(name, desc);
    item.append(icon, body);
    list.appendChild(item);
  }
  document.getElementById('adv-skill-monster-tag').textContent = level.name;
  document.getElementById('adv-skills-summary').textContent = skills.length + ' 個怪物技能，可展開';
}
function applyAdvStageTheme(level) {
  const stage = advBattleStage();
  const themes = typeof ADV_STAGE_THEMES === 'undefined' ? null : ADV_STAGE_THEMES;
  const theme = themes && level ? (themes[level.stageTheme] || themes[level.chapterId]) : null;
  if (!stage || !theme) {
    if (stage) stage.classList.remove('has-adv-stage-theme');
    return;
  }
  const far = stage.querySelector('.adv-stage-far');
  const mid = stage.querySelector('.adv-stage-mid');
  const ground = stage.querySelector('.adv-stage-ground');
  if (far) far.style.backgroundImage = 'url("' + theme.far + '")';
  if (mid) mid.style.backgroundImage = 'url("' + theme.mid + '")';
  if (ground) ground.style.backgroundImage = 'url("' + theme.ground + '")';
  stage.style.setProperty('--adv-stage-far', 'url("' + theme.far + '")');
  stage.style.setProperty('--adv-stage-mid', 'url("' + theme.mid + '")');
  stage.style.setProperty('--adv-stage-ground', 'url("' + theme.ground + '")');
  stage.classList.add('has-adv-stage-theme');
}
function renderAdvHeroProgress(progress = advBestProgress()) {
  const title = document.getElementById('adv-hero-title');
  const expText = document.getElementById('adv-hero-exptext');
  const expBar = document.getElementById('adv-hero-expbar');
  const maxHp = document.getElementById('adv-hero-maxhp');
  const atk = document.getElementById('adv-hero-atk');
  if (title) title.textContent = 'Lex Lv.' + progress.heroLevel;
  if (expText) expText.textContent = 'EXP ' + progress.heroExp + '/' + progress.heroExpToNext;
  if (expBar) {
    expBar.max = progress.heroExpToNext;
    expBar.value = progress.heroExp;
  }
  if (maxHp) maxHp.textContent = progress.heroMaxHp;
  if (atk) atk.textContent = progress.heroAttackBonus;
}
function renderAdvHud() {
  if (!adv) return;
  const level = adventureLevelById(adv.levelId);
  if (!level) return;
  const progress = advBestProgress();
  setBgmThemeForLevel(level);
  applyAdvStageTheme(level);
  document.getElementById('adv-chapter').textContent = '第 ' + (level.chapterIdx + 1) + ' 章：' + level.chapterTitle + '　' + level.mapLabel;
  document.getElementById('adv-player-name').textContent = 'Lex Lv.' + progress.heroLevel;
  document.getElementById('adv-monster-name').textContent = (adv.isBoss ? 'Boss ' : '') + adv.monsterName;
  document.getElementById('adv-monster-sprite').innerHTML = monsterSpriteSvg(adv.monsterKind, adv.isBoss);
  document.getElementById('adv-monster-hpbar').style.width = Math.max(0, adv.monsterHp / adv.monsterMaxHp * 100) + '%';
  document.getElementById('adv-monster-hptext').textContent = Math.max(0, adv.monsterHp) + '/' + adv.monsterMaxHp;
  document.getElementById('adv-player-hpbar').style.width = Math.max(0, adv.playerHp / adv.playerMaxHp * 100) + '%';
  document.getElementById('adv-player-hptext').textContent = Math.max(0, adv.playerHp) + '/' + adv.playerMaxHp;
  renderAdvHeroProgress(progress);
  renderAdvFloatingWord();
  renderAdvSkills(level);
  renderAdvItems();
}
function storyChapterForProgress(progress) {
  const completed = new Set(progress.completedLevelIds);
  const activeLevel = adv && adv.levelId ? adventureLevelById(adv.levelId) : null;
  if (activeLevel && !completed.has(activeLevel.id)) return activeLevel;
  return ADVENTURE_LEVELS.find(level => !completed.has(level.id)) || ADVENTURE_LEVELS[ADVENTURE_LEVELS.length - 1];
}
function renderAdvStoryCard(progress) {
  const titleEl = document.getElementById('adv-story-title');
  const textEl = document.getElementById('adv-story-text');
  const goalEl = document.getElementById('adv-story-goal');
  if (!titleEl || !textEl || !goalEl) return;

  const completedCount = progress.completedLevelIds.length;
  if (completedCount >= ADVENTURE_LEVELS.length) {
    titleEl.textContent = ADVENTURE_STORY.endingTitle;
    textEl.textContent = ADVENTURE_STORY.ending[0];
    goalEl.textContent = '全部關卡已通關，可以回頭重打已解鎖關卡。';
    return;
  }

  const level = storyChapterForProgress(progress);
  const chapterStory = ADVENTURE_STORY.chapters[level.chapterId];
  titleEl.textContent = '第 ' + (level.chapterIdx + 1) + ' 章：' + level.chapterTitle;
  textEl.textContent = chapterStory.logline;
  goalEl.textContent = '目標：' + chapterStory.goal;
}
function openStoryModal(title, paragraphs, comic = null, options = {}) {
  const modal = document.getElementById('adv-story-modal');
  const titleEl = document.getElementById('adv-story-modal-title');
  const body = document.getElementById('adv-story-modal-body');
  advStoryAfterClose = typeof options.onClose === 'function' ? options.onClose : null;
  const hasFullComic = !!(comic && comic.fullImage);
  const hasComic = !!(comic && (comic.fullImage || (comic.panels && comic.panels.length)));
  modal.classList.toggle('has-comic', hasComic);
  modal.classList.toggle('has-full-comic', hasFullComic);
  titleEl.textContent = title;
  body.innerHTML = '';
  if (hasComic) {
    const page = document.createElement('div');
    page.className = 'adv-comic-page' + (hasFullComic ? ' full-image' : '');
    if (hasFullComic) {
      const img = document.createElement('img');
      img.className = 'adv-comic-full-image';
      img.src = comic.fullImage;
      img.alt = comic.title || title;
      img.loading = 'eager';
      page.appendChild(img);
    } else if (comic.ribbon) {
      const ribbon = document.createElement('div');
      ribbon.className = 'adv-comic-ribbon';
      ribbon.textContent = comic.ribbon;
      page.appendChild(ribbon);
    }
    if (!hasFullComic) for (const panel of comic.panels) {
      const item = document.createElement('figure');
      item.className = 'adv-comic-panel ' + (panel.size === 'wide' ? 'wide' : 'half');
      if (panel.image) {
        const img = document.createElement('img');
        img.src = panel.image;
        img.alt = panel.caption || title;
        img.loading = 'lazy';
        item.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'adv-comic-placeholder';
        placeholder.textContent = panel.ribbon || comic.ribbon || title;
        item.appendChild(placeholder);
      }
      if (panel.bubble) {
        const bubble = document.createElement('div');
        bubble.className = 'adv-comic-bubble' + (panel.bubbleClass ? ' ' + panel.bubbleClass : '');
        bubble.textContent = panel.bubble;
        item.appendChild(bubble);
      }
      const caption = document.createElement('figcaption');
      caption.textContent = panel.caption || '';
      item.appendChild(caption);
      page.appendChild(item);
    }
    body.appendChild(page);
  }
  if (!hasComic) for (const text of paragraphs) {
    const p = document.createElement('p');
    p.textContent = text;
    body.appendChild(p);
  }
  modal.classList.add('show');
}
function closeStoryModal() {
  const modal = document.getElementById('adv-story-modal');
  const wasOpen = modal.classList.contains('show');
  const afterClose = advStoryAfterClose;
  advStoryAfterClose = null;
  modal.classList.remove('show');
  modal.classList.remove('has-comic');
  modal.classList.remove('has-full-comic');
  if (wasOpen && afterClose) afterClose();
}
function openAdventureStoryFromMap() {
  const progress = advBestProgress();
  if (progress.completedLevelIds.length >= ADVENTURE_LEVELS.length) {
    openStoryModal(ADVENTURE_STORY.endingTitle, ADVENTURE_STORY.ending, ADVENTURE_COMICS.ending);
    return;
  }
  const level = storyChapterForProgress(progress);
  const chapterStory = ADVENTURE_STORY.chapters[level.chapterId];
  const comic = ADVENTURE_COMICS.chapters[level.chapterId];
  openStoryModal('第 ' + (level.chapterIdx + 1) + ' 章：' + level.chapterTitle, [
    chapterStory.quote,
    chapterStory.logline,
    '目標：' + chapterStory.goal
  ], comic);
}
function openAdventureClearComic(level, onClose) {
  const chapterStory = ADVENTURE_STORY.chapters[level.chapterId];
  const comic = ADVENTURE_COMICS.chapters[level.chapterId];
  openStoryModal('第 ' + (level.chapterIdx + 1) + ' 章：' + level.chapterTitle, [
    chapterStory.quote,
    chapterStory.logline,
    '目標：' + chapterStory.goal
  ], comic, { onClose });
}
function showAdventureIntroForNewGame() {
  localStorage.setItem(STORY_INTRO_SEEN_KEY, '1');
  setTimeout(() => {
    openStoryModal(ADVENTURE_STORY.introTitle, ADVENTURE_STORY.intro.concat(ADVENTURE_STORY.world), ADVENTURE_COMICS.intro);
  }, 280);
}
function setAdventureView(view) {
  document.body.classList.toggle('adv-view-map', view === 'map');
  document.body.classList.toggle('adv-view-battle', view === 'battle');
}
function renderAdvMap() {
  const progress = advBestProgress();
  const completed = new Set(progress.completedLevelIds);
  const activeLevelId = adv && adv.levelId && adv.monsterHp > 0 && !over ? adv.levelId : '';
  const path = document.getElementById('adv-map-path');
  path.innerHTML = '';
  renderAdvStoryCard(progress);
  renderAdvHeroProgress(progress);

  const nextLevel = ADVENTURE_LEVELS.find(level => !completed.has(level.id));
  document.getElementById('adv-map-summary').textContent = nextLevel
    ? '已通關 ' + completed.size + ' / ' + ADVENTURE_LEVELS.length + ' 關。' + advHeroSummary(progress) + '。下一個目標：' + nextLevel.mapLabel + ' ' + nextLevel.name + '。'
    : '全部 ' + ADVENTURE_LEVELS.length + ' 關都已通關。' + advHeroSummary(progress) + '。可以回頭重打已解鎖關卡。';

  for (const level of ADVENTURE_LEVELS) {
    const unlocked = isAdventureLevelUnlocked(level.id, progress);
    const isCompleted = completed.has(level.id);
    const isActive = activeLevelId === level.id;
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'adv-map-node ' + (isCompleted ? 'completed ' : '') + (unlocked ? 'available ' : 'locked ') + (isActive ? 'ongoing' : '');
    node.disabled = !unlocked;
    node.dataset.levelId = level.id;

    const badge = document.createElement('span');
    badge.className = 'adv-node-badge';
    badge.textContent = isCompleted ? '✓' : unlocked ? level.mapLabel : '•';

    const main = document.createElement('span');
    main.className = 'adv-node-main';
    const title = document.createElement('b');
    title.textContent = level.mapLabel + ' ' + level.name;
    const meta = document.createElement('span');
    meta.textContent = '第 ' + (level.chapterIdx + 1) + ' 章：' + level.chapterTitle + '　HP ' + level.hp + ' / ATK ' + level.atk + ' / EXP ' + adventureExpReward(level);
    main.append(title, meta);

    const state = document.createElement('span');
    state.className = 'adv-node-state';
    state.textContent = isActive ? '戰鬥中' : isCompleted ? '已通關' : unlocked ? '可挑戰' : '未解鎖';

    node.append(badge, main, state);
    path.appendChild(node);
  }
}
function showAdventureMap() {
  clearTimeout(advAdvanceTimer);
  advAdvancing = false;
  clearAdvStageMotion();
  if (adv && adv.monsterHp > 0 && !over && isValidGrid(grid, COLS, ROWS)) saveAdventure();
  sel = [];
  setAdventureView('map');
  if (grid.length === COLS) { render(); updateCurrent(); }
  renderAdvMap();
  setBgmThemeForLevel(storyChapterForProgress(advBestProgress()));
}
function makeAdventureState(level) {
  const progress = advBestProgress();
  return {
    levelId: level.id,
    levelIdx: level.globalIdx,
    chapterIdx: level.chapterIdx,
    monsterIdx: level.levelIdx,
    playerHp: progress.heroMaxHp,
    playerMaxHp: progress.heroMaxHp,
    monsterHp: 0,
    monsterMaxHp: 0,
    monsterAtk: 0,
    monsterName: '',
    monsterKind: level.kind,
    isBoss: !!level.boss,
    totalKills: progress.completedLevelIds.length,
    items: normaliseAdvItems(progress.items, defaultAdvItems()),
  };
}
function startAdventureLevel(levelId, options = {}) {
  clearTimeout(advAdvanceTimer);
  advAdvancing = false;
  clearAdvStageMotion();
  const level = adventureLevelById(levelId);
  if (!level || !isAdventureLevelUnlocked(levelId)) {
    toast('這關還沒解鎖，先把前面的書庫清乾淨。', 1600);
    return;
  }
  setBgmThemeForLevel(level);
  document.getElementById('adv-gameover').classList.remove('show');
  over = false; sel = []; setFace('normal');
  const canResume = adv && adv.levelId === levelId && adv.monsterHp > 0 && isValidGrid(grid, COLS, ROWS);
  if (!canResume) {
    localStorage.removeItem(ADV_SAVE_KEY);
    adv = makeAdventureState(level);
    freshBoard();
    startMonster();
  }
  setAdventureView('battle');
  render(); updateCurrent(); renderAdvHud();
  if (options.fromAdvance) beginAdvEncounter();
  saveAdventure();
}
function restartAdventureGame() {
  if (!confirm('重新開始會清除冒險模式進度與目前戰鬥；經典模式存檔不會受影響。確定要重來嗎？')) return;
  localStorage.removeItem(ADV_SAVE_KEY);
  localStorage.removeItem(ADV_PROGRESS_KEY);
  localStorage.removeItem(STORY_INTRO_SEEN_KEY);
  adv = null; sel = []; over = false;
  document.getElementById('adv-gameover').classList.remove('show');
  freshBoard(); render(); updateCurrent(); setFace('normal');
  showAdventureMap();
  toast('冒險模式已重新開始。', 1600);
}
function startMonster() {
  const m = adventureLevelById(adv.levelId);
  adv.chapterIdx = m.chapterIdx; adv.monsterIdx = m.levelIdx; adv.levelIdx = m.globalIdx;
  adv.monsterName = m.name; adv.monsterKind = m.kind; adv.isBoss = !!m.boss;
  adv.monsterHp = m.hp; adv.monsterMaxHp = m.hp; adv.monsterAtk = m.atk;
  renderAdvHud();
  const bossQuote = ADVENTURE_STORY.bossQuotes[m.id];
  bubble(bossQuote || (adv.isBoss ? ('Boss 出現：' + m.name + '！') : ('遭遇 ' + m.name + '！')));
}
function defeatMonster() {
  const level = adventureLevelById(adv.levelId);
  const defeatedName = adv.monsterName;
  bubble('打倒了 ' + defeatedName + '！');
  sfx.levelup();
  advAdvancing = true;
  adv.totalKills++;
  const rewards = grantAdventureReward(level);
  const clearResult = completeAdventureLevel(level, adv.items);
  const progress = clearResult.progress;
  adv.playerMaxHp = progress.heroMaxHp;
  if (clearResult.levelsGained > 0) adv.playerHp = progress.heroMaxHp;
  localStorage.removeItem(ADV_SAVE_KEY);
  sel = [];
  render(); updateCurrent();
  const nextLevel = ADVENTURE_LEVELS.find(item => !progress.completedLevelIds.includes(item.id));
  const rewardText = rewards.length ? (' 獲得：' + rewards.join('、') + '。') : '';
  const expText = clearResult.expGained
    ? (' EXP +' + clearResult.expGained + '。' + (clearResult.levelsGained ? 'Lex 升到 Lv.' + progress.heroLevel + '，Max HP ' + progress.heroMaxHp + '。' : ''))
    : (clearResult.alreadyCompleted ? ' 已通關關卡不再獲得 EXP。' : '');
  if (nextLevel) {
    renderAdvHud();
    beginAdvAdvance(nextLevel);
    toast('打倒 ' + defeatedName + '！' + expText + rewardText + '閱讀章節分鏡後前往下一戰：' + nextLevel.name, 2800);
    advAdvanceTimer = setTimeout(() => {
      openAdventureClearComic(level, () => startAdventureLevel(nextLevel.id, { fromAdvance: true }));
    }, ADV_ADVANCE_MS);
    return;
  }
  renderAdvHud();
  toast('🎉 所有關卡都通關了！' + expText + rewardText + '閱讀最終章分鏡後回到地圖。', 3200);
  advAdvanceTimer = setTimeout(() => {
    openAdventureClearComic(level, () => {
      advAdvancing = false;
      clearAdvStageMotion();
      showAdventureMap();
      setTimeout(() => openStoryModal(ADVENTURE_STORY.endingTitle, ADVENTURE_STORY.ending, ADVENTURE_COMICS.ending), 300);
    });
  }, 900);
}
function checkAdvOver() {
  if (adv && adv.playerHp <= 0 && !over) {
    over = true;
    sfx.over(); setFace('sad');
    updateAdvBestProgress(null, adv.items);
    saveAdventure();  // over=true 時會自動清掉舊存檔
    document.getElementById('adv-fchapter').textContent = adv.chapterIdx + 1;
    document.getElementById('adv-fkills').textContent = adv.totalKills;
    document.getElementById('adv-gameover').classList.add('show');
  }
}
function initAdventure(fromSave = false) {
  sel = []; over = false;
  document.getElementById('adv-gameover').classList.remove('show');
  setFace('normal');
  const hasBattleSave = fromSave && loadAdventure();
  const hasProgressRecord = hasAdventureProgressRecord();
  const shouldShowIntro = !hasBattleSave && !hasProgressRecord;
  if (!hasBattleSave) {
    localStorage.removeItem(ADV_SAVE_KEY);
    adv = null;
    freshBoard();
  }
  if (grid.length !== COLS) freshBoard();
  render(); updateCurrent();
  showAdventureMap();
  if (hasBattleSave) toast('讀取冒險戰鬥，可從地圖繼續。', 1600);
  if (shouldShowIntro && !document.body.classList.contains('home-screen')) showAdventureIntroForNewGame();
}
function submitAdventure(w) {
  if (advAdvancing || !adv) return;
  const dmg = battleDamage(w, sel);
  adv.monsterHp = Math.max(0, adv.monsterHp - dmg);

  sfx.ok(w.length); setFace('happy');
  const face = document.getElementById('wormface');
  face.style.transform = 'scale(1.25)'; setTimeout(() => face.style.transform = '', 250);
  toast('攻擊 -' + dmg, 1000);
  if (Math.random() < .4) setTimeout(() => bubble(quip(w.length <= 3 ? QUIPS.short : w.length <= 5 ? QUIPS.mid : QUIPS.long)), 700);

  const gemTier = w.length >= 8 ? 'diamond' : w.length >= 7 ? 'sapphire' : w.length >= 6 ? 'gold' : w.length >= 5 ? 'green' : null;
  removeTilesAdventure(sel, gemTier);
  sel = [];

  if (adv.monsterHp <= 0) {
    // 刻意設計：斬殺當回合不觸發反擊（怪物已死不能還手），非漏掉的分支
    defeatMonster();
    return;
  } else {
    monsterCounter();
  }
  render(); updateCurrent();
  renderAdvHud();
  checkAdvOver();
  if (!over) saveAdventure();
}
document.getElementById('adv-restart').onclick = () => initAdventure();

/* ================= 程式進入點 ================= */
setBoardSize();
applyModeClass();
if (gameMode === 'adventure') initAdventure(true);
else init(true);
