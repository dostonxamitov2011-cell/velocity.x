// ====================================================================
// O’yin tizimlari: missiya, tuning, mobil boshqaruv, drift
// ====================================================================

// ───────── [12-missiya.js] ─────────
// ==================================================================
// MISSIYALAR: vaqtga qarshi 5 ta chekpunkt + rekordlar (localStorage)
// ==================================================================
const REKORDS_KEY = 'game3d_rekordlar';
const MSTATE = { on:false, idx:0, total:5, tLeft:0, elapsed:0, animT:0, hudT:0, tx:0, tz:0, grp:null, ring:null };
function rekords(){
  try{ const v = JSON.parse(localStorage.getItem(REKORDS_KEY)); return Array.isArray(v) ? v : []; }catch(e){ return []; }
}
function rekordPush(sec){
  const rs = rekords(); rs.push(sec); rs.sort((a,b)=>a-b);
  if(rs.length > 5) rs.length = 5;
  try{ localStorage.setItem(REKORDS_KEY, JSON.stringify(rs)); }catch(e){}
}
function missionToggle(){
  if(!carLoaded) return;
  const mv = document.getElementById('mission'); if(!mv) return;
  if(MSTATE.on){
    MSTATE.on = false;
    if(MSTATE.grp) MSTATE.grp.visible = false;
    mv.hidden = true; mv.classList.remove('ok','fail');
    return;
  }  if(!groundReady) return;
  MSTATE.on = true; MSTATE.idx = 0; MSTATE.tLeft = 100; MSTATE.elapsed = 0; MSTATE.animT = 0; MSTATE.hudT = 0;
  if(MSTATE.hider) clearTimeout(MSTATE.hider);
  mv.hidden = false; mv.classList.remove('ok','fail');
  missionSpawn();
  mv.querySelector('b').textContent = 'Chekpunkt 0/' + MSTATE.total + ' - yugur!';
  document.getElementById('mInfo').textContent = Math.ceil(MSTATE.tLeft) + ' s';
}
function missionSpawn(){
  const bp = chassisBody.position, n = roadPts.length/2;
  for(let k=0;k<60 && n;k++){
    const i = (Math.random()*n)|0, x = roadPts[2*i], z = roadPts[2*i+1], d = Math.hypot(x-bp.x, z-bp.z);
    if(d < 150 || d > 420) continue;
    const y = gH(x, z, 1e5);
    if(y > -1e8){
      MSTATE.grp.position.set(x, y + 0.05, z);
      MSTATE.grp.visible = true;
      MSTATE.tx = x; MSTATE.tz = z;
      return;
    }
  }
  let bi = 0, bd = 1e9;
  for(let i=0;i<n;i++){ const d = Math.abs(Math.hypot(roadPts[2*i]-bp.x, roadPts[2*i+1]-bp.z) - 200); if(d < bd){ bd = d; bi = i; } }
  MSTATE.tx = n ? roadPts[2*bi] : bp.x + 200; MSTATE.tz = n ? roadPts[2*bi+1] : bp.z;
  MSTATE.grp.position.set(MSTATE.tx, bp.y, MSTATE.tz);
  MSTATE.grp.visible = true;
}
function missionStop(outcome){
  MSTATE.on = false;
  if(MSTATE.grp) MSTATE.grp.visible = false;
  const mv = document.getElementById('mission'); if(!mv) return;
  const info = document.getElementById('mInfo');
  if(outcome === 'ok'){
    mv.classList.add('ok');
    mv.querySelector('b').textContent = 'Missiya bajarildi!';
    info.textContent = MSTATE.elapsed.toFixed(1) + ' sek - rekord saqlandi';
    rekordPush(MSTATE.elapsed);
  } else if(outcome === 'fail'){
    mv.classList.add('fail');
    mv.querySelector('b').textContent = 'Vaqt tugadi!';
    info.textContent = MSTATE.idx + '/' + MSTATE.total;
  }
  const hide = () => { mv.hidden = true; mv.classList.remove('ok','fail'); };
  if(outcome) MSTATE.hider = setTimeout(hide, 4200);
}
function updateMission(dt){
  if(!MSTATE.grp) return;
  if(!MSTATE.on){ if(MSTATE.grp.visible) MSTATE.grp.visible = false; return; }
  MSTATE.elapsed += dt; MSTATE.tLeft -= dt; MSTATE.animT += dt;
  if(MSTATE.tLeft <= 0){ missionStop('fail'); return; }
  if(MSTATE.grp.visible === false) MSTATE.grp.visible = true;
  MSTATE.grp.rotation.y += dt*0.5;
  MSTATE.ring.material.opacity = 0.65 + Math.sin(MSTATE.animT*3)*0.3;
  MSTATE.ring.position.y = 6.5 + Math.sin(MSTATE.animT*2.2)*0.3;
  const dx = MSTATE.tx - chassisBody.position.x, dz = MSTATE.tz - chassisBody.position.z;
  const dist = Math.hypot(dx, dz);
  if(dist < 8.5){
    MSTATE.idx++;
    if(MSTATE.idx >= MSTATE.total){ missionStop('ok'); return; }
    MSTATE.tLeft += 25;
    MSTATE.grp.visible = false;
    missionSpawn();
  }
  MSTATE.hudT -= dt;
  if(MSTATE.hudT <= 0){
    MSTATE.hudT = 0.25;
    const mv = document.getElementById('mission');
    if(mv) mv.querySelector('b').textContent = 'Chekpunkt ' + MSTATE.idx + '/' + MSTATE.total;
    const info = document.getElementById('mInfo');
    if(info) info.textContent = 'Vaqt: ' + Math.ceil(MSTATE.tLeft) + ' s \u00b7 ' + Math.round(dist) + ' m';
  }
  const ar = document.getElementById('mArrow');
  if(ar) ar.style.transform = 'rotate(' + ((Math.atan2(dx, dz) - heading) * -57.2958) + 'deg)';
}
{
  const mq = new THREE.Group();
  const mRing = new THREE.Mesh(new THREE.TorusGeometry(6, 0.35, 8, 28),
    new THREE.MeshBasicMaterial({color:0xffd23f, transparent:true, opacity:0.95}));
  mRing.position.y = 6.5;
  const mBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 58, 8, 1, true),
    new THREE.MeshBasicMaterial({color:0xffd23f, transparent:true, opacity:0.15, depthWrite:false, side:THREE.DoubleSide}));
  mBeam.position.y = 29;
  const mPad = new THREE.Mesh(new THREE.CircleGeometry(6, 24),
    new THREE.MeshBasicMaterial({color:0xffd23f, transparent:true, opacity:0.13, depthWrite:false}));
  mPad.rotation.x = -Math.PI/2;
  mq.add(mRing); mq.add(mBeam); mq.add(mPad);
  mq.visible = false;
  scene.add(mq);
  MSTATE.grp = mq;
  MSTATE.ring = mRing;
}
function renderRecords(){
  const box = document.getElementById('recList'); if(!box) return;
  const rs = rekords();
  box.innerHTML = rs.length
    ? 'Eng yaxshi 5 natija (sek):<br><b>' + rs.map((r,i)=>(i+1)+'. '+r.toFixed(1)+' s').join('<br>') + '</b>'
    : 'Hali rekord yo\u2019q. O\u2019yinda <b>M</b> bosing: 5 ta oltin halqani o\u2019tab chiqing!';
}

