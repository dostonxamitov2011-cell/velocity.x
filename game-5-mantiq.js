// ====================================================================
// O’yin mantiqi: ovoz, pit, yoqilg’i/shina, asosiy sikl
// ====================================================================

// ───────── [15-ovoz-pit.js] ─────────
// ==================================================================
// HAYDASH HISSI: ovoz, yoqilg'i, shina yeyilishi, kuzov holati, pit-stop
// ==================================================================
const SND_KEY = 'game3d_snd', HARD_KEY = 'game3d_hard';
let hardMode = false, fuel = 1, tireWear = 0, damage = 0, wallTouch = 0, slipAmt = 0, gT = 0;
try{ hardMode = localStorage.getItem(HARD_KEY) === '1'; }catch(e){}
const UI = {};
function el(id){ return UI[id] || (UI[id] = document.getElementById(id)); }
function setText(id, t){ const n = el(id); if(n && n._t !== t){ n._t = t; n.textContent = t; } }

// ---- PIT: HAR BIR MASHINAGA ALOHIDA boks — garaj devori OLDIDA (yo'l tomonda), o'z garaj eshigi qarshisida ----
const PIT_BAYS = [12.3, 23.4, 1.0, 29.2, 6.8, 18.0];            // garaj eshiklari markazi: start/finish chizig'idan t metr oldinda
const PIT_COLORS = [0x37d6ff, 0xffc02e, 0xff5a5a, 0x7dff6a, 0xd48bff, 0xffffff];
const PIT = { lat0:2.3, len:5.4, wid:3.4, cx:0, cz:0, sel:-1, boxes:[], hold:false, t:0, Tf:0, Tt:0, Td:0, f0:1, w0:0, d0:0, fixed:false,
  gasT:0, cd:0, flash:0, fm:null, guide:false, built:false, s0:0, s1:0, s2:0 };
CARS.forEach((c, i)=>{
  const t0 = PIT_BAYS[i % PIT_BAYS.length];
  PIT.boxes.push({ t0, cx: TRK_C[0] + TRK_D[0]*t0 + TRK_N[0]*PIT.lat0, cz: TRK_C[1] + TRK_D[1]*t0 + TRK_N[1]*PIT.lat0,
    accent: PIT_COLORS[i % PIT_COLORS.length], label: String(c.title || c.name).toUpperCase(), padMat:null, lampMat:null, beamMat:null, beam:null });
});
PIT.cx = PIT.boxes[0].cx; PIT.cz = PIT.boxes[0].cz;
const PITF = { C:TRK_C, D:TRK_D, N:TRK_N }, PITBOX = { spa:PIT.boxes }, PITBUILT = { spa:false };
const PITDEF = { spa:{ C:TRK_C, D:TRK_D, N:TRK_N, lat0:2.3 }, rain:{ C:RAIN_F, D:RAIN_D, N:RAIN_NN, lat0:5.75 } };
function pitSetMap(id){
  const f = PITDEF[id]; if(!f) return;
  PITF.C = f.C; PITF.D = f.D; PITF.N = f.N; PIT.lat0 = f.lat0;
  if(!PITBOX[id]) PITBOX[id] = CARS.map((c, i)=>{ const t0 = PIT_BAYS[i % PIT_BAYS.length];
    return { t0, cx:f.C[0] + f.D[0]*t0 + f.N[0]*f.lat0, cz:f.C[1] + f.D[1]*t0 + f.N[1]*f.lat0, accent:PIT_COLORS[i % PIT_COLORS.length], label:String(c.title || c.name).toUpperCase(), padMat:null, lampMat:null, beamMat:null, beam:null }; });
  PIT.boxes = PITBOX[id]; PIT.built = !!PITBUILT[id]; PIT.sel = -1; PIT.hold = false;
  const b = PIT.boxes[carIdx] || PIT.boxes[0]; PIT.cx = b.cx; PIT.cz = b.cz;
}

function feelReset(){
  fuel = 1; tireWear = 0; damage = 0; tireGrip = 1; wallTouch = 0; slipAmt = 0;
  PIT.hold = false; PIT.cd = 0; PIT.flash = 0; gT = 0;
}
function setHard(v){
  hardPref = !!v; hardMode = hardPref && mapId !== 'city';
  try{ localStorage.setItem(HARD_KEY, hardPref ? '1' : '0'); }catch(e){}
  setText('hardV', hardPref ? (mapId !== 'city' ? 'Yoniq' : 'Yoniq (Spa, Rainier)') : 'O\u2019chiq');
  document.body.classList.toggle('hard', hardMode);
  if(!hardMode) tireGrip = 1;
  gT = 0;
}
function togglePitGuide(){ PIT.guide = !PIT.guide; }

// ================= OVOZ (WebAudio, tayyor fayl kerak emas) =================
const AUD = { ctx:null, on:true, master:null, noise:null, e:null, sc:null, wd:null, rn:null, sp:null,
  rpm:0, gear:0, thrS:0, shiftT:0, prevF:false, beep:0 };
