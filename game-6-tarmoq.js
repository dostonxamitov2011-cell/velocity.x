// ====================================================================
// Grafika sozlamasi, onlayn (multiplayer) klienti, ishga tushirish
// ====================================================================

// ───────── [17-grafika.js] ─────────
// ==================================================================
// GRAFIKA SOZLAMASI (ishlash vaqtida qo’llash)
// ==================================================================
function updGfxUI(){ setText('gfxV', GFX.pref === 'auto' ? 'Avto · ' + GFX.name : GFX.name); }
function applyGfx(){
  sun.castShadow = GFX.shadow;
  if(sun.shadow.mapSize.x !== GFX.shMap){ sun.shadow.mapSize.set(GFX.shMap, GFX.shMap); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } }
  hiRes = GFX.hi; applyRes(); updLbl();
  try{ rain.geometry.setDrawRange(0, Math.max(2, Math.floor(rainV.length*GFX.rain))*2); }catch(e){}
  updGfxUI();
}
function gfxCycle(){
  const order = ['auto','0','1','2']; GFX.pref = order[(order.indexOf(GFX.pref) + 1) % 4];
  try{ localStorage.setItem('game3d_gfx', GFX.pref); }catch(e){}
  GFX.load(GFX.pref === 'auto' ? GFX.auto : +GFX.pref); applyGfx();
}
let _gw = 0, _gn = 0, _gc = 8;
function gfxWatch(dt){   // Avto rejim: kadr tezligi juda past bo’lsa, bir pog’ona pasaytiradi
  if(GFX.pref !== 'auto' || inMenu || !(carLoaded && cityLoaded) || dt > 0.5){ _gw = 0; _gn = 0; return; }
  _gw += dt; _gn++; if(_gw < 3) return;
  const avg = _gw/_gn; _gw = 0; _gn = 0; _gc -= 3; if(_gc > 0) return;
  if(avg > 0.045 && GFX.lvl > 0){ GFX.load(GFX.lvl - 1); applyGfx(); _gc = 8; }
}

