// ====================================================================
// Xaritalar: Spa trassasi, menyu/garaj, Mount Rainier, bosh ekran
// ====================================================================

// ───────── [05-trassa-spa.js] ─────────
// ---- TRASSA: Spa-Francorchamps ----
// Tezlik uchun: katta meshlar bo'laklarga bo'linadi, uzoqdagi bo'laklar chizilmaydi (masofaga qarab)
const _cv = new THREE.Vector3(), _cs = new THREE.Sphere(); let trackChunks = [];
const FAR_GROUND = MOBILE?850:1100, FAR_PROPS = MOBILE?300:380, FAR_TREES = MOBILE?500:650;
function farFor(name){
  if(/^(BKA|BKB)/.test(name)) return 0;                                   // uzoq fon — doim ko'rinadi
  if(/^(ROAD_|RGED_|GRASS_|GRVL_|RDCP_CURB|WATER|COBL|STRP_|BP[A-Z]+_)/.test(name)) return FAR_GROUND;   // yer, yo'l, yo'l belgilari
  if(/^TREEWALL/.test(name)) return FAR_TREES;
  return FAR_PROPS;                                                       // to'siq, ustun, chiroq, bino va h.k.
}
function regChunk(m, maxD){
  const g = m.geometry; if(!g.boundingSphere) g.computeBoundingSphere();
  _cs.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
  m.userData.cx = _cs.center.x; m.userData.cy = _cs.center.y; m.userData.cz = _cs.center.z; m.userData.r = _cs.radius; m.userData.maxD = maxD;
  trackChunks.push(m);
}
function chunkMesh(o){
  const maxD = (curFar || farFor)((o.material && o.material.name) || '');
  const g = o.geometry, ix = g.index, pos = g.attributes.position;
  if(!ix || !pos || ix.count < 6000){ regChunk(o, maxD); return; }
  o.updateMatrixWorld(true);
  const m = o.matrixWorld.elements, I = ix.array, n = ix.count/3, CS = maxD >= FAR_GROUND ? 300 : 150, bins = new Map();
  for(let t=0;t<n;t++){
    const a=I[3*t], b=I[3*t+1], c=I[3*t+2];
    const x=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3, y=(pos.getY(a)+pos.getY(b)+pos.getY(c))/3, z=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3;
    const wx=m[0]*x+m[4]*y+m[8]*z+m[12], wz=m[2]*x+m[6]*y+m[10]*z+m[14];
    const k=(Math.floor(wx/CS)+64)*512+(Math.floor(wz/CS)+64);
    let l=bins.get(k); if(!l){ l=[]; bins.set(k,l); } l.push(a,b,c);
  }
  if(bins.size < 2){ regChunk(o, maxD); return; }
  const parent = o.parent;
  bins.forEach(l=>{
    const ng = new THREE.BufferGeometry();
    for(const k in g.attributes) ng.setAttribute(k, g.attributes[k]);
    ng.setIndex(new THREE.BufferAttribute(new Uint32Array(l),1));
    const box = new THREE.Box3();
    for(let i=0;i<l.length;i++) box.expandByPoint(_cv.set(pos.getX(l[i]),pos.getY(l[i]),pos.getZ(l[i])));
    ng.boundingBox = box; ng.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const nm = new THREE.Mesh(ng, o.material);
    nm.matrix.copy(o.matrix); nm.matrix.decompose(nm.position, nm.quaternion, nm.scale);
    nm.receiveShadow = true; nm.name = o.name;
    parent.add(nm); nm.updateMatrixWorld(true); regChunk(nm, maxD);
  });
  parent.remove(o);
}
let cullN = 0;
function cullTrack(){
  if(!trackChunks.length || (cullN++ % 4) !== 0) return;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  for(let i=0;i<trackChunks.length;i++){
    const m = trackChunks[i], u = m.userData;
    if(u.maxD === 0){ m.visible = true; continue; }
    const dx = u.cx-cx, dy = u.cy-cy, dz = u.cz-cz;
    m.visible = Math.sqrt(dx*dx+dy*dy+dz*dz) - u.r < u.maxD*GFX.far;
  }
}
MeshoptDecoder.ready.then(()=>{ setLoadMsg('Trassa yuklanmoqda…'); return b64ToBufAsync(takeData('d-track')); }).then(trackBuf=>{
  loader.parse(trackBuf, '',
    (gltf)=>{
      shrinkTex(gltf.scene, 2048);
      const track = gltf.scene;
      track.updateMatrixWorld(true);
      const list = []; track.traverse(o=>{ if(o.isMesh) list.push(o); });
      const seen = new Set();
      list.forEach(o=>{
        const m = o.material; o.receiveShadow = true;
        if(m && !seen.has(m)){
          seen.add(m);
          if(m.map) m.map.anisotropy = 4;
          // daraxt/to'r: yarim shaffoflik o'rniga alphaTest (tez va tartibsiz saralash yo'q)
          if(m.transparent && m.map && /TREE|^BK[AB]|FENCE|RAILINGS/.test(m.name||'')){ m.alphaTest = 0.45; m.transparent = false; m.depthWrite = true; m.needsUpdate = true; }
        }
        chunkMesh(o);
      });
      spaRoot.add(track);
      track.updateMatrixWorld(true);
      track.traverse(o=>{ o.matrixAutoUpdate = false; });                  // statik: har kadrda matritsa hisoblanmasin
      scene.remove(ground); scene.remove(grid);
      initTerrain(); buildBarrier(); buildStartLine(); buildPit();
      // teksturalar va shaderlarni oldindan GPU ga yuklaymiz — haydashda "qotib qolish" bo'lmasin
      const tx = new Set(); track.traverse(o=>{ if(o.isMesh && o.material && o.material.map) tx.add(o.material.map); });
      tx.forEach(t=>renderer.initTexture(t));
      try{ renderer.compile(scene, camera); }catch(e){}
      groundReady = true; MT.spa = { TX0, TZ0, NTILES, tmap, T_H, T_H2:null, T_S, roadPts, START, chunks:trackChunks }; useMap('spa'); resetCar();
      cityLoaded = true;
      hideLoad(); trackResolve();
    },
    (err)=>{ trackResolve(); document.getElementById('load').textContent = 'Xato: trassa yuklanmadi'; console.error(err); }
  );
}).catch(err=>{ trackResolve(); setLoadMsg('Xato: trassa yuklanmadi'); console.error(err); });