try{ AUD.on = localStorage.getItem(SND_KEY) !== '0'; }catch(e){}
// cyl — silindrlar soni (4 taktli dvigatelda aylanishiga cyl/2 ta olov), idle/red — bo'sh yurish / maksimal aylanish
const SNDCFG = [ { cyl:8, idle:900,  red:8400, sub:1.0, rasp:0.9 },    // Mercedes V8
                 { cyl:6, idle:1150, red:9100, sub:0.55, rasp:1.25 } ]; // Porsche bokser-6
const GEAR_F = [0.22, 0.39, 0.55, 0.70, 0.85, 1.0];
function ap(p, v, tc){ try{ p.setTargetAtTime(v, AUD.ctx.currentTime, tc || 0.05); }catch(e){ try{ p.value = v; }catch(_){} } }
function updSndUI(){ setText('sndV', AUD.on ? 'Yoniq' : 'O\u2019chiq'); setText('sndlbl', AUD.on ? '\ud83d\udd0a' : '\ud83d\udd07'); }
function setSound(v){
  AUD.on = !!v;
  try{ localStorage.setItem(SND_KEY, AUD.on ? '1' : '0'); }catch(e){}
  updSndUI();
  if(AUD.on) audioInit();
  if(AUD.ctx){ ap(AUD.master.gain, AUD.on ? 0.9 : 0, 0.04); if(AUD.on && AUD.ctx.state === 'suspended') AUD.ctx.resume(); }
}
function satCurve(k){ const n = 1024, c = new Float32Array(n); for(let i=0;i<n;i++){ const x = i*2/(n-1) - 1; c[i] = (1+k)*x/(1+k*Math.abs(x)); } return c; }
function audioInit(){
  if(AUD.ctx){ if(AUD.on && AUD.ctx.state === 'suspended') AUD.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
  let c; try{ c = new AC(); }catch(e){ return; }
  AUD.ctx = c;
  const master = c.createGain(); master.gain.value = AUD.on ? 0.9 : 0;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp); comp.connect(c.destination); AUD.master = master;
  const len = Math.floor(c.sampleRate*2), nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = Math.random()*2 - 1;
  AUD.noise = nb;
  const nz = ()=>{ const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random()*1.8); return s; };
  const mkG = v=>{ const g = c.createGain(); g.gain.value = v; return g; };
  const mkF = (t,f,q)=>{ const b = c.createBiquadFilter(); b.type = t; b.frequency.value = f; if(q != null) b.Q.value = q; return b; };
  // --- dvigatel: 3 ta tebranish + shovqin -> yumshoq buzilish -> past chastota filtri ---
  const e = {};
  e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
  e.o2 = c.createOscillator(); e.o2.type = 'square';
  e.o3 = c.createOscillator(); e.o3.type = 'sawtooth'; e.o3.detune.value = 9;
  e.g1 = mkG(0.5); e.g2 = mkG(0.25); e.g3 = mkG(0.14);
  const mix = mkG(1), ws = c.createWaveShaper(); ws.curve = satCurve(2.4); try{ ws.oversample = '2x'; }catch(_){}
  e.lp = mkF('lowpass', 900, 1.1);
  e.out = mkG(0);
  e.o1.connect(e.g1); e.o2.connect(e.g2); e.o3.connect(e.g3);
  e.g1.connect(mix); e.g2.connect(mix); e.g3.connect(mix);
  mix.connect(ws); ws.connect(e.lp); e.lp.connect(e.out); e.out.connect(master);
  e.o1.start(); e.o2.start(); e.o3.start();
  e.nz = nz(); e.nf = mkF('bandpass', 500, 0.8); e.ng = mkG(0);        // kirish/chiqish gumburi
  e.nz.connect(e.nf); e.nf.connect(e.ng); e.ng.connect(master);
  AUD.e = e;
  // --- shina vizillashi ---
  const s = {};
  s.a = nz(); s.fa = mkF('bandpass', 1500, 7); s.b = nz(); s.fb = mkF('bandpass', 3300, 11); s.g = mkG(0);
  s.a.connect(s.fa); s.b.connect(s.fb); s.fa.connect(s.g); s.fb.connect(s.g); s.g.connect(master);
  AUD.sc = s;
  // --- shamol ---
  const w = {}; w.n = nz(); w.f = mkF('lowpass', 300, 0.6); w.g = mkG(0);
  w.n.connect(w.f); w.f.connect(w.g); w.g.connect(master); AUD.wd = w;
  // --- yomg'ir ---
  const r = {}; r.n = nz(); r.h = mkF('highpass', 1400, 0.5); r.l = mkF('lowpass', 7000, 0.5); r.g = mkG(0);
  r.n.connect(r.h); r.h.connect(r.l); r.l.connect(r.g); r.g.connect(master); AUD.rn = r;
  // --- devorga ishqalanish ---
  const p = {}; p.n = nz(); p.f = mkF('bandpass', 2200, 1.4); p.g = mkG(0);
  p.n.connect(p.f); p.f.connect(p.g); p.g.connect(master); AUD.sp = p;
  document.addEventListener('visibilitychange', ()=>{
    if(!AUD.ctx) return;
    if(document.hidden) AUD.ctx.suspend(); else if(AUD.on) AUD.ctx.resume();
  });
  updSndUI();
}
['pointerdown','keydown','touchstart'].forEach(t=>addEventListener(t, ()=>{ if(AUD.on || !AUD.ctx) audioInit(); }, {passive:true}));

