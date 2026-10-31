// ====================================================================
// Fizika: relyef, mashina fizikasi (cannon-es), halokat, kun-tun/ob-havo
// ====================================================================

// ───────── [09-fizika-relyef.js] ─────────
// ---- FIZIKA: relyef, og'irlik kuchi, tepaliklar ----
const CELL=8, cells=new Map(), tris=[], bigT=[], WB=1.3, HT=0.85, G=9.81;
const WP=[[-HT,WB],[HT,WB],[-HT,-WB],[HT,-WB]];
const SUNOFF=new THREE.Vector3(35,55,20);
carGroup.rotation.order='YXZ';
let py=0, vv=0, pitch=0, roll=0, groundReady=false;
// Trassa yuzasi: 1 m li balandlik to'ri + devor maydoni (asfaltdan 5 m gacha ruxsat; undan keyin devor)
let TX0 = -2150, TZ0 = -2600, NTILES = 3708, tmap = new Map(), T_H2 = null;
let T_H = null, T_S = null, roadPts = new Float32Array(0);
function initTerrain(){
  const raw = pako.inflate(new Uint8Array(b64ToBuf(takeData('d-terrain')))), n = NTILES, o0 = raw.byteOffset;
  const co = new Uint16Array(raw.buffer.slice(o0, o0+4*n));
  T_H = new Int16Array(raw.buffer.slice(o0+4*n, o0+4*n+n*512));
  T_S = new Int8Array(raw.buffer.slice(o0+4*n+n*512, o0+4*n+n*512+n*256));
  for(let i=0;i<n;i++) tmap.set(co[2*i+1]*1024 + co[2*i], i);
  // missiya uchun asfalt ustidagi nuqtalar (devordan >= 3.5 m ichkarida)
  const pts = [];
  for(let i=0;i<n;i++){
    const tx = co[2*i], tz = co[2*i+1];
    for(let j=0;j<16;j+=5) for(let k=0;k<16;k+=5) if(T_S[i*256+j*16+k] >= 68) pts.push(TX0+tx*16+k+0.5, TZ0+tz*16+j+0.5);
  }
  roadPts = new Float32Array(pts);
}
function cellH(ix,iz){ const t = tmap.get((iz>>4)*1024 + (ix>>4)); return t === undefined ? NaN : T_H[t*256 + ((iz&15)<<4) + (ix&15)]*0.01; }
function cellS(ix,iz){ const t = tmap.get((iz>>4)*1024 + (ix>>4)); return t === undefined ? -15 : T_S[t*256 + ((iz&15)<<4) + (ix&15)]*0.125; }
function bil(fn,x,z){
  const fx = x-TX0-0.5, fz = z-TZ0-0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx-i, v = fz-j;
  return (fn(i,j)*(1-u) + fn(i+1,j)*u)*(1-v) + (fn(i,j+1)*(1-u) + fn(i+1,j+1)*u)*v;
}
// (x,z) ostidagi yer balandligi (yr dan biroz baland bo'lsa — yo'q deb hisoblanadi)
function cellH2(ix,iz,lim){   // shahar xaritasi: ikki qavatli (ko'prik) balandliklar
  const t = tmap.get((iz>>4)*1024 + (ix>>4)); if(t === undefined) return NaN;
  const k = t*256 + ((iz&15)<<4) + (ix&15), u = T_H2[k];
  if(u !== -32768 && u*0.01 <= lim) return u*0.01;
  const l = T_H[k]*0.01; return l <= lim ? l : NaN;
}
function gH(x,z,yr){
  if(!T_H) return -1e9;
  if(T_H2){
    const lim = yr + 0.1, fx = x-TX0-0.5, fz = z-TZ0-0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx-i, v = fz-j;
    const h2 = (cellH2(i,j,lim)*(1-u) + cellH2(i+1,j,lim)*u)*(1-v) + (cellH2(i,j+1,lim)*(1-u) + cellH2(i+1,j+1,lim)*u)*v;
    return h2 === h2 ? h2 : -1e9;
  }
  const h = bil(cellH,x,z);
  return (h === h && h <= yr + 0.1) ? h : -1e9;
}
function sdf(x,z){ return T_S ? bil(cellS,x,z) : 0; }   // > 0 — ruxsat etilgan hudud ichida, < 0 — devor ortida
const _sg = {x:0,z:0};
function sdfGrad(x,z){
  const e = 0.4;
  let gx = (sdf(x+e,z) - sdf(x-e,z))/(2*e), gz = (sdf(x,z+e) - sdf(x,z-e))/(2*e);
  const l = Math.hypot(gx,gz) || 1; _sg.x = gx/l; _sg.z = gz/l; return _sg;
}
// Devor: mashina asfaltdan 5 m dan chiqolmaydi, urilganda zarba beradi
const WALL_PTS = [[0.95,2.3],[-0.95,2.3],[0.95,-2.3],[-0.95,-2.3],[0.95,0],[-0.95,0],[0,2.4],[0,-2.4]];
const _wq = new THREE.Quaternion(), _wv = new THREE.Vector3();
function wallCollide(){
  if(!T_S) return;
  const c = chassisBody, q = c.quaternion, v = c.velocity;
  _wq.set(q.x,q.y,q.z,q.w);
  let worst = 0, sx = 0, sz = 0;
  for(let i=0;i<WALL_PTS.length;i++){
    _wv.set(WALL_PTS[i][0], 0.2, WALL_PTS[i][1]).applyQuaternion(_wq);
    const x = c.position.x + _wv.x, z = c.position.z + _wv.z, s = sdf(x,z);
    if(s < 0){ const g = sdfGrad(x,z); sx += g.x*(-s); sz += g.z*(-s); if(-s > worst) worst = -s; }
  }
  if(worst <= 0) return;
  wallTouch = 0.12;
  const l = Math.hypot(sx,sz) || 1, nx = sx/l, nz = sz/l;
  c.position.x += nx*worst; c.position.z += nz*worst;
  c.interpolatedPosition.x = c.position.x; c.interpolatedPosition.z = c.position.z;
  const vn = v.x*nx + v.z*nz;
  if(vn < 0){
    v.x -= 1.22*vn*nx; v.z -= 1.22*vn*nz;               // 0.22 — qaytish (restitutsiya)
    v.x *= 0.985; v.z *= 0.985;                           // devorga ishqalanish
  }
  c.angularVelocity.y *= 0.9;
}
// Qizil-oq to'siq: ruxsat chegarasi bo'ylab
function buildBarrier(did, root){
  did = did || 'd-barrier'; root = root || spaRoot;
  const dv = new DataView(did === 'd-barrier' ? b64ToBuf(takeData(did)) : (()=>{ const u = pako.inflate(new Uint8Array(b64ToBuf(takeData(did)))); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); })()); let o = 0;
  const np = dv.getUint32(o,true); o += 4;
  const lens = []; for(let i=0;i<np;i++){ lens.push(dv.getUint32(o,true)); o += 4; }
  const cellsB = new Map(); let run = 0;
  const cellOf = (x,z)=>{ const k = Math.floor(x/250)*512 + Math.floor(z/250); let c = cellsB.get(k); if(!c){ c = {P:[],N:[],C:[],IDX:[],vi:0}; cellsB.set(k,c); } return c; };
  const H = 1.0, TH = 0.5;
  const quad = (cb,a,b,c,d,nx,ny,nz,col)=>{
    cb.P.push(...a,...b,...c,...d); for(let k=0;k<4;k++){ cb.N.push(nx,ny,nz); cb.C.push(col[0],col[1],col[2]); }
    cb.IDX.push(cb.vi,cb.vi+1,cb.vi+2, cb.vi,cb.vi+2,cb.vi+3); cb.vi += 4;
  };
  for(let p=0;p<np;p++){
    const pts = []; for(let i=0;i<lens[p];i++){ pts.push([dv.getInt32(o,true)/10, dv.getInt32(o+4,true)/10]); o += 8; }
    for(let i=0;i<pts.length-1;i++){
      const [x0,z0] = pts[i], [x1,z1] = pts[i+1], L = Math.hypot(x1-x0,z1-z0); if(L < 0.05) continue;
      const steps = Math.max(1, Math.ceil(L/5)), dx = (x1-x0)/L, dz = (z1-z0)/L;
      let nx = -dz, nz = dx; const mx = (x0+x1)/2, mz = (z0+z1)/2;
      if(sdf(mx+nx*0.8, mz+nz*0.8) > sdf(mx-nx*0.8, mz-nz*0.8)){ nx = -nx; nz = -nz; }   // nx,nz — tashqariga
      for(let s=0;s<steps;s++){
        const ax = x0+(x1-x0)*s/steps, az = z0+(z1-z0)*s/steps, bx = x0+(x1-x0)*(s+1)/steps, bz = z0+(z1-z0)*(s+1)/steps;
        const ha = gH(ax,az,1e5), hb = gH(bx,bz,1e5); if(!(ha > -1e8) || !(hb > -1e8)) continue;
        run += L/steps; const red = (Math.floor(run/6) % 2) === 0, col = red ? [0.82,0.08,0.08] : [0.92,0.92,0.92];
        const cb = cellOf(ax,az);
        const A0=[ax,ha,az], A1=[bx,hb,bz], A0t=[ax,ha+H,az], A1t=[bx,hb+H,bz];
        const B0t=[ax+nx*TH,ha+H,az+nz*TH], B1t=[bx+nx*TH,hb+H,bz+nz*TH], B0=[ax+nx*TH,ha,az+nz*TH], B1=[bx+nx*TH,hb,bz+nz*TH];
        quad(cb,A1,A0,A0t,A1t, -nx,0,-nz, col);      // ichki yuz (mashina tomonda)
        quad(cb,A0t,B0t,B1t,A1t, 0,1,0, col);        // tepa
        quad(cb,B0,B1,B1t,B0t, nx,0,nz, col);        // tashqi yuz
      }
    }
  }
  const bmat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85, metalness:0, side:THREE.DoubleSide});
  cellsB.forEach(cb=>{
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cb.P,3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(cb.N,3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cb.C,3)); g.setIndex(cb.IDX);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, bmat);
    mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; root.add(mesh); mesh.updateMatrixWorld(true);
    regChunk(mesh, 450);                                   // to'siq faqat yaqinda chiziladi
  });
}
// Start/finish chizig'i (shaxmat)
function buildStartLine(){
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16;
  const cx = cv.getContext('2d');
  for(let i=0;i<32;i++) for(let j=0;j<2;j++){ cx.fillStyle = ((i+j)%2) ? '#111' : '#f4f4f4'; cx.fillRect(i*8, j*8, 8, 8); }
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
  const W0 = -11, W1 = 14, cols = 32, g = new THREE.PlaneGeometry(1,1,cols,1), p = g.attributes.position;
  for(let i=0;i<=cols;i++) for(let r=0;r<2;r++){
    const lat = W0 + (W1-W0)*i/cols, t = START_T + (r ? 0.6 : -0.6);
    const x = TRK_C[0] + TRK_D[0]*t + TRK_N[0]*lat, z = TRK_C[1] + TRK_D[1]*t + TRK_N[1]*lat, h = gH(x,z,1e5);
    p.setXYZ(r*(cols+1)+i, x, (h > -1e8 ? h : 0) + 0.04, z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({map:tex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}));
  spaRoot.add(m);
}

// ───────── [10-fizika-mashina-halokat.js] ─────────
// ---- cannon-es RaycastVehicle: g'ildirak nurlari shahar yo'lini gH() orqali "ko'radi" ----
const world = new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
const chassisBody = new CANNON.Body({mass:160});
chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.95,0.3,2.2)), new CANNON.Vec3(0,0.15,0)); // quti yuqorida => CoM past
chassisBody.angularDamping = 0.5; chassisBody.linearDamping = 0.01;
world.addBody(chassisBody);
world.addEventListener('preStep', ()=>{ const v = chassisBody.velocity; chassisBody.force.y -= 0.25*(v.x*v.x + v.z*v.z); }); // aerodinamik bosim
const groundDummy = new CANNON.Body({mass:0});   // nur "tegdi" deb hisoblanishi uchun statik jism
const CH_Y = 0.42, SUSP_K = 26, VIS_Y = CH_Y - 9.82/(4*SUSP_K);   // VIS_Y = tinch holatdagi cho'kish hisobga olingan                  // chassis markazi balandligi / model tubigacha masofa
const ENGINE = 640, REVERSE = 330, BRAKE_F = 12, HAND_F = 25, MAX_STEER = 0.5, TOP_REV = 40;
let vehicle = null, steerCur = 0, flipT = 0;

