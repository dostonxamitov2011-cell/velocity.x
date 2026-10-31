// ====================================================================
// Yadro: sozlama, sahna, yordamchi funksiyalar, mashina modeli
// ====================================================================

// ───────── [01-sozlama.js] ─────────
// ==================================================================
// MOSLASHUV: telefon + kompyuter, xatolarga chidamlilik, yengil rejim
// ==================================================================
const MOBILE = (()=>{ try{ return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent||'') || (navigator.maxTouchPoints>1 && /Mac/i.test(navigator.platform||'')); }catch(e){ return false; } })();

// ==================================================================
// GRAFIKA: qurilma xotirasi/protsessori/internetiga qarab avtomatik sifat (Past / O’rta / Yuqori)
// ==================================================================
let netSlot = -1;   // onlayn: start joyi raqami (-1 = yakka o’yin)
const GFX = (()=>{
  let pref = 'auto'; try{ pref = localStorage.getItem('game3d_gfx') || 'auto'; }catch(e){}
  if(!/^(auto|0|1|2)$/.test(pref)) pref = 'auto';
  const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency || 4, cn = navigator.connection || {};
  let tier;
  if((mem && mem <= 2) || cores <= 2) tier = 0;
  else if(MOBILE) tier = ((mem || 4) >= 6 && cores >= 8) ? 2 : 1;
  else tier = ((mem === undefined || mem >= 8) && cores >= 6) ? 2 : ((mem === undefined || mem >= 4) ? 1 : 0);
  if(cn.saveData) tier = Math.min(tier, 0);
  const P = [
    { name:'Past',   prMax: MOBILE ? 0.8 : 1,   shadow:false, shMap:512,  far:0.55, tex:1024, rain:0.4, remote:3, hi:false },
    { name:'O’rta',  prMax: 1.5,                shadow:true,  shMap:1024, far:0.8,  tex:2048, rain:0.7, remote:5, hi:false },
    { name:'Yuqori', prMax: 4,                  shadow:true,  shMap:2048, far:1,    tex:4096, rain:1,   remote:7, hi:!MOBILE }
  ];
  const G = { pref, auto:tier, lvl:tier, P, mem, cores };
  G.load = l=>{ G.lvl = l; Object.assign(G, P[l]); };
  G.load(pref === 'auto' ? tier : +pref);
  return G;
})();
const $loadEl = document.getElementById('load');
function setLoadMsg(t){ try{ $loadEl.textContent = t; $loadEl.style.display = 'flex'; }catch(e){} }
function peekData(id){ const el = document.getElementById(id); return el ? el.textContent : ''; }
function takeData(id){ const el = document.getElementById(id); if(!el) return ''; const t = el.textContent; el.remove(); return t; }
let trackResolve; const trackDone = new Promise(r=>{ trackResolve = r; });
let perfAcc = 0, perfN = 0, perfCool = 4, frameErrs = 0;
addEventListener('error', e=>{ try{ console.error(e.error || e.message); }catch(_){} });
addEventListener('unhandledrejection', e=>{ try{ console.error(e.reason); }catch(_){} });

// ───────── [02-sahna.js] ─────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb8de);
scene.fog = new THREE.Fog(0x8fb8de, 120, 900);

const camera = new THREE.PerspectiveCamera(58, innerWidth/Math.max(1,innerHeight), 0.3, 4000);
let _fovBase = 58, _fovEff = 58;
function fitFov(v){ const a = camera.aspect || 1.78; if(a >= 1.25) return v; return Math.min(90, 2*Math.atan(Math.tan(v*Math.PI/360)*1.25/a)*180/Math.PI); }
Object.defineProperty(camera, 'fov', { get(){ return _fovEff; }, set(v){ _fovBase = v; _fovEff = fitFov(v); }, configurable:true });
camera.fov = 58;
let renderer;
try{
  renderer = new THREE.WebGLRenderer({canvas:document.getElementById('c'), antialias:true, alpha:false, powerPreference:'high-performance'});
}catch(err){
  setLoadMsg('Bu qurilmada 3D grafika (WebGL) ishlamayapti. Brauzerni yangilang yoki boshqa brauzerda oching.');
  throw err;
}
let hiRes = GFX.hi, resScale = 1;
const RES_MIN = 0.7, RES_MAX = 1;
function applyRes(){
  const w = Math.max(1,innerWidth), h = Math.max(1,innerHeight), dpr = window.devicePixelRatio || 1;
  let pr;
  if(hiRes) pr = Math.min(4, Math.max(dpr, Math.sqrt(8294400/(w*h))));
  else{
    pr = Math.min(dpr, 2)*resScale;
    if(MOBILE) pr = Math.min(pr, Math.sqrt(4.5e6/(w*h)));
  }
  renderer.setPixelRatio(Math.max(0.4, Math.min(pr, GFX.prMax)));
  renderer.setSize(w, h, false);
}
applyRes();
renderer.domElement.addEventListener('webglcontextlost', e=>{ e.preventDefault(); setLoadMsg('Grafika vaqtincha to’xtadi… tiklanmoqda'); }, false);
renderer.domElement.addEventListener('webglcontextrestored', ()=>{ hideLoad(); }, false);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x2e2620, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3df, 1.15);
sun.position.set(35,55,20);
scene.add(sun); scene.add(sun.target);
sun.castShadow=true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.05;
{const sc=sun.shadow.camera; sc.left=-40; sc.right=40; sc.top=40; sc.bottom=-40; sc.near=1; sc.far=220;}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(700,700), new THREE.MeshStandardMaterial({color:0x38383e, roughness:1}));
ground.rotation.x = -Math.PI/2;
scene.add(ground);
const grid = new THREE.GridHelper(700,140,0x707078,0x2b2b30);
grid.position.y = 0.01;
scene.add(grid);

