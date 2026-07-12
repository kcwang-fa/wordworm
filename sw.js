importScripts('./js/version.js');

const WORDWORM_SW_VERSION = self.WORDWORM_VERSION || 'dev';
const CACHE_NAME = 'wordworm-pwa-' + WORDWORM_SW_VERSION;

function versioned(url) {
  return url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(WORDWORM_SW_VERSION);
}

function versionedCacheRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search) return null;
  url.searchParams.set('v', WORDWORM_SW_VERSION);
  return new Request(url.href, { credentials: request.credentials });
}

const PRECACHE_URLS = [
  './',
  './index.html',
  versioned('./manifest.webmanifest'),
  versioned('./apple-touch-icon.png'),
  versioned('./favicon.ico'),
  versioned('./css/base.css'),
  versioned('./css/adventure.css'),
  versioned('./css/board.css'),
  versioned('./css/gameover.css'),
  versioned('./css/daily-kids.css'),
  versioned('./css/word-of-day.css'),
  versioned('./js/version.js'),
  versioned('./js/game-profile.js'),
  versioned('./js/story.js'),
  versioned('./js/adventure-data.js'),
  versioned('./js/daily.js'),
  versioned('./js/game-core.js'),
  versioned('./js/game-audio.js'),
  versioned('./js/game-save.js'),
  versioned('./js/game-board.js'),
  versioned('./js/game-classic.js'),
  versioned('./js/game-adventure.js'),
  versioned('./js/game-adventure-map.js'),
  versioned('./js/game-sync.js'),
  versioned('./js/game-boot.js'),
  versioned('./js/kids.js'),
  versioned('./js/word-of-day.js'),
  versioned('./enable1.txt'),
  versioned('./modern-words.txt'),
  versioned('./extra-words.txt'),
  versioned('./data/daily-words.json'),
  versioned('./data/kids-words.json'),
  versioned('./assets/icons/apple-touch-icon.png'),
  versioned('./assets/icons/icon-192.png'),
  versioned('./assets/icons/icon-512.png'),
  versioned('./assets/icons/maskable-icon-512.png'),
  versioned('./assets/home-cover.png'),
  versioned('./assets/library-background-gpt.png'),
  versioned('./assets/maps/adventure-map.png'),
  versioned('./assets/characters/bookworm-hero.png'),
  versioned('./assets/characters/enemy-blob.png'),
  versioned('./assets/characters/enemy-book-boss.png'),
  versioned('./assets/characters/enemy-critter.png'),
  versioned('./assets/stages/dusty-library-far.png'),
  versioned('./assets/stages/dusty-library-mid.png'),
  versioned('./assets/stages/dusty-library-ground.png'),
  versioned('./assets/stages/ink-gallery-far.png'),
  versioned('./assets/stages/ink-gallery-mid.png'),
  versioned('./assets/stages/ink-gallery-ground.png'),
  versioned('./assets/stages/crooked-fairytale-far.png'),
  versioned('./assets/stages/crooked-fairytale-mid.png'),
  versioned('./assets/stages/crooked-fairytale-ground.png'),
  versioned('./assets/stages/star-chart-room-far.png'),
  versioned('./assets/stages/star-chart-room-mid.png'),
  versioned('./assets/stages/star-chart-room-ground.png'),
  versioned('./assets/stages/forbidden-greenhouse-far.png'),
  versioned('./assets/stages/forbidden-greenhouse-mid.png'),
  versioned('./assets/stages/forbidden-greenhouse-ground.png'),
  versioned('./assets/stages/storm-index-harbor-far.png'),
  versioned('./assets/stages/storm-index-harbor-mid.png'),
  versioned('./assets/stages/storm-index-harbor-ground.png'),
  versioned('./assets/stages/living-type-core-far.png'),
  versioned('./assets/stages/living-type-core-mid.png'),
  versioned('./assets/stages/living-type-core-ground.png'),
  versioned('./assets/story/intro-1-library.png'),
  versioned('./assets/story/intro-2-crack.png'),
  versioned('./assets/story/intro-3-spell.png'),
  versioned('./assets/story/intro-comic-fixed.png'),
  versioned('./assets/story/chapter-1-library.png'),
  versioned('./assets/story/chapter-1-paper-mouse.png'),
  versioned('./assets/story/chapter-1-catalog-repair.png'),
  versioned('./assets/story/chapter-1-comic.png'),
  versioned('./assets/story/chapter-2-ink-gallery.png'),
  versioned('./assets/story/chapter-2-missing-word-ghost.png'),
  versioned('./assets/story/chapter-2-index-repair.png'),
  versioned('./assets/story/chapter-3-fairytale-chaos.png'),
  versioned('./assets/story/chapter-3-paper-queen.png'),
  versioned('./assets/story/chapter-3-story-order.png'),
  versioned('./assets/story/chapter-4-star-room.png'),
  versioned('./assets/story/chapter-4-observatory-golem.png'),
  versioned('./assets/story/chapter-4-star-map.png'),
  versioned('./assets/story/chapter-5-greenhouse.png'),
  versioned('./assets/story/chapter-5-mandrake.png'),
  versioned('./assets/story/chapter-5-trim-growth.png'),
  versioned('./assets/story/chapter-6-index-harbor.png'),
  versioned('./assets/story/chapter-6-chapter-kraken.png'),
  versioned('./assets/story/chapter-6-harbor-repair.png'),
  versioned('./assets/story/chapter-7-type-core.png'),
  versioned('./assets/story/chapter-7-type-golem.png'),
  versioned('./assets/story/chapter-7-final-boss-intro.png'),
  versioned('./assets/story/chapter-7-final-word.png'),
  versioned('./assets/ui/adv-gameover-defeat.png')
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    return cached || cache.match(fallbackUrl);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const versionedRequest = versionedCacheRequest(request);
  const cached = await cache.match(request)
    || (versionedRequest && await cache.match(versionedRequest));
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}
