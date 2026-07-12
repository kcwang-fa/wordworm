(() => {
  const SAVE_KEY = profileStorageKey('wordworm_kids_save_v1');
  const VOLUME_KEY = profileStorageKey('wordworm_kids_volume');
  const WORDS_URL = 'data/kids-words.json';
  const THEME_ORDER = ['animals', 'food', 'home', 'body', 'nature', 'traffic'];
  const STICKER_POOL = ['⭐', '🌈', '🍀', '🎈', '💎', '🌟', '🎀', '🧩', '🍄', '🎵', '🏵️', '🪁'];
  const THEME_STICKERS = {
    animals: '🐾',
    food: '🍽️',
    home: '🏠',
    body: '🙂',
    nature: '🌿',
    traffic: '🛞',
  };
  const DISTRACTOR_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  let kidsWords = [];
  let kidsReady = null;
  let state = null;
  let current = null;
  let filledSlots = [];
  let kidsVolume = Number(localStorage.getItem(VOLUME_KEY));
  if (!Number.isFinite(kidsVolume)) kidsVolume = 0.85;
  let holdTimer = null;
  let nextTimer = null;
  let kidsSpeechPrimed = false;
  let kidsPendingSpeak = false;
  let kidsVoices = [];

  const el = {
    hud: document.getElementById('kids-hud'),
    themeIcon: document.getElementById('kids-theme-icon'),
    picture: document.getElementById('kids-picture'),
    slots: document.getElementById('kids-slots'),
    bank: document.getElementById('kids-letter-bank'),
    worm: document.getElementById('kids-worm'),
    speak: document.getElementById('kids-speak'),
    stickerOpen: document.getElementById('kids-sticker-open'),
    settingsHold: document.getElementById('kids-settings-hold'),
    stickerbook: document.getElementById('kids-stickerbook'),
    stickerClose: document.getElementById('kids-sticker-close'),
    stickerGrid: document.getElementById('kids-sticker-grid'),
    parentPanel: document.getElementById('kids-parent-panel'),
    parentClose: document.getElementById('kids-parent-close'),
    volume: document.getElementById('kids-volume'),
    reset: document.getElementById('kids-reset'),
  };

  function shuffleList(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved || typeof saved !== 'object') throw new Error('bad save');
      return {
        currentTheme: THEME_ORDER.includes(saved.currentTheme) ? saved.currentTheme : THEME_ORDER[0],
        completedWords: Array.isArray(saved.completedWords) ? [...new Set(saved.completedWords.filter(Boolean))] : [],
        wormSegments: Array.isArray(saved.wormSegments) ? saved.wormSegments.filter(seg => seg && seg.id && seg.icon && seg.word) : [],
        stickers: Array.isArray(saved.stickers) ? saved.stickers.filter(sticker => sticker && sticker.id && sticker.icon) : [],
      };
    } catch {
      return { currentTheme: THEME_ORDER[0], completedWords: [], wormSegments: [], stickers: [] };
    }
  }

  function saveState() {
    if (!state) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function loadKidsWords() {
    if (!kidsReady) {
      const wordsUrl = typeof versionedAssetUrl === 'function' ? versionedAssetUrl(WORDS_URL) : WORDS_URL;
      kidsReady = fetch(wordsUrl, { cache: 'no-cache' })
        .then(r => {
          if (!r.ok) throw new Error('kids words failed');
          return r.json();
        })
        .then(words => {
          kidsWords = words
            .filter(item => item && typeof item.word === 'string' && /^[a-z]{3}$/.test(item.word))
            .map(item => ({ ...item, word: item.word.toLowerCase() }));
          if (kidsWords.length < 1) throw new Error('empty kids words');
          return kidsWords;
        });
    }
    return kidsReady;
  }

  function wordsForTheme(theme) {
    return kidsWords.filter(item => item.theme === theme);
  }

  function chooseThemeWithWords() {
    const currentThemeWords = wordsForTheme(state.currentTheme);
    if (currentThemeWords.some(item => !state.completedWords.includes(item.id))) return state.currentTheme;
    const nextTheme = THEME_ORDER.find(theme => wordsForTheme(theme).some(item => !state.completedWords.includes(item.id)));
    if (nextTheme) return nextTheme;
    return state.currentTheme || THEME_ORDER[0];
  }

  function chooseNextWord() {
    state.currentTheme = chooseThemeWithWords();
    let candidates = wordsForTheme(state.currentTheme).filter(item => !state.completedWords.includes(item.id));
    if (!candidates.length) candidates = wordsForTheme(state.currentTheme);
    if (!candidates.length) candidates = kidsWords;
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    const letters = item.word.split('');
    const blockers = new Set(letters);
    const distractors = [];
    while (distractors.length < 2) {
      const letter = DISTRACTOR_LETTERS[Math.floor(Math.random() * DISTRACTOR_LETTERS.length)];
      if (blockers.has(letter) || distractors.includes(letter)) continue;
      distractors.push(letter);
    }
    current = {
      item,
      options: shuffleList([...letters, ...distractors].map((letter, idx) => ({ id: item.id + '-' + idx, letter }))),
    };
    filledSlots = Array(letters.length).fill(false);
    saveState();
  }

  function renderSlots() {
    el.slots.innerHTML = '';
    const letters = current.item.word.toUpperCase().split('');
    for (let i = 0; i < letters.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'kids-slot';
      slot.textContent = filledSlots[i] ? letters[i] : '';
      if (filledSlots[i]) slot.classList.add('filled');
      el.slots.appendChild(slot);
    }
  }

  function renderLetters() {
    el.bank.innerHTML = '';
    for (const option of current.options) {
      const btn = document.createElement('button');
      btn.className = 'kids-letter';
      btn.type = 'button';
      btn.textContent = option.letter.toUpperCase();
      btn.dataset.letter = option.letter;
      btn.dataset.optionId = option.id;
      btn.setAttribute('aria-label', option.letter.toUpperCase());
      btn.addEventListener('click', () => pickLetter(btn));
      el.bank.appendChild(btn);
    }
  }

  function renderQuestion() {
    if (!current) return;
    el.themeIcon.textContent = current.item.themeIcon || THEME_STICKERS[current.item.theme] || '🐛';
    el.picture.textContent = current.item.icon;
    el.picture.setAttribute('aria-label', current.item.word);
    renderSlots();
    renderLetters();
    el.hud.classList.remove('kids-eating');
    window.clearTimeout(nextTimer);
    nextTimer = window.setTimeout(() => speakCurrentWord(), 260);
  }

  function renderWorm() {
    el.worm.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'kids-worm-head';
    head.innerHTML = '<span class="kids-worm-eye"></span><span class="kids-worm-eye"></span>';
    el.worm.appendChild(head);

    for (const segment of state.wormSegments.slice(-18).reverse()) {
      const body = document.createElement('div');
      body.className = 'kids-worm-segment';
      body.textContent = segment.icon;
      body.title = segment.word;
      el.worm.appendChild(body);
    }
  }

  function renderStickerBook() {
    el.stickerGrid.innerHTML = '';
    const stickers = state.stickers.length ? state.stickers : [{ id: 'empty', icon: '✨' }];
    for (const sticker of stickers) {
      const cell = document.createElement('div');
      cell.className = 'kids-sticker';
      cell.textContent = sticker.icon;
      cell.title = sticker.label || '';
      el.stickerGrid.appendChild(cell);
    }
  }

  function kidsTone(freq, dur = 0.08, type = 'sine', vol = 0.16, when = 0) {
    if (typeof muted !== 'undefined' && muted) return;
    if (typeof playTone === 'function') playTone(freq, dur, type, vol * kidsVolume, when);
  }

  function popSound() {
    kidsTone(410, 0.055, 'sine', 0.12);
    kidsTone(560, 0.06, 'sine', 0.09, 0.035);
  }

  function celebrateSound() {
    [523, 659, 784, 988].forEach((freq, idx) => kidsTone(freq, 0.12, 'triangle', 0.13, idx * 0.06));
  }

  function refreshKidsVoices() {
    if (!('speechSynthesis' in window)) return [];
    kidsVoices = speechSynthesis.getVoices();
    return kidsVoices;
  }

  function bestKidsVoice() {
    const voices = kidsVoices.length ? kidsVoices : refreshKidsVoices();
    return voices.find(v => v.lang === 'en-US') || voices.find(v => /^en[-_]/i.test(v.lang)) || null;
  }

  function speakCurrentWord(options = {}) {
    if (!current || !('speechSynthesis' in window)) return;
    if (!options.force && !kidsSpeechPrimed) {
      kidsPendingSpeak = true;
      return;
    }
    kidsPendingSpeak = false;
    const utter = new SpeechSynthesisUtterance(current.item.word);
    utter.lang = 'en-US';
    utter.rate = 0.8;
    utter.pitch = 1.08;
    utter.volume = kidsVolume;
    utter.voice = bestKidsVoice();
    try {
      speechSynthesis.cancel();
      if (typeof speechSynthesis.resume === 'function') speechSynthesis.resume();
      speechSynthesis.speak(utter);
    } catch (e) {
      kidsPendingSpeak = true;
    }
  }

  function primeKidsSpeech() {
    kidsSpeechPrimed = true;
    refreshKidsVoices();
    if (kidsPendingSpeak) speakCurrentWord({ force: true });
  }

  function speakFromPress(event) {
    event.preventDefault();
    kidsSpeechPrimed = true;
    speakCurrentWord({ force: true });
  }

  function pickLetter(btn) {
    if (!current || btn.disabled || el.hud.classList.contains('kids-eating')) return;
    const letter = btn.dataset.letter;
    const letters = current.item.word.split('');
    const targetIndex = letters.findIndex((ch, idx) => ch === letter && !filledSlots[idx]);
    if (targetIndex === -1) {
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
      popSound();
      return;
    }

    filledSlots[targetIndex] = true;
    btn.disabled = true;
    btn.classList.add('correct');
    popSound();
    renderSlots();
    if (filledSlots.every(Boolean)) {
      window.setTimeout(completeWord, 420);
    }
  }

  function addSticker(sticker) {
    if (state.stickers.some(item => item.id === sticker.id)) return;
    state.stickers.push(sticker);
  }

  function unlockRewards(item) {
    const count = state.wormSegments.length;
    if (count > 0 && count % 5 === 0) {
      const icon = STICKER_POOL[Math.floor((count / 5 - 1) % STICKER_POOL.length)];
      addSticker({ id: 'milestone-' + count, icon, label: count + ' words' });
    }

    const themeWords = wordsForTheme(item.theme);
    const themeDone = themeWords.length && themeWords.every(word => state.completedWords.includes(word.id));
    if (themeDone) {
      addSticker({ id: 'theme-' + item.theme, icon: THEME_STICKERS[item.theme] || item.themeIcon || '🏵️', label: item.theme });
    }
  }

  function completeWord() {
    if (!current) return;
    const item = current.item;
    speakCurrentWord({ force: true });
    el.hud.classList.add('kids-eating');
    if (!state.completedWords.includes(item.id)) state.completedWords.push(item.id);
    state.wormSegments.push({ id: item.id + '-' + Date.now(), word: item.word, icon: item.icon });
    unlockRewards(item);
    saveState();
    renderWorm();
    renderStickerBook();
    celebrateSound();
    confetti();
    nextTimer = window.setTimeout(() => {
      chooseNextWord();
      renderQuestion();
    }, 1700);
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'kids-confetti';
    for (let i = 0; i < 32; i++) {
      const piece = document.createElement('i');
      piece.style.left = (8 + Math.random() * 84) + '%';
      piece.style.setProperty('--delay', (Math.random() * 0.18).toFixed(3) + 's');
      piece.style.setProperty('--x', (Math.random() * 90 - 45).toFixed(1) + 'px');
      piece.style.setProperty('--rot', (Math.random() * 360).toFixed(1) + 'deg');
      piece.style.background = ['#ff7a90', '#ffd166', '#8bd450', '#58c4ff', '#b48cff'][i % 5];
      box.appendChild(piece);
    }
    document.body.appendChild(box);
    window.setTimeout(() => box.remove(), 1300);
  }

  async function initKidsMode(fromSave = true) {
    document.body.classList.remove('daily-view-entry', 'daily-view-play', 'daily-view-locked', 'adv-view-map', 'adv-view-battle');
    document.getElementById('gameover').classList.remove('show');
    document.getElementById('daily-gameover').classList.remove('show');
    document.getElementById('daily-rules').classList.remove('show');
    document.getElementById('adv-gameover').classList.remove('show');
    closeKidsPanels();
    if (typeof setBgmTheme === 'function') setBgmTheme('classic');
    state = fromSave ? readState() : { currentTheme: THEME_ORDER[0], completedWords: [], wormSegments: [], stickers: [] };
    el.volume.value = kidsVolume;
    el.picture.textContent = '🐛';
    el.slots.innerHTML = '';
    el.bank.innerHTML = '';
    await loadKidsWords();
    renderWorm();
    renderStickerBook();
    chooseNextWord();
    renderQuestion();
  }

  function openStickerBook() {
    renderStickerBook();
    el.stickerbook.hidden = false;
    el.stickerbook.classList.add('show');
  }

  function openParentPanel() {
    el.parentPanel.hidden = false;
    el.parentPanel.classList.add('show');
  }

  function closeKidsPanels() {
    for (const panel of [el.stickerbook, el.parentPanel]) {
      if (!panel) continue;
      panel.classList.remove('show');
      panel.hidden = true;
    }
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = null;
    if (el.settingsHold) el.settingsHold.classList.remove('holding');
  }

  function resetKidsProgress() {
    if (!confirm('確定要重設小書蟲進度嗎？貼紙和書蟲身體都會清空。')) return;
    localStorage.removeItem(SAVE_KEY);
    state = { currentTheme: THEME_ORDER[0], completedWords: [], wormSegments: [], stickers: [] };
    closeKidsPanels();
    renderWorm();
    renderStickerBook();
    chooseNextWord();
    renderQuestion();
  }

  if ('speechSynthesis' in window) {
    refreshKidsVoices();
    if (typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', refreshKidsVoices);
    } else {
      speechSynthesis.onvoiceschanged = refreshKidsVoices;
    }
  }
  document.addEventListener('pointerdown', primeKidsSpeech, { capture: true });
  el.picture.addEventListener('pointerdown', speakFromPress);
  el.speak.addEventListener('pointerdown', speakFromPress);
  el.stickerOpen.addEventListener('click', openStickerBook);
  el.stickerClose.addEventListener('click', closeKidsPanels);
  el.parentClose.addEventListener('click', closeKidsPanels);
  el.stickerbook.addEventListener('click', e => { if (e.target === el.stickerbook) closeKidsPanels(); });
  el.parentPanel.addEventListener('click', e => { if (e.target === el.parentPanel) closeKidsPanels(); });
  el.volume.addEventListener('input', () => {
    kidsVolume = Number(el.volume.value);
    localStorage.setItem(VOLUME_KEY, String(kidsVolume));
  });
  el.reset.addEventListener('click', resetKidsProgress);
  el.settingsHold.addEventListener('contextmenu', e => e.preventDefault());
  el.settingsHold.addEventListener('pointerdown', () => {
    el.settingsHold.classList.add('holding');
    holdTimer = window.setTimeout(openParentPanel, 3000);
  });
  for (const eventName of ['pointerup', 'pointerleave', 'pointercancel']) {
    el.settingsHold.addEventListener(eventName, () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = null;
      el.settingsHold.classList.remove('holding');
    });
  }

  window.initKidsMode = initKidsMode;
  window.closeKidsPanels = closeKidsPanels;

  if (typeof gameMode !== 'undefined' && gameMode === 'kids' && !document.body.classList.contains('home-screen')) {
    initKidsMode(true);
  }
})();