function actx(){ return (AUD.ctx && AUD.on && AUD.ctx.state === 'running') ? AUD.ctx : null; }
function burst(type, f0, f1, q, dur, peak, delay){
  const c = actx(); if(!c) return;
  const t = c.currentTime + (delay || 0);
  const s = c.createBufferSource(); s.buffer = AUD.noise;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AUD.master);
  s.start(t, Math.random()*1.5); s.stop(t + dur + 0.05);
}
function tone(type, f0, f1, dur, peak, delay){
  const c = actx(); if(!c) return;
  const t = c.currentTime + (delay || 0);
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AUD.master); o.start(t); o.stop(t + dur + 0.05);
}
function sndCrash(sev){
  if(!actx()) return;
  burst('lowpass', 1500, 160, 0.7, 0.5, 0.45 + 0.55*sev);               // gumburlagan urilish
  tone('sine', 140, 38, 0.38, 0.55 + 0.5*sev);                            // og'ir "dub"
  if(sev > 0.25) burst('highpass', 2600, 2600, 0.7, 0.14 + 0.12*sev, 0.22*sev, 0.02);   // shisha/plastik chaqnashi
  [410, 653, 997, 1311].forEach((f, i)=>tone('triangle', f*(0.88 + Math.random()*0.24), f*0.7, 0.2 + 0.07*i, 0.1*sev + 0.02, 0.01*i));   // metall jaranglashi
}
function sndPop(){ burst('bandpass', 420, 180, 2.2, 0.09, 0.2); if(Math.random() < 0.6) burst('bandpass', 380, 160, 2.2, 0.08, 0.14, 0.11); }
function sndBeep(f, dur, peak){ tone('sine', f, f, dur, peak || 0.1); }
function sndGun(){ burst('bandpass', 2300, 2100, 4, 0.1, 0.32); tone('sawtooth', 170, 130, 0.1, 0.12); }
function sndFuel(){ tone('sine', 90, 105, 0.22, 0.1); burst('lowpass', 700, 400, 0.6, 0.2, 0.09); }
function sndTap(){ tone('square', 720, 480, 0.07, 0.1); burst('bandpass', 1800, 900, 2, 0.06, 0.16); }
function sndDing(){ tone('sine', 880, 880, 0.22, 0.14); tone('sine', 1320, 1320, 0.34, 0.14, 0.14); }

