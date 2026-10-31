# 3D Haydash — ixcham tuzilma (19 ta fayl)

Eng katta fayl 23.8 MB (GitHub chegarasi 25 MB). Zip yo‘q, hammasi oddiy fayl.

## Ishga tushirish
```
npm install
npm start          # so‘ng brauzerda http://localhost:3000
```
O‘yin va onlayn server bitta Node.js jarayonida ishlaydi. Faylni ikki marta bosib (`file://`) ochib bo‘lmaydi.

## Fayllar
```
server.js            onlayn server (HTTP + Socket.io + xonalar), bitta fayl
package.json         bog‘liqliklar (socket.io)
.gitignore, README.md
public/
  index.html         HTML (menyu, HUD)
  style.css          hamma uslublar
  vendor.js          three · GLTFLoader · meshopt · pako · cannon-es
  peerjs.min.js      serversiz onlayn (WebRTC) kutubxonasi — YANGI
  config.js          NET_SERVER (onlayn server manzili)
  boot.js            yuklovchi
  game-1-yadro.js         sozlama, sahna, mashina modeli
  game-2-xaritalar.js     Spa trassasi, menyu/garaj, Mount Rainier, bosh ekran
  game-3-fizika.js        relyef, mashina fizikasi, halokat, kun-tun/ob-havo
  game-4-boshqaruv.js     missiya, tuning, mobil boshqaruv, drift
  game-5-mantiq.js        ovoz, pit-stop, yoqilg‘i/shina, asosiy sikl
  game-6-tarmoq.js        grafika, multiplayer klienti, ishga tushirish
  data-1-trassa.txt       Spa trassasi (23.8 MB)
  data-2-rainier.txt      Mount Rainier (19.3 MB)
  data-3-mashinalar.txt   Mercedes, Porsche, garaj, relyef (18.8 MB)
```

## Ulanish tartibi
1. `index.html` → `style.css`
2. `vendor.js` (three → GLTFLoader → meshopt → pako → cannon-es) → `config.js` → `boot.js`
3. `boot.js` `data-1…3.txt` va `game-1…6.js` ni parallel yuklaydi. Data fayllaridagi `@@d-nom` bloklarini
   `<script type="text/plain" id="d-nom">` qilib qo‘yadi, so‘ng `game-1…6.js` ni **shu tartibda** birlashtirib
   bitta module-skript sifatida ishga tushiradi (kod bo‘laklari umumiy o‘zgaruvchilardan foydalanadi).
4. Yangi fayl qo‘shsangiz — `boot.js` dagi `GAME_FILES` / `DATA_FILES` ro‘yxatiga yozing.

## Multiplayer
- **Ikki usul, o‘yin o‘zi tanlaydi:** (1) Node.js server bo‘lsa — Socket.io; (2) server bo‘lmasa (Sayt.uz, GitHub Pages va h.k.) —
  to‘g‘ridan-to‘g‘ri WebRTC (`peerjs.min.js`): xona egasining brauzeri xona serveri bo‘ladi. Ikkinchi usul uchun
  hech qanday server o‘rnatish shart emas, faqat `peerjs.min.js` o‘yin fayllari yonida turishi kerak.
- Menyu: 🌐 Onlayn → ism → Xona yaratish / kod bilan Qo‘shilish. O‘yin vaqtida `O` tugmasi (telefonda ☰ → Onlayn).
- Klient (`game-6-tarmoq.js`) `/socket.io/socket.io.js` ni serverdan oladi va shu manzilga ulanadi.
- Xona kodi 4 belgi, 8 tagacha o‘yinchi. Protokol `server.js` ichida yozilgan.
- O‘yin GitHub Pages/Netlify da, server Render/Railway da bo‘lsa: `public/config.js` da
  `NET_SERVER: 'https://sizning-server.onrender.com'`, serverda `ORIGIN=https://sizning-sayt.github.io`.

## GitHub ga yuklash
Papkani saqlab yuklang: `server.js`, `package.json`, `.gitignore`, `README.md` ildizda; qolgan 15 fayl `public/` ichida.
