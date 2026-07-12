/* ================= 每日單字（Word of the Day） =================
 * 獨立於「每日挑戰」模式：只讀 data/daily-words.json、使用 speechSynthesis、
 * 並把收藏存在目前玩家的 ww_favorite_words。不得連網，也不碰遊戲存檔。
 */

const WOTD_WORDS_URL = 'data/daily-words.json';
const WOTD_FAVORITES_KEY = profileStorageKey('ww_favorite_words');
const WOTD_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let wotdWords = [];
let wotdByWord = new Map();
let wotdTodayWord = null;
let wotdLoadPromise = null;

const wotdEls = {
  open: document.getElementById('wotd-open'),
  bookOpen: document.getElementById('wordbook-open'),
  modal: document.getElementById('wotd-modal'),
  card: document.getElementById('wotd-card'),
  close: document.getElementById('wotd-close'),
  loading: document.getElementById('wotd-loading'),
  content: document.getElementById('wotd-content'),
  date: document.getElementById('wotd-date'),
  word: document.getElementById('wotd-word'),
  ipa: document.getElementById('wotd-ipa'),
  pos: document.getElementById('wotd-pos'),
  zh: document.getElementById('wotd-zh'),
  en: document.getElementById('wotd-en'),
  academic: document.getElementById('wotd-academic'),
  life: document.getElementById('wotd-life'),
  speakWord: document.getElementById('wotd-speak-word'),
  speakAcademic: document.getElementById('wotd-speak-academic'),
  speakLife: document.getElementById('wotd-speak-life'),
  favorite: document.getElementById('wotd-favorite'),
  bookModal: document.getElementById('wordbook-modal'),
  bookClose: document.getElementById('wordbook-close'),
  bookEmpty: document.getElementById('wordbook-empty'),
  bookList: document.getElementById('wordbook-list'),
};