function updateAudio(dt){
  const c = AUD.ctx; if(!c || !AUD.e) return;
  wallTouch = Math.max(0, wallTouch - dt);
  const e = AUD.e, car = CARS[carIdx], cfg = SNDCFG[Math.min(carIdx, SNDCFG.length-1)];
  const playing = carLoaded && !inMenu && groundReady && !!vehicle;
  const kmh = playing ? Math.abs(speed)*3.6 : 0;
  const fwd = playing && !!(keys['w'] || keys['arrowup']), bwd = playing && !!(keys['s'] || keys['arrowdown']);
  const empty = hardMode && fuel <= 0;
  let thr = (playing && !PIT.hold && !empty) ? (fwd ? 1 : (bwd ? 0.45 : 0)) : 0;
  AUD.thrS += (thr - AUD.thrS)*Math.min(1, dt*(thr > AUD.thrS ? 9 : 5));
  AUD.shiftT = Math.max(0, AUD.shiftT - dt);
  // pog'ona va aylanish tezligi
  let g = AUD.gear;
  while(g < 5 && kmh > GEAR_F[g]*car.maxKmh*0.97) g++;
  while(g > 0 && kmh < GEAR_F[g-1]*car.maxKmh*0.78) g--;
  if(g !== AUD.gear){ if(g > AUD.gear && AUD.thrS > 0.3) AUD.shiftT = 0.11; AUD.gear = g; }
  let tgt = playing ? Math.min(1, kmh/(GEAR_F[g]*car.maxKmh)) : 0;
  if(playing && AUD.thrS > 0.2 && kmh < 40) tgt = Math.max(tgt, 0.28 + 0.3*AUD.thrS);   // joyidan olishda debriyaj sirpanishi
  AUD.rpm += (tgt - AUD.rpm)*Math.min(1, dt*(tgt > AUD.rpm ? 7 : 3.5));
  const rpm = AUD.rpm, hz = (cfg.idle + (cfg.red - cfg.idle)*rpm)/60*cfg.cyl/2;
  ap(e.o1.frequency, hz, 0.025); ap(e.o2.frequency, hz*0.5, 0.025); ap(e.o3.frequency, hz*2, 0.025);
  ap(e.g2.gain, 0.25*cfg.sub, 0.1); ap(e.g3.gain, 0.14*cfg.rasp, 0.1);
  ap(e.lp.frequency, 450 + 3300*rpm*(0.35 + 0.65*AUD.thrS) + 700*AUD.thrS, 0.05);
  let vol = playing ? 0.05 + 0.17*Math.pow(AUD.thrS, 0.7) + 0.05*rpm : 0.04;
  if(AUD.shiftT > 0) vol *= 0.3;
  if(playing && rpm > 0.985 && AUD.thrS > 0.5) vol *= (Math.sin(c.currentTime*110) > 0 ? 1 : 0.5);   // aylanish chegarasi (limiter)
  if(empty) vol = kmh > 3 ? vol*(Math.random() < 0.45 ? 0.08 : 0.4) : 0;                             // yoqilg'i tugadi — dvigatel "yo'talib" qoladi
  ap(e.out.gain, vol, 0.04);
  ap(e.nf.frequency, 300 + 1500*rpm, 0.08); ap(e.ng.gain, playing ? 0.015 + 0.075*AUD.thrS*rpm : 0, 0.08);
  // gaz qo'yib yuborilganda "pop"
  const f1 = thr > 0.9;
  if(AUD.prevF && !f1 && rpm > 0.5 && kmh > 40 && playing && !empty) sndPop();
  AUD.prevF = f1;
  // shina vizillashi
  const sg = playing ? slipAmt*Math.min(1, kmh/40) : 0;
  ap(AUD.sc.g.gain, sg*0.2, 0.05);
  ap(AUD.sc.fa.frequency, 1250 + 900*sg + kmh*5, 0.08); ap(AUD.sc.fb.frequency, 3000 + 800*sg, 0.08);
  // shamol
  const vf = playing ? Math.min(1, kmh/Math.max(60, car.maxKmh)) : 0;
  ap(AUD.wd.g.gain, playing ? 0.008 + 0.26*vf*vf : 0, 0.12); ap(AUD.wd.f.frequency, 250 + 2600*vf, 0.12);
  // yomg'ir
  ap(AUD.rn.g.gain, WSTATES[weatherIdx].rain ? 0.07 : 0, 0.8);
  // devorga ishqalanish
  ap(AUD.sp.g.gain, (wallTouch > 0 && playing) ? Math.min(1, kmh/70)*0.2 : 0, 0.04);
  ap(AUD.sp.f.frequency, 1700 + kmh*9, 0.08);
  // yoqilg'i oz qolganda signal
  if(hardMode && playing && fuel > 0 && fuel < 0.15){
    AUD.beep -= dt;
    if(AUD.beep <= 0){ AUD.beep = fuel < 0.07 ? 0.55 : 1.2; sndBeep(880, 0.09, 0.07); }
  }
}

// ───────── [16-oyin-mantiqi.js] ─────────
// ================= YOQILG'I, SHINA, KUZOV =================
function feelHit(sev){ damage = Math.min(1, damage + 0.01 + 0.13*sev); sndCrash(sev); }
function gauge(id, frac, low, crit){
  const g = el('g'+id), b = el('g'+id+'B'); if(!g || !b) return;
  const f = Math.max(0, Math.min(1, frac)), pc = Math.round(f*100);
  b.style.width = pc + '%'; setText('g'+id+'V', pc + '%');
  g.classList.toggle('low', f < low && f >= crit); g.classList.toggle('crit', f < crit);
}
function updateGauges(dt){
  gT -= dt; if(gT > 0) return; gT = 0.12;
  document.body.classList.toggle('hard', hardMode);
  document.body.classList.toggle('dmg', !hardMode && damage > 0.005);
  gauge('Fuel', fuel, 0.25, 0.1); gauge('Tire', 1 - tireWear, 0.4, 0.2); gauge('Dmg', 1 - damage, 0.5, 0.25);
}
function updateFeel(dt){
  const live = carLoaded && !inMenu && groundReady && vehicle;
  if(!live){ slipAmt += (0 - slipAmt)*Math.min(1, dt*6); updateGauges(dt); return; }
  const cfg = CARS[carIdx], v = chassisBody.velocity, spd = Math.hypot(v.x, v.z), kmh = Math.abs(speed)*3.6;
  const lat = Math.abs(v.x*Math.cos(heading) - v.z*Math.sin(heading));            // yon tomonga sirpanish tezligi
  const fwd = !!(keys['w'] || keys['arrowup']), bwd = !!(keys['s'] || keys['arrowdown']);
  let sl = spd > 4 ? Math.min(1, Math.max(0, (lat - 1.5)/6.5)) : 0;
  if(keys[' '] && kmh > 12) sl = Math.max(sl, 0.75);                              // qo'l tormozi bilan drift
  const brk = ((bwd && speed > 2.5) || (fwd && speed < -2.5)) ? Math.min(1, Math.max(0, (kmh - 30)/90)) : 0;
  sl = Math.max(sl, brk*0.55);                                                    // kuchli tormoz
  if(PIT.hold) sl = 0;
  slipAmt += (sl - slipAmt)*Math.min(1, dt*10);
  if(hardMode && !PIT.hold){
    const vf = Math.min(1, spd/Math.max(1, cfg.maxKmh/3.6)), thr = (fwd && fuel > 0) ? 1 : 0;
    fuel = Math.max(0, fuel - dt*(0.0002 + 0.0022*thr*(0.4 + 0.6*vf)));           // to'liq gazda ~7 daqiqaga yetadi
    tireWear = Math.min(1, tireWear + dt*(0.0006 + 0.022*slipAmt + 0.004*vf*Math.min(1, Math.abs(steerCur)/0.25)));
  }
  tireGrip = hardMode ? 1 - 0.4*Math.pow(tireWear, 1.4) : 1;                      // eskirgan shina = kam ushlash
  updateGauges(dt);
}

