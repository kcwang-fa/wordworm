const CACHE_NAME = 'wordworm-pwa-20260712e';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './favicon.ico',
  './css/style.css?v=kids-20260712a',
  './js/story.js',
  './js/adventure-data.js',
  './js/daily.js',
  './js/game.js',
  './js/kids.js?v=kids-20260712b',
  './js/word-of-day.js?v=wotd-20260712b',
  './enable1.txt',
  './modern-words.txt',
  './extra-words.txt',
  './daily_words.json',
  './data/kids-words.json',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-icon-512.png',
  './assets/home-cover.png',
  './assets/library-background-gpt.png',
  './assets/maps/adventure-map.png',
  './assets/characters/bookworm-hero.png',
  './assets/characters/enemy-blob.png',
  './assets/characters/enemy-book-boss.png',
  './assets/characters/enemy-critter.png',
  './assets/stages/dusty-library-far.png',
  './assets/stages/dusty-library-mid.png',
  './assets/stages/dusty-library-ground.png',
  './assets/stages/ink-gallery-far.png',
  './assets/stages/ink-gallery-mid.png',
  './assets/stages/ink-gallery-ground.png',
  './assets/stages/crooked-fairytale-far.png',
  './assets/stages/crooked-fairytale-mid.png',
  './assets/stages/crooked-fairytale-ground.png',
  './assets/stages/star-chart-room-far.png',
  './assets/stages/star-chart-room-mid.png',
  './assets/stages/star-chart-room-ground.png',
  './assets/stages/forbidden-greenhouse-far.png',
  './assets/stages/forbidden-greenhouse-mid.png',
  './assets/stages/forbidden-greenhouse-ground.png',
  './assets/stages/storm-index-harbor-far.png',
  './assets/stages/storm-index-harbor-mid.png',
  './assets/stages/storm-index-harbor-ground.png',
  './assets/stages/living-type-core-far.png',
  './assets/stages/living-type-core-mid.png',
  './assets/stages/living-type-core-ground.png',
  './assets/story/intro-1-library.png',
  './assets/story/intro-2-crack.png',
  './assets/story/intro-3-spell.png',
  './assets/story/intro-comic-fixed.png',
  './assets/story/chapter-1-library.png',
  './assets/story/chapter-1-paper-mouse.png',
  './assets/story/chapter-1-catalog-repair.png',
  './assets/story/chapter-1-comic.png',
  './assets/story/chapter-2-ink-gallery.png',
  './assets/story/chapter-2-missing-word-ghost.png',
  './assets/story/chapter-2-index-repair.png',
  './assets/story/chapter-3-fairytale-chaos.png',
  './assets/story/chapter-3-paper-queen.png',
  './assets/story/chapter-3-story-order.png',
  './assets/story/chapter-4-star-room.png',
  './assets/story/chapter-4-observatory-golem.png',
  './assets/story/chapter-4-star-map.png',
  './assets/story/chapter-5-greenhouse.png',
  './assets/story/chapter-5-mandrake.png',
  './assets/story/chapter-5-trim-growth.png',
  './assets/story/chapter-6-index-harbor.png',
  './assets/story/chapter-6-chapter-kraken.png',
  './assets/story/chapter-6-harbor-repair.png',
  './assets/story/chapter-7-type-core.png',
  './assets/story/chapter-7-type-golem.png',
  './assets/story/chapter-7-final-boss-intro.png',
  './assets/story/chapter-7-final-word.png',
  './assets/ui/adv-gameover-defeat.png'
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
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}
