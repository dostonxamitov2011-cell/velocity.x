'use strict';
// ====================================================================
// 3D Haydash — onlayn server (Node.js + Socket.io), BITTA FAYL.
//   1) Sozlamalar  2) Xonalar mantiqi  3) Statik fayllar (public/)  4) Socket.io hodisalari  5) Ishga tushirish
// Ishga tushirish:  npm install  →  npm start   (so’ng http://localhost:3000)
// Muhit o’zgaruvchilari: PORT (standart 3000), ORIGIN ('*' yoki 'https://a.app,https://b.app')
// ====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Server } = require('socket.io');

// ---------- 1) Sozlamalar ----------
const PORT = process.env.PORT || 3000;
const _origin = String(process.env.ORIGIN || '*').trim();
const ORIGIN = _origin === '*' ? '*' : _origin.split(',').map(s => s.trim()).filter(Boolean);
const PUBLIC_DIR = path.join(__dirname, 'public');
const NET_MAX = 8;                                         // xonadagi eng ko’p o’yinchi
const NET_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';         // kod belgilari (O/0, I/1 yo’q)
const KOD_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const MAX_HOLAT_SEK = 60;                                  // bitta o’yinchidan sekundiga ruxsat etilgan holat paketi

// ---------- 2) Xonalar ----------
const xonalar = new Map();      // kod → { kod, egasi(socket.id), oyinchilar:Map(socket.id → {id, ism, mashina}), xarita }

function ismTozala(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  return s || ('Haydovchi' + (10 + (Math.random() * 90 | 0)));
}
function mashinaRaqam(v) { const n = (+v) | 0; return n < 0 ? 0 : n > 99 ? 99 : n; }
function kodYarat() {
  for (let u = 0; u < 200; u++) {
    const k = Array.from({ length: 4 }, () => NET_CH[Math.random() * NET_CH.length | 0]).join('');
    if (!xonalar.has(k)) return k;
  }
  return null;
}
function bushId(xona) {
  const band = new Set(); xona.oyinchilar.forEach(p => band.add(p.id));
  for (let i = 0; i < NET_MAX; i++) if (!band.has(i)) return i;
  return -1;
}
function royxat(xona, chiqarma) {      // [{i, n, c}] — mijoz netAdd() uchun
  const r = [];
  xona.oyinchilar.forEach((p, sid) => { if (sid !== chiqarma) r.push({ i: p.id, n: p.ism, c: p.mashina }); });
  return r;
}

function xonadanChiqar(io, socket) {
  const kod = socket.data.kod; if (!kod) return;
  const xona = xonalar.get(kod);
  socket.data.kod = null; socket.leave(kod);
  if (!xona) return;
  const p = xona.oyinchilar.get(socket.id); xona.oyinchilar.delete(socket.id);
  if (xona.oyinchilar.size === 0) { xonalar.delete(kod); console.log('[xona yopildi]', kod); return; }
  if (p) io.to(kod).emit('chiqdi', { id: p.id });
  if (xona.egasi === socket.id) {      // xona egasi chiqib ketdi → eng kichik id egasiga o’tadi
    let yangi = null, sid2 = null;
    xona.oyinchilar.forEach((q, sid) => { if (!yangi || q.id < yangi.id) { yangi = q; sid2 = sid; } });
    xona.egasi = sid2;
    io.to(kod).emit('egasi', { id: yangi.id });
  }
}

// ---------- 3) Statik fayllar ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2'
};
const GZIP = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg']);

function xato(res, kod, matn) {
  res.writeHead(kod, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(matn);
}

// true — so’rov shu yerda hal qilindi; false — fayl topilmadi (keyingi ishlov berishga o’tkazing)
function serve(req, res, cb) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { xato(res, 405, 'Faqat GET'); return cb(true); }
  let rel;
  try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { xato(res, 400, 'Noto’g’ri manzil'); return cb(true); }
  if (rel.indexOf('\0') >= 0) { xato(res, 400, 'Noto’g’ri manzil'); return cb(true); }
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) { xato(res, 403, 'Taqiqlangan'); return cb(true); }

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return cb(false);
    const ext = path.extname(full).toLowerCase();
    const etag = 'W/"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const h = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
      // katta o’zgarmas fayllar uzoq keshlanadi; kod va HTML har safar tekshiriladi (ETag orqali tez)
      'Cache-Control': (rel.startsWith('/data-') || rel === '/vendor.js') ? 'public, max-age=86400' : 'no-cache'
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); res.end(); return cb(true); }
    const gz = GZIP.has(ext) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gz) { h['Content-Encoding'] = 'gzip'; h['Vary'] = 'Accept-Encoding'; } else h['Content-Length'] = st.size;
    res.writeHead(200, h);
    if (req.method === 'HEAD') { res.end(); return cb(true); }
    const rs = fs.createReadStream(full);
    rs.on('error', () => res.destroy());
    if (gz) rs.pipe(zlib.createGzip({ level: 4 })).pipe(res); else rs.pipe(res);
    cb(true);
  });
}

// ---------- 4) Socket.io hodisalari ----------
// ====================================================================
// Socket.io hodisalari (klient ⇄ server protokoli):
//   xona:tekshir {code}                → {bor, soni, toldi} | {bor:false, xato}
//   xona:yarat   {name, car, map}      → {ok, code, id}
//   xona:qosh    {code, name, car}     → {ok, code, id, map, list:[{i,n,c}]}
//   xarita       {map}                 (faqat xona egasi) → boshqalarga 'xarita'
//   holat        [15 ta qiymat]        → boshqalarga {i, p}   (volatile, 20 Gts)
//   ping (cb) / xona:chiq / disconnect
//   Serverdan: qoshildi {id,n,c} · chiqdi {id} · egasi {id} · xarita {map} · holat {i,p}
// ====================================================================

