/* ============================================================
 * game-adventure.js —— 冒險模式：戰鬥層
 * 內容：戰鬥狀態 adv、道具欄、傷害公式 battleDamage、
 *       怪物反擊與技能、負面磚、戰鬥 HUD 渲染。
 * 關卡資料在 adventure-data.js，故事文本在 story.js。
 * ============================================================ */


/* ================= 冒險模式：戰鬥狀態 ================= */
let adv = null; // { chapterIdx, monsterIdx, playerHp, playerMaxHp, monsterHp, monsterMaxHp, monsterAtk, monsterName, monsterKind, isBoss }
let advAdvancing = false;
let advAdvanceTimer = null;
let advEncounterTimer = null;
let advStoryAfterClose = null;
let advStorySlides = null;
let advStorySlideIndex = 0;
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
      grid[c][r].negativeTurns = 0;
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
function tickNegativeTiles() {
  let cleared = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const tile = grid[c][r];
    if (!isNegativeTile(tile)) continue;
    tile.negativeTurns = negativeTileTurns(tile) - 1;
    if (tile.negativeTurns <= 0) {
      tile.locked = false;
      tile.cursed = false;
      tile.negativeTurns = 0;
      cleared++;
    }
  }
  return cleared;
}
function monsterSkillAlter() {
  const candidates = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
    if (!grid[c][r].locked && !grid[c][r].cursed) candidates.push({ c, r });
  const n = Math.min(candidates.length, Math.random() < .5 ? 1 : 2);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const p = candidates.splice(idx, 1)[0];
    if (Math.random() < .5) {
      grid[p.c][p.r].locked = true;
      grid[p.c][p.r].cursed = false;
    } else {
      grid[p.c][p.r].cursed = true;
      grid[p.c][p.r].locked = false;
    }
    grid[p.c][p.r].negativeTurns = ADV_NEGATIVE_TILE_TURNS;
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
    critter: 'assets/characters/enemy-critter.webp',
    blob: 'assets/characters/enemy-blob.webp',
    book: 'assets/characters/enemy-book-boss.webp',
  };
  const src = assets[kind] || assets.book;
  const bossClass = isBoss ? ' is-boss' : '';
  const alt = isBoss ? '日式奇幻 Boss 怪物' : '日式奇幻怪物';
  return '<img class="adv-character-img adv-monster-img' + bossClass + '" src="' + src + '" width="720" height="720" decoding="async" alt="' + alt + '">';
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
  const skills = level.skills && level.skills.length ? level.skills : [
    { icon: 'L', name: '鎖定磚', desc: '隨機封住 1 格，無法選取；3 次有效攻擊後解除。' },
    { icon: 'C', name: '詛咒磚', desc: '拼入後本次攻擊傷害降低；3 次有效攻擊後解除。' },
    { icon: 'ATK', name: '反擊', desc: '未擊倒時回合結尾扣玩家 HP。' },
  ];
  for (const listId of ['adv-skills-list', 'adv-mobile-skills-list']) {
    const list = document.getElementById(listId);
    if (!list) continue;
    list.innerHTML = '';
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