// ================= PIT-STOP =================
function pitAccent(){ const b = PIT.boxes[PIT.sel]; return b ? b.accent : 0x39a9ff; }
function pitColor(hex){ const b = PIT.boxes[PIT.sel]; if(b && b.padMat){ b.padMat.color.setHex(hex); b.lampMat.color.setHex(hex); b.beamMat.color.setHex(hex); } }
function pitRefresh(){                 // faqat tanlangan mashinaning boksi yorqin va faol; boshqalari xira (o'z mashinasi uchun)
  PIT.boxes.forEach((b, i)=>{
    if(!b.padMat) return;
    const on = (i === carIdx), hex = on ? b.accent : 0x6b7680;
    b.padMat.color.setHex(hex); b.lampMat.color.setHex(hex); b.beamMat.color.setHex(hex);
    b.padMat.opacity = on ? 1 : 0.55; b.beam.visible = on;
  });
  PIT.sel = carIdx;
  const b = PIT.boxes[carIdx]; if(b){ PIT.cx = b.cx; PIT.cz = b.cz; }
}
function buildPit(){
  if(PIT.built) return; PIT.built = true;
  const grp = new THREE.Group(), postM = new THREE.MeshBasicMaterial({color:0xffffff});
  PIT.boxes.forEach(B=>{
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 400;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.30)'; x.fillRect(0, 0, 256, 400);
    x.strokeStyle = '#fff'; x.lineWidth = 12; x.strokeRect(6, 6, 244, 388);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 60px sans-serif'; x.fillText('\u25b2', 128, 56);
    x.font = 'bold 104px Impact, "Barlow Condensed", sans-serif'; x.fillText('PIT', 128, 150);
    let fs = 54; x.font = 'bold ' + fs + 'px Impact, sans-serif';
    while(x.measureText(B.label).width > 216 && fs > 20){ fs -= 2; x.font = 'bold ' + fs + 'px Impact, sans-serif'; }
    x.fillText(B.label, 128, 232);
    x.font = 'bold 50px Impact, sans-serif'; x.fillText('STOP', 128, 292);
    x.font = 'bold 60px sans-serif'; x.fillText('\u25b2', 128, 346);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(1, 1, 6, 12), pos = geo.attributes.position, uv = geo.attributes.uv;
    let hc = gH(B.cx, B.cz, 1e5); if(!(hc > -1e8)) hc = 0;
    const P = (al, lat)=>[PITF.C[0] + PITF.D[0]*(B.t0 + al) + PITF.N[0]*lat, PITF.C[1] + PITF.D[1]*(B.t0 + al) + PITF.N[1]*lat];
    for(let i=0;i<pos.count;i++){
      // u ortishi = o'ngga (N yo'nalishi), v ortishi = oldinga: yozuv haydovchiga to'g'ri o'qiladi (oldin teskari edi)
      const u = uv.getX(i), v = uv.getY(i), p = P((v - 0.5)*PIT.len, PIT.lat0 - PIT.wid/2 + u*PIT.wid), h = gH(p[0], p[1], 1e5);
      pos.setXYZ(i, p[0], (h > -1e8 ? h : hc) + 0.05, p[1]);
    }
    pos.needsUpdate = true; geo.computeBoundingSphere();
    B.padMat = new THREE.MeshBasicMaterial({map:tex, color:B.accent, transparent:true, side:THREE.DoubleSide, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4});
    grp.add(new THREE.Mesh(geo, B.padMat));
    B.lampMat = new THREE.MeshBasicMaterial({color:B.accent});
    for(const [a, b] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
      const p = P(a*PIT.len/2, PIT.lat0 + b*PIT.wid/2), h = gH(p[0], p[1], 1e5), y = h > -1e8 ? h : hc;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 8), postM); post.position.set(p[0], y + 0.8, p[1]);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), B.lampMat); lamp.position.set(p[0], y + 1.75, p[1]);
      grp.add(post, lamp);
    }
    B.beamMat = new THREE.MeshBasicMaterial({color:B.accent, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide, fog:false});
    B.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 40, 16, 1, true), B.beamMat);
    B.beam.position.set(B.cx, hc + 20, B.cz); grp.add(B.beam);
  });
  (mapId === 'rain' ? rainRoot : spaRoot).add(grp);
  PITBUILT[mapId] = true;
  pitRefresh();
}
function pitShow(cls, t, i, prog, arrow){
  const m = el('pitmsg'); if(!m) return;
  m.hidden = false; if(m._c !== cls){ m._c = cls; m.className = cls; }
  setText('pitT', t); setText('pitI', i);
  el('pitbar').style.display = prog >= 0 ? 'block' : 'none';
  if(prog >= 0) el('pitP').style.width = Math.round(prog*100) + '%';
  el('pitArrow').style.display = arrow ? 'block' : 'none';
}
function pitHide(){ const m = el('pitmsg'); if(m && !m.hidden) m.hidden = true; }
function updatePit(dt){
  const live = carLoaded && !inMenu && groundReady && vehicle && PIT.built && (mapId === 'spa' || mapId === 'rain');
  if(!live){ PIT.hold = false; pitHide(); return; }
  if(PIT.sel !== carIdx) pitRefresh();
  PIT.cd = Math.max(0, PIT.cd - dt);
  const bp = chassisBody.position, dx = bp.x - PIT.cx, dz = bp.z - PIT.cz;
  const along = dx*PITF.D[0] + dz*PITF.D[1], across = dx*PITF.N[0] + dz*PITF.N[1];
  const inZ = Math.abs(along) < PIT.len/2 + 0.4 && Math.abs(across) < PIT.wid/2 + 0.3;
  const need = (hardMode && (fuel < 0.97 || tireWear > 0.03)) || damage > 0.01;
  const slow = Math.abs(speed) < 2.2, gas = !!(keys['w'] || keys['arrowup']);

  if(PIT.hold){                                    // xizmat ketmoqda: mashina tormozda ushlab turiladi
    PIT.t += dt; PIT.gasT = gas ? PIT.gasT + dt : 0;
    const tot = Math.max(PIT.Tf, PIT.Tt, PIT.Td, 0.5);
    if(PIT.Tf > 0) fuel = PIT.f0 + (1 - PIT.f0)*Math.min(1, PIT.t/PIT.Tf);
    if(PIT.Tt > 0) tireWear = PIT.w0*(1 - Math.min(1, PIT.t/PIT.Tt));
    if(PIT.Td > 0){
      const pd = Math.min(1, PIT.t/PIT.Td); damage = PIT.d0*(1 - pd);
      if(pd >= 1 && !PIT.fixed){ PIT.fixed = true; repairCar(curModel); }
    }
    if(PIT.Tt > 0 && PIT.t < PIT.Tt){ PIT.s0 -= dt; if(PIT.s0 <= 0){ PIT.s0 = 0.42; sndGun(); } }
    if(PIT.Tf > 0 && PIT.t < PIT.Tf){ PIT.s1 -= dt; if(PIT.s1 <= 0){ PIT.s1 = 0.24; sndFuel(); } }
    if(PIT.Td > 0 && PIT.t < PIT.Td){ PIT.s2 -= dt; if(PIT.s2 <= 0){ PIT.s2 = 0.3 + Math.random()*0.2; sndTap(); } }
    if(PIT.gasT > 0.5){                            // gazni bosib turilsa — xizmat bekor qilinadi
      PIT.hold = false; PIT.cd = 3; pitColor(pitAccent()); PIT.flash = 1.6; PIT.fm = ['warn', 'PIT bekor qilindi', 'Xizmat to\u2019liq tugamadi'];
    } else if(PIT.t >= tot){
      if(PIT.Tf > 0) fuel = 1;
      if(PIT.Tt > 0) tireWear = 0;
      if(PIT.Td > 0){ damage = 0; if(!PIT.fixed){ PIT.fixed = true; repairCar(curModel); } }
      PIT.hold = false; PIT.cd = 2; pitColor(pitAccent()); PIT.flash = 2.4; PIT.fm = ['go', 'PIT-STOP tayyor', 'Yo\u2019lga chiqing!']; sndDing();
    } else {
      const parts = [];
      if(PIT.Tf > 0) parts.push('Yoqilg\u2019i ' + Math.round(fuel*100) + '%');
      if(PIT.Tt > 0) parts.push('Shina ' + Math.round((1 - tireWear)*100) + '%');
      if(PIT.Td > 0) parts.push('Kuzov ' + Math.round((1 - damage)*100) + '%');
      pitShow('go', 'PIT-STOP \u00b7 xizmat ketmoqda', parts.join('  \u00b7  '), PIT.t/tot, false);
      return;
    }
  }
  if(PIT.flash > 0){ PIT.flash -= dt; if(PIT.fm) pitShow(PIT.fm[0], PIT.fm[1], PIT.fm[2], -1, false); return; }

  if(inZ && slow && need && PIT.cd <= 0){          // to'xtadi — xizmat boshlanadi
    PIT.hold = true; PIT.t = 0; PIT.fixed = false; PIT.gasT = 0; PIT.f0 = fuel; PIT.w0 = tireWear; PIT.d0 = damage; PIT.s0 = PIT.s1 = PIT.s2 = 0;
    PIT.Tf = (hardMode && fuel < 0.97) ? 0.8 + 4.2*(1 - fuel) : 0;
    PIT.Tt = (hardMode && tireWear > 0.03) ? 1.6 + 2.2*tireWear : 0;
    PIT.Td = damage > 0.01 ? 1.5 + 4.5*damage : 0;
    pitColor(0x57dd77); sndBeep(660, 0.1, 0.12);
    return;
  }
  if(inZ){
    if(!need) pitShow('', 'PIT zonasi', 'Servis kerak emas', -1, false);
    else if(PIT.cd > 0 && slow) pitShow('warn', 'PIT zonasi', 'Bir oz kuting\u2026', -1, false);
    else pitShow('warn', 'PIT zonasi', 'To\u2019xtang! (tezlik 8 km/h dan past)', -1, false);
    return;
  }
  const reason = (hardMode && fuel < 0.3) ? 'Yoqilg\u2019i kam' : ((hardMode && tireWear > 0.55) ? 'Shina yeyilgan' : (damage > 0.15 ? 'Kuzov shikastlangan' : ''));
  const urgent = need && reason !== '';
  if(PIT.guide || urgent){
    pitShow(urgent ? 'warn' : '', 'PIT-STOP', (urgent ? reason + ' \u00b7 ' : 'Pit zonasi \u00b7 ') + Math.round(Math.hypot(dx, dz)) + ' m', -1, true);
    el('pitArrow').style.transform = 'rotate(' + ((Math.atan2(PIT.cx - bp.x, PIT.cz - bp.z) - heading)*-57.2958) + 'deg)';
  } else pitHide();
}
setHard(hardMode); updSndUI(); document.body.classList.toggle('hard', hardMode);