const carGroup = new THREE.Group();
scene.add(carGroup);

const headL = new THREE.SpotLight(0xfff4d6, 0, 45, Math.PI/6, 0.45, 1.3);
const headR = new THREE.SpotLight(0xfff4d6, 0, 45, Math.PI/6, 0.45, 1.3);
carGroup.add(headL, headL.target, headR, headR.target);

let wheelRigs = [], carLoaded = false, cityLoaded = false;
const GRASS_DROP = 5; // o\u2019t yo\u2019ldan shuncha pastda \u2014 yo\u2019l yerdan baland ko\u2019rinadi (kattaroq qiymat = balandroq)
// Spa-Francorchamps: start/finish to'g'ri yo'li, asosiy tribuna (kuzatuvchilar) qarshisida. d = poyga yo'nalishi, n = chap normal
const TRK_C = [-379.5, -2085.6], TRK_D = (()=>{ const x=0.6238, z=0.7816, l=Math.hypot(x,z); return [x/l, z/l]; })();
const TRK_N = [-TRK_D[1], TRK_D[0]], START_T = -11;      // start chizig'i tribuna markazi qarshisida
function gridSlot(i){   // i=0 — pole; juft/toq qatorlar chap/o'ng, har biri 8 m orqada
  const t = START_T - 4 - 8*i, lat = (i%2===0 ? -3 : 3) + 1.5;
  return { x: TRK_C[0] + TRK_D[0]*t + TRK_N[0]*lat, z: TRK_C[1] + TRK_D[1]*t + TRK_N[1]*lat, heading: Math.atan2(TRK_D[0], TRK_D[1]) };
}
let START = gridSlot(0);
function hideLoad(){ if(carLoaded && cityLoaded && garageReady) document.getElementById('load').style.display = 'none'; }
let CAR_LEN = 4.6, WHEEL_R = 0.33;
const MAX_WHEEL_STEER = 0.5; // old (~28 daraja) — burilganda old g'ildiraklar shuncha buriladi

