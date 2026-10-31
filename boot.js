// ====================================================================
// 3D Haydash — yuklovchi (boot)
// 1) data-*.txt (trassa, mashina modellari) va game-*.js fayllarini parallel yuklaydi
// 2) data fayllari "@@d-nom" sarlavhali bloklardan iborat: har bir blok sahifaga
//    <script type="text/plain" id="d-nom"> sifatida qo’yiladi (o’yin shu elementlardan o’qiydi)
// 3) game-1…6.js ni TARTIB BILAN birlashtirib bitta <script type="module"> sifatida ishga tushiradi
//    (kod bo’laklari umumiy o’zgaruvchilardan foydalanadi, shuning uchun bitta doirada ishlashi shart)
// Yangi fayl qo’shsangiz — GAME_FILES yoki DATA_FILES ro’yxatiga yozing.
// ====================================================================
(function(){
  'use strict';
  var V = '3';   // fayllar o’zgarganda raqamni oshiring — brauzer keshi yangilanadi
  var GAME_FILES = ["game-1-yadro.js", "game-2-xaritalar.js", "game-3-fizika.js", "game-4-boshqaruv.js", "game-5-mantiq.js", "game-6-tarmoq.js"];
  var DATA_FILES = [["data-1-trassa.txt", 23793063], ["data-2-rainier.txt", 19281166], ["data-3-mashinalar.txt", 18836012]];   // [fayl, taxminiy hajm (belgi)]

  var loadEl = document.getElementById('load');
  function msg(t){ if(loadEl){ loadEl.textContent = t; loadEl.style.display = 'flex'; } }
  function fail(e){ console.error(e); msg('Yuklashda xato: ' + ((e && e.message) || e) + ' — sahifani yangilang.'); }

  if(location.protocol === 'file:'){
    msg('O’yin serverdan ochilishi kerak: terminalda "npm install" va "npm start" ni ishga tushiring, so’ng brauzerda http://localhost:3000 ni oching.');
    return;
  }

  var total = 0, got = 0, lastPct = -1;
  DATA_FILES.forEach(function(d){ total += d[1]; });
  GAME_FILES.forEach(function(){ total += 150000; });
  function progress(n){
    got += n; var p = Math.min(99, Math.floor(got / total * 100));
    if(p !== lastPct){ lastPct = p; msg('Yuklanmoqda… ' + p + '%'); }
  }

  // matnni oqim bilan o’qiydi (foiz ko’rsatish uchun), oqim bo’lmasa oddiy text()
  function getText(url, tries){
    return fetch(url + '?v=' + V).then(function(r){
      if(!r.ok) throw new Error(url + ' (' + r.status + ')');
      if(!r.body || !r.body.getReader) return r.text().then(function(t){ progress(t.length); return t; });
      var rd = r.body.getReader(), dec = new TextDecoder(), parts = [];
      function pump(){
        return rd.read().then(function(x){
          if(x.done){ parts.push(dec.decode()); return parts.join(''); }
          var s = dec.decode(x.value, { stream: true }); parts.push(s); progress(s.length); return pump();
        });
      }
      return pump();
    }).catch(function(e){
      if(tries > 0) return new Promise(function(ok){ setTimeout(ok, 500); }).then(function(){ return getText(url, tries - 1); });
      throw e;
    });
  }
  // "@@d-nom\n<base64>\n@@d-boshqa\n..." → { 'd-nom': '<base64>', ... }
  function parseData(t, out){
    var i = 0;
    while(i < t.length && t.charAt(i) === '@' && t.charAt(i + 1) === '@'){
      var nl = t.indexOf('\n', i), id = t.slice(i + 2, nl);
      var e = t.indexOf('\n@@', nl + 1); if(e < 0) e = t.length;
      var body = t.slice(nl + 1, e); if(body.charAt(body.length - 1) === '\n') body = body.slice(0, -1);
      out[id] = body; i = e + 1;
    }
  }

  msg('Yuklanmoqda… 0%%');
  var dataP = DATA_FILES.map(function(d){ return getText(d[0], 2); });
  var codeP = GAME_FILES.map(function(f){ return getText(f, 2); });
  Promise.all(codeP).then(function(code){
    return Promise.all(dataP).then(function(data){ return { code: code, data: data }; });
  }).then(function(R){
    // 1) ma’lumot elementlari
    var map = {};
    R.data.forEach(function(t){ parseData(t, map); });
    R.data.length = 0;
    Object.keys(map).forEach(function(id){
      var el = document.createElement('script'); el.type = 'text/plain'; el.id = id;
      el.textContent = map[id]; delete map[id];
      document.body.appendChild(el);
    });
    // 2) o’yin kodi (tartib bilan birlashtirilgan, module sifatida)
    var m = document.createElement('script'); m.type = 'module';
    m.textContent = R.code.join('\n');
    document.body.appendChild(m);
  }).catch(fail);
})();