function makeVehicle(cfg){
  if(vehicle) vehicle.removeFromWorld(world);
  vehicle = new CANNON.RaycastVehicle({chassisBody, indexRightAxis:0, indexUpAxis:1, indexForwardAxis:2});
  const R = cfg.wheelR, rest = 0.28;
  const o = {
    radius:R, directionLocal:new CANNON.Vec3(0,-1,0), axleLocal:new CANNON.Vec3(-1,0,0),
    suspensionStiffness:SUSP_K, suspensionRestLength:rest, maxSuspensionTravel:0.2, maxSuspensionForce:2500,
    dampingRelaxation:5.5, dampingCompression:4.5, frictionSlip:Grip(), rollInfluence:0.01,
    useCustomSlidingRotationalSpeed:true, customSlidingRotationalSpeed:-30
  };
  const y = -(CH_Y - R) + rest;
  // 0: old-chap, 1: old-o'ng, 2: orqa-chap, 3: orqa-o'ng (old = +z, chap = +x)
  [[ cfg.hw, cfg.wz],[-cfg.hw, cfg.wz],[ cfg.hw,-cfg.wz],[-cfg.hw,-cfg.wz]].forEach(([x,z])=>{
    vehicle.addWheel({...o, chassisConnectionPointLocal:new CANNON.Vec3(x,y,z)});
  });
  // nurni tekis dunyo o'rniga shahar yuzasiga (gH) qarshi otamiz
  vehicle.castRay = function(wheel){
    this.updateWheelTransformWorld(wheel);
    const src = wheel.chassisConnectionPointWorld, dir = wheel.directionWorld;
    const raylen = wheel.suspensionRestLength + wheel.radius;
    const rr = wheel.raycastResult; rr.reset();
    let depth = -1;
    const h = groundReady ? gH(src.x, src.z, src.y + 0.3) : -1e9;
    const t = (h > -1e8 && dir.y < -0.2) ? (src.y - h)/(-dir.y) : -1;
    if(t >= 0 && t <= raylen + 0.05){
      // sirt normali: yaqin nuqtalardagi balandliklar farqidan
      const hx = gH(src.x + 0.6, src.z, h + 0.6), hz = gH(src.x, src.z + 0.6, h + 0.6);
      const cl = v=>Math.max(-0.35, Math.min(0.35, v));
      const nx = cl((hx > -1e8 ? (h - hx) : 0)/0.6), nz = cl((hz > -1e8 ? (h - hz) : 0)/0.6);
      const nl = Math.hypot(nx, 1, nz);
      rr.hitNormalWorld.set(nx/nl, 1/nl, nz/nl);
      rr.hitPointWorld.set(src.x + dir.x*t, src.y + dir.y*t, src.z + dir.z*t);
      rr.distance = t; rr.hasHit = true; rr.body = groundDummy;
      depth = t;
      wheel.isInContact = true;
      wheel.suspensionLength = t - wheel.radius;
      const minL = wheel.suspensionRestLength - wheel.maxSuspensionTravel;
      const maxL = wheel.suspensionRestLength + wheel.maxSuspensionTravel;
      if(wheel.suspensionLength < minL) wheel.suspensionLength = minL;
      if(wheel.suspensionLength > maxL){ wheel.suspensionLength = maxL; rr.reset(); }
      const den = rr.hitNormalWorld.dot(dir);
      const cv = new CANNON.Vec3();
      chassisBody.getVelocityAtWorldPoint(rr.hitPointWorld, cv);
      const proj = rr.hitNormalWorld.dot(cv);
      if(den >= -0.1){ wheel.suspensionRelativeVelocity = 0; wheel.clippedInvContactDotSuspension = 10; }
      else { const inv = -1/den; wheel.suspensionRelativeVelocity = proj*inv; wheel.clippedInvContactDotSuspension = inv; }
    } else {
      wheel.suspensionLength = wheel.suspensionRestLength;
      wheel.suspensionRelativeVelocity = 0;
      dir.scale(-1, rr.hitNormalWorld);
      wheel.clippedInvContactDotSuspension = 1;
    }
    return depth;
  };
  vehicle.addToWorld(world);
}