// ───────── [13-tuning-izlar.js] ─────────
// ==================================================================
// TUNING: kuzov rangi va disklar (garaj panellarida, localStorage)
// ==================================================================
// Kuzov ranglari (oldingi 8 tasi joyida qoldi — saqlangan tanlov buzilmasin) + yangilari
const BODYC = ['#ffd23f','#ff6a4d','#4db2ff','#59d98c','#ffffff','#40434a','#c56cf0','#ffb3c1',
               '#e8222a','#ff8a1f','#1fc7b6','#2f5bff','#9aa1ab','#15161a'];
// Disk ranglari
const RIMC  = ['#d6d9de','#17181c','#d4a04a','#8a5a2b','#e8222a','#2f5bff','#ffd23f','#ffffff'];
const TUNE_KEY = 'game3d_tuning_';

// Qaysi materiallar kuzov bo'yog'i / disk ekanini mashina bo'yicha aniq ko'rsatamiz.
// paint: bo'yoqning asl rangi (hue 0..1) va yorqinligi — shu rangga o'xshash piksellar almashadi,
// yozuv, logotip, bayroq, qora naqsh va oynalar tegilmaydi.
const TUNECFG = [
  { paint:{re:/^EXT_CarPaint/,       hue:190/360, w:0.05, f:0.025, lum:0.188}, rim:[/^EXT_Rims/, /^EXT_Rim_Hub/] },   // Mercedes
  { paint:{re:/^EXT_Carpaint_Inst$/, hue:41/360,  w:0.07, f:0.04,  lum:0.40 }, rim:[/^EXT_RIM_0$/] }                  // Porsche
];

