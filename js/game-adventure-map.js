/* ============================================================
 * game-adventure-map.js —— 冒險模式：地圖與流程層
 * 內容：故事 modal（含第七章結局動畫）、冒險地圖、
 *       關卡進出、submitAdventure、冒險相關事件繫結。
 * 事件繫結放本檔尾端：它們直接引用本檔函式名，
 * 同檔內函式宣告會提升（hoisting），跨檔就會 ReferenceError。
 * ============================================================ */

function renderStorySlide(title) {
  if (!advStorySlides || !advStorySlides.length) return;
  const modal = document.getElementById('adv-story-modal');
  const body = document.getElementById('adv-story-modal-body');
  const hint = document.getElementById('adv-story-hint');
  const slide = advStorySlides[advStorySlideIndex];
  body.innerHTML = '';

  const frame = document.createElement('article');
  frame.className = 'adv-ending-slide';

  const img = document.createElement('img');
  img.className = 'adv-ending-slide-image';
  img.src = slide.image;
  img.alt = slide.alt || title;
  img.loading = 'eager';
  frame.appendChild(img);

  const textBox = document.createElement('div');
  textBox.className = 'adv-ending-slide-text';
  for (const text of slide.paragraphs || []) {
    const p = document.createElement('p');
    p.textContent = text;
    textBox.appendChild(p);
  }
  frame.appendChild(textBox);
  body.appendChild(frame);

  const isLastSlide = advStorySlideIndex >= advStorySlides.length - 1;
  hint.textContent = isLastSlide ? '按任意鍵或點一下回到主畫面' : '按任意鍵或點一下繼續下一張';
  modal.setAttribute('aria-label', title + '，第 ' + (advStorySlideIndex + 1) + ' 張，共 ' + advStorySlides.length + ' 張');
}
function advanceStorySlide() {
  const modal = document.getElementById('adv-story-modal');
  if (!modal.classList.contains('show') || !advStorySlides || !advStorySlides.length) return false;
  if (advStorySlideIndex < advStorySlides.length - 1) {
    advStorySlideIndex++;
    renderStorySlide(document.getElementById('adv-story-modal-title').textContent);
  } else {
    closeStoryModal();
  }
  return true;
}
function openStoryModal(title, paragraphs, comic = null, options = {}) {
  const modal = document.getElementById('adv-story-modal');
  const titleEl = document.getElementById('adv-story-modal-title');
  const body = document.getElementById('adv-story-modal-body');
  advStorySlides = null;
  advStorySlideIndex = 0;
  advStoryAfterClose = typeof options.onClose === 'function' ? options.onClose : null;
  const hasFullComic = !!(comic && comic.fullImage);
  const hasSlides = !!(comic && comic.slides && comic.slides.length);
  const hasComic = !!(comic && (comic.fullImage || hasSlides || (comic.panels && comic.panels.length)));
  const showParagraphs = !hasComic || (!hasSlides && !!options.showParagraphsWithComic);
  modal.classList.toggle('has-comic', hasComic);
  modal.classList.toggle('has-full-comic', hasFullComic);
  modal.classList.toggle('has-ending-slides', hasSlides);
  modal.classList.toggle('show-paragraphs', hasComic && !!options.showParagraphsWithComic);
  titleEl.textContent = title;
  body.innerHTML = '';
  if (hasSlides) {
    advStorySlides = comic.slides;
    renderStorySlide(title);
  } else if (hasComic) {
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
      item.className = 'adv-comic-panel ' + (panel.size === 'wide' ? 'wide' : 'half') + (panel.className ? ' ' + panel.className : '');
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
  if (showParagraphs) for (const text of paragraphs) {
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
  advStorySlides = null;
  advStorySlideIndex = 0;
  modal.classList.remove('show');
  modal.classList.remove('has-comic');
  modal.classList.remove('has-full-comic');
  modal.classList.remove('has-ending-slides');
  modal.classList.remove('show-paragraphs');
  modal.removeAttribute('aria-label');
  if (wasOpen && afterClose) afterClose();
}
function openAdventureStoryFromMap() {
  const progress = advBestProgress();
  if (progress.completedLevelIds.length >= ADVENTURE_LEVELS.length) {
    openAdventureEnding();
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
function openAdventureLevelComic(level, onClose) {
  const chapterStory = ADVENTURE_STORY.chapters[level.chapterId];
  const comic = ADVENTURE_COMICS.chapters[level.chapterId];
  openStoryModal(level.mapLabel + ' ' + level.name + '｜第 ' + (level.chapterIdx + 1) + ' 章：' + level.chapterTitle, [
    chapterStory.quote,
    chapterStory.logline,
    '目標：' + chapterStory.goal
  ], comic, { onClose });
}
function openAdventureFinalBossIntro(onClose) {
  openStoryModal('終章活字巨像', [
    '錯誤無法被完全修正。刪除文字，即可刪除錯誤。'
  ], ADVENTURE_COMICS.finalBossIntro, { onClose });
}
function openAdventureEnding(onClose) {
  openStoryModal(ADVENTURE_STORY.endingTitle, ADVENTURE_STORY.ending, ADVENTURE_COMICS.ending, {
    onClose,
    showParagraphsWithComic: true,
  });
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
const ADV_MAP_CHAPTER_POSITIONS = [
  [7, 43],
  [22, 38],
  [37, 34],
  [52, 35],
  [65, 41],
  [79, 39],
  [91, 42],
];
function advMapPositionForChapter(chapterIdx) {
  return ADV_MAP_CHAPTER_POSITIONS[chapterIdx] || [50, 50];
}
function renderAdvMap() {
  const progress = advBestProgress();
  const completed = new Set(progress.completedLevelIds);
  const activeLevelId = adv && adv.levelId && adv.monsterHp > 0 && !over ? adv.levelId : '';
  const activeLevel = activeLevelId ? adventureLevelById(activeLevelId) : null;
  const path = document.getElementById('adv-map-path');
  path.innerHTML = '';
  renderAdvStoryCard(progress);
  renderAdvHeroProgress(progress);

  const nextLevel = ADVENTURE_LEVELS.find(level => !completed.has(level.id));
  document.getElementById('adv-map-summary').textContent = nextLevel
    ? '已通關 ' + completed.size + ' / ' + ADVENTURE_LEVELS.length + ' 關。' + advHeroSummary(progress) + '。下一個目標：' + nextLevel.mapLabel + ' ' + nextLevel.name + '。'
    : '全部 ' + ADVENTURE_LEVELS.length + ' 關都已通關。' + advHeroSummary(progress) + '。可以回頭重打已解鎖關卡。';

  for (const chapter of ADVENTURE_CHAPTERS) {
    const chapterLevels = ADVENTURE_LEVELS.filter(level => level.chapterId === chapter.id);
    const entryLevel = chapterLevels[0];
    if (!entryLevel) continue;
    const unlocked = isAdventureLevelUnlocked(entryLevel.id, progress);
    const isCompleted = chapterLevels.every(level => completed.has(level.id));
    const isActive = activeLevel && activeLevel.chapterId === chapter.id;
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'adv-map-node chapter-entry ' + (isCompleted ? 'completed ' : '') + (unlocked ? 'available ' : 'locked ') + (isActive ? 'ongoing ' : '') + (entryLevel.chapterIdx === ADVENTURE_CHAPTERS.length - 1 ? 'final' : '');
    node.disabled = !unlocked;
    node.dataset.levelId = entryLevel.id;
    node.onclick = e => {
      e.stopPropagation();
      startAdventureLevel(entryLevel.id);
    };
    const [mapX, mapY] = advMapPositionForChapter(entryLevel.chapterIdx);
    node.style.setProperty('--map-x', mapX + '%');
    node.style.setProperty('--map-y', mapY + '%');

    const badge = document.createElement('span');
    badge.className = 'adv-node-badge';
    badge.textContent = isCompleted ? '✓' : entryLevel.mapLabel;

    const main = document.createElement('span');
    main.className = 'adv-node-main';
    const title = document.createElement('b');
    title.textContent = '第 ' + (entryLevel.chapterIdx + 1) + ' 章：' + chapter.title;
    const meta = document.createElement('span');
    meta.textContent = '入口：' + entryLevel.mapLabel + ' ' + entryLevel.name + '　章節進度 ' + chapterLevels.filter(level => completed.has(level.id)).length + ' / ' + chapterLevels.length;
    main.append(title, meta);

    const state = document.createElement('span');
    state.className = 'adv-node-state';
    state.textContent = isActive ? '戰鬥中' : isCompleted ? '已通關' : unlocked ? '可進入' : '未解鎖';
    const label = '第 ' + (entryLevel.chapterIdx + 1) + ' 章：' + chapter.title + '，入口接到 ' + entryLevel.mapLabel + ' ' + entryLevel.name + '，' + state.textContent;
    node.title = label;
    node.setAttribute('aria-label', label);

    node.append(badge, main, state);
    path.appendChild(node);
  }
}
function showAdventureMap() {
  clearTimeout(advAdvanceTimer);
  advAdvancing = false;
  clearAdvStageMotion();
  if (adv && adv.monsterHp > 0 && !over && isValidAdventureGrid(grid, COLS, ROWS)) saveAdventure();
  sel = [];
  setAdventureView('map');
  if (grid.length === COLS) { render(); updateCurrent(); }
  renderAdvMap();
  setBgmThemeForLevel(storyChapterForProgress(advBestProgress()));
}
function makeAdventureState(level, options = {}) {
  const progress = advBestProgress();
  const playerMaxHp = progress.heroMaxHp;
  let playerHp = playerMaxHp;
  if (Number.isFinite(Number(options.playerHp))) {
    const previousMaxHp = Number.isFinite(Number(options.playerMaxHp)) && Number(options.playerMaxHp) > 0
      ? Number(options.playerMaxHp)
      : playerMaxHp;
    playerHp = Number(options.playerHp);
    if (playerMaxHp > previousMaxHp) playerHp += playerMaxHp - previousMaxHp;
    playerHp = clampedAdventureHp(playerHp, playerMaxHp);
  }
  return {
    levelId: level.id,
    levelIdx: level.globalIdx,
    chapterIdx: level.chapterIdx,
    monsterIdx: level.levelIdx,
    playerHp,
    playerMaxHp,
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
  const canResume = adv && adv.levelId === levelId && adv.monsterHp > 0 && isValidAdventureGrid(grid, COLS, ROWS);
  if (level.id === 'final-type-golem' && !canResume && !options.skipFinalBossIntro) {
    openAdventureFinalBossIntro(() => startAdventureLevel(levelId, { ...options, skipFinalBossIntro: true }));
    return;
  }
  if (!canResume) {
    localStorage.removeItem(ADV_SAVE_KEY);
    adv = makeAdventureState(level, options);
    freshBoardAdventure();
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
  freshBoardAdventure(); render(); updateCurrent(); setFace('normal');
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
    ? (' EXP +' + clearResult.expGained + '。' + (clearResult.levelsGained ? 'Lex 升到 Lv.' + progress.heroLevel + '，Max HP ' + progress.heroMaxHp + '，HP 回滿。' : ''))
    : (clearResult.alreadyCompleted ? ' 已通關關卡不再獲得 EXP。' : '');
  if (nextLevel) {
    renderAdvHud();
    beginAdvAdvance(nextLevel);
    const transitionOptions = {
      fromAdvance: true,
      playerHp: adv.playerHp,
      playerMaxHp: adv.playerMaxHp,
    };
    const isChapterTransition = nextLevel.chapterId !== level.chapterId;
    toast(
      '打倒 ' + defeatedName + '！' + expText + rewardText +
      (isChapterTransition ? '閱讀下一章分鏡後前往：' : '前往下一戰：') + nextLevel.name,
      2800
    );
    advAdvanceTimer = setTimeout(() => {
      if (isChapterTransition) {
        openAdventureLevelComic(nextLevel, () => startAdventureLevel(nextLevel.id, transitionOptions));
      } else {
        startAdventureLevel(nextLevel.id, transitionOptions);
      }
    }, ADV_ADVANCE_MS);
    return;
  }
  renderAdvHud();
  toast('🎉 所有關卡都通關了！' + expText + rewardText + '閱讀結局後回到地圖。', 3200);
  advAdvanceTimer = setTimeout(() => {
    openAdventureEnding(() => {
      advAdvancing = false;
      clearAdvStageMotion();
      showAdventureMap();
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
    freshBoardAdventure();
  }
  if (grid.length !== COLS) freshBoardAdventure();
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
  tickNegativeTiles();

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
document.getElementById('adv-story-open').onclick = () => openAdventureStoryFromMap();
document.getElementById('adv-map-path').onclick = e => {
  let node = e.target.closest('.adv-map-node');
  if (!node) {
    const candidates = [...document.querySelectorAll('.adv-map-node:not(:disabled)')];
    let nearest = null;
    let nearestDistance = Infinity;
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    node = nearestDistance <= 72 ? nearest : null;
  }
  if (!node || node.disabled) return;
  startAdventureLevel(node.dataset.levelId);
};
document.getElementById('adv-map-reset').onclick = restartAdventureGame;
document.getElementById('adv-battle-reset').onclick = restartAdventureGame;
document.getElementById('adv-back-map').onclick = showAdventureMap;
document.getElementById('adv-story-close').onclick = closeStoryModal;
document.getElementById('adv-story-modal').onclick = e => {
  if (e.currentTarget.classList.contains('has-ending-slides')) {
    advanceStorySlide();
    return;
  }
  const clickAnywhereToClose = e.currentTarget.classList.contains('has-comic') && !e.currentTarget.classList.contains('show-paragraphs');
  if (clickAnywhereToClose || e.target.id === 'adv-story-modal') closeStoryModal();
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
  if (advStorySlides && !e.repeat && advanceStorySlide()) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') closeStoryModal();
});