const keys = {};
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  if(k==='escape'){ if(!e.repeat) menuEsc(); e.preventDefault(); return; }
  if(inMenu){ menuKey(e,k); return; }
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  if(!keys[k]){ if(k==='c') cycleCam(); if(k==='l') toggleLights(); if(k==='r') (e.shiftKey ? resetCar() : flipReset()); if(k==='x') testHit(); if(k==='t') timeSkip(); if(k==='y') weatherSkip(); if(k==='m') missionToggle(); if(k==='n') setSound(!AUD.on); if(k==='f') setHard(!hardMode); if(k==='p') togglePitGuide(); if(k==='k'){ hiRes=!hiRes; applyRes(); updLbl(); } }
  keys[k] = true;
}, {passive:false});
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

let camMode = 0, lightsOn = false;
const camNames = ['Kuzatuv','Orqa ko\u2019rinish','Yuqoridan'];
const camlbl = document.getElementById('camlbl');
function updLbl(){ camlbl.textContent = '📷 ' + camNames[camMode] + (hiRes ? '  ·  4K' : '') + (lightsOn ? '  ·  💡 yoniq' : ''); }
// Kamera: nisbiy (mashinaga nisbatan) silliqlanadi — tezlikda orqada qolib ketmaydi. O'ng tugma — erkin aylantirish.
let camYaw = 0, camPitch = 0, camZoom = 1, camDrag = false, camHold = 0, camSpd = 0, camSnap = true;
const camOff = new THREE.Vector3(), camLook = new THREE.Vector3(), _lk = new THREE.Vector3();
function camFreeReset(){ camYaw = 0; camPitch = 0; camZoom = 1; camHold = 0; }
function cycleCam(){ camMode = (camMode+1)%3; camFreeReset(); updLbl(); }
addEventListener('contextmenu', e=>{ if(!inMenu) e.preventDefault(); });
addEventListener('mousedown', e=>{ if(e.button === 2 && !inMenu){ camDrag = true; camHold = 1e9; e.preventDefault(); } });
addEventListener('mouseup', e=>{ if(e.button === 2 && camDrag){ camDrag = false; camHold = 2.5; } });
addEventListener('mousemove', e=>{
  if(!camDrag) return;
  if(!(e.buttons & 2)){ camDrag = false; camHold = 2.5; return; }
  camYaw -= e.movementX*0.006;
  camPitch = Math.max(-0.6, Math.min(1.2, camPitch + e.movementY*0.005));
});
addEventListener('wheel', e=>{ if(inMenu) return; camZoom = Math.max(0.45, Math.min(3, camZoom*(e.deltaY > 0 ? 1.1 : 0.9))); camHold = Math.max(camHold, 2.5); }, {passive:true});
addEventListener('blur', ()=>{ camDrag = false; });
function toggleLights(){ lightsOn = !lightsOn; headL.intensity = headR.intensity = headPower(); updLbl(); }
updLbl();