function driveVehicle(dt, fwd, bwd, steerAmt, hand){
  if(PIT.hold) hand = false;
  const cfg = CARS[carIdx], kmh = vehicle.currentVehicleSpeedKmHour; // + oldinga
  const drift = hand && Math.abs(kmh) > 12;   // tezlikda qol tormozi = drift; sekinlikda park tormozi
  let eng = 0, br = 0;
  if(fwd){
    if(kmh < -2) br = BRAKE_F;
    else if(kmh < cfg.maxKmh){                                           // tezlik oshgan sari dvigatel kuchi kamayadi (quvvat egri chizig'i) — 0-100 km/h ~4 s
      const fr = Math.max(0, kmh)/cfg.maxKmh, pw = ENGINE*(0.14 + 0.86*(1 - fr*fr));
      eng = drift ? -pw*0.55 : -pw;                                      // drift paytida ham dvigatel itarib turadi
    }
  }
  else if(bwd){ if(kmh > 2) br = BRAKE_F; else if(kmh > -TOP_REV) eng = drift ? REVERSE*0.6 : REVERSE; }
  else br = drift ? 0.6 : 1.5;                // drift: tezlik oz-ozi tarzda sekin tushadi
  if(hardMode && fuel <= 0) eng = 0;                                  // yoqilg'i tugadi
  if(hardMode && damage > 0.4) eng *= 1 - 0.3*(damage - 0.4)/0.6;       // og'ir shikast — kuch kamayadi
  if(PIT.hold){ eng = 0; br = BRAKE_F; }                                 // pit-stop: mashina tormozda turadi
  vehicle.applyEngineForce(eng, 2); vehicle.applyEngineForce(eng, 3);
  for(let i=0;i<4;i++) vehicle.setBrake(br, i);
  if(hand){
    const rb = drift ? 3 : HAND_F;            // drift: orqa qulf sozlanmaydi, sirpanish erkin
    vehicle.setBrake(rb, 2); vehicle.setBrake(rb, 3);
  }
  for(const i of [2,3]) vehicle.wheelInfos[i].frictionSlip = drift ? 0.8 : Grip();
  const limit = MAX_STEER*(drift?1.3:1)/(1 + Math.abs(kmh)/(drift?90:60));
  steerCur += (steerAmt*limit - steerCur)*Math.min(1, dt*8);
  vehicle.setSteeringValue(steerCur, 0); vehicle.setSteeringValue(steerCur, 1);
}