function wotdLocalDateString() {
  const override = new URLSearchParams(location.search).get('wotddate') || window.WOTD_DATE_OVERRIDE;
  if (override && WOTD_DATE_RE.test(override)) return override;
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function wotdHash(str) {
  // FNV-1a 32-bit：同一日期字串永遠得到同一個索引。
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function wotdPickForDate(dateStr) {
  if (!wotdWords.length) return null;
  return wotdWords[wotdHash(dateStr) % wotdWords.length];
}

function wotdIsSpeechSupported() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function wotdApplySpeechSupport() {
  document.body.classList.toggle('no-speech', !wotdIsSpeechSupported());
}

function wotdSpeak(text) {
  if (!text || !wotdIsSpeechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = text.length > 28 ? 0.92 : 0.88;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function wotdNormalizeWord(word) {
  return String(word || '').trim().toLowerCase();
}

function wotdLoadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(WOTD_FAVORITES_KEY));
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw
      .map(wotdNormalizeWord)
      .filter(w => w && !seen.has(w) && seen.add(w));
  } catch (e) {
    return [];
  }
}

function wotdSaveFavorites(words) {
  try { localStorage.setItem(WOTD_FAVORITES_KEY, JSON.stringify(words)); }
  catch (e) { /* localStorage 滿了或被停用時，不阻斷單字卡 */ }
}

function wotdIsFavorite(word) {
  return wotdLoadFavorites().includes(wotdNormalizeWord(word));
}

function wotdSetFavorite(word, enabled) {
  const key = wotdNormalizeWord(word);
  if (!key) return;
  const favorites = wotdLoadFavorites().filter(w => w !== key);
  if (enabled) favorites.push(key);
  wotdSaveFavorites(favorites);
}

function wotdUpdateFavoriteButton() {
  if (!wotdTodayWord) return;
  const active = wotdIsFavorite(wotdTodayWord.word);
  wotdEls.favorite.textContent = active ? '★' : '☆';
  wotdEls.favorite.classList.toggle('active', active);
  wotdEls.favorite.setAttribute('aria-pressed', active ? 'true' : 'false');
  wotdEls.favorite.title = active ? '取消收藏' : '收藏單字';
}

function wotdSafeText(value, fallback = '—') {
  const text = String(value || '').trim();
  return text || fallback;
}

function wotdEscapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wotdRenderCard(item) {
  wotdTodayWord = item;
  wotdEls.loading.hidden = true;
  wotdEls.content.hidden = false;
  wotdEls.date.textContent = wotdLocalDateString();
  wotdEls.word.textContent = wotdSafeText(item.word);
  wotdEls.ipa.textContent = wotdSafeText(item.ipa);
  wotdEls.pos.textContent = wotdSafeText(item.pos);
  wotdEls.zh.textContent = wotdSafeText(item.zh);
  wotdEls.en.textContent = wotdSafeText(item.en || item.definition);
  wotdEls.academic.textContent = wotdSafeText(item.academic_example || item.example);
  wotdEls.life.textContent = wotdSafeText(item.life_example || item.example);
  wotdUpdateFavoriteButton();
}

function wotdShowLoading() {
  wotdEls.loading.hidden = false;
  wotdEls.loading.textContent = '每日單字載入中…';
  wotdEls.content.hidden = true;
}

function wotdShowError() {
  wotdEls.loading.hidden = false;
  wotdEls.loading.textContent = '每日單字載入失敗，請確認 data/daily-words.json 有隨網頁一起部署。';
  wotdEls.content.hidden = true;
}

function wotdValidateItem(item) {
  return item && typeof item.word === 'string' && item.word.trim()
    && typeof item.ipa === 'string'
    && typeof item.pos === 'string'
    && typeof item.zh === 'string'
    && (typeof item.en === 'string' || typeof item.definition === 'string')
    && (typeof item.academic_example === 'string' || typeof item.example === 'string')
    && (typeof item.life_example === 'string' || typeof item.example === 'string');
}

function wotdLoadWords() {
  if (wotdLoadPromise) return wotdLoadPromise;
  const wordsUrl = typeof versionedAssetUrl === 'function' ? versionedAssetUrl(WOTD_WORDS_URL) : WOTD_WORDS_URL;
  wotdLoadPromise = fetch(wordsUrl, { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error('data/daily-words.json HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('data/daily-words.json must be an array');
      const seen = new Set();
      wotdWords = data.filter(item => {
        if (!wotdValidateItem(item)) return false;
        const key = wotdNormalizeWord(item.word);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      wotdByWord = new Map(wotdWords.map(item => [wotdNormalizeWord(item.word), item]));
      if (!wotdWords.length) throw new Error('data/daily-words.json has no valid words');
      return wotdWords;
    });
  return wotdLoadPromise;
}

function wotdOpenCard() {
  wotdApplySpeechSupport();
  wotdEls.modal.hidden = false;
  wotdEls.modal.classList.add('show');
  wotdShowLoading();
  wotdLoadWords()
    .then(() => wotdRenderCard(wotdPickForDate(wotdLocalDateString())))
    .catch(() => wotdShowError());
}

function wotdCloseCard() {
  if (wotdIsSpeechSupported()) window.speechSynthesis.cancel();
  wotdEls.modal.classList.remove('show');
  wotdEls.modal.hidden = true;
}

function wotdOpenBook() {
  wotdApplySpeechSupport();
  wotdEls.bookModal.hidden = false;
  wotdEls.bookModal.classList.add('show');
  wotdRenderBook();
  wotdLoadWords().then(() => wotdRenderBook()).catch(() => wotdRenderBook());
}

function wotdCloseBook() {
  if (wotdIsSpeechSupported()) window.speechSynthesis.cancel();
  wotdEls.bookModal.classList.remove('show');
  wotdEls.bookModal.hidden = true;
}

function wotdBookItemHtml(item) {
  const word = wotdEscapeHtml(wotdSafeText(item.word));
  const rawWord = wotdEscapeHtml(wotdSafeText(item.word));
  const ipa = wotdEscapeHtml(wotdSafeText(item.ipa));
  const pos = wotdEscapeHtml(wotdSafeText(item.pos));
  const zh = wotdEscapeHtml(wotdSafeText(item.zh));
  const en = wotdEscapeHtml(wotdSafeText(item.en || item.definition));
  const academic = wotdEscapeHtml(wotdSafeText(item.academic_example || item.example));
  const life = wotdEscapeHtml(wotdSafeText(item.life_example || item.example));
  return '<article class="wordbook-item" data-word="' + rawWord + '">' +
    '<div class="wordbook-head">' +
      '<div><h3>' + word + '</h3><div class="word-meta"><span>' + ipa + '</span><span>' + pos + '</span></div></div>' +
      '<div class="wordbook-actions">' +
        '<button class="icon-btn speech-only" data-speak="' + rawWord + '" type="button" title="朗讀單字" aria-label="朗讀單字">🔊</button>' +
        '<button class="icon-btn remove-word" data-remove="' + rawWord + '" type="button" title="移除收藏" aria-label="移除收藏">✕</button>' +
      '</div>' +
    '</div>' +
    '<dl class="word-defs compact">' +
      '<div><dt>中文</dt><dd>' + zh + '</dd></div>' +
      '<div><dt>English</dt><dd>' + en + '</dd></div>' +
    '</dl>' +
    '<div class="word-example compact"><div class="word-example-label">Academic</div><p>' + academic + '</p><button class="mini-speak speech-only" data-speak="' + academic + '" type="button" title="朗讀學術例句" aria-label="朗讀學術例句">🔊</button></div>' +
    '<div class="word-example compact"><div class="word-example-label">Everyday</div><p>' + life + '</p><button class="mini-speak speech-only" data-speak="' + life + '" type="button" title="朗讀生活例句" aria-label="朗讀生活例句">🔊</button></div>' +
  '</article>';
}

function wotdPlaceholderItem(word) {
  return {
    word,
    ipa: '—',
    pos: '—',
    zh: '資料載入後會顯示中文解釋',
    en: 'The word data is still loading.',
    academic_example: 'The word data is still loading.',
    life_example: 'The word data is still loading.',
  };
}

function wotdRenderBook() {
  const favorites = wotdLoadFavorites().slice().reverse();
  wotdEls.bookEmpty.hidden = favorites.length > 0;
  wotdEls.bookList.innerHTML = favorites
    .map(word => wotdBookItemHtml(wotdByWord.get(word) || wotdPlaceholderItem(word)))
    .join('');
}

wotdEls.open.onclick = wotdOpenCard;
wotdEls.bookOpen.onclick = wotdOpenBook;
wotdEls.close.onclick = wotdCloseCard;
wotdEls.bookClose.onclick = wotdCloseBook;
wotdEls.modal.onclick = e => { if (e.target === wotdEls.modal) wotdCloseCard(); };
wotdEls.bookModal.onclick = e => { if (e.target === wotdEls.bookModal) wotdCloseBook(); };
wotdEls.speakWord.onclick = () => wotdSpeak(wotdTodayWord && wotdTodayWord.word);
wotdEls.speakAcademic.onclick = () => wotdSpeak(wotdEls.academic.textContent);
wotdEls.speakLife.onclick = () => wotdSpeak(wotdEls.life.textContent);
wotdEls.favorite.onclick = () => {
  if (!wotdTodayWord) return;
  wotdSetFavorite(wotdTodayWord.word, !wotdIsFavorite(wotdTodayWord.word));
  wotdUpdateFavoriteButton();
};
wotdEls.bookList.onclick = e => {
  const speak = e.target.closest('[data-speak]');
  if (speak) {
    wotdSpeak(speak.dataset.speak);
    return;
  }
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    wotdSetFavorite(remove.dataset.remove, false);
    wotdRenderBook();
    wotdUpdateFavoriteButton();
  }
};
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  wotdCloseCard();
  wotdCloseBook();
});

wotdApplySpeechSupport();
wotdLoadWords()
  .then(() => { wotdTodayWord = wotdPickForDate(wotdLocalDateString()); })
  .catch(() => { /* 入口打開時會顯示明確錯誤 */ });
