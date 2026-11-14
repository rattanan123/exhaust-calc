/* sw.js — ทำให้เว็บแอปเปิดได้ตอนไม่มีเน็ต (iPhone "เพิ่มไปยังหน้าจอโฮม" / Android Chrome)
 * กลยุทธ์: โหลดไฟล์ทั้งหมดเก็บไว้ตอนติดตั้ง → เปิดจากเครื่องทันที แล้วแอบเช็คของใหม่จากเน็ตเบื้องหลัง
 * (stale-while-revalidate) — แก้โค้ดแล้ว push ผู้ใช้จะได้ของใหม่ในการเปิดครั้งถัดไป ไม่ต้องเปลี่ยน VERSION
 * เปลี่ยน VERSION เมื่อเพิ่ม/ลบไฟล์ใน ASSETS เท่านั้น (แคชเก่าจะถูกลบ)
 */
const VERSION = 'v2'; // v2: ดีไซน์ใหม่ + ฟอนต์ IBM Plex Sans Thai
const CACHE = 'exhaust-calc-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/calc.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './fonts/fonts.css',
  './fonts/plex-sans-thai-thai-400.woff2',
  './fonts/plex-sans-thai-thai-500.woff2',
  './fonts/plex-sans-thai-thai-600.woff2',
  './fonts/plex-sans-thai-thai-700.woff2',
  './fonts/plex-sans-thai-latin-400.woff2',
  './fonts/plex-sans-thai-latin-500.woff2',
  './fonts/plex-sans-thai-latin-600.woff2',
  './fonts/plex-sans-thai-latin-700.woff2',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' = ข้าม HTTP cache ของเบราว์เซอร์ ให้ได้ไฟล์ล่าสุดจริง
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('exhaust-calc-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ไม่ยุ่งกับไฟล์จากเว็บอื่น

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // หน้าเว็บ (เช่น /exhaust-calc/ หรือ ?query) → ใช้ index.html ที่เก็บไว้
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });

    const network = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => null);

    if (cached) {
      e.waitUntil(network); // อัปเดตเบื้องหลัง ไม่ให้ผู้ใช้รอ
      return cached;
    }
    const res = await network;
    return res || new Response('ออฟไลน์ — ยังไม่มีไฟล์นี้ในเครื่อง', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