// ───────── [18-tarmoq.js] ─────────
// ==================================================================
// ONLAYN (ko’p o’yinchili rejim). IKKI usul, o’yin o’zi tanlaydi:
//  1) Socket.io server (Node.js) — agar sayt shu server orqali ochilgan bo’lsa (server.js)
//  2) To’g’ridan-to’g’ri (WebRTC / PeerJS) — SERVERSIZ: oddiy hosting (Sayt.uz, GitHub Pages) da ham ishlaydi.
//     Xona egasining brauzeri xona “serveri” bo’ladi; qolganlar xona kodi bilan unga ulanadi.
// Holat 20 Gts (internet sekin bo’lsa 8–12 Gts) yuboriladi, qabul qiluvchi tomonda silliqlanadi.
// ==================================================================
const NET = { on:false, host:false, sock:null, busy:false, myId:0, code:'', name:'', mode:'', ioOk:null, players:new Map(), sendT:0, pingT:0, hudT:0, ping:0, rate:20 };
const NET_SERVER = (window.HAYDASH_CONFIG && window.HAYDASH_CONFIG.NET_SERVER) || '';   // '' = o’yin shu server orqali ochilgan; aks holda masalan 'https://haydash.onrender.com'
const NET_MAX = 8;
const NET_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const P2P_PREFIX = 'haydash-v1-';
const P2P_ICE = { iceServers:[
  { urls:'stun:stun.l.google.com:19302' }, { urls:'stun:stun1.l.google.com:19302' },
  { urls:['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username:'openrelayproject', credential:'openrelayproject' }
] };
const _na = new THREE.Quaternion(), _nb = new THREE.Quaternion(), _nv = new THREE.Vector3();
function nMsg(t){ const e = $m('oMsg'); if(e) e.textContent = t; }
let _toastT = 0;
function netToast(t){
  const e = $m('ntoast'); if(!e) return;
  e.textContent = t; e.classList.add('show'); clearTimeout(_toastT); _toastT = setTimeout(()=>e.classList.remove('show'), 3500);
}
function loadScript(urls, test){
  return new Promise((res, rej)=>{
    if(test()) return res();
    let i = 0;
    const next = ()=>{
      if(i >= urls.length) return rej(new Error('skript'));
      const sc = document.createElement('script'); sc.src = urls[i++];
      sc.onload = ()=>{ if(test()) res(); else { sc.remove(); next(); } };
      sc.onerror = ()=>{ sc.remove(); next(); };
      document.head.appendChild(sc);
    };
    next();
  });
}
const loadPeerJS = ()=>loadScript(['peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'], ()=>!!window.Peer);

// ───────── 1) Socket.io usuli ─────────
function ioConnect(){
  return new Promise((res, rej)=>{
    if(location.protocol === 'file:' && !NET_SERVER) return rej(new Error('manzil'));
    if(NET.sock && NET.sock.connected && NET.mode === 'io') return res(NET.sock);
    const base = NET_SERVER.replace(/\/+$/, '');
    loadScript([base + '/socket.io/socket.io.js'], ()=>!!window.io).then(()=>{
      const o = { transports:['websocket','polling'], reconnection:false, timeout:6000 };
      const s = NET_SERVER ? io(NET_SERVER, o) : io(o);
      const to = setTimeout(()=>{ try{ s.disconnect(); }catch(e){} rej(new Error('vaqt')); }, 7000);
      s.on('connect', ()=>{ clearTimeout(to); res(s); });
      s.on('connect_error', ()=>{ clearTimeout(to); try{ s.disconnect(); }catch(e){} rej(new Error('ulanish')); });
    }).catch(()=>rej(new Error('socketio')));
  });
}

// ───────── 2) To’g’ridan-to’g’ri (serversiz) usul ─────────
// Xona egasining brauzerida ishlaydigan mini-server (server.js dagi mantiqning o’zi)
function p2pName(v){ const s = String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14); return s || ('Haydovchi' + (10 + (Math.random()*90 | 0))); }
function p2pCar(v){ const n = (+v) | 0; return n < 0 ? 0 : n > 99 ? 99 : n; }
function p2pCode(){ return Array.from({ length:4 }, ()=>NET_CH[Math.random()*NET_CH.length | 0]).join(''); }
class Hub {
  constructor(code, map){ this.code = code; this.map = String(map || 'spa').slice(0, 32); this.cl = new Map(); }
  count(){ let n = 0; this.cl.forEach(c=>{ if(c.id >= 0) n++; }); return n; }
  freeId(){ const u = new Set(); this.cl.forEach(c=>{ if(c.id >= 0) u.add(c.id); }); for(let i = 0; i < NET_MAX; i++) if(!u.has(i)) return i; return -1; }
  connect(cid, send, id){ const c = { send, id: id == null ? -1 : id, ism:'', mashina:0, n:0, t:Date.now() }; this.cl.set(cid, c); return c; }
  others(cid, ev, d, vol){ this.cl.forEach((c, k)=>{ if(k !== cid && c.id >= 0) c.send(ev, d, vol); }); }
  drop(cid){
    const c = this.cl.get(cid); if(!c) return; this.cl.delete(cid);
    if(c.id >= 0) this.others(cid, 'chiqdi', { id:c.id });
  }
  handle(cid, ev, d, ack){
    ack = typeof ack === 'function' ? ack : ()=>{};
    const me = this.cl.get(cid); if(!me) return;
    if(ev === 'xona:qosh'){
      if(me.id >= 0) return ack({ ok:false, xato:'Siz allaqachon xonadasiz.' });
      const id = this.freeId(); if(id < 0) return ack({ ok:false, xato:'Xona to’lgan.' });
      const list = []; this.cl.forEach((c, k)=>{ if(c.id >= 0) list.push({ i:c.id, n:c.ism, c:c.mashina }); });
      me.id = id; me.ism = p2pName(d && d.name); me.mashina = p2pCar(d && d.car);
      this.others(cid, 'qoshildi', { id:me.id, n:me.ism, c:me.mashina });
      ack({ ok:true, code:this.code, id:me.id, map:this.map, list });
    } else if(ev === 'xarita'){
      if(cid !== 'host') return;
      this.map = String((d && d.map) || 'spa').slice(0, 32); this.others(cid, 'xarita', { map:this.map });
    } else if(ev === 'holat'){
      if(me.id < 0) return;
      const t = Date.now(); if(t - me.t >= 1000){ me.t = t; me.n = 0; }
      if(++me.n > 60) return;
      const p = d; if(!Array.isArray(p) || p.length !== 15) return;
      for(let i = 0; i < 13; i++) if(typeof p[i] !== 'number' || !isFinite(p[i])) return;
      if(typeof p[13] !== 'number' || typeof p[14] !== 'string' || p[14].length > 32) return;
      me.mashina = p2pCar(p[12]);
      this.others(cid, 'holat', { i:me.id, p }, true);
    } else if(ev === 'ping') ack();
    else if(ev === 'xona:chiq') this.drop(cid);
  }
}
// Mijoz tomonidagi “soket” ko’rinishi (Socket.io bilan bir xil: on / emit / volatile.emit / disconnect / connected)
function mkSock(){
  const S = { connected:false, h:{}, cb:{}, n:0, manual:false, _out:null, _vol:null, _close:null,
    on(ev, fn){ S.h[ev] = fn; },
    emit(ev, d, cb){ if(typeof d === 'function'){ cb = d; d = undefined; } const m = { e:ev, d }; if(typeof cb === 'function'){ m.a = ++S.n; S.cb[m.a] = cb; } if(S._out) S._out(m); },
    volatile:{ emit(ev, d){ if(S._vol) S._vol({ e:ev, d }); } },
    disconnect(){ S.manual = true; S.connected = false; try{ S._close && S._close(); }catch(e){} },
    _in(m){
      if(!m) return;
      if(m.e === undefined && m.a !== undefined){ const f = S.cb[m.a]; delete S.cb[m.a]; if(f) f(m.r); return; }
      const f = S.h[m.e]; if(f) f(m.d);
    },
    _drop(){ if(S.manual) return; S.connected = false; const f = S.h.disconnect; if(f) f(); }
  };
  return S;
}
function p2pHost(map0){
  return loadPeerJS().then(()=>new Promise((res, rej)=>{
    let tries = 0;
    const attempt = ()=>{
      const code = p2pCode(); let peer, opened = false;
      try{ peer = new Peer(P2P_PREFIX + code, { debug:0, config:P2P_ICE }); }catch(e){ return rej(new Error('ulanish')); }
      const to = setTimeout(()=>{ if(!opened){ try{ peer.destroy(); }catch(e){} rej(new Error('vaqt')); } }, 15000);
      peer.on('error', er=>{
        if(opened){ console.warn('p2p', er); return; }
        clearTimeout(to); try{ peer.destroy(); }catch(e){}
        if(er && er.type === 'unavailable-id' && ++tries < 8) attempt(); else rej(new Error('ulanish'));
      });
      peer.on('open', ()=>{
        opened = true; clearTimeout(to);
        const hub = new Hub(code, map0), H = mkSock(), pos = {}, ctl = {};
        H.connected = true; H.hub = hub; H.peer = peer;
        hub.connect('host', (ev, d)=>H._in({ e:ev, d }), 0); hub.cl.get('host').ism = '';
        H._out = m=>{
          if(m.e === 'xona:yarat'){ const f = H.cb[m.a]; delete H.cb[m.a]; hub.cl.get('host').ism = p2pName(m.d && m.d.name); hub.cl.get('host').mashina = p2pCar(m.d && m.d.car); hub.map = String((m.d && m.d.map) || 'spa').slice(0, 32); if(f) f({ ok:true, code, id:0 }); return; }
          hub.handle('host', m.e, m.d, m.a !== undefined ? (r=>{ const f = H.cb[m.a]; delete H.cb[m.a]; if(f) f(r); }) : null);
        };
        H._vol = m=>hub.handle('host', m.e, m.d);
        H._close = ()=>{ try{ for(const k in ctl) ctl[k].close(); }catch(e){} try{ peer.destroy(); }catch(e){} hub.cl.clear(); };
        peer.on('connection', conn=>{
          const pid = conn.peer;
          if(conn.label === 'pos'){ pos[pid] = conn; conn.on('data', m=>{ if(m && m.e === 'holat') hub.handle(pid, 'holat', m.d); }); conn.on('close', ()=>{ delete pos[pid]; }); return; }
          if(hub.cl.size > NET_MAX + 4){ try{ conn.close(); }catch(e){} return; }
          ctl[pid] = conn;
          const send = (ev, d, vol)=>{ const c = (vol && pos[pid] && pos[pid].open) ? pos[pid] : conn; if(c.open) try{ c.send({ e:ev, d }); }catch(e){} };
          conn.on('open', ()=>hub.connect(pid, send));
          conn.on('data', m=>{ if(m && typeof m.e === 'string') hub.handle(pid, m.e, m.d, m.a !== undefined ? (r=>{ if(conn.open) try{ conn.send({ a:m.a, r }); }catch(e){} }) : null); });
          conn.on('close', ()=>{ delete ctl[pid]; hub.drop(pid); const pc = pos[pid]; if(pc){ try{ pc.close(); }catch(e){} delete pos[pid]; } });
          conn.on('error', ()=>{});
        });
        res(H);
      });
    };
    attempt();
  }));
}
function p2pJoin(code){
  return loadPeerJS().then(()=>new Promise((res, rej)=>{
    let peer; try{ peer = new Peer(undefined, { debug:0, config:P2P_ICE }); }catch(e){ return rej(new Error('ulanish')); }
    const S = mkSock(); let done = false, ctl, pos;
    const fail = m=>{ if(done) return; done = true; clearTimeout(to); try{ peer.destroy(); }catch(e){} rej(new Error(m)); };
    const to = setTimeout(()=>fail('vaqt'), 16000);
    peer.on('error', er=>{ if(!done) fail(er && er.type === 'peer-unavailable' ? 'topilmadi' : 'ulanish'); else console.warn('p2p', er); });
    peer.on('open', ()=>{
      ctl = peer.connect(P2P_PREFIX + code, { label:'ctl', reliable:true, serialization:'json' });
      ctl.on('open', ()=>{
        if(done) return; done = true; clearTimeout(to);
        try{ pos = peer.connect(P2P_PREFIX + code, { label:'pos', reliable:false, serialization:'json' }); }catch(e){ pos = null; }
        S.connected = true;
        S._out = m=>{ if(ctl.open) try{ ctl.send(m); }catch(e){} };
        S._vol = m=>{ const c = (pos && pos.open) ? pos : ctl; if(c.open) try{ c.send(m); }catch(e){} };
        S._close = ()=>{ try{ if(pos) pos.close(); }catch(e){} try{ ctl.close(); }catch(e){} try{ peer.destroy(); }catch(e){} };
        res(S);
      });
      ctl.on('data', m=>S._in(m));
      ctl.on('close', ()=>{ if(!done) fail('ulanish'); else S._drop(); });
      ctl.on('error', ()=>{ if(!done) fail('ulanish'); });
    });
  }));
}

function netErr(e){
  const m = e && e.message;
  return m === 'topilmadi' ? 'Bunday xona topilmadi. Kodni tekshiring (xona egasi o’yinda bo’lishi shart).'
       : m === 'skript' ? 'Onlayn moduli yuklanmadi: peerjs.min.js faylini o’yin fayllari yoniga yuklang yoki internetni tekshiring.'
       : m === 'vaqt' ? 'Ulanish vaqti tugadi. Internetni tekshirib, qayta urinib ko’ring.'
       : 'Ulanib bo’lmadi. Internetni tekshiring va qayta urinib ko’ring.';
}
function netBind(s){
  s.on('qoshildi', d=>{ const nm = String(d.n || '').slice(0, 14); netAdd(d.id, nm, (+d.c | 0) % CARS.length); netUI(); netToast('🏁 ' + nm + ' qo’shildi'); });
  s.on('chiqdi', d=>{ const pl = NET.players.get(d.id); if(pl) netToast(pl.name + ' chiqib ketdi'); netRemove(d.id); netUI(); });
  s.on('holat', d=>{ if(d) netState(d.i, d.p); });
  s.on('xarita', d=>{ if(d && d.map !== mapId && !inMenu) playMap(d.map, true); });
  s.on('egasi', d=>{ if(NET.on){ NET.host = (d.id === NET.myId); netUI(); if(NET.host) nMsg('Siz endi xona egasisiz.'); } });
  s.on('disconnect', ()=>{ if(NET.on){ const was = NET.mode; netLeave(true); nMsg(was === 'p2p' ? 'Xona egasi chiqib ketdi — xona yopildi.' : 'Server bilan aloqa uzildi.'); netToast('Onlayn aloqa uzildi'); } });
}
function netName(){
  const v = (($m('oName').value || '').trim().slice(0, 14)) || ('Haydovchi' + (10 + (Math.random()*90|0)));
  $m('oName').value = v; NET.name = v; try{ localStorage.setItem('game3d_name', v); }catch(e){}
}
function netCommon(){
  const c = navigator.connection; let r = 20;
  if(c){ if(c.saveData || /2g/.test(c.effectiveType || '')) r = 8; else if(c.effectiveType === '3g') r = 12; }
  NET.rate = r; NET.sendT = 0; NET.pingT = 0;
  document.body.classList.add('net');
}
function roomLink(){ return (NET.on && location.protocol !== 'file:') ? location.href.replace(/#.*$/, '') + '#room=' + NET.code : ''; }
function showRoom(){
  $m('oIdle').hidden = NET.on; $m('oRoom').hidden = !NET.on;
  $m('oRoomCode').textContent = NET.code || '----';
  $m('oLink').textContent = roomLink();
  setText('onV', NET.on ? NET.code : 'O’chiq');
  const pb = $m('oPlay'); if(pb) pb.textContent = NET.host ? 'O’ynashni boshlash ▶' : 'O’yinga qaytish ▶';
  if(!NET.on) document.body.classList.remove('net');
}
function netUI(){
  const names = [NET.name + ' (siz)']; NET.players.forEach(p=>names.push(p.name));
  const ol = $m('oList'); if(ol){ ol.textContent = ''; names.forEach(n=>{ const li = document.createElement('li'); li.textContent = n; ol.appendChild(li); }); }
  const h = $m('nethud');
  if(h) h.textContent = NET.on ? ('🌐 Xona ' + NET.code + ' · ' + names.length + ' o’yinchi' + (NET.host ? ' · xona egasi' : ' · ping ' + NET.ping + ' ms') + '\n' + names.slice(1).join(', ')) : '';
}
function netEnter(s, mode, r, host){
  NET.sock = s; NET.mode = mode; NET.on = true; NET.host = host; NET.code = r.code; NET.myId = r.id; netSlot = r.id;
  netBind(s); netCommon(); showRoom(); netUI();
}
async function netHost(){
  if(NET.on || NET.busy) return;
  netName(); nMsg('Xona yaratilmoqda…'); NET.busy = true;
  let s = null, mode = '';
  if(NET.ioOk !== false){ try{ s = await ioConnect(); mode = 'io'; NET.ioOk = true; }catch(e){ NET.ioOk = false; s = null; } }
  if(!s){ try{ s = await p2pHost(mapId); mode = 'p2p'; }catch(e){ NET.busy = false; nMsg(netErr(e)); return; } }
  s.emit('xona:yarat', { name:NET.name, car:carIdx, map:mapId }, r=>{
    NET.busy = false;
    if(!r || !r.ok){ nMsg((r && r.xato) || 'Xona yaratib bo’lmadi.'); try{ s.disconnect(); }catch(e){} return; }
    netEnter(s, mode, r, true);
    nMsg('Xona tayyor! Kodni (yoki havolani) do’stlarga yuboring, ular qo’shilgach “O’ynashni boshlash”ni bosing.' + (mode === 'p2p' ? ' Diqqat: siz chiqsangiz, xona yopiladi.' : ''));
  });
}
async function netJoin(){
  if(NET.on || NET.busy) return;
  netName();
  const code = ($m('oCode').value || '').trim().toUpperCase();
  if(code.length !== 4){ nMsg('4 ta belgidan iborat xona kodini kiriting.'); return; }
  nMsg('Xona qidirilmoqda…'); NET.busy = true;
  let s = null, mode = '';
  if(NET.ioOk !== false){
    try{
      s = await ioConnect(); NET.ioOk = true;
      const bor = await new Promise(ok=>{ const t = setTimeout(()=>ok(false), 5000); s.emit('xona:tekshir', { code }, r=>{ clearTimeout(t); ok(!!(r && r.bor)); }); });
      if(bor) mode = 'io'; else { try{ s.disconnect(); }catch(e){} s = null; }
    }catch(e){ NET.ioOk = false; s = null; }
  }
  if(!s){ try{ s = await p2pJoin(code); mode = 'p2p'; }catch(e){ NET.busy = false; nMsg(netErr(e)); return; } }
  s.emit('xona:qosh', { code, name:NET.name, car:carIdx }, r=>{
    NET.busy = false;
    if(!r || !r.ok){ nMsg((r && r.xato) || 'Xonaga qo’shilib bo’lmadi.'); try{ s.disconnect(); }catch(e){} return; }
    netEnter(s, mode, r, false);
    (r.list || []).forEach(p=>netAdd(p.i, String(p.n || '').slice(0, 14), (+p.c | 0) % CARS.length));
    netUI(); nMsg('Xonaga qo’shildingiz!'); playMap(r.map, true);
  });
}
// Maydonlar: Enter bosilsa keyingi qadam, o’yin tugmalari yozishga xalaqit bermaydi
{ const ni = $m('oName'), ci = $m('oCode');
  [ni, ci].forEach(el=>{ el.addEventListener('keydown', e=>{ e.stopPropagation(); if(e.key === 'Escape') return; if(e.key === 'Enter'){ e.preventDefault(); if(el === ni){ if(ci.value.trim().length === 4) netJoin(); else ci.focus(); } else netJoin(); } }); el.addEventListener('keyup', e=>e.stopPropagation()); });
  ci.addEventListener('input', ()=>{
    const v = ci.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); if(v !== ci.value) ci.value = v;
    if(v.length === 4 && !NET.on) nMsg('Kod kiritildi. “Qo’shilish”ni bosing.');
  });
}
function netCopy(){
  const t = roomLink() || NET.code; if(!t) return;
  const ok = ()=>nMsg('Havola nusxalandi — do’stlarga yuboring.');
  try{ navigator.clipboard.writeText(t).then(ok, ()=>nMsg(t)); }catch(e){ nMsg(t); }
}
function netOpenPanel(){ if(!inMenu) openMenu(); openPanel(pO); }
addEventListener('keydown', e=>{ if(!inMenu && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'o' && !/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) netOpenPanel(); });
function netOnStart(){ if(NET.on && NET.host && NET.sock) NET.sock.emit('xarita', { map:mapId }); }
function netAdd(id, name, car, pid){
  if(NET.players.has(id)) return;
  const tag = document.createElement('div'); tag.className = 'ntag'; tag.textContent = name; $m('ntags').appendChild(tag);
  NET.players.set(id, { id, name, car, pid, tag, grp:null, body:null, rigs:null, buf:[], menu:false, map:'', wait:false });
}
function netDropVisual(pl){
  if(pl.grp){ scene.remove(pl.grp); pl.grp = null; }
  if(pl.body){ world.removeBody(pl.body); pl.body = null; }
  pl.rigs = null;
}
function netRemove(id){
  const pl = NET.players.get(id); if(!pl) return;
  netDropVisual(pl); pl.tag.remove(); NET.players.delete(id);
}
function netLeave(silent){
  NET.players.forEach(pl=>{ netDropVisual(pl); pl.tag.remove(); }); NET.players.clear();
  const s = NET.sock; NET.on = false; NET.host = false; NET.sock = null; NET.busy = false; NET.myId = 0; NET.code = ''; NET.mode = ''; netSlot = -1;
  try{ if(s){ s.emit('xona:chiq'); s.disconnect(); } }catch(e){}
  showRoom(); netUI(); if(!silent) nMsg('Xonadan chiqdingiz.');
}
function netState(id, p){
  const pl = NET.players.get(id); if(!pl || !Array.isArray(p) || p.length < 15) return;
  const car = (+p[12] | 0) % CARS.length;
  if(car !== pl.car){ pl.car = car; netDropVisual(pl); pl.buf.length = 0; }
  pl.buf.push({t:performance.now(), p}); if(pl.buf.length > 12) pl.buf.shift();
  pl.menu = p[13] === 1; pl.map = p[14];
}
// Uzoqdagi mashina: asl modelning nusxasi (geometriya faqat pachoqlanadigan qismlar uchun alohida, toza holatda)
function netBuild(pl){
  const cc = carCache[pl.car];
  if(!cc){ if(!pl.wait){ pl.wait = true; ensureCar(pl.car, ()=>{ pl.wait = false; }); } return; }
  const src = cc.model, ud = src.userData, sd = ud.def, sc = ud._cp;
  delete ud.def; delete ud._cp;                              // clone() userData ni JSON qiladi — aylanma havolalar xato beradi
  let clone; try{ clone = src.clone(true); } finally { ud.def = sd; if(sc !== undefined) ud._cp = sc; }
  const A = [], B = []; src.traverse(o=>A.push(o)); clone.traverse(o=>B.push(o));
  const map = new Map(); A.forEach((o, i)=>map.set(o, B[i]));
  const dm = new Map(); (sd || []).forEach(d=>dm.set(d.mesh, d));
  A.forEach((o, i)=>{
    const m = B[i]; if(!o.isMesh) return;
    const d = dm.get(o);
    if(d){
      const s0 = o.geometry, g = new THREE.BufferGeometry();
      for(const k in s0.attributes) g.setAttribute(k, s0.attributes[k]);
      g.setAttribute('position', new THREE.BufferAttribute(d.p0.slice(), 3));
      if(d.n0) g.setAttribute('normal', new THREE.BufferAttribute(d.n0.slice(), 3));
      if(s0.index) g.setIndex(s0.index);
      s0.groups.forEach(x=>g.addGroup(x.start, x.count, x.materialIndex));
      g.computeBoundingBox(); g.computeBoundingSphere(); m.geometry = g;
    }
    if(/^INT_Cpit/.test((o.material && o.material.name) || '')) m.visible = false;
    m.castShadow = GFX.shadow && o.castShadow;
  });
  pl.rigs = cc.rigs.map(r=>({ steer:map.get(r.steer), roll:map.get(r.roll), isFront:r.isFront }));
  const grp = new THREE.Group(); grp.add(clone); grp.visible = false; scene.add(grp); pl.grp = grp;
  const body = new CANNON.Body({ mass:0, type:CANNON.Body.KINEMATIC });
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.95, 0.3, 2.2)), new CANNON.Vec3(0, 0.15, 0));
  body.position.set(0, -1000, 0); world.addBody(body); pl.body = body;
}
function netSend(dt){
  NET.sendT -= dt; if(NET.sendT > 0) return;
  const menu = inMenu || !started;
  NET.sendT = menu ? 0.25 : 1/NET.rate;
  const c = chassisBody, p = c.position, q = c.quaternion, v = c.velocity, r = x=>Math.round(x*100)/100, r3 = x=>Math.round(x*1000)/1000;
  const arr = [r(p.x), r(p.y), r(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), r(v.x), r(v.y), r(v.z), r(steerVisual), r(speed), carIdx, menu ? 1 : 0, mapId];
  if(NET.sock && NET.sock.connected) NET.sock.volatile.emit('holat', arr);
}
function netFrame(dt){
  if(!NET.on) return;
  netSend(dt);
  NET.pingT -= dt; if(NET.pingT <= 0){ NET.pingT = 2; const s = NET.sock, t0 = performance.now(); if(s && s.connected) s.emit('ping', ()=>{ NET.ping = Math.round(performance.now() - t0); }); }
  NET.hudT -= dt; if(NET.hudT <= 0){ NET.hudT = 1; netUI(); }
  const rt = performance.now() - 120, W = innerWidth, H = innerHeight; let vis = 0;
  NET.players.forEach(pl=>{
    if(!pl.grp && vis < GFX.remote) netBuild(pl);
    const b = pl.buf, show = pl.grp && b.length && !inMenu && !pl.menu && pl.map === mapId;
    if(pl.grp) vis++;
    if(!show){
      if(pl.grp){ pl.grp.visible = false; pl.body.position.set(0, -1000, 0); pl.body.velocity.set(0, 0, 0); }
      pl.tag.style.display = 'none'; return;
    }
    let A = b[0], B = null;
    for(let i = b.length - 1; i >= 0; i--){ if(b[i].t <= rt){ A = b[i]; B = b[i + 1] || null; break; } }
    const a = A.p; let x = a[0], y = a[1], z = a[2], vx = a[7], vy = a[8], vz = a[9], st = a[10], sp = a[11];
    _na.set(a[3], a[4], a[5], a[6]);
    if(B){
      const k = Math.max(0, Math.min(1, (rt - A.t)/Math.max(1, B.t - A.t))), c2 = B.p;
      x += (c2[0] - x)*k; y += (c2[1] - y)*k; z += (c2[2] - z)*k; vx += (c2[7] - vx)*k; vy += (c2[8] - vy)*k; vz += (c2[9] - vz)*k;
      st += (c2[10] - st)*k; sp += (c2[11] - sp)*k;
      _nb.set(c2[3], c2[4], c2[5], c2[6]); _na.slerp(_nb, k);
    } else if(rt > A.t){ const e = Math.min((rt - A.t)/1000, 0.3); x += vx*e; y += vy*e; z += vz*e; }
    const g = pl.grp;
    g.visible = true; g.quaternion.copy(_na);
    _nv.set(0, -VIS_Y, 0).applyQuaternion(_na); g.position.set(x + _nv.x, y + _nv.y, z + _nv.z);
    const bd = pl.body; bd.position.set(x, y, z); bd.quaternion.set(_na.x, _na.y, _na.z, _na.w); bd.velocity.set(vx, vy, vz);
    const spin = sp*dt/CARS[pl.car].wheelR;
    for(const rig of pl.rigs){ rig.roll.rotation.x += spin; if(rig.isFront) rig.steer.rotation.y = st; }
    // ism yorlig’i
    _nv.set(x, y + 2.1, z); const dx = x - camera.position.x, dz = z - camera.position.z, dist = Math.hypot(dx, dz);
    _nv.project(camera);
    if(_nv.z < 1 && dist < 180){
      const tg = pl.tag; tg.style.display = 'block';
      tg.style.transform = 'translate(' + Math.round((_nv.x*0.5 + 0.5)*W) + 'px,' + Math.round((-_nv.y*0.5 + 0.5)*H) + 'px) translate(-50%,-100%)';
      const t = pl.name + ' · ' + Math.round(dist) + ' m'; if(tg._t !== t){ tg._t = t; tg.textContent = t; }
    } else pl.tag.style.display = 'none';
  });
}

// ───────── [19-ishga-tushirish.js] ─────────
{ // ism va havola orqali kirish (#room=ABCD)
  try{ const n = localStorage.getItem('game3d_name'); if(n) $m('oName').value = n; }catch(e){}
  const hm = /#room=([A-Za-z0-9]{4})/.exec(location.hash);
  if(hm){ $m('oCode').value = hm[1].toUpperCase(); setTimeout(()=>{ openPanel(pO); nMsg('Do’stingiz taklif qildi. Ismingizni kiriting va “Qo’shilish”ni bosing.'); }, 900); }
  showRoom(); applyGfx();
}

animate();

let _rsT = 0;
function onResize(){
  camera.aspect = innerWidth/Math.max(1,innerHeight);
  camera.fov = _fovBase;
  camera.updateProjectionMatrix();
  applyRes();
}
function onResizeSoon(){ cancelAnimationFrame(_rsT); _rsT = requestAnimationFrame(onResize); }
addEventListener('resize', onResizeSoon);
addEventListener('orientationchange', ()=>{ setTimeout(onResize, 120); setTimeout(onResize, 450); });
if(window.visualViewport) visualViewport.addEventListener('resize', onResizeSoon);
onResize();