// ───────── [06-menyu-garaj.js] ─────────
// ---- MENYU ----
let inMenu = true, started = false, menuAng = 0.6;
// Mashinalar ro'yxati — garajdagi joylar tartibi shu. open:false bo'lsa qulflangan (keyin ketma-ket ochiladi).
// Yangi mashina qo'shish: shu ro'yxatga yozing.
const CARS = [
  {name:'Mercedes-AMG C 63 DTM', tag:'DTM poyga mashinasi \u00b7 2018', title:'Mercedes', sub:'Spa-Francorchamps trassasida AMG C 63 DTM bilan haydang.',
   dataId:'d-mercedes', open:true, len:4.8, wheelR:0.347, maxKmh:200, yaw:0, wz:1.34, hw:0.78, head:{x:0.6,y:0.55,z:0.46},
   credit:'Model: Dave Love (Sketchfab) \u00b7 CC BY 4.0',
   stats:[['Tezlik',80,'200 km/h'],['Boshqaruv',90,'Yuqori'],['Dvigatel',80,'4.0 L V8']]},
  {name:'Porsche 992 GT3 R', tag:'GT3 poyga mashinasi \u00b7 2024', title:'Porsche', sub:'Spa-Francorchamps trassasida 992 GT3 R bilan haydang.',
   dataId:'d-porsche', open:true, len:4.6, wheelR:0.33, maxKmh:250, yaw:0, wz:1.30, hw:0.80, head:{x:0.58,y:0.34,z:0.47},
   stats:[['Tezlik',100,'250 km/h'],['Boshqaruv',92,'Yuqori'],['Dvigatel',85,'4.2 L bokser']]}
];
const SLOTS = 3;
let carIdx = 0; // o'yin boshida birinchi joydagi mashina (Mercedes)
const $m = id=>document.getElementById(id), pG=$m('pGarage'), pC=$m('pControls'), pR=$m('pRecords'), pO=$m('pOnline');
function updateTitle(){}
// ==================================================================
// XARITALAR: Spa-Francorchamps + 1939-yil terassasi (shahar)
// ==================================================================
let mapId = 'spa', cityState = 0, curIdx = 0, mview = 'home', tuneIdx = 0, hardPref = false, curFar = null, msSnap = true;
const spaRoot = new THREE.Group(), cityRoot = new THREE.Group(), rainRoot = new THREE.Group();
scene.add(spaRoot, cityRoot, rainRoot); cityRoot.visible = false; rainRoot.visible = false;
const MT = {}, MAPCHUNKS = { city: [], rain: [] }, MENUCAM = {};
let rainState = 0, RAINX = 0;
const CITY_N = 5515;
const CITY_START = { x:-162.5, z:366.5, heading:Math.atan2(0.095, 0.995) };
const MAPNAME = { spa:'Spa-Francorchamps', city:'1939-yil terassasi', rain:'Mount Rainier' };

