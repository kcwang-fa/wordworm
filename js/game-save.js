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