// ───────── [03-yordamchi.js] ─────────
// Katta base64 ni bo'laklab (asosiy oqimni qotirmasdan va xotirani tejab) ArrayBuffer ga aylantiradi
async function b64ToBufAsync(b64){
  const len = b64.length; let pad = 0;
  if(b64.charCodeAt(len-1) === 61) pad++;
  if(b64.charCodeAt(len-2) === 61) pad++;
  const out = new Uint8Array(len/4*3 - pad), CH = 1<<20; let o = 0;
  for(let i=0;i<len;i+=CH){
    const bin = atob(b64.substring(i, Math.min(len, i+CH)));
    for(let j=0;j<bin.length;j++) out[o++] = bin.charCodeAt(j);
    await new Promise(r=>setTimeout(r,0));
  }
  return out.buffer;
}
// Telefonda: 1024 pikseldan katta teksturalarni kichraytirib, video xotirani 3-4 marta tejaydi
function shrinkTex(root, maxS){
  maxS = Math.min(maxS, GFX.tex);
  if(!MOBILE && GFX.tex >= 4096) return;
  const seen = new Set(), done = new Map();
  const keys = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap','bumpMap'];
  root.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for(const m of ms) for(const k of keys){
      const t = m[k]; if(!t || seen.has(t) || !t.image) continue; seen.add(t);
      const im = t.image, w = im.width || im.naturalWidth, h = im.height || im.naturalHeight;
      if(!w || !h || Math.max(w,h) <= maxS) continue;
      try{
        let cv = done.get(im);
        if(!cv){
          const s = maxS/Math.max(w,h), nw = Math.max(1,Math.round(w*s)), nh = Math.max(1,Math.round(h*s));
          cv = document.createElement('canvas'); cv.width = nw; cv.height = nh;
          cv.getContext('2d').drawImage(im, 0, 0, nw, nh); done.set(im, cv);
        }
        t.image = cv; t.needsUpdate = true;
      }catch(e){}
    }
  });
}
// Kadr tezligini kuzatib, sekin bo'lsa rasm sifatini avtomatik pasaytiradi (qotib qolmaslik uchun)
function perfTick(dt){
  if(hiRes || dt > 0.4 || !(carLoaded && cityLoaded)){ perfAcc = 0; perfN = 0; return; }
  perfAcc += dt; perfN++;
  if(perfAcc < 1.5) return;
  const avg = perfAcc/perfN; perfAcc = 0; perfN = 0;
  perfCool -= 1.5; if(perfCool > 0) return;
  if(avg > 0.036){
    if(resScale > RES_MIN + 0.01){ resScale = Math.max(RES_MIN, resScale - 0.1); applyRes(); perfCool = 2.5; }
    else if(sun.castShadow){ sun.castShadow = false; perfCool = 3; }
  } else if(avg < 0.0185 && resScale < RES_MAX - 0.01){ resScale = Math.min(RES_MAX, resScale + 0.05); applyRes(); perfCool = 8; }
}
// Ekran o'chib qolmasin (telefon)
let _wl = null;
async function keepAwake(){ try{ if(MOBILE && 'wakeLock' in navigator && !_wl){ _wl = await navigator.wakeLock.request('screen'); _wl.addEventListener('release', ()=>{ _wl = null; }); } }catch(e){ _wl = null; } }
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && !inMenu) keepAwake(); });
function onGameStart(){
  keepAwake();
  if(document.body.classList.contains('touch') && innerHeight > innerWidth){
    const o = document.getElementById('orient');
    if(o){ o.classList.add('show'); setTimeout(()=>o.classList.remove('show'), 4500); }
  }
}
// To'liq ekran
const fsEl = ()=>document.fullscreenElement || document.webkitFullscreenElement;
function toggleFS(){
  const d = document.documentElement;
  try{
    if(fsEl()){ (document.exitFullscreen || document.webkitExitFullscreen).call(document); try{ screen.orientation.unlock(); }catch(e){} }
    else{
      const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
      const lock = ()=>{ try{ screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} };
      if(p && p.then) p.then(lock).catch(()=>{}); else lock();
    }
  }catch(e){}
}
function updFS(){ const v = document.getElementById('fsV'); if(v) v.textContent = fsEl() ? 'Yoniq' : 'O’chiq'; setTimeout(onResize, 150); }
['fullscreenchange','webkitfullscreenchange'].forEach(t=>document.addEventListener(t, updFS));
{ const d = document.documentElement, b = document.getElementById('bFs'); if(b && (d.requestFullscreen || d.webkitRequestFullscreen)) b.hidden = false; }
function b64ToBuf(b64){
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

const loader = new THREE.GLTFLoader();
MeshoptDecoder.ready.then(()=>loader.setMeshoptDecoder(MeshoptDecoder));
const carCache = {};
let curModel = null;
const $load = document.getElementById('load');

// ───────── [04-mashina-model.js] ─────────
// Modelni yig'adi: yo'nalish, o'lcham, g'ildirak pivotlari. Hali sahnaga qo'shmaydi.
function buildCar(gltf, cfg){
  const model = gltf.scene;
  const holder = new THREE.Group(); holder.add(model); // vaqtincha, o'zgarmagan koordinatalarda hisoblash uchun
  holder.updateMatrixWorld(true);
  let front=null, rear=null;
  model.traverse(o=>{
    const n = (o.name||'').toUpperCase();
    if(n.includes('FRONT') && n.includes('LIGHT')) front = o;
    if(n.includes('REAR') && n.includes('LIGHT')) rear = o;
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  let yaw = cfg.yaw || 0;
  if(front && rear){
    const fw = new THREE.Vector3(); front.getWorldPosition(fw);
    const rw = new THREE.Vector3(); rear.getWorldPosition(rw);
    const dir = fw.sub(rw); dir.y = 0; dir.normalize();
    yaw = -Math.atan2(dir.x, dir.z);
  }
  model.rotation.y = yaw;
  const horiz = Math.max(size.x, size.z) || 1;
  model.scale.setScalar(cfg.len/horiz);
  model.traverse(o=>{ if(o.isMesh){ const mn=(o.material&&o.material.name)||'', inner=/^(INT_|T5_)/.test(mn); o.castShadow=!inner; o.receiveShadow=!inner; } });   // salon soyaga qatnashmaydi (tezlik uchun)
  model.updateMatrixWorld(true);

  // G'ildirak qismlarini (RIM/TIRE/DISC/WHEEL) topib, har birini
  // qaysi burchakka (old-chap, old-o'ng, orqa-chap, orqa-o'ng)
  // tegishli ekanini nomidan (yoki topilmasa joylashuvidan) aniqlaymiz.
  const wheelNodeRe = /RIM|TIRE|TYRE|DISC|WHEEL/i;
  const cornerRe = {
    LF: /(^|_)(LF|FL)(_|\d|$)/i,
    RF: /(^|_)(RF|FR)(_|\d|$)/i,
    LR: /(^|_)(LR|RL)(_|\d|$)/i,
    RR: /(^|_)(RR)(_|\d|$)/i
  };
  const cornerParts = {LF:[], RF:[], LR:[], RR:[]};
  (function collect(o){
    if(wheelNodeRe.test(o.name||'')){
      let corner = null;
      for(const k in cornerRe){ if(cornerRe[k].test(o.name)){ corner = k; break; } }
      if(!corner){
        const wp = new THREE.Vector3(); o.getWorldPosition(wp);
        const lp = model.worldToLocal(wp.clone());
        corner = (lp.z>=0 ? (lp.x<0?'LF':'RF') : (lp.x<0?'LR':'RR'));
      }
      cornerParts[corner].push(o);
      return; // shu tugun ichiga qayta kirmaymiz (bitta detal 2 marta qo'shilmasin)
    }
    for(const c of o.children.slice()) collect(c);
  })(model);

  // Har bir burchak uchun ikki qavatli pivot: tashqisi (steer) — burilishda
  // gorizontal buriladi, ichkisi (roll) — yurishda aylanadi.
  const rigs = [];
  for(const corner in cornerParts){
    const parts = cornerParts[corner];
    if(!parts.length) continue;
    const wbox = new THREE.Box3();
    for(const p of parts) wbox.expandByObject(p);
    const worldCenter = wbox.getCenter(new THREE.Vector3());

    const steer = new THREE.Object3D();
    model.add(steer);
    steer.position.copy(model.worldToLocal(worldCenter.clone()));
    const roll = new THREE.Object3D();
    steer.add(roll);

    for(const p of parts) roll.attach(p);

    rigs.push({steer, roll, isFront: corner==='LF'||corner==='RF'});
  }
  holder.remove(model);
  prepDeform(model, rigs);
  return {model, rigs};
}

// Tanlangan mashinani sahnaga qo'yadi va uning sozlamalarini (tezlik, faralar, g'ildirak) qo'llaydi.
function showCar(idx){
  const c = carCache[idx], cfg = CARS[idx];
  curIdx = idx; repairCar(c.model); feelReset();
  if(curModel) carGroup.remove(curModel);
  curModel = c.model; carGroup.add(curModel);
  wheelRigs = c.rigs;
  CAR_LEN = cfg.len; WHEEL_R = cfg.wheelR; MAXF = cfg.maxKmh/3.6;
  const h = cfg.head;
  headL.position.set(-h.x, h.y, CAR_LEN*h.z);
  headR.position.set( h.x, h.y, CAR_LEN*h.z);
  headL.target.position.set(-h.x, 0.1, CAR_LEN*1.4);
  headR.target.position.set( h.x, 0.1, CAR_LEN*1.4);
  makeVehicle(cfg);
  applyTune(idx);
  carLoaded = true;
  hideLoad();
}

// Mashina modelini kerak bo'lganda yuklaydi (bir marta), keyin cb ni chaqiradi.
const carWait = {};
function ensureCar(idx, cb){
  if(carCache[idx]){ cb(); return; }
  if(carWait[idx]){ carWait[idx].push(cb); return; }
  carWait[idx] = [cb];
  if(carLoaded){ $load.textContent = 'Model yuklanmoqda…'; $load.style.display = 'flex'; }
  const fail = (err)=>{ delete carWait[idx]; $load.style.display = 'flex'; $load.textContent = 'Xato: model yuklanmadi'; console.error(err); };
  (carLoaded ? Promise.resolve() : trackDone)
    .then(()=>{ if(!carLoaded) setLoadMsg('Mashina yuklanmoqda…'); return new Promise(r=>setTimeout(r, carLoaded ? 40 : 0)); })
    .then(()=>MeshoptDecoder.ready)
    .then(()=>{ loader.setMeshoptDecoder(MeshoptDecoder); return b64ToBufAsync(peekData(CARS[idx].dataId)); })
    .then(buf=>{
      loader.parse(buf, '', (gltf)=>{
        try{
          shrinkTex(gltf.scene, 2048);
          carCache[idx] = buildCar(gltf, CARS[idx]);
          const el = document.getElementById(CARS[idx].dataId); if(el) el.remove();
          if(carLoaded) $load.style.display = 'none';
          const w = carWait[idx] || []; delete carWait[idx]; w.forEach(f=>f());
        }catch(err){ fail(err); }
      }, fail);
    })
    .catch(fail);
}