// ---- 3D GARAJ: bosh ekran va garaj shu yerning ichida ----
const garageRoot = new THREE.Group(); garageRoot.scale.setScalar(0.15); garageRoot.position.set(0, -3000, 0); garageRoot.visible = false; scene.add(garageRoot);
garageRoot.add(new THREE.AmbientLight(0xeaeeff, 0.75));
let garageOn = false, garageReady = false;
function applyVis(){
  const g = inMenu && garageOn;
  garageRoot.visible = g; spaRoot.visible = !g && mapId === 'spa'; cityRoot.visible = !g && mapId === 'city'; rainRoot.visible = !g && mapId === 'rain';
}
function loadGarage(){
  const fail = err=>{ console.error(err); garageOn = false; garageReady = true; applyVis(); hideLoad(); };
  new Promise(r=>setTimeout(r, 30)).then(()=>b64ToBufAsync(peekData('d-garage'))).then(buf=>{
    const u8 = pako.inflate(new Uint8Array(buf));
    return new Promise((res, rej)=>loader.parse(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), '', res, rej));
  }).then(gltf=>{
    const root = gltf.scene; shrinkTex(root, 1024); root.updateMatrixWorld(true);
    const bx = new THREE.Box3(), c = new THREE.Vector3(), drop = [], seen = new Set();
    root.traverse(o=>{
      if(!o.isMesh) return;
      bx.setFromObject(o); bx.getCenter(c);
      if(c.x > 72 || c.x < -72 || c.z < -96) { drop.push(o); return; }     // asosiy zaldan tashqaridagi qismlar kerak emas
      o.receiveShadow = true; o.castShadow = false;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for(const m of ms){ if(!m || seen.has(m)) continue; seen.add(m); if(m.map) m.map.anisotropy = 4; if(m.metalness > 0.15) m.metalness = 0.15; }
    });
    drop.forEach(o=>o.parent && o.parent.remove(o));
    garageRoot.add(root); root.updateMatrixWorld(true);
    const wx = -1.4*0.15, wz = -40.5*0.15;
    MENUCAM.garage = { x:wx, y:-3000 + 1.55, z:wz, yaw:Math.PI };
    const tx = new Set(); root.traverse(o=>{ if(o.isMesh && o.material && o.material.map) tx.add(o.material.map); }); tx.forEach(t=>renderer.initTexture(t));
    garageRoot.visible = true; try{ renderer.compile(scene, camera); }catch(e){}
    const el = document.getElementById('d-garage'); if(el) el.remove();
    garageOn = true; garageReady = true; msSnap = true; applyVis(); hideLoad();
  }).catch(fail);
}
function setMenuCam(){
  let cx, cz, dx, dz;
  if(mapId === 'spa'){ dx = TRK_D[0]; dz = TRK_D[1]; const t = START_T - 11; cx = TRK_C[0] + dx*t + TRK_N[0]*-3.0; cz = TRK_C[1] + dz*t + TRK_N[1]*-3.0; }
  else { dx = Math.sin(START.heading); dz = Math.cos(START.heading); cx = START.x - dx*10; cz = START.z - dz*10; }
  const g = gH(cx, cz, 1e5);
  MENUCAM[mapId] = { x:cx, z:cz, y:(g > -1e8 ? g : 0) + 1.55, yaw:Math.atan2(-dx, -dz) };
}
// Faol xaritani almashtiradi: ko'rinish, fizika yuzasi, start nuqtasi, missiya
function useMap(id){
  const t = MT[id]; if(!t) return;
  if(MSTATE.on) missionToggle();
  mapId = id;
  applyVis();
  TX0 = t.TX0; TZ0 = t.TZ0; NTILES = t.NTILES; tmap = t.tmap; T_H = t.T_H; T_H2 = t.T_H2; T_S = t.T_S; roadPts = t.roadPts;
  trackChunks = t.chunks; START = t.START;
  try{ pitSetMap(id); }catch(e){}
  setHard(hardPref); document.body.classList.toggle('hard', hardMode);
  setMenuCam(); msSnap = true;
  const cur = $m('home'); if(cur) cur.dataset.map = id;
}
function loadCityTerrain(){
  const raw = pako.inflate(new Uint8Array(b64ToBuf(peekData('d-cityterr')))), n = CITY_N, o0 = raw.byteOffset, B = raw.buffer;
  const co = new Uint16Array(B.slice(o0, o0 + 4*n));
  let o = o0 + 4*n;
  const H = new Int16Array(B.slice(o, o + n*512)); o += n*512;
  const H2 = new Int16Array(B.slice(o, o + n*512)); o += n*512;
  const S = new Int8Array(B.slice(o, o + n*256));
  const tm = new Map(); for(let i=0;i<n;i++) tm.set(co[2*i+1]*1024 + co[2*i], i);
  const x0 = -1328, z0 = -1424, pts = [];
  for(let i=0;i<n;i++){
    const tx = co[2*i], tz = co[2*i+1];
    for(let j=0;j<16;j+=5) for(let k=0;k<16;k+=5) if(S[i*256 + j*16 + k] >= 20) pts.push(x0 + tx*16 + k + 0.5, z0 + tz*16 + j + 0.5);
  }
  return { TX0:x0, TZ0:z0, NTILES:n, tmap:tm, T_H:H, T_H2:H2, T_S:S, roadPts:new Float32Array(pts) };
}
const FAR_CITY = MOBILE ? 800 : 1000;
function farCity(name){ return /^(Railing|BridgeSupport|Concrete)/.test(name) ? (MOBILE ? 350 : 500) : FAR_CITY; }
function loadCity(onOk){
  if(cityState === 2){ onOk(); return; }
  if(cityState === 1) return;
  cityState = 1; setLoadMsg('1939-yil terassasi yuklanmoqda…');
  const fail = err=>{ cityState = 0; console.error(err); setLoadMsg('Xato: xarita yuklanmadi'); setTimeout(()=>{ $loadEl.style.display = 'none'; }, 2600); };
  new Promise(r=>setTimeout(r, 80)).then(()=>b64ToBufAsync(peekData('d-city'))).then(buf=>{
    const u8 = pako.inflate(new Uint8Array(buf));
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    return new Promise((res, rej)=>loader.parse(ab, '', res, rej));
  }).then(gltf=>{
    const root = gltf.scene;
    shrinkTex(root, 2048);
    root.updateMatrixWorld(true);
    const list = []; root.traverse(o=>{ if(o.isMesh) list.push(o); });
    const seen = new Set(), prev = trackChunks, prevFar = curFar;
    trackChunks = MAPCHUNKS.city; curFar = farCity;
    list.forEach(o=>{
      const m = o.material; o.receiveShadow = true; o.castShadow = false;
      if(m && !seen.has(m)){
        seen.add(m);
        if(m.map) m.map.anisotropy = 4;
        if(m.metalness > 0.1) m.metalness = 0.1;        // aks muhiti yo'q — metall qoramtir bo'lib qoladi
        if(m.name === 'Material.001'){ m.polygonOffset = true; m.polygonOffsetFactor = 4; m.polygonOffsetUnits = 4; }   // yer tekisligi yo'l ostida qolsin
        if(/^(Arrow|Crossing)/.test(m.name || '')){ m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
      }
      chunkMesh(o);
    });
    trackChunks = prev; curFar = prevFar;
    cityRoot.add(root);
    root.updateMatrixWorld(true);
    root.traverse(o=>{ o.matrixAutoUpdate = false; });
    const tx = new Set(); root.traverse(o=>{ if(o.isMesh && o.material && o.material.map) tx.add(o.material.map); });
    tx.forEach(t=>renderer.initTexture(t));
    const t = loadCityTerrain(); t.START = CITY_START; t.chunks = MAPCHUNKS.city; MT.city = t;
    const el1 = document.getElementById('d-city'); if(el1) el1.remove();
    const el2 = document.getElementById('d-cityterr'); if(el2) el2.remove();
    const vis = cityRoot.visible; cityRoot.visible = true; try{ renderer.compile(scene, camera); }catch(e){} cityRoot.visible = vis;
    cityState = 2; $loadEl.style.display = 'none';
    onOk();
  }).catch(fail);
}

// ───────── [07-xarita-rainier.js] ─────────
// ---- MOUNT RAINIER: 3-xarita (GLB + balandlik/devor to'ri) ----
const RAIN_X0 = -736, RAIN_Z0 = -608, RAIN_F = [-512, -4], RAIN_D = [0.8779, 0.4789], RAIN_NN = [-0.4789, 0.8779];
const RAIN_START = { x:RAIN_F[0] + RAIN_D[0]*-6 + RAIN_NN[0]*-1.5, z:RAIN_F[1] + RAIN_D[1]*-6 + RAIN_NN[1]*-1.5, heading:Math.atan2(RAIN_D[0], RAIN_D[1]) };
const FAR_RAIN = MOBILE ? 450 : 750;
function farRain(name){ return /leaf|spruce|shrub|tree|sway/i.test(name) ? (MOBILE ? 140 : 220) : FAR_RAIN; }
function loadRainTerrain(){
  const raw = pako.inflate(new Uint8Array(b64ToBuf(peekData('d-rainterr')))), o0 = raw.byteOffset, B = raw.buffer, n = raw.length/1284;
  const co = new Uint16Array(B.slice(o0, o0 + 4*n)); let o = o0 + 4*n;
  const H = new Int16Array(B.slice(o, o + n*512)); o += n*512;
  const H2 = new Int16Array(B.slice(o, o + n*512)); o += n*512;
  const S = new Int8Array(B.slice(o, o + n*256));
  const tm = new Map(); for(let i=0;i<n;i++) tm.set(co[2*i+1]*1024 + co[2*i], i);
  const pts = [];
  for(let i=0;i<n;i++){ const tx = co[2*i], tz = co[2*i+1];
    for(let j=0;j<16;j+=5) for(let k=0;k<16;k+=5) if(S[i*256 + j*16 + k] >= 20) pts.push(RAIN_X0 + tx*16 + k + 0.5, RAIN_Z0 + tz*16 + j + 0.5); }
  return { TX0:RAIN_X0, TZ0:RAIN_Z0, NTILES:n, tmap:tm, T_H:H, T_H2:H2, T_S:S, roadPts:new Float32Array(pts) };
}
function loadRain(onOk){
  if(rainState === 2){ onOk(); return; }
  if(rainState === 1) return;
  rainState = 1; setLoadMsg('Mount Rainier yuklanmoqda…');
  const fail = err=>{ rainState = 0; console.error(err); setLoadMsg('Xato: xarita yuklanmadi'); setTimeout(()=>{ $loadEl.style.display = 'none'; }, 2600); };
  new Promise(r=>setTimeout(r, 80)).then(()=>b64ToBufAsync(peekData('d-rain'))).then(buf=>{
    const u8 = pako.inflate(new Uint8Array(buf));
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    return new Promise((res, rej)=>loader.parse(ab, '', res, rej));
  }).then(gltf=>{
    const root = gltf.scene;
    shrinkTex(root, MOBILE ? 1024 : 2048);
    root.updateMatrixWorld(true);
    const list = []; root.traverse(o=>{ if(o.isMesh) list.push(o); });
    const seen = new Set(), prev = trackChunks, prevFar = curFar;
    trackChunks = MAPCHUNKS.rain; curFar = farRain;
    list.forEach(o=>{
      const m = o.material; o.receiveShadow = !/leaf|spruce|shrub|tree|sway/i.test(o.name); o.castShadow = false;
      if(m && !seen.has(m)){ seen.add(m); if(m.map) m.map.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); if(m.metalness > 0.1) m.metalness = 0.1; }
      chunkMesh(o);
    });
    trackChunks = prev; curFar = prevFar;
    rainRoot.add(root);
    root.updateMatrixWorld(true);
    root.traverse(o=>{ o.matrixAutoUpdate = false; });
    const tx = new Set(); root.traverse(o=>{ if(o.isMesh && o.material && o.material.map) tx.add(o.material.map); });
    tx.forEach(t=>renderer.initTexture(t));
    const t = loadRainTerrain(); t.START = RAIN_START; t.chunks = MAPCHUNKS.rain; MT.rain = t;
    const el1 = document.getElementById('d-rain'); if(el1) el1.remove();
    const el2 = document.getElementById('d-rainterr'); if(el2) el2.remove();
    const vis = rainRoot.visible; rainRoot.visible = true; try{ renderer.compile(scene, camera); }catch(e){} rainRoot.visible = vis;
    rainState = 2; $loadEl.style.display = 'none';
    onOk();
  }).catch(fail);
}
function rainStartLine(){
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16; const cx = cv.getContext('2d');
  for(let i=0;i<32;i++) for(let j=0;j<2;j++){ cx.fillStyle = ((i+j)%2) ? '#111' : '#f4f4f4'; cx.fillRect(i*8, j*8, 8, 8); }
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
  const cols = 32, g = new THREE.PlaneGeometry(1,1,cols,1), p = g.attributes.position;
  for(let i=0;i<=cols;i++) for(let r=0;r<2;r++){
    const lat = -8 + 16*i/cols, t = r ? 0.6 : -0.6;
    const x = RAIN_F[0] + RAIN_D[0]*t + RAIN_NN[0]*lat, z = RAIN_F[1] + RAIN_D[1]*t + RAIN_NN[1]*lat, h = gH(x,z,1e5);
    p.setXYZ(r*(cols+1)+i, x, (h > -1e8 ? h : 0) + 0.06, z);
  }
  g.computeVertexNormals();
  rainRoot.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({map:tex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4})));
}
function rainExtras(){
  if(RAINX) return; RAINX = 1;
  try{ buildBarrier('d-rainbar', rainRoot); }catch(e){ console.error(e); }
  try{ rainStartLine(); }catch(e){ console.error(e); }
  try{ buildPit(); }catch(e){ console.error(e); }
}
function playMap(id, fresh){ if(id === 'city') id = 'spa';
  if(id === mapId && started && !fresh){ startGame(false); return; }
  const go = ()=>{ useMap(id); if(id === 'rain') rainExtras(); startGame(true); };
  if(id === 'city' && cityState !== 2) loadCity(go); else if(id === 'rain' && rainState !== 2) loadRain(go); else go();
}