const TINT_UNI = 'uniform float uOn; uniform vec3 uCol; uniform float uHue; uniform float uW; uniform float uF; uniform float uBase;\n';
const GLSL_PAINT = `
#ifdef USE_MAP
  vec4 texelColor = texture2D( map, vUv );
  texelColor = mapTexelToLinear( texelColor );
  if(uOn > 0.5){
    vec3 c = texelColor.rgb;
    vec3 g = pow(max(c, vec3(0.0)), vec3(0.4545));
    float mx = max(g.r, max(g.g, g.b)), mn = min(g.r, min(g.g, g.b)), d = mx - mn;
    float h = 0.0;
    if(d > 1e-4){
      if(mx == g.r) h = mod((g.g - g.b)/d, 6.0);
      else if(mx == g.g) h = (g.b - g.r)/d + 2.0;
      else h = (g.r - g.g)/d + 4.0;
      h /= 6.0;
    }
    float dh = abs(h - uHue); dh = min(dh, 1.0 - dh);
    float sat = d / (mx + 1e-5);
    float m = (1.0 - smoothstep(uW, uW + uF, dh)) * smoothstep(0.30, 0.50, sat) * smoothstep(0.02, 0.06, mx);
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    texelColor.rgb = mix(c, uCol * clamp(lum / uBase, 0.0, 1.6), m);
  }
  diffuseColor *= texelColor;
#endif
`;
const GLSL_RIM = `
#ifdef USE_MAP
  vec4 texelColor = texture2D( map, vUv );
  texelColor = mapTexelToLinear( texelColor );
  if(uOn > 0.5){
    float lum = dot(texelColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    texelColor.rgb = uCol * (0.55 + 1.5 * lum);
  }
  diffuseColor *= texelColor;
#endif
`;
function hookTint(m, kind, P){
  const u = { uOn:{value:0}, uCol:{value:new THREE.Color(1,1,1)}, uHue:{value:P.hue||0},
              uW:{value:P.w||0.05}, uF:{value:P.f||0.03}, uBase:{value:P.lum||0.2} };
  m.onBeforeCompile = sh=>{
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = TINT_UNI + sh.fragmentShader.replace('#include <map_fragment>', kind==='paint' ? GLSL_PAINT : GLSL_RIM);
  };
  m.customProgramCacheKey = ()=>'tint_'+kind;
  m.needsUpdate = true;
  return u;
}
function setTint(m, kind, P, hex){
  const ud = m.userData;
  if(ud._tint === undefined){
    ud._oc = m.color.clone();
    ud._tint = m.map ? hookTint(m, kind, P) : null;   // teksturasi bor — shader; yo'q — oddiy rang
  }
  if(ud._tint){
    ud._tint.uOn.value = hex ? 1 : 0;
    if(hex) ud._tint.uCol.value.set(hex).convertSRGBToLinear();
  } else {
    if(ud._om === undefined) ud._om = m.metalness;
    if(hex){ m.color.set(hex).convertSRGBToLinear(); m.metalness = Math.min(ud._om, 0.15); }   // metall + aks muhiti yo'q = qoramtir bo'lib qolardi
    else { m.color.copy(ud._oc); m.metalness = ud._om; }
  }
}
function getTune(i){
  let t = { body:null, rim:null };
  try{ const v = JSON.parse(localStorage.getItem(TUNE_KEY + i)); if(v && typeof v === 'object') t = Object.assign(t, v); }catch(e){}
  return t;
}
function setTune(i, k, v){
  const t = getTune(i);
  t[k] = (v < 0 || t[k] === v) ? null : v;   // asl tugmasi yoki bir xil rang yana bosilsa: asliga qaytadi
  try{ localStorage.setItem(TUNE_KEY + i, JSON.stringify(t)); }catch(e){}
  applyTune(i);
  renderGarage();
}
function applyTune(idx){
  const cc = carCache && carCache[idx]; if(!cc || !cc.model) return;
  const cfg = TUNECFG[idx]; if(!cfg) return;
  const t = getTune(idx);
  const body = (t.body != null && BODYC[t.body]) || null;
  const rim  = (t.rim  != null && RIMC[t.rim])   || null;
  const seen = new Set();
  cc.model.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    for(const m of (Array.isArray(o.material) ? o.material : [o.material])){
      if(!m || !m.color || seen.has(m)) continue;
      seen.add(m);
      const nm = m.name || '';
      if(cfg.paint.re.test(nm)) setTint(m, 'paint', cfg.paint, body);
      else if(cfg.rim.some(r=>r.test(nm))) setTint(m, 'rim', {}, rim);
    }
  });
}
function tuneRows(i){
  const t = getTune(i);
  const sw = (a, arr, cur)=> '<button data-a="'+a+'" data-i="-1" class="reset'+(cur==null?' on':'')+'" title="Asl rang">\u21ba</button>'
    + arr.map((h,j)=>'<button data-a="'+a+'" data-i="'+j+'" style="background:'+h+'" class="'+(cur===j?'on':'')+'"></button>').join('');
  return '<div class="tune"><span>Kuzov rangi (yozuv va logotiplar o\u2019zgarmaydi)</span><div class="swatches">' + sw('body', BODYC, t.body) + '</div></div>'
    + '<div class="tune"><span>Disklar</span><div class="swatches">' + sw('rim', RIMC, t.rim) + '</div></div>';
}