// ================= HALOKAT (DAMAGE): zarba aniqlash, tezlikka mutanosib pachoqlanish, uchqun, kamera silkinishi =================
const IMPACT_MIN = 5;          // m/s: shundan past zarba pachoqlamaydi
const DENT_PER_MS = 0.014;     // botiq chuqurligi = tezlik * shu (m per m/s) — to'g'ri mutanosib
const DENT_LIMIT = 0.5;        // strukturaviy chegara: bundan chuqur botmaydi, ortiqcha energiya radiusni kengaytiradi
const CRUSH_CAP = 0.8;         // bitta uchning asl joyidan maks. umumiy siljishi (m)
const DENT_R = 1.0;            // asosiy botiq radiusi (m)
let impCd = 0, shake = 0, spLive = false;
const _hq = new THREE.Quaternion(), _hd = new THREE.Vector3(), _hp = new THREE.Vector3(), _hn = new THREE.Vector3();
const _inv = new THREE.Matrix4(), _lp = new THREE.Vector3(), _ld = new THREE.Vector3(), _so = new THREE.Vector3();

// Mesh geometriyasini Float32 BufferAttribute ga o'tkazadi (kvantlangan/interleaved bo'lsa ham), asl nusxani saqlaydi
function prepDeform(model, rigs){
  const skip = new Set(); rigs.forEach(r=>r.roll.traverse(o=>skip.add(o)));   // g'ildiraklar pachoqlanmaydi
  const DN = {Int8Array:127, Uint8Array:255, Int16Array:32767, Uint16Array:65535}, def = [];
  const f32 = a=>{ const o = new Float32Array(a.count*3), d = a.normalized ? (DN[a.array.constructor.name]||1) : 1;
    for(let i=0;i<a.count;i++){ o[3*i]=a.getX(i)/d; o[3*i+1]=a.getY(i)/d; o[3*i+2]=a.getZ(i)/d; } return o; };
  model.traverse(o=>{
    if(!o.isMesh || o.isSkinnedMesh || skip.has(o) || !o.geometry.attributes.position) return;
    const s = o.geometry, g = new THREE.BufferGeometry();
    for(const k in s.attributes) g.setAttribute(k, s.attributes[k]);
    if(s.index) g.setIndex(s.index);
    s.groups.forEach(x=>g.addGroup(x.start, x.count, x.materialIndex));
    const pos = new THREE.BufferAttribute(f32(s.attributes.position), 3); g.setAttribute('position', pos);
    let n0 = null;
    if(s.attributes.normal){ n0 = f32(s.attributes.normal); g.setAttribute('normal', new THREE.BufferAttribute(n0.slice(), 3)); }
    g.computeBoundingBox(); g.computeBoundingSphere();
    o.geometry = g;
    def.push({mesh:o, pos, p0:pos.array.slice(), n0, t:new Uint8Array(pos.count)});
  });
  model.userData.def = def;
}
function repairCar(m){
  for(const d of (m && m.userData.def) || []){
    d.pos.array.set(d.p0); d.pos.needsUpdate = true; d.t.fill(0);
    const nr = d.mesh.geometry.attributes.normal; if(d.n0){ nr.array.set(d.n0); nr.needsUpdate = true; }
  }
}
// Butun mesh bo'ylab s yo'nalishidagi (zarbaga qaragan) eng chekka sirt yamog'ining markazi (dunyo koord.) —
// tom, kapot, eshik, bamper: qaysi qism zarbaga qaragan bo'lsa, o'sha topiladi.
function contactPoint(s){
  carGroup.updateMatrixWorld(true);
  const defs = curModel.userData.def, K = [];
  let best = -1e9;
  for(const m of defs){
    const e = m.mesh.matrixWorld.elements, P = m.pos.array;
    const ax = s.x*e[0]+s.y*e[1]+s.z*e[2], ay = s.x*e[4]+s.y*e[5]+s.z*e[6], az = s.x*e[8]+s.y*e[9]+s.z*e[10];
    const b = s.x*e[12]+s.y*e[13]+s.z*e[14];
    K.push([ax, ay, az, b]);
    for(let i=0;i<P.length;i+=3){ const pr = ax*P[i]+ay*P[i+1]+az*P[i+2]+b; if(pr > best) best = pr; }
  }
  _hp.set(0,0,0); let n = 0;
  defs.forEach((m, mi)=>{
    const [ax, ay, az, b] = K[mi], P = m.pos.array;
    for(let i=0;i<P.length;i+=3){
      if(ax*P[i]+ay*P[i+1]+az*P[i+2]+b > best - 0.1){ _lp.set(P[i], P[i+1], P[i+2]).applyMatrix4(m.mesh.matrixWorld); _hp.add(_lp); n++; }
    }
  });
  return n ? _hp.divideScalar(n) : _hp.copy(carGroup.position);
}
// p — zarba nuqtasi (dunyo), dir — zarba mashinaga ta'sir yo'nalishi (ichkariga), depth/R — metr, sev — 0..1 og'irlik
function deform(p, dir, depth, R, sev){
  carGroup.updateMatrixWorld(true);
  const crumple = 0.3 + 0.5*sev;   // og'ir zarbada notekis g'ijimlanish kuchayadi
  for(const m of curModel.userData.def){
    const mesh = m.mesh, g = mesh.geometry;
    _inv.copy(mesh.matrixWorld).invert();
    const s = mesh.matrixWorld.getMaxScaleOnAxis(), rl = R/s, dl = depth/s, cap = CRUSH_CAP/s, r2 = rl*rl;
    _lp.copy(p).applyMatrix4(_inv); _ld.copy(dir).transformDirection(_inv);
    if(g.boundingBox.distanceToPoint(_lp) > rl) continue;
    const P = m.pos.array, P0 = m.p0, N0 = m.n0, T = m.t; let moved = false;
    for(let i=0, j=0; i<P.length; i+=3, j++){
      const dx = P[i]-_lp.x, dy = P[i+1]-_lp.y, dz = P[i+2]-_lp.z, d2 = dx*dx + dy*dy + dz*dz;
      if(d2 >= r2) continue;
      let w = 1 - Math.sqrt(d2)/rl; w *= w;
      if(N0) w *= 0.4 + 0.6*Math.max(0, -(N0[i]*_ld.x + N0[i+1]*_ld.y + N0[i+2]*_ld.z));   // zarbaga qaragan yuza ko'proq ezilsin
      const h = Math.sin(P0[i]*127.1 + P0[i+1]*311.7 + P0[i+2]*74.7)*43758.5453;
      w *= 1 + crumple*(2*(h - Math.floor(h)) - 1);                                         // pozitsiyaga bog'liq shovqin
      const pr = dx*_ld.x + dy*_ld.y + dz*_ld.z, pull = 0.5*sev*w;                          // zarba o'qiga tomon siqilish
      let ox = P[i] + _ld.x*dl*w - (dx - pr*_ld.x)*pull - P0[i];
      let oy = P[i+1] + _ld.y*dl*w - (dy - pr*_ld.y)*pull - P0[i+1];
      let oz = P[i+2] + _ld.z*dl*w - (dz - pr*_ld.z)*pull - P0[i+2];
      const len = Math.hypot(ox, oy, oz); if(len > cap){ const c = cap/len; ox *= c; oy *= c; oz *= c; }
      P[i] = P0[i]+ox; P[i+1] = P0[i+1]+oy; P[i+2] = P0[i+2]+oz; T[j] = 1; moved = true;
    }
    if(!moved) continue;
    m.pos.needsUpdate = true;
    const nr = g.attributes.normal;
    if(N0){   // faqat tegilgan uchlarda yangi normal; qolganlarida eskisi (chok/qirralar buzilmasin)
      const keep = nr.array.slice(); g.computeVertexNormals();
      const A = nr.array; for(let j=0;j<T.length;j++) if(!T[j]){ A[3*j]=keep[3*j]; A[3*j+1]=keep[3*j+1]; A[3*j+2]=keep[3*j+2]; }
    } else g.computeVertexNormals();
    nr.needsUpdate = true;
  }
}

