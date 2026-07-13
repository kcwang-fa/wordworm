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
  versioned('./extra-words.txt'),
  versioned('./data/daily-words.json'),
  versioned('./data/kids-words.json'),
  versioned('./assets/icons/apple-touch-icon.png'),
  versioned('./assets/icons/icon-192.png'),
  versioned('./assets/icons/icon-512.png'),
  versioned('./assets/icons/maskable-icon-512.png'),
  versioned('./assets/home-cover.webp'),
  versioned('./assets/library-background-gpt.webp'),
  versioned('./assets/characters/bookworm-hero.webp')
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