// ==================================================================
// IZLAR: shina izlari 10 sek vaz vazexe kech, so'ng 4 sek ichida so'nadi
// ==================================================================
let markAge = null;   // MARKS keyinrda deklaratsiya qilinadi - birinchi chaqiruvga kechiktiriladi
const _hideM = new THREE.Matrix4().makeScale(0.0001,0.0001,0.0001).setPosition(0,-1e4,0);
const _mScale = new THREE.Matrix4();
function updateMarks(dt){
  if(!markAge) markAge = new Float32Array(MARKS);
  let dirty = false;
  for(let i=0;i<MARKS;i++){
    const a = markAge[i]; if(a <= 0) continue;
    const na = a + dt;
    if(na >= 14){ markAge[i] = 0; marks.setMatrixAt(i, _hideM); dirty = true; continue; }
    markAge[i] = na;
    if(na > 10){
      const s = Math.max(0.0001, 1 - (na - 10)/4);
      marks.getMatrixAt(i, _m4);
      _mScale.makeScale(s, s, s);
      _m4.multiply(_mScale);
      marks.setMatrixAt(i, _m4);
      dirty = true;
    }
  }
  if(dirty) marks.instanceMatrix.needsUpdate = true;
}

// ───────── [14-mobil-boshqaruv-drift.js] ─────────
// ==================================================================
// MOBIL BOSHQARUV: sensorli ekran uchun tugmalar
// ==================================================================
(function(){
  let on = false;
  const HOLD = { tg:'w', tb:'s', tsl:'a', tsr:'d', th:' ' };
  const TAPK = { tc:'c', tm:'m', tr:'r', tli:'l', tw:'y', tt:'t', tmn:'Escape' };
  const press = key=>{ window.dispatchEvent(new KeyboardEvent('keydown', {key})); window.dispatchEvent(new KeyboardEvent('keyup', {key})); };
  function enable(){
    if(on) return; on = true;
    document.body.classList.add('touch');
    for(const id in HOLD){
      const b = document.getElementById(id); if(!b) continue;
      const k = HOLD[id];
      const dn = e=>{ e.preventDefault(); keys[k] = true; b.classList.add('dn'); };
      const up = e=>{ if(e.cancelable) e.preventDefault(); keys[k] = false; b.classList.remove('dn'); };
      b.addEventListener('pointerdown', dn);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    }
    for(const id in TAPK){
      const b = document.getElementById(id); if(!b) continue;
      b.addEventListener('pointerdown', e=>{
        e.preventDefault(); b.classList.add('dn'); setTimeout(()=>b.classList.remove('dn'), 150);
        press(TAPK[id]);   // keydown + keyup: aks holda keys[...] true qolib, ikkinchi bosish ishlamaydi
      });
    }
    // sahifa siljishi, zoom va uzoq bosishdagi menyuni o'chirish (menyuning o'zi siljiydi)
    document.addEventListener('touchmove', e=>{ if(!(e.target.closest && e.target.closest('#menu'))) e.preventDefault(); }, {passive:false});
    ['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t, e=>e.preventDefault()));
    document.addEventListener('contextmenu', e=>e.preventDefault());
    // barmoq ekrandan chiqib ketsa yoki ilova fonga o'tsa — tugmalar "yopishib" qolmasin
    const releaseAll = ()=>{ for(const id in HOLD){ keys[HOLD[id]] = false; const b = document.getElementById(id); if(b) b.classList.remove('dn'); } };
    addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', ()=>{ if(document.hidden) releaseAll(); });
  }
  if(MOBILE || /#touch/.test(location.hash)) enable();
  else addEventListener('pointerdown', e=>{ if(e.pointerType === 'touch') enable(); }, {passive:true});
})();
// Uchqunlar (Points puli)
const SP = 160, spP = new Float32Array(SP*3).fill(-1e4), spC = new Float32Array(SP*3), spV = new Float32Array(SP*3), spL = new Float32Array(SP);
let spI = 0;
const spG = new THREE.BufferGeometry();
spG.setAttribute('position', new THREE.BufferAttribute(spP, 3)); spG.setAttribute('color', new THREE.BufferAttribute(spC, 3));
const sparks = new THREE.Points(spG, new THREE.PointsMaterial({size:0.14, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
sparks.frustumCulled = false; scene.add(sparks);
function emitSparks(p, dir, n){
  const cv = chassisBody.velocity;
  for(let k=0;k<n;k++){
    const i = spI++ % SP, j = i*3, s = 2 + Math.random()*6;
    spP[j]=p.x; spP[j+1]=p.y; spP[j+2]=p.z;
    spV[j]   = cv.x*0.5 + (dir.x + Math.random()-0.5)*s;
    spV[j+1] = cv.y*0.5 + (dir.y + Math.random()*0.8)*s;
    spV[j+2] = cv.z*0.5 + (dir.z + Math.random()-0.5)*s;
    spL[i] = 0.35 + Math.random()*0.45;
  }
  spLive = true;
}
function updateSparks(dt){
  if(!spLive) return;
  let alive = false;
  for(let i=0;i<SP;i++){
    if(spL[i] <= 0) continue;
    const j = i*3; spL[i] -= dt;
    if(spL[i] <= 0){ spP[j+1] = -1e4; continue; }
    alive = true; spV[j+1] -= 9.8*dt;
    spP[j] += spV[j]*dt; spP[j+1] += spV[j+1]*dt; spP[j+2] += spV[j+2]*dt;
    const f = spL[i]/0.8; spC[j] = f; spC[j+1] = (0.35 + 0.4*f)*f; spC[j+2] = 0.1*f*f;
  }
  spG.attributes.position.needsUpdate = spG.attributes.color.needsUpdate = true;
  spLive = alive;
}

// ---- DRIFT EFFEKTLARI: shinalar izlari (InstancedMesh) + tutun (Points puli) ----
const MARKS = 420;                       // iz kvadlari puli (aylanma, FPS ustida ozgina)
const markGeo = new THREE.PlaneGeometry(0.24, 1.5);
markGeo.rotateX(-Math.PI/2);             // yotqizilgan tombon kvad
const marks = new THREE.InstancedMesh(markGeo,
  new THREE.MeshBasicMaterial({color:0x0e0e12, transparent:true, opacity:0.42, depthWrite:false}), MARKS);
marks.frustumCulled = false;
marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(marks);
let markI = 0;
const _m4 = new THREE.Matrix4(), _mu = new THREE.Vector3(0,1,0), _mq2 = new THREE.Quaternion();
{
  const hide = new THREE.Matrix4().makeScale(0.0001,0.0001,0.0001).setPosition(0,-1e4,0);
  for(let i=0;i<MARKS;i++) marks.setMatrixAt(i, hide);
  marks.instanceMatrix.needsUpdate = true;
}
function addMark(x, y, z, yaw){
  _mq2.setFromAxisAngle(_mu, yaw);
  _m4.makeRotationFromQuaternion(_mq2).setPosition(x, y+0.02, z);
  marks.setMatrixAt(markI % MARKS, _m4);
  markAge[markI % MARKS] = 0;
  markI++;
  marks.instanceMatrix.needsUpdate = true;
}
const SM = 130;                          // tutun zarralari puli
const smP = new Float32Array(SM*3).fill(-1e4), smC = new Float32Array(SM*3), smV = new Float32Array(SM*3), smL = new Float32Array(SM);
let smI = 0, smLive = false, smEmitCd = 0;
const smG = new THREE.BufferGeometry();
smG.setAttribute('position', new THREE.BufferAttribute(smP, 3));
smG.setAttribute('color', new THREE.BufferAttribute(smC, 3));
// yumaloq tutun teksturasi (bir marta yasaladi)
const smTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const smoke = new THREE.Points(smG, new THREE.PointsMaterial({size:1.05, map:smTex, vertexColors:true, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false}));
smoke.frustumCulled = false; scene.add(smoke);
function emitSmoke(x, y, z){
  const cv = chassisBody.velocity, s = smI++ % SM, i = s*3;
  smP[i]=x; smP[i+1]=y+0.15; smP[i+2]=z;
  smV[i]   = cv.x*0.55 + (Math.random()-0.5)*0.7;
  smV[i+1] = 0.9 + Math.random()*0.8;
  smV[i+2] = cv.z*0.55 + (Math.random()-0.5)*0.7;
  smL[s] = 0.6 + Math.random()*0.5;
}
function updateSmoke(dt){
  if(!smLive) return;
  let alive = false;
  for(let i=0;i<SM;i++){
    if(smL[i] <= 0) continue;
    const j = i*3; smL[i] -= dt;
    if(smL[i] <= 0){ smP[j+1] = -1e4; continue; }
    alive = true;
    smV[j+1] -= 0.6*dt;                       // koparilib songi ochadi
    smP[j] += smV[j]*dt; smP[j+1] += smV[j+1]*dt; smP[j+2] += smV[j+2]*dt;
    const f = smL[i]/1.1, k = f*f*0.8;     // och-kulrang tutun, ozib ketadi
    smC[j] = k; smC[j+1] = k; smC[j+2] = k;
  }
  smG.attributes.position.needsUpdate = smG.attributes.color.needsUpdate = true;
  smLive = alive;
}
// drift paytida: iz qoyish + tutun chiqarish
function driftEffects(dt){
  const kmhD = vehicle.currentVehicleSpeedKmHour;
  if(!(keys[' '] && Math.abs(kmhD) > 12)){ smEmitCd = 0; return; }
  for(const wi of [2,3]){
    const w = vehicle.wheelInfos[wi];
    if(!w.isInContact) continue;
    const p = w.raycastResult.hitPointWorld;
    addMark(p.x, p.y, p.z, heading);
  }
  smEmitCd -= dt;
  if(smEmitCd <= 0){
    smEmitCd = 0.045;                    // sekundiga ~22 zarra (yoruglik puli kichkina)
    for(const wi of [2,3]){
      const w = vehicle.wheelInfos[wi];
      if(!w.isInContact) continue;
      const p = w.raycastResult.hitPointWorld;
      emitSmoke(p.x, p.y, p.z);
    }
    smLive = true;
  }
}

// Yagona zarba nuqtasi: v — zarba tezligi (m/s), dir — zarbaning mashinaga ta'sir yo'nalishi (dunyo, birlik vektor)
function hit(v, dir){
  if(v < IMPACT_MIN || impCd > 0 || !curModel || !curModel.userData.def) return;
  impCd = 0.3;
  const raw = v*DENT_PER_MS*(1 - 0.4*Math.abs(dir.y));              // chuqurlik ~ tezlik (vertikal zarbada biroz kam)
  const depth = Math.min(raw, DENT_LIMIT), over = Math.min((raw - depth)/DENT_LIMIT, 1.5);
  const sev = Math.min(v/30, 1), R = DENT_R*(0.6 + 0.5*sev)*(1 + 1.2*over);   // chegaradan oshsa — ko'proq uchlar ezilsin
  const p = contactPoint(_hn.copy(dir).negate());                    // zarbaga qaragan sirt yamog'i
  deform(p, dir, depth, R, sev);
  emitSparks(p, dir, Math.round(10 + 50*sev));
  shake = Math.max(shake, 0.12 + 0.5*sev);
  feelHit(sev);
}
// Cannon 'collide' (boshqa jism qo'shilsa ishlaydi); shahar yo'li gH() orqali — shuning uchun stepPhysics da tezlik o'zgarishi ham kuzatiladi
chassisBody.addEventListener('collide', e=>{
  const ct = e.contact, n = ct.ni, sg = ct.bi === chassisBody ? -1 : 1;
  hit(Math.abs(ct.getImpactVelocityAlongNormal()), _hd.set(n.x*sg, n.y*sg, n.z*sg).normalize());
});
// Teleportdan keyin interpolatsiya sakramasin
function teleport(){
  const c = chassisBody;
  c.previousPosition.copy(c.position); c.interpolatedPosition.copy(c.position);
  c.previousQuaternion.copy(c.quaternion); c.interpolatedQuaternion.copy(c.quaternion);
}
// R: mashina hozirgi joyida, yerga to'g'ri (g'ildirak ustida, yer qiyaligiga mos) qo'yiladi; yo'nalish saqlanadi, tezlik = 0
const _Y = new THREE.Vector3(0,1,0), _rn = new THREE.Vector3(), _rq1 = new THREE.Quaternion(), _rq2 = new THREE.Quaternion();
function flipReset(){
  const c = chassisBody;
  let x = c.position.x, z = c.position.z;
  if(T_S){ const sv = sdf(x,z); if(sv < 1.5){ const g = sdfGrad(x,z); x += g.x*(1.5 - sv); z += g.z*(1.5 - sv); } }   // devorga qapishib qolgan bo'lsa — biroz ichkariga
  let g = groundReady ? gH(x, z, 1e5) : -1e9;
  if(g < -1e8){ x = START.x; z = START.z; heading = START.heading; g = groundReady ? gH(x, z, 1e5) : 0; }
  let nx = 0, nz = 0;
  const a = gH(x+1,z,1e5), b = gH(x-1,z,1e5), d = gH(x,z+1,1e5), e = gH(x,z-1,1e5);
  if(a > -1e8 && b > -1e8 && d > -1e8 && e > -1e8){ nx = -(a-b)/2; nz = -(d-e)/2; }
  _rn.set(nx, 1, nz).normalize();
  _rq1.setFromAxisAngle(_Y, heading);
  _rq2.setFromUnitVectors(_Y, _rn).multiply(_rq1);
  c.position.set(x, g + CH_Y + 0.3, z);
  c.quaternion.set(_rq2.x, _rq2.y, _rq2.z, _rq2.w);
  c.velocity.set(0,0,0); c.angularVelocity.set(0,0,0); c.force.setZero(); c.torque.setZero();
  steerCur = 0; flipT = 0; impCd = 1.2; teleport(); syncCar();     // impCd: qo'nishda soxta zarba bo'lmasin
}
// X: sinov zarbalari (old, chap eshik, tom, orqa, juda kuchli old)
const TESTS = [[0,0,-1,18],[-1,0,0,16],[0,-1,0,14],[0,0,1,20],[0,0,-1,40]]; let testI = 0;
function testHit(){
  const t = TESTS[testI++ % TESTS.length], q = chassisBody.quaternion;
  impCd = 0; hit(t[3], _hd.set(t[0], t[1], t[2]).applyQuaternion(_hq.set(q.x, q.y, q.z, q.w)));
}

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
function syncCar(){
  const ip = chassisBody.interpolatedPosition, iq = chassisBody.interpolatedQuaternion;   // fizika 60Hz, ekran har xil — silliq ko'rsatish
  carGroup.quaternion.set(iq.x, iq.y, iq.z, iq.w);
  _v.set(0, -VIS_Y, 0).applyQuaternion(carGroup.quaternion);
  carGroup.position.set(ip.x + _v.x, ip.y + _v.y, ip.z + _v.z);
  _v.set(0,0,1).applyQuaternion(carGroup.quaternion);
  if(Math.hypot(_v.x, _v.z) > 0.3) heading = Math.atan2(_v.x, _v.z);   // old vertikal bo'lsa oxirgi yaw saqlanadi
  if(vehicle) speed = vehicle.currentVehicleSpeedKmHour/3.6;
}
function stepPhysics(dt){
  const c = chassisBody, v = c.velocity;
  const v0x = v.x, v0y = v.y, v0z = v.z;
  world.step(1/60, dt, 3);
  if(v.y > 6) v.y = 6;                               // bordyurdan "otilib" ketmasin
  const g = gH(c.position.x, c.position.z, c.position.y + 1);   // ehtiyot: yer ostiga tushib ketmasin
  if(g > -1e8 && c.position.y < g + 0.12){ c.position.y = g + 0.12; c.interpolatedPosition.y = Math.max(c.interpolatedPosition.y, c.position.y); if(v.y < 0) v.y = 0; }
  wallCollide();
  _hd.set(v.x-v0x, v.y-v0y, v.z-v0z); const dvm = _hd.length();
  if(dvm > IMPACT_MIN) hit(dvm, _hd.divideScalar(dvm));
  if(c.position.y < -300) resetCar();
  // ag'darilib qolsa — 2 soniyadan keyin joyida g'ildirakka qo'yadi
  _v.set(0,1,0).applyQuaternion(_q.set(c.quaternion.x,c.quaternion.y,c.quaternion.z,c.quaternion.w));
  flipT = _v.y < 0.3 ? flipT + dt : 0;
  if(flipT > 1.5) flipReset();
  syncCar();
}