// ───────── [08-bosh-ekran.js] ─────────
// ==================================================================
// BOSH EKRAN: ikki mashina (chapda Mercedes, o'ngda Porsche), o'rtada kartalar
// ==================================================================
const stage = new THREE.Group(); scene.add(stage);
const slotG = CARS.map(()=>{
  const g = new THREE.Group(); stage.add(g);
  const px = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 4.9), new THREE.MeshBasicMaterial({visible:false}));
  px.position.y = 0.75; g.add(px); g.userData.px = px; return g;
});
const MS = CARS.map(()=>({x:0, z:-12, s:1, h:0, v:1, wx:0, wy:0, wz:0}));
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _pv = new THREE.Vector3(), _Yax = new THREE.Vector3(0,1,0);
const tagEls = [ $m('tag0'), $m('tag1') ], tagKey = ['', ''];
function dockModels(){
  CARS.forEach((c,i)=>{ const cc = carCache[i]; if(!cc) return; if(cc.model.parent !== slotG[i]) slotG[i].add(cc.model); applyTune(i); });
  for(const r of wheelRigs) r.steer.rotation.y = 0;
}
function menuTargets(i, hw, D){
  const side = (i % 2 === 0) ? -1 : 1, sel = (i === carIdx);
  if(i > 1) return { x:side*1.7*hw, z:-D, s:1, h:0, v:0 };
  if(mview === 'tune'){
    if(i === tuneIdx) return { x:0.2*hw, z:-D*0.78, s:1.1, h:-0.42, v:1 };
    return { x:side*1.7*hw, z:-D, s:1, h:-side*0.5, v:0 };
  }
  return { x:side*(garageOn ? 0.61 : 0.64)*hw, z:-D, s:sel ? 1.04 : 0.97, h:-side*0.5, v:1 };
}
function menuFrame(dt){
  const M = (garageOn && MENUCAM.garage) || MENUCAM[mapId]; if(!M) return;
  camera.position.set(M.x, M.y, M.z); camera.quaternion.setFromAxisAngle(_Yax, M.yaw); camera.updateMatrixWorld(true);
  stage.position.copy(camera.position); stage.quaternion.copy(camera.quaternion);
  const asp = camera.aspect || 1.78, hw0 = Math.tan(camera.fov*Math.PI/360)*asp, portrait = asp < 1;
  const D = Math.min(30, Math.max(11, 10.5/hw0)), hw = D*hw0;
  const k = msSnap ? 1 : 1 - Math.exp(-dt*6.5), sn = Math.sin(M.yaw), cs = Math.cos(M.yaw), tt = performance.now()*0.001;
  for(let i=0;i<CARS.length;i++){
    const T = menuTargets(i, hw, D), S = MS[i];
    S.x += (T.x - S.x)*k; S.z += (T.z - S.z)*k; S.s += (T.s - S.s)*k; S.h += (T.h - S.h)*k; S.v += (T.v - S.v)*k;
    const wx = stage.position.x + S.x*cs + S.z*sn, wz = stage.position.z - S.x*sn + S.z*cs;
    const g = garageOn ? -1e9 : gH(wx, wz, 1e5), ly = (g > -1e8 ? g : M.y - 1.55) - stage.position.y + (portrait ? D*0.2 : 0);
    const sl = slotG[i];
    sl.position.set(S.x, ly, S.z); sl.rotation.y = S.h + Math.sin(tt*0.6 + i*2)*0.03; sl.scale.setScalar(S.s);
    sl.visible = S.v > 0.03;
    S.wx = wx; S.wy = ly + stage.position.y; S.wz = wz;
  }
  msSnap = false;
  if(garageOn){ scene.fog.near = 800; scene.fog.far = 3000; }
  const fx = -Math.sin(M.yaw)*D, fz = -Math.cos(M.yaw)*D;
  sun.target.position.set(stage.position.x + fx, stage.position.y - 1.5, stage.position.z + fz);
  sun.position.copy(sun.target.position).add(envSunOff);
  updTags();
}
function updTags(){
  const modal = !pC.hidden || !pR.hidden || !pO.hidden;
  for(let i=0;i<tagEls.length;i++){
    const el = tagEls[i], S = MS[i]; if(!el) continue;
    const show = mview !== 'tune' && !modal && !!carCache[i] && S.v > 0.5;
    const key = show ? (mview + '|' + (carIdx === i ? 1 : 0)) : '';
    if(key !== tagKey[i]){
      tagKey[i] = key; el.style.opacity = show ? '1' : '0';
      if(show){
        const c = CARS[i], sub = mview === 'garage' ? 'Rangini o’zgartirish ›' : (carIdx === i ? '✓ Tanlangan' : 'Tanlash uchun bosing');
        el.innerHTML = '<b>' + c.title + '</b><span class="' + (mview === 'home' && carIdx === i ? 'sel' : '') + '">' + sub + '</span>';
      }
    }
    if(!show) continue;
    _pv.set(S.wx, S.wy, S.wz).project(camera);
    el.style.transform = 'translate(' + ((_pv.x*0.5 + 0.5)*innerWidth).toFixed(0) + 'px,' + ((-_pv.y*0.5 + 0.5)*innerHeight + 12).toFixed(0) + 'px) translateX(-50%)';
  }
}
function pickAt(cx, cy){
  _ndc.set(cx/innerWidth*2 - 1, -(cy/innerHeight)*2 + 1); _ray.setFromCamera(_ndc, camera);
  let best = -1, bd = 1e9;
  for(let i=0;i<CARS.length;i++){
    if(MS[i].v < 0.5 || !carCache[i]) continue;
    const h = _ray.intersectObject(slotG[i].userData.px, false);
    if(h.length && h[0].distance < bd){ bd = h[0].distance; best = i; }
  }
  return best;
}
function onCarClick(i){
  if(mview === 'home') pickCar(i);
  else if(mview === 'garage'){ carIdx = i; tuneIdx = i; setView('tune'); }
}