function resetCar(){
  repairCar(curModel); feelReset();
  heading = START.heading; speed = 0; steerCur = 0;
  let sx = START.x, sz = START.z;
  if(netSlot >= 0){ const lat = (netSlot % 2 ? 1 : -1)*2, back = 7*(netSlot >> 1); sx += Math.cos(heading)*lat - Math.sin(heading)*back; sz += -Math.sin(heading)*lat - Math.cos(heading)*back; }
  const g0 = groundReady ? gH(sx, sz, 1e5) : 0;
  py = g0 > -1e8 ? g0 : 0;
  chassisBody.position.set(sx, py + CH_Y + 0.1, sz);
  chassisBody.quaternion.setFromEuler(0, heading, 0);
  chassisBody.velocity.setZero(); chassisBody.angularVelocity.setZero();
  chassisBody.force.setZero(); chassisBody.torque.setZero();
  impCd = 1.2; teleport(); syncCar(); camSnap = true; camFreeReset();
  const f = new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
  camera.position.copy(carGroup.position).addScaledVector(f,-9).add(new THREE.Vector3(0,3.3,0));
}
resetCar();
let MAXF = 55.56;
const clock = new THREE.Clock();
const vig = document.getElementById('vig');
const spdEl = document.getElementById('spd');

function animate(){
  requestAnimationFrame(animate);
  const raw = clock.getDelta();
  perfTick(raw); gfxWatch(raw);
  const dt = Math.min(raw, 0.05);
  try{ frame(dt); }catch(e){ if(frameErrs++ < 5) console.error('frame xato:', e); }
  try{ renderer.render(scene, camera); }catch(e){ if(frameErrs++ < 5) console.error('render xato:', e); }
}
function frame(dt){
  updateSparks(dt); updateSmoke(dt); impCd -= dt;
  updateEnv(dt); updateMission(dt); updateMarks(dt);
  updateFeel(dt); updatePit(dt); updateAudio(dt);
  if(inMenu) menuFrame(dt);
  if(carLoaded && !inMenu){
    const fwd = keys['w']||keys['arrowup'], bwd = keys['s']||keys['arrowdown'];
    const left = keys['a']||keys['arrowleft'], right = keys['d']||keys['arrowright'];
    const steerAmt = (left?1:0)-(right?1:0);
    if(groundReady && vehicle){ driveVehicle(dt, fwd, bwd, steerAmt, keys[' ']); stepPhysics(dt); }
    sun.target.position.copy(carGroup.position); sun.position.copy(carGroup.position).add(envSunOff);

    // Old g'ildiraklarning vizual burilishi: A/D bosilganda darhol,
    // yumshoq (lerp) tarzda burcakka o'tadi — mashina tez yoki sekin
    // yursa ham, hatto to'xtab turganda ham ko'rinadi.
    const targetSteer = steerAmt * MAX_WHEEL_STEER;
    steerVisual += (targetSteer - steerVisual) * Math.min(dt*9, 1);

    const spin = speed*dt/WHEEL_R;
    for(const rig of wheelRigs){
      rig.roll.rotation.x += spin;
      if(rig.isFront) rig.steer.rotation.y = steerVisual;
    }
    if(groundReady && vehicle) driftEffects(dt);

    const fV = new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
    const vmaxC = Math.max(10, CARS[carIdx].maxKmh/3.6);
    camSpd += (Math.min(Math.abs(speed)/vmaxC, 1) - camSpd)*Math.min(dt*2, 1);
    let tOff, tLook, fovT = 58;                       // mashinaga NISBATAN kamera va nishon
    if(camMode===0){
      const dist = 8.6 + 3.8*camSpd, hgt = 3.2 + 1.4*camSpd, ahead = 3 + 3*camSpd;   // tezlashgan sari biroz uzoqlashadi, lekin mashina ko'rinib turadi
      tOff = fV.clone().multiplyScalar(-dist); tOff.y = hgt;
      tLook = fV.clone().multiplyScalar(ahead); tLook.y = 1;
      fovT = 56 + camSpd*9;
      vig.style.opacity = Math.min(Math.abs(speed)/30,1)*0.5;
    } else if(camMode===1){
      tOff = fV.clone().multiplyScalar(-CAR_LEN*0.42); tOff.y = 1.1;
      tLook = tOff.clone().addScaledVector(fV,-12);
      vig.style.opacity = 0;
    } else {
      tOff = new THREE.Vector3(0,21,8); tLook = new THREE.Vector3(0,0,0);
      vig.style.opacity = 0;
    }
    // O'ng tugma: mashina atrofida erkin aylantirish (old / orqa / yon / tepa) + g'ildirak bilan yaqinlashtirish
    camYaw = Math.atan2(Math.sin(camYaw), Math.cos(camYaw));
    if(!camDrag){
      if(camHold > 0) camHold -= dt;
      else if(Math.abs(speed) > 3 && (camYaw || camPitch)){      // harakatda — asta-sekin odatiy joyga qaytadi (to'xtab turganda — qoladi)
        const kr = 1 - Math.exp(-dt*2.2);
        camYaw -= camYaw*kr; camPitch -= camPitch*kr;
        if(Math.abs(camYaw) < 0.002) camYaw = 0; if(Math.abs(camPitch) < 0.002) camPitch = 0;
      }
    }
    if(camYaw || camPitch || camZoom !== 1){
      const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
      for(const v of [tOff, tLook]){ const x = v.x*cy + v.z*sy, z = -v.x*sy + v.z*cy; v.x = x; v.z = z; }
      const hz = Math.hypot(tOff.x, tOff.z) || 0.001, r = Math.hypot(hz, tOff.y)*camZoom;
      const elv = Math.max(0.06, Math.min(1.45, Math.atan2(tOff.y, hz) + camPitch));
      const nh = r*Math.cos(elv); tOff.x *= nh/hz; tOff.z *= nh/hz; tOff.y = r*Math.sin(elv);
    }
    if(camSnap){ camOff.copy(tOff); camLook.copy(tLook); camSnap = false; }
    else { const kc = 1 - Math.exp(-dt*(camDrag ? 28 : 7)); camOff.lerp(tOff, kc); camLook.lerp(tLook, kc); }
    camera.position.copy(carGroup.position).add(camOff);
    const gyc = gH(camera.position.x, camera.position.z, camera.position.y + 3);
    if(gyc > -1e8 && camera.position.y < gyc + 0.5) camera.position.y = gyc + 0.5;      // yer ostiga tushib ketmasin
    camera.lookAt(_lk.copy(carGroup.position).add(camLook));
    camera.fov = fovT; camera.updateProjectionMatrix();
    shake *= Math.exp(-dt*5); _so.set(Math.random()-.5, Math.random()-.5, Math.random()-.5).multiplyScalar(shake < 0.004 ? 0 : shake);
    camera.position.add(_so);
    spdEl.textContent = Math.round(Math.abs(speed)*3.6);
  }
  if(curModel){   // haydash paytida salon asboblar paneli (og'ir, ko'rinmaydi) chizilmaydi
    if(curModel.userData._cp === undefined){ const a = []; curModel.traverse(o=>{ if(o.isMesh && /^INT_Cpit/.test((o.material && o.material.name) || '')) a.push(o); }); curModel.userData._cp = a; }
    const vis = inMenu; for(const o of curModel.userData._cp) o.visible = vis;
  }
  cullTrack();
  netFrame(dt);
}
