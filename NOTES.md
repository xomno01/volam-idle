# Clone Notes: Võ Lâm Idle (jxoffline)

- **Original URL**: `https://jxoffline.khoa-vnd92.workers.dev/`
- **Architecture**: 100% Client-Side Web Game (HTML5 Canvas + Vanilla JS + Web Audio API + LocalStorage)
- **Status**: Hoàn chỉnh 100% (Bit-for-bit fidelity)
- **Total Assets**: 1,275 files (~61.5 MB)
  - JavaScript modules: 21 files (`js/*.js`) + 6 root data scripts (`data.js`, `world.js`, `sound.js`, `fx.js`, `jmo.js`, `rdata.js`)
  - Audio: 175 files (`snd/*.mp3`)
  - Images: 1048 files (`img/i/`, `img/m/`, `img/pl/`, `img/s/`, `img/z/`, `ui/`)
  - Fonts: 4 variable fonts (`fonts/*.ttf`)
  - HTML & CSS: `index.html`, `style.css`, `fonts/font.css`
  - Offline cache: `sw.js`, `manifest.json`

## Local Verification
- Server: `node server.js`
- Port: `3000`
- Response test: All MIME types (text/html, application/javascript, audio/mpeg, image/png, font/ttf) verified `200 OK`.