const $home = $m('home');
function pickCar(i){
  if(i < 0 || i >= CARS.length || !CARS[i].open) return;
  carIdx = i; renderSlots(); msSnap = false; updTags();
  if(mview === 'tune'){ tuneIdx = i; renderGarage(); }
  ensureCar(i, dockModels);
}
function renderSlots(){
  const box = $m('hmSlots'); if(!box) return;
  box.innerHTML = CARS.map((cc,i)=>'<div data-a="slot" data-i="'+i+'" style="cursor:pointer" class="'+(i===carIdx?'on':'')+'">'+(cc.open?(i+1):'🔒')+'</div>').join('')
    + '<div title="Tez orada">🔒</div>'.repeat(Math.max(0, SLOTS - CARS.length));
  const p = document.querySelector('#hmGar [data-a=prev]'), n = document.querySelector('#hmGar [data-a=next]');
  if(p) p.disabled = carIdx <= 0; if(n){ const nx = CARS[carIdx+1]; n.disabled = !(nx && nx.open); }
}
// Garajda tanlangan mashina: yig'ma rang paneli (o'ng tomonda)
function renderGarage(){
  const c = CARS[carIdx];
  pG.innerHTML = '<h2>' + c.title + '</h2><p class="tag">' + c.name + ' · ' + c.tag + '</p>'
    + c.stats.map(s=>'<div class="stat"><span>'+s[0]+'</span><i><u style="width:'+s[1]+'%"></u></i><span>'+s[2]+'</span></div>').join('')
    + tuneRows(carIdx)
    + (c.credit ? '<p style="margin:14px 0 0;font-size:11.5px;opacity:.55">' + c.credit + '</p>' : '')
    + '<button class="back" data-a="tback">← Orqaga</button>';
}
function setView(v){
  mview = v; $home.dataset.v = v;
  pG.hidden = v !== 'tune';
  if(v === 'tune'){ tuneIdx = carIdx; renderGarage(); }
  renderSlots(); updTags();
}
function openPanel(p){
  pC.hidden = p !== pC; pR.hidden = p !== pR; pO.hidden = p !== pO;
  if(p === pR) renderRecords();
  $home.classList.toggle('modal', !!p);
  if(p === pO){ const f = $m(NET.on ? 'oRoomCode' : ($m('oName').value ? 'oCode' : 'oName')); if(f && f.focus && !NET.on) f.focus({preventScroll:true}); }
  else if(p){ const b = p.querySelector('.back'); b && b.focus({preventScroll:true}); }
}
function openMenu(){
  inMenu = true; for(const k in keys) keys[k] = false; applyVis();
  document.body.classList.add('menu');
  stage.visible = true; dockModels(); msSnap = true;
  $m('hmResume').hidden = !started;
  openPanel(null); setView('home');
  camera.fov = 40; camera.updateProjectionMatrix();
}
function startGame(fresh){
  const m = carCache[carIdx];
  if(!m){ ensureCar(carIdx, ()=>startGame(fresh)); return; }
  if(curModel !== m.model){ showCar(carIdx); fresh = true; }
  else carGroup.add(curModel);
  if(fresh || !started) resetCar();
  started = true; inMenu = false; applyVis(); onGameStart();
  document.body.classList.remove('menu');
  camera.fov = 58; camera.updateProjectionMatrix();
  stage.visible = false;
  if(document.activeElement) document.activeElement.blur();
  try{ netOnStart(); }catch(e){}
}
function menuEsc(){
  if(!inMenu) openMenu();
  else if(!pC.hidden || !pR.hidden || !pO.hidden) openPanel(null);
  else if(mview === 'tune') setView('garage');
  else if(mview === 'garage') setView('home');
  else if(started) startGame(false);
}
function menuKey(e,k){
  if(k === 'arrowleft' && mview !== 'home'){ pickCar(carIdx - 1); }
  else if(k === 'arrowright' && mview !== 'home'){ pickCar(carIdx + 1); }
  else if(k === 'enter' && document.activeElement === document.body && mview === 'home'){ playMap(mapId, false); }
}
$m('menu').addEventListener('click', e=>{
  const b = e.target.closest('[data-a]');
  if(!b){
    if(inMenu && pC.hidden && pR.hidden && pO.hidden && !e.target.closest('.panel') && !e.target.closest('.hm-top')){
      const i = pickAt(e.clientX, e.clientY); if(i >= 0) onCarClick(i);
    }
    return;
  }
  const a = b.dataset.a;
  if(a === 'map') playMap(b.dataset.m, false);
  else if(a === 'play') playMap(mapId, false);
  else if(a === 'new') playMap(mapId, true);
  else if(a === 'garage') setView('garage');
  else if(a === 'gback') setView('home');
  else if(a === 'tback') setView('garage');
  else if(a === 'controls') openPanel(pC);
  else if(a === 'missions') openPanel(pR);
  else if(a === 'body') setTune(carIdx, 'body', +b.dataset.i);
  else if(a === 'rim') setTune(carIdx, 'rim', +b.dataset.i);
  else if(a === 'close') openPanel(null);
  else if(a === 'prev') pickCar(carIdx - 1);
  else if(a === 'next') pickCar(carIdx + 1);
  else if(a === 'slot') pickCar(+b.dataset.i);
  else if(a === 'hard') setHard(!hardPref);
  else if(a === 'snd') setSound(!AUD.on);
  else if(a === 'fs') toggleFS();
  else if(a === 'gfx') gfxCycle();
  else if(a === 'online') openPanel(pO);
  else if(a === 'ohost') netHost();
  else if(a === 'ojoin') netJoin();
  else if(a === 'oleave') netLeave();
  else if(a === 'oplay') playMap(mapId, false);
  else if(a === 'ocopy') netCopy();
});
renderSlots();
ensureCar(carIdx, ()=>{ showCar(carIdx); dockModels(); CARS.forEach((c,i)=>{ if(i !== carIdx) ensureCar(i, dockModels); }); });
trackDone.then(loadGarage);
camera.fov = 40; camera.updateProjectionMatrix();

let speed = 0, heading = 0, steerVisual = 0;