const javobBer = cb => (typeof cb === 'function' ? cb : () => {});
const kodOl = d => String((d && d.code) || '').trim().toUpperCase();

function tarmoqniUlash(io) {
  io.on('connection', socket => {
    socket.data.kod = null; socket.data.sana = 0; socket.data.vaqt = Date.now();

    // Xona kodini tekshirish (qo’shilmasdan)
    socket.on('xona:tekshir', (d, cb) => {
      const javob = javobBer(cb);
      const kod = kodOl(d);
      if (!KOD_RE.test(kod)) return javob({ bor: false, xato: '4 ta belgidan iborat xona kodini kiriting.' });
      const xona = xonalar.get(kod);
      if (!xona) return javob({ bor: false, xato: 'Bunday xona topilmadi: ' + kod });
      javob({ bor: true, soni: xona.oyinchilar.size, toldi: xona.oyinchilar.size >= NET_MAX });
    });

    // Xona yaratish (Host)
    socket.on('xona:yarat', (d, cb) => {
      const javob = javobBer(cb);
      if (socket.data.kod) return javob({ ok: false, xato: 'Siz allaqachon xonadasiz.' });
      const kod = kodYarat();
      if (!kod) return javob({ ok: false, xato: 'Xona kodini yaratib bo’lmadi. Qayta urinib ko’ring.' });
      const xona = { kod, egasi: socket.id, oyinchilar: new Map(), xarita: String((d && d.map) || 'spa').slice(0, 32) };
      xona.oyinchilar.set(socket.id, { id: 0, ism: ismTozala(d && d.name), mashina: mashinaRaqam(d && d.car) });
      xonalar.set(kod, xona);
      socket.data.kod = kod; socket.join(kod);
      console.log('[xona yaratildi]', kod);
      javob({ ok: true, code: kod, id: 0 });
    });

    // Xonaga qo’shilish (Join)
    socket.on('xona:qosh', (d, cb) => {
      const javob = javobBer(cb);
      if (socket.data.kod) return javob({ ok: false, xato: 'Siz allaqachon xonadasiz.' });
      const kod = kodOl(d);
      if (!KOD_RE.test(kod)) return javob({ ok: false, xato: '4 ta belgidan iborat xona kodini kiriting.' });
      const xona = xonalar.get(kod);
      if (!xona) return javob({ ok: false, xato: 'Bunday xona topilmadi: ' + kod });
      if (xona.oyinchilar.size >= NET_MAX) return javob({ ok: false, xato: 'Xona to’lgan.' });
      const id = bushId(xona); if (id < 0) return javob({ ok: false, xato: 'Xona to’lgan.' });
      const p = { id, ism: ismTozala(d && d.name), mashina: mashinaRaqam(d && d.car) };
      const list = royxat(xona, null);                      // qo’shilishdan oldingi ro’yxat
      xona.oyinchilar.set(socket.id, p);
      socket.data.kod = kod; socket.join(kod);
      socket.to(kod).emit('qoshildi', { id: p.id, n: p.ism, c: p.mashina });
      javob({ ok: true, code: kod, id: p.id, map: xona.xarita, list });
    });

    // Xona egasi xaritani o’zgartirsa — hammaga
    socket.on('xarita', d => {
      const xona = xonalar.get(socket.data.kod); if (!xona || xona.egasi !== socket.id) return;
      xona.xarita = String((d && d.map) || 'spa').slice(0, 32);
      socket.to(xona.kod).emit('xarita', { map: xona.xarita });
    });

    // Mashina holati: [x,y,z, qx,qy,qz,qw, vx,vy,vz, rul, tezlik, mashina, menyu, xarita]
    socket.on('holat', p => {
      const kod = socket.data.kod; if (!kod) return;
      const xona = xonalar.get(kod); const me = xona && xona.oyinchilar.get(socket.id); if (!me) return;
      const hozir = Date.now();
      if (hozir - socket.data.vaqt >= 1000) { socket.data.vaqt = hozir; socket.data.sana = 0; }
      if (++socket.data.sana > MAX_HOLAT_SEK) return;         // juda tez yuborayotganlarni kesamiz
      if (!Array.isArray(p) || p.length !== 15) return;
      for (let i = 0; i < 13; i++) if (typeof p[i] !== 'number' || !isFinite(p[i])) return;
      if (typeof p[13] !== 'number' || typeof p[14] !== 'string' || p[14].length > 32) return;
      me.mashina = mashinaRaqam(p[12]);
      socket.to(kod).volatile.emit('holat', { i: me.id, p });
    });

    socket.on('ping', cb => javobBer(cb)());                  // ping o’lchash uchun
    socket.on('xona:chiq', () => xonadanChiqar(io, socket));
    socket.on('disconnect', () => xonadanChiqar(io, socket));
  });
}

// ---------- 5) Ishga tushirish ----------
const httpServer = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/salomatlik') {                              // hosting uchun salomatlik tekshiruvi
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, xonalar: xonalar.size }));
    return;
  }
  serve(req, res, hal => {
    if (hal) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Topilmadi. 3D Haydash onlayn serveri ishlayapti.');
  });
});

const io = new Server(httpServer, {
  cors: { origin: ORIGIN, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e5,
  pingInterval: 10000,
  pingTimeout: 15000
});
tarmoqniUlash(io);

httpServer.listen(PORT, () => console.log('Haydash serveri ishga tushdi: port ' + PORT));

// Hosting (Render/Railway) o’chirganda toza yopilish
['SIGTERM', 'SIGINT'].forEach(s => process.on(s, () => { io.close(); httpServer.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }));