// ───────── [11-kun-tun-obhavo.js] ─────────
// ==================================================================
// KUN-TUN + OB-HAVO: quyosh holati, yomg'ir, tuman, yulduzlar
// ==================================================================
const DAY_LEN = 360;                          // to'liq sutka (sekund): 6 daqiqa
let dayTime = 0.34;                           // 0..1: 0.25 = tong, 0.5 = tush, 0.75 = kechqurun
let weatherIdx = 0, weatherT = 105, wetGrip = 1, envLblT = 0;
const WSTATES = [
  { name:'Ochiq', near:120, far:900, sunM:1.00, hemiM:1.00, grip:1.00, dark:1.00, rain:false, life:105 },
  { name:'Yomg\u2019ir', near:34, far:430, sunM:0.48, hemiM:1.14, grip:0.52, dark:0.60, rain:true, life:95 },
  { name:'Tuman', near:16, far:170, sunM:0.66, hemiM:1.22, grip:0.66, dark:0.55, rain:false, life:80 },
];
const CBG_D = new THREE.Color(0x8fb8de), CBG_DU = new THREE.Color(0xd8894c), CBG_N = new THREE.Color(0x0a0e1e);
const CS_D  = new THREE.Color(0xfff3df), CS_DU  = new THREE.Color(0xffa864), CS_N  = new THREE.Color(0x93a7ff);
const CH_D  = new THREE.Color(0xcfe3ff), CH_DU  = new THREE.Color(0xd8a070), CH_N  = new THREE.Color(0x1a2240);
const CHG_D = new THREE.Color(0x2e2620), CHG_N  = new THREE.Color(0x0c1018);
const _eA = new THREE.Color(), _eB = new THREE.Color(), _eC = new THREE.Color(), _eD = new THREE.Color();
const envSunOff = SUNOFF.clone();

let stars;
{
  const N = 320, p = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const th = Math.random()*Math.PI*2, ph = 0.06 + Math.random()*1.25;
    p[i*3] = 850*Math.cos(th)*Math.cos(ph); p[i*3+1] = 850*Math.sin(ph); p[i*3+2] = 850*Math.sin(th)*Math.cos(ph);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p,3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({color:0xdfe8ff, size:2.3, sizeAttenuation:false, transparent:true, opacity:0, depthWrite:false}));
  stars.frustumCulled = false;
  scene.add(stars);
}
let rain, rainV;
{
  const N = 420, p = new Float32Array(N*6);
  rainV = new Float32Array(N);
  for(let i=0;i<N;i++){
    const x = (Math.random()-.5)*56, z = (Math.random()-.5)*56, y = Math.random()*26;
    p[i*6]=x; p[i*6+1]=y; p[i*6+2]=z; p[i*6+3]=x; p[i*6+4]=y+1.1; p[i*6+5]=z;
    rainV[i] = 40 + Math.random()*26;
  }
  const g = new THREE.BufferGeometry();
  const at = new THREE.BufferAttribute(p,3);
  at.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', at);
  rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0xa8c4e0, transparent:true, opacity:0.45, depthWrite:false}));
  rain.frustumCulled = false; rain.visible = false;
  scene.add(rain);
}
function weatherSet(i){
  weatherIdx = ((i % WSTATES.length) + WSTATES.length) % WSTATES.length;
  weatherT = WSTATES[weatherIdx].life;
  envLblT = 0;
}
function weatherSkip(){ weatherSet(weatherIdx + 1); }
function timeSkip(){ dayTime = (dayTime + 0.25) % 1; envLblT = 0; }
function isNight(){ return dayTime < 0.23 || dayTime > 0.77; }
function headPower(){ return (lightsOn || isNight()) ? 1200 : 0; }
let tireGrip = 1;
function Grip(){ return 3.5 * wetGrip * tireGrip; }
function updateRain(dt){
  if(!rain.visible) return;
  const pa = rain.geometry.attributes.position, arr = pa.array;
  for(let i=0;i<rainV.length;i++){
    const j = i*6, v = rainV[i]*dt;
    arr[j+1] -= v; arr[j+4] -= v;
    if(arr[j+4] < 0){
      const x = (Math.random()-.5)*56, z = (Math.random()-.5)*56, y = 24 + Math.random()*4;
      arr[j]=x; arr[j+1]=y; arr[j+2]=z; arr[j+3]=x; arr[j+4]=y+1.1; arr[j+5]=z;
    }
  }
  pa.needsUpdate = true;
  rain.position.set(carGroup.position.x, carGroup.position.y - 2, carGroup.position.z);
}
function updateEnv(dt){
  updateRain(dt);
  weatherT -= dt;
  if(weatherT <= 0) weatherSet(weatherIdx + 1);
  const W = WSTATES[weatherIdx];
  const lf = Math.min(dt*1.2, 1);
  wetGrip += (W.grip - wetGrip) * lf;
  scene.fog.near += (W.near - scene.fog.near) * lf;
  scene.fog.far  += (W.far  - scene.fog.far ) * lf;
  const elv = Math.sin((dayTime - 0.25) * Math.PI * 2);
  const duskF = Math.max(0, 1 - Math.abs(elv)/0.28);
  const nf = Math.min(Math.max(1 - (elv + 0.16)/0.32, 0), 1);   // 0..1 tunlik
  _eA.copy(CBG_D); _eA.lerp(CBG_DU, duskF); _eA.lerp(CBG_N, nf); _eA.multiplyScalar(W.dark);
  scene.background.copy(_eA);
  scene.fog.color.copy(_eA);
  _eB.copy(CS_D); _eB.lerp(CS_DU, duskF); _eB.lerp(CS_N, nf);
  sun.color.copy(_eB);
  sun.intensity = (0.16 + 0.99*(1 - nf)) * W.sunM;
  _eC.copy(CH_D); _eC.lerp(CH_DU, duskF); _eC.lerp(CH_N, nf);
  hemi.color.copy(_eC);
  _eD.copy(CHG_D); _eD.lerp(CHG_N, nf);
  hemi.groundColor.copy(_eD);
  hemi.intensity = (0.35 + 0.60*(1 - nf)) * W.hemiM;
  const az = dayTime * Math.PI * 2;
  const yv = elv*(1 - nf) + 0.55*nf;
  envSunOff.set(Math.sin(az)*36, Math.max(yv, 0.05)*55, Math.cos(az)*36);
  if(vehicle){
    const fg = Grip();
    vehicle.wheelInfos[0].frictionSlip = fg;
    vehicle.wheelInfos[1].frictionSlip = fg;
  }
  const hp = headPower();
  headL.intensity = headR.intensity = hp;
  stars.material.opacity = nf * (W.rain ? 0.15 : 0.85);
  rain.visible = W.rain;
  envLblT -= dt;
  if(envLblT <= 0){
    envLblT = 1;
    const lb = document.getElementById('envlbl');
    if(lb) lb.textContent = W.name + ' - ' + (isNight() ? 'Tun' : 'Kun');
  }
}
