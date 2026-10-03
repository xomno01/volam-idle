/* ======================= VE SAN DAU (canvas) ======================= */
'use strict';
let CV, CX, DPR = 1;
const MON_SCALE = 1.4, HERO_SCALE = 1.35; // bang hoat anh xuat o 0.6 kich thuoc goc
const IMG = {};
function img(src) { if (!src) return null; let i = IMG[src]; if (!i) { i = new Image(); i.src = src; IMG[src] = i; } return i; }
function addText(x, y, t, color, size = 12) { const max = giamHieuUng() ? 20 : 60; if (R.quiet || R.txt.length > max) return; R.txt.push({ x, y, t, color, size, life: giamHieuUng() ? 0.6 : 0.9 }); }
function burst(x, y, color) { if (R.quiet) return; R.fx.push({ k: 'ring', x, y, color, life: 0.45, max: 0.45 }); }
function fxLine(a, b, atk) {
  if (R.quiet || R.fx.length > 80) return;
  let el = 'phys', v = 0; for (const e in atk.parts) if (atk.parts[e] > v) { v = atk.parts[e]; el = e; }
  R.fx.push({ k: 'line', x1: a.x, y1: a.y - 20, x2: b.x, y2: b.y - 14, color: ELEM_COL[el], life: 0.18, max: 0.18 });
}
/* ---------- hieu ung chieu goc (Missles.txt -> tools/extract_fx.py -> fx.js): dan bay theo huong + no tai muc tieu ----------
   chieu can chien: phat hoat anh tai muc tieu; thieu hinh thi ve tia nhu cu */
const JFX = window.JFX || { m: {}, s: {}, c: {}, f: {} }, FX_SCALE = 1.4, FX_MAX = 60;
const dir16 = (vx, vy) => (((Math.round(Math.atan2(-vx, vy) / (Math.PI / 8)) % 16) + 16) % 16);
function skillFxColor(atk) {
  let el = 'phys', v = 0;
  for (const e in (atk && atk.parts) || {}) if (atk.parts[e] > v) { v = atk.parts[e]; el = e; }
  return ELEM_COL[el] || ELEM_COL.phys;
}
/* hieu ung tai cho nguoi ra chieu (PreCastSpr cua skills.txt) */
function castFx(atk) {
  const f = atk && atk.id && JFX.f && JFX.f[atk.id], c = f && f.pre && JFX.c && JFX.c[f.pre];
  if (!c || R.quiet || R.fx.length > FX_MAX) return;
  R.fx.push({ k: 'boom', s: c, x: H.x, y: H.y - 6, t: 0, life: animDur(c), dir: 0, color: skillFxColor(atk) });
}
/* kieu phong dan cua chieu (MisslesForm / ChildSkillNum trong skills.txt, KSkill::CastMissles):
   0 tuong, 1 hang, 2 quat, 3 vong, 4 ngau nhien, 5 vung, 6 tai muc tieu, 7 tai nguoi ra chieu, >= 8 can chien */
function skillFx(a, b, atk) {
  const f = (atk.id && JFX.f && JFX.f[atk.id]) || {}, m = atk.id && JFX.m[f.c || JFX.s[atk.id]];
  castFx(atk);
  crackFx(b, atk);
  if (!m || R.quiet) {
    fxLine(a, b, atk);
    if (!R.quiet) burst(f.form === 7 ? a.x : b.x, f.form === 7 ? a.y : b.y, skillFxColor(atk));
    return;
  }
  if (R.fx.length > FX_MAX) return;
  const x1 = a.x, y1 = a.y - 20, x2 = b.x, y2 = b.y - 14, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
  const form = f.form === undefined ? 1 : f.form, n = clamp(f.num || 1, 1, 8), ang = Math.atan2(dy, dx);
  const color = skillFxColor(atk);
  const boom = (s, x, y, delay = 0) => R.fx.push({ k: 'boom', s, x, y, t: -delay, life: animDur(s), dir: dir16(dx, dy), color });
  const mis = (tx, ty, delay = 0) => R.fx.push({ k: 'mis', s: m.fly, hit: m.hit, x1, y1, x2: tx, y2: ty, t: -delay, life: Math.min(0.6, Math.hypot(tx - x1, ty - y1) / m.spd), dir: dir16(tx - x1, ty - y1), color });
  const s1 = m.hit || m.fly;
  if (atk.melee || form >= 8) { boom(s1, x2, y2); return; }
  if (form === 7) { boom(s1, x1, y1 + 8); return; }                                    // tai nguoi ra chieu
  if (form === 6) { for (let i = 0; i < n; i++) boom(s1, x2 + (n > 1 ? rnd(-36, 36) : 0), y2 + (n > 1 ? rnd(-24, 24) : 0), i * 0.07); return; }   // tai muc tieu
  if (!m.fly) { boom(s1, x2, y2); return; }
  if (form === 3) { for (let i = 0; i < n; i++) { const g = ang + i / n * Math.PI * 2; mis(x1 + Math.cos(g) * 130, y1 + Math.sin(g) * 130); } return; }   // vong quanh nguoi
  if (form === 2) { for (let i = 0; i < n; i++) { const g = ang + (i - (n - 1) / 2) * 0.26; mis(x1 + Math.cos(g) * d, y1 + Math.sin(g) * d); } return; }   // quat
  if (form === 1) { for (let i = 0; i < n; i++) mis(x2, y2, i * 0.09); return; }          // hang (lien tiep theo huong)
  if (form === 0) { const px = -dy / d, py = dx / d; for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 34; mis(x2 + px * o, y2 + py * o); } return; }   // tuong
  for (let i = 0; i < n; i++) mis(x2 + rnd(-60, 60), y2 + rnd(-40, 40), i * 0.05);         // ngau nhien / vung
}
/* Ky nang co "su kien khi dan tan" (skill_vanishedevent: Thien Ngoai Luu Tinh -> ky nang con 363, Am Phong Thuc Cot -> 354) sinh nut / vet nut tren mat dat tai noi roi.
   Ky nang con khong co trong du lieu trich ra va khong co hinh -> ve bang canvas: vet nut toa ra, vet xem trong dat, mau theo nguyen to chinh cua chieu */
function crackFx(b, atk) {
  const sk = atk && atk.id && SK[atk.id];
  if (!sk || !sk.attr.skill_vanishedevent || R.quiet || R.fx.length > FX_MAX) return;
  let el = 'phys', v = 0; for (const e in atk.parts) if (atk.parts[e] > v) { v = atk.parts[e]; el = e; }
  const rays = [], n = giamHieuUng() ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd(-0.25, 0.25), pts = []; let g = ang;
    for (let k = 1; k <= 4; k++) { g += rnd(-0.35, 0.35); pts.push([Math.cos(g) * k / 4 * rnd(0.85, 1.1), Math.sin(g) * k / 4 * rnd(0.85, 1.1)]); }
    rays.push(pts);
  }
  R.fx.push({ k: 'crack', x: b.x, y: b.y + 4, t: -0.3, life: 1.3, rays, r: clamp(atk.rad * 0.22, 56, 110), color: ELEM_COL[el] });   // t < 0: cho dan toi dich roi moi nut
}
function drawCrack(f) {
  const c = CX, k = clamp(f.t / f.life, 0, 1), grow = Math.min(1, f.t / 0.18), fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, r = f.r * (1 - Math.pow(1 - grow, 3));
  c.save(); c.translate(f.x, f.y); c.scale(1, 0.42);                  // nhin xien: mat dat bi dep theo chieu doc
  c.globalAlpha = 0.5 * fade; c.fillStyle = '#120a06'; c.beginPath(); c.arc(0, 0, r * 0.85, 0, 7); c.fill();
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const pass of [0, 1]) {
    c.globalAlpha = (pass ? 0.95 * (1 - k * 0.6) : 0.85) * fade; c.strokeStyle = pass ? f.color : '#0b0604'; c.lineWidth = pass ? 1.6 : 4.2;
    for (const ray of f.rays) { c.beginPath(); c.moveTo(0, 0); for (const [px, py] of ray) c.lineTo(px * r, py * r); c.stroke(); }
  }
  if (grow < 1) { c.globalAlpha = (1 - grow) * 0.7; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * 0.95, 0, 7); c.stroke(); }
  c.restore();
}
const animDur = s => Math.min(1.2, s.n * s.ms / 1000);
function drawFxSprite(s, dir, t, x, y, loop) {
  const im = img(s.f); if (!im || !im.complete || !im.naturalWidth) return false;
  const fr = loop ? Math.floor(t * 1000 / s.ms) % s.n : Math.min(s.n - 1, Math.floor(t * 1000 / s.ms));
  const row = s.d > 1 ? Math.round(dir * s.d / 16) % s.d : 0;
  CX.drawImage(im, fr * s.w, row * s.h, s.w, s.h, x - s.ax * FX_SCALE, y - s.ay * FX_SCALE, s.w * FX_SCALE, s.h * FX_SCALE);
  return true;
}
/* Sprite goc co the thieu trong ban deploy; ve tia va vong no canvas de chieu van hien hinh. */
function drawFxFallback(f) {
  const c = CX, color = f.color || ELEM_COL.phys;
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
  if (f.k === 'mis') {
    const k = clamp(f.t / Math.max(0.01, f.life), 0, 1), x = f.x1 + (f.x2 - f.x1) * k, y = f.y1 + (f.y2 - f.y1) * k;
    c.globalAlpha = 0.75; c.lineWidth = 2.5; c.beginPath(); c.moveTo(f.x1, f.y1);
    for (let i = 1; i <= 5; i++) { const q = i / 5, wobble = q < k ? Math.sin(f.t * 34 + i * 1.7) * 5 : 0; c.lineTo(f.x1 + (x - f.x1) * q, f.y1 + (y - f.y1) * q + wobble); }
    c.stroke(); c.globalAlpha = 1; c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fill();
  } else {
    const k = clamp(f.t / Math.max(0.01, f.life), 0, 1), r = 7 + k * 35;
    c.globalAlpha = 0.9 * (1 - k * 0.55); c.lineWidth = 3 - k;
    c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.55, 0, 0, 7); c.stroke();
    c.globalAlpha = 0.7 * (1 - k); c.beginPath(); c.arc(f.x, f.y, 3 + (1 - k) * 3, 0, 7); c.fill();
  }
  c.restore(); return true;
}
const SPR_FX = { mis: 1, boom: 1, crack: 1 };    // hieu ung dung dong ho t (khong dung life giam dan)
function stepFx(f, dt) { // tra ve false khi het; dan toi dich thi doi sang no
  f.t += dt; if (f.t < 0) return true;     // dang cho (phat dan lien tiep)
  if (f.k === 'crack') return f.t < f.life;
  if (f.k === 'mis' && f.t >= f.life) {
    if (f.hit) { Object.assign(f, { k: 'boom', s: f.hit, x: f.x2, y: f.y2, t: 0, life: animDur(f.hit) }); return true; }
    return false;
  }
  return f.t < f.life;
}
function drawFx(f) {
  if (f.t < 0) return false;
  if (f.k === 'crack') { drawCrack(f); return true; }
  if (f.k === 'mis') { const k = clamp(f.t / f.life, 0, 1); if (drawFxSprite(f.s, f.dir, f.t, f.x1 + (f.x2 - f.x1) * k, f.y1 + (f.y2 - f.y1) * k, true)) return true; return drawFxFallback(f); }
  if (drawFxSprite(f.s, f.dir, f.t, f.x, f.y, false)) return true;
  return drawFxFallback(f);
}
/* Giao dien di dong thu nho 20% (UI_SCALE_MOBILE): #app co width / height lon 1/0.8 lan roi transform: scale(0.8) (style.css, body.mob).
   Toa do trong game theo px bo cuc (offsetWidth / Height, khong bi transform); DPR hieu dung nhan them he so thu nho de net. */
const UI_SCALE_MOBILE = 0.8;
const isMobileUI = () => !(typeof isDesktopLandscape === 'function' && isDesktopLandscape()) && !!(window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700));
const uiScale = () => document.body.classList.contains('mob') ? UI_SCALE_MOBILE : 1;
function resizeArena() {
  const b = $('#battle'), box = { width: b.offsetWidth, height: b.offsetHeight };
  DPR = Math.min(2, window.devicePixelRatio || 1) * uiScale();
  CV.width = Math.round(box.width * DPR); CV.height = Math.round(box.height * DPR);
  AR.w = box.width; AR.h = box.height; AR.top = 58; AR.bot = box.height - 12;   // khung nhin (man hinh)
  snapCamera();
}
/* ---------- camera chay theo nhan vat, khong ra ngoai mep ban do ---------- */
const CAM = { x: 0, y: 0 };
const camTarget = () => [clamp(H.x - AR.w / 2, 0, Math.max(0, WORLD.w - AR.w)), clamp(H.y - AR.h * 0.55, 0, Math.max(0, WORLD.h - AR.h))];
function snapCamera() { [CAM.x, CAM.y] = camTarget(); }
function updateCamera(dt) { const [tx, ty] = camTarget(), k = Math.min(1, dt * 6); CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k; }
/* ---------- nen ban do: anh 3x3 vung that (BG_TILE diem) lat guong xen ke -> ghep lien, khong thay mep, the gioi rong tuy y ---------- */
const BG_TILE = 1536;
function drawTiledBg(c, bg) {
  if (!(bg && bg.complete && bg.naturalWidth)) { c.fillStyle = '#26301f'; c.fillRect(CAM.x - 2, CAM.y - 2, AR.w + 4, AR.h + 4); return; }
  if (OBS.g) { c.drawImage(bg, 0, 0, WORLD.w, WORLD.h); return; }          // ban do that rong, khong lat guong
  const T = BG_TILE, i0 = Math.floor(CAM.x / T), i1 = Math.floor((CAM.x + AR.w) / T), j0 = Math.floor(CAM.y / T), j1 = Math.floor((CAM.y + AR.h) / T);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const fx = i & 1, fy = j & 1;
    if (!fx && !fy) { c.drawImage(bg, i * T, j * T, T, T); continue; }
    c.save(); c.translate(i * T + (fx ? T : 0), j * T + (fy ? T : 0)); c.scale(fx ? -1 : 1, fy ? -1 : 1); c.drawImage(bg, 0, 0, T, T); c.restore();
  }
}
/* ---------- ban do nho: anh ban do that thu nho, quai = cham theo ngu hanh / trum, nhan vat = mui ten, khung = tam nhin ---------- */
const MINI = { s: 92, m: 8, top: 62 };
function drawMinimap(c) {
  if (R.town || S.miniMap === false) return;
  const s = MINI.s, x0 = AR.w - s - MINI.m, y0 = MINI.top, k = s / WORLD.w;
  c.save(); c.globalAlpha = 0.9; c.fillStyle = '#000c'; c.fillRect(x0 - 2, y0 - 2, s + 4, s + 4);
  const bg = R.bgImg;
  if (bg && bg.complete && bg.naturalWidth) {
    if (OBS.g) c.drawImage(bg, x0, y0, s, s);
    else { const n = Math.round(WORLD.w / BG_TILE), h = s / n;                   // cung cach ghep lat guong nhu nen tran dau
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.save(); c.translate(x0 + i * h + (i & 1 ? h : 0), y0 + j * h + (j & 1 ? h : 0)); c.scale(i & 1 ? -1 : 1, j & 1 ? -1 : 1); c.drawImage(bg, 0, 0, h, h); c.restore(); } }
  } else { c.fillStyle = '#26301f'; c.fillRect(x0, y0, s, s); }
  c.globalAlpha = 1;
  c.strokeStyle = '#fff6'; c.lineWidth = 1; c.strokeRect(x0 + CAM.x * k, y0 + CAM.y * k, Math.min(s, AR.w * k), Math.min(s, AR.h * k));
  for (const d of R.ground) if (lootMatch(d.it)) { c.fillStyle = RAR_COL[d.it.r]; c.fillRect(x0 + d.x * k - 1, y0 + d.y * k - 1, 2, 2); }
  for (const e of R.enemies) {
    if (e.dead) continue;
    const r = e.cls === 'boss' ? 3.2 : e.cls === 'elite' ? 2.4 : 1.8;
    c.fillStyle = e.goldBoss ? '#ffd24a' : e.cls === 'boss' ? '#ff4a3a' : SERIES_COL[e.series];
    c.beginPath(); c.arc(x0 + e.x * k, y0 + e.y * k, r, 0, 7); c.fill();
  }
  if (R.petPos) { c.fillStyle = '#9fe36a'; c.fillRect(x0 + R.petPos.x * k - 1.5, y0 + R.petPos.y * k - 1.5, 3, 3); }
  const hx = x0 + H.x * k, hy = y0 + H.y * k, a = Math.PI / 2 + (H.dir || 0) * Math.PI / 4;   // huong 0 = nam (xuong duoi)
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.beginPath();
  c.moveTo(hx + Math.cos(a) * 5, hy + Math.sin(a) * 5); c.lineTo(hx + Math.cos(a + 2.5) * 4, hy + Math.sin(a + 2.5) * 4); c.lineTo(hx + Math.cos(a - 2.5) * 4, hy + Math.sin(a - 2.5) * 4);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#c8a45a'; c.strokeRect(x0 - 2, y0 - 2, s + 4, s + 4);
  c.font = '9px "Noto Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#f3d88a';
  c.fillText(R.tower ? `Tháp · tầng ${R.tower.floor}` : zoneOf(Math.min(S.stage, STAGES)).n, x0 + s / 2, y0 + s + 11);
  c.restore();
}
const onScreen = (x, y, m = 120) => x > CAM.x - m && x < CAM.x + AR.w + m && y > CAM.y - m && y < CAM.y + AR.h + m;
function drawSprite(im, sz, x, y, scale, flip, alpha = 1) {
  if (!im || !im.complete || !im.naturalWidth) return false;
  const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
  // diem chan lay tu tam spr; mot so spr co tam nam ngoai khung da cat -> dung giua-duoi anh
  const okFoot = sz && sz[2] >= 0 && sz[2] <= im.naturalWidth && sz[3] >= im.naturalHeight * 0.5 && sz[3] <= im.naturalHeight * 1.2;
  const fx = okFoot ? sz[2] * scale : w / 2, fy = okFoot ? sz[3] * scale : h * 0.95;
  CX.save(); CX.globalAlpha = alpha; CX.translate(x, y); if (flip) CX.scale(-1, 1);
  CX.drawImage(im, -fx, -fy, w, h); CX.restore();
  return true;
}
/* ---------- hoat anh 8 huong (img/a/<npcres>_<hanh dong>.webp) ----------
   huong 0 = quay mat ve nguoi xem, tang theo chieu kim dong ho: N(am), TN, T, TB, B, DB, D, DN */
const dirOf = (vx, vy) => (((Math.round(Math.atan2(-vx, vy) / (Math.PI / 4)) % 8) + 8) % 8);
const ONCE = { at: 1, hurt: 1, die: 1 };
function animLen(key, act) { const m = W.anim && W.anim[key] && W.anim[key][act]; return m ? m.n * m.ms / 1000 : 0; }
function drawAnim(key, act, dir, t, x, y, sc, alpha = 1) {
  const set = W.anim && W.anim[key]; if (!set) return false;
  const m = set[act] || set.st; if (!m) return false;
  const im = img('img/a/' + m.f); if (!im.complete || !im.naturalWidth) return false;
  let fr = Math.floor(t * 1000 / m.ms); fr = ONCE[act] ? Math.min(fr, m.n - 1) : fr % m.n;
  const d = m.d >= 8 ? dir : Math.floor(dir * m.d / 8);
  CX.globalAlpha = alpha;
  CX.drawImage(im, fr * m.w, d * m.h, m.w, m.h, x - m.ax * sc, y - m.ay * sc, m.w * sc, m.h * sc);
  CX.globalAlpha = 1;
  return m.h * sc;
}
function setAct(o, act) { if (o.act !== act) { o.act = act; o.actT = 0; } }
function stepAct(o, dt, idle) { // het hoat anh mot lan (danh / trung don) -> ve trang thai nen
  o.actT = (o.actT || 0) + dt;
  if ((o.act === 'at' || o.act === 'hurt') && o.actT >= Math.max(0.25, animLen(o.animKey, o.act))) setAct(o, idle);
}
/* ten tren dau (nhan vat, quai, dong hanh): chu mot nen, vien den cho de doc tren moi nen ban do */
const NAME_COL = { boss: '#ffb070', elite: '#8fc6ff', normal: '#e8dcc8', hero: '#fff3c0', pet: '#9fe36a', gold: '#ffd24a' };
/* Nhan (ten + thanh mau) tren dau: xep vao hang cho, cuoi khung moi tranh chong: nhan nao de len nhan khac thi day len cao hon.
   y = diem sat dau; thanh mau nam duoi cung, ten ngay tren thanh. hp < 0: khong ve thanh. */
const LABELS = [];
function label(x, y, text, col, size, hp, barCol) { LABELS.push({ x, y, text, col, size, hp, barCol }); }
function flushLabels() {
  if (!LABELS.length) return;
  CX.textAlign = 'center'; CX.lineJoin = 'round';
  const placed = [];
  for (const L of LABELS.sort((a, b) => b.y - a.y)) {                 // tu duoi len: nhan thap giu cho, nhan cao day len khi de
    CX.font = `${L.size}px "Noto Sans", sans-serif`; L.w = Math.max(CX.measureText(L.text).width, 44); L.h = L.size + 4 + (L.hp >= 0 ? 7 : 0);
    let y = L.y;
    for (let k = 0; k < 8; k++) { const hit = placed.find(p => Math.abs(p.x - L.x) < (p.w + L.w) / 2 && y > p.top && y - L.h < p.y); if (!hit) break; y = hit.top - 1; }
    L.py = y; L.top = y - L.h; placed.push({ x: L.x, w: L.w, y, top: L.top });
  }
  for (const L of LABELS) {
    const y = L.py, bw = Math.min(L.w, 56);
    if (L.hp >= 0) { CX.fillStyle = '#000c'; CX.fillRect(L.x - bw / 2 - 1, y - 6, bw + 2, 6); CX.fillStyle = L.barCol; CX.fillRect(L.x - bw / 2, y - 5, bw * clamp(L.hp, 0, 1), 4); }
    CX.font = `${L.size}px "Noto Sans", sans-serif`; CX.lineWidth = 3; CX.strokeStyle = '#000c';
    const ty = y - (L.hp >= 0 ? 8 : 1); CX.strokeText(L.text, L.x, ty); CX.fillStyle = L.col; CX.fillText(L.text, L.x, ty);
  }
  LABELS.length = 0;
}
function nameTag(x, y, text, col, size = 11) {
  CX.font = `${size}px "Noto Sans", sans-serif`; CX.textAlign = 'center'; CX.lineJoin = 'round'; CX.lineWidth = 3; CX.strokeStyle = '#000c';
  CX.strokeText(text, x, y); CX.fillStyle = col; CX.fillText(text, x, y);
}
/* Ngoai hinh theo trang bi: hinh nhan vat that khong tach lop trang bi (chi 1 bo hoat anh theo phai) nen doi do khong doi hinh.
   Thay bang quang sang duoi chan theo do dang mac: Tim (>= 3 mon) tim, Hoang Kim vang, Bach Kim trang xanh; cang nhieu mon cang sang,
   du bo them cac hat sang quay quanh nguoi, cuong hoa / Bach Kim cap cao them vong ngoai */
function heroAura() {
  const eq = S.eq; let gold = 0, plat = 0, vio = 0, top = 0, n = 0;
  for (const k in eq) { const it = eq[k]; if (!it) continue; n++; if (it.set) it.set.kind === 'platina' ? plat++ : gold++; else if (it.r === 3) vio++; top = Math.max(top, (it.enh || 0) + (it.plv || 0)); }
  const col = plat >= gold && plat > 0 ? ['#cfe9ff', '#8cc8ff'] : gold ? ['#ffd24a', '#ff9a1e'] : vio >= 3 ? ['#e0a8ff', '#a050ff'] : null;
  return { col, k: Math.min(1, (plat + gold + vio * 0.5) / 8), full: typeof enoughToActive === 'function' && enoughToActive(eq), top, n };
}
function drawHeroAura(c, t, back) {
  const a = R.aura || (R.aura = heroAura());
  if (!a.col || giamHieuUng()) return;
  const pulse = 0.75 + 0.25 * Math.sin(t * 3), w = 22 + a.k * 16;
  if (back) {
    const g = c.createRadialGradient(H.x, H.y, 2, H.x, H.y, w * 1.6);
    g.addColorStop(0, a.col[0] + 'cc'); g.addColorStop(0.5, a.col[1] + '66'); g.addColorStop(1, a.col[1] + '00');
    c.save(); c.globalAlpha = (0.35 + 0.55 * a.k) * pulse; c.translate(H.x, H.y); c.scale(1, 0.4); c.translate(-H.x, -H.y); c.fillStyle = g; c.beginPath(); c.arc(H.x, H.y, w * 1.6, 0, 7); c.fill();
    if (a.top >= 5) { c.globalAlpha = 0.7; c.strokeStyle = a.col[0]; c.lineWidth = 2; c.beginPath(); c.arc(H.x, H.y, w * 1.05, 0, 7); c.stroke(); }
    c.restore(); return;
  }
  if (a.full) for (let i = 0; i < 6; i++) {                               // du bo: hat sang quay quanh nguoi
    const g = t * 1.6 + i * Math.PI / 3, rx = w * 0.95, h = 14 + Math.sin(t * 2.4 + i) * 12;
    c.globalAlpha = 0.85; c.fillStyle = a.col[0]; c.beginPath(); c.arc(H.x + Math.cos(g) * rx, H.y - 26 - h + Math.sin(g) * rx * 0.4, 2.2, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
}
function drawChatBubble(c, x, y, text) {
  if (!text) return;
  c.save();
  c.font = '11px "Noto Sans", sans-serif';
  const tw = c.measureText(text).width;
  const bw = Math.max(40, tw + 14), bh = 18;
  const bx = x - bw / 2, by = y - bh;

  c.fillStyle = 'rgba(12, 22, 17, 0.92)';
  c.strokeStyle = '#4fd08f';
  c.lineWidth = 1;
  c.beginPath();
  if (c.roundRect) c.roundRect(bx, by, bw, bh, 4);
  else c.rect(bx, by, bw, bh);
  c.fill(); c.stroke();

  c.beginPath();
  c.moveTo(x - 4, by + bh);
  c.lineTo(x, by + bh + 4);
  c.lineTo(x + 4, by + bh);
  c.fillStyle = 'rgba(12, 22, 17, 0.92)';
  c.fill();

  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, by + bh / 2 + 1);
  c.restore();
}

function drawRemoteHero(c, p, dt) {
  if (p.targetX !== undefined) {
    p.x += (p.targetX - p.x) * Math.min(1, dt * 12);
    p.y += (p.targetY - p.y) * Math.min(1, dt * 12);
  }
  const moving = p.targetX !== undefined && Math.hypot(p.targetX - p.x, p.targetY - p.y) > 2;

  c.fillStyle = '#0007'; c.beginPath(); c.ellipse(p.x, p.y, 16, 6, 0, 0, 7); c.fill();

  const hw = (W && W.hero && (W.hero[p.fac] || (typeof S !== 'undefined' && W.hero[S.fac]) || Object.values(W.hero)[0])) || null;
  const animKey = hw && hw.anim;
  const targetAct = p.isAttacking ? 'at' : (moving ? 'run' : 'st');
  if (p.act !== targetAct) {
    p.act = targetAct;
    p.actT = 0;
  } else {
    p.actT = (p.actT || 0) + dt;
  }

  const drawn = animKey && drawAnim(animKey, p.act, p.dir || 0, p.actT, p.x, p.y, HERO_SCALE);
  if (!drawn && hw && hw.img) {
    drawSprite(img(hw.img), hw.sz, p.x, p.y, 0.9, [3, 4, 5].includes(p.dir || 0));
  }

  const facName = (FAC && FAC[p.fac] && FAC[p.fac].n) || (hw && hw.n) || 'Võ Lâm';
  label(p.x, p.y - 60, `[${facName}] ${p.name || 'Đại hiệp'} · Lv${p.lvl || 1}`, '#5fd4ff', 12, (p.hp || 100) / (p.maxHp || 100), '#38bdf8');

  if (p.chatBubble && p.chatT > 0) {
    p.chatT -= dt;
    drawChatBubble(c, p.x, p.y - 70, p.chatBubble);
  }
}

function bar(x, y, w, h, f, col) { CX.fillStyle = '#000a'; CX.fillRect(x, y, w, h); CX.fillStyle = col; CX.fillRect(x, y, w * clamp(f, 0, 1), h); }
function draw(dt) {
  const c = CX; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, AR.w, AR.h);
  updateCamera(dt);
  c.setTransform(DPR, 0, 0, DPR, -Math.round(CAM.x) * DPR, -Math.round(CAM.y) * DPR);  // toa do the gioi
  const bg = R.bgImg;
  drawTiledBg(c, bg);
  // do roi tren dat: vien theo do hiem, ten cho do khop bo loc / mon dang chon
  c.textAlign = 'center';
  for (const d of R.town ? [] : R.ground) {
    const im = d.it.ic ? img(d.it.ic) : null, match = lootMatch(d.it), sel = R.pickTarget === d;
    const bob = Math.sin((d.age + d.x) * 3) * 1.5;
    c.fillStyle = '#0008'; c.beginPath(); c.ellipse(d.x, d.y + 2, 11, 4, 0, 0, 7); c.fill();
    c.strokeStyle = RAR_COL[d.it.r]; c.lineWidth = sel ? 2.5 : match ? 1.6 : 0.8; c.globalAlpha = match || sel ? 1 : 0.55;
    c.beginPath(); c.ellipse(d.x, d.y + 2, 12, 5, 0, 0, 7); c.stroke();
    if (im && im.complete && im.naturalWidth) { const k = Math.min(26 / im.naturalWidth, 26 / im.naturalHeight); c.drawImage(im, d.x - im.naturalWidth * k / 2, d.y - im.naturalHeight * k + bob, im.naturalWidth * k, im.naturalHeight * k); }
    if (match || sel || d.it.r >= 2) { c.font = '9px "Noto Sans", sans-serif'; c.fillStyle = '#000'; c.fillText(d.it.n, d.x + 1, d.y - 27); c.fillStyle = RAR_COL[d.it.r]; c.fillText(d.it.n, d.x, d.y - 28); }
    c.globalAlpha = 1;
  }
  // xac quai: phat hoat anh chet roi mo dan
  for (const e of R.corpses) {
    e.actT += dt; const a = clamp(1.6 - e.actT, 0, 1);
    const sc = e.cls === 'boss' ? 1.15 : e.cls === 'elite' ? 0.95 : 0.8;
    if (!(e.animKey && drawAnim(e.animKey, 'die', e.dir || 0, e.actT, e.x, e.y, sc * MON_SCALE, a))) { c.globalAlpha = a * 0.5; drawSprite(e.img, e.sz, e.x, e.y, sc, e.face < 0); c.globalAlpha = 1; }
  }
  R.corpses = R.corpses.filter(e => e.actT < 1.6);
  // dong hanh (rewards.js)
  drawPet(c, dt);

  // Dong bo vi tri cua ban than len may chu Online
  if (window.NET && typeof NET.syncMove === 'function') {
    NET.syncMove(H.x, H.y, H.dir, H.act === 'at');
  }

  // Danh sach tat ca thuc the tren san (Quai + Nhan vat chinh + Nguoi choi online khac)
  const remoteHeroList = (window.R && R.remotePlayers) ? Array.from(R.remotePlayers.values()).map(p => ({ remoteHero: true, p, y: p.y })) : [];
  const ents = R.enemies.filter(e => !e.dead)
    .concat([{ hero: true, y: H.y }])
    .concat(remoteHeroList)
    .sort((a, b) => a.y - b.y);

  for (const e of ents) {
    if (e.remoteHero) {
      drawRemoteHero(c, e.p, dt);
      continue;
    }
    if (e.hero) {
      c.fillStyle = '#0007'; c.beginPath(); c.ellipse(H.x, H.y, 16, 6, 0, 0, 7); c.fill();
      drawHeroAura(c, performance.now() / 1000, true);
      const hw = W.hero[S.fac];
      H.animKey = hw && hw.anim;
      const isMoving = !!H._isMoving;
      H.moving = isMoving;
      stepAct(H, dt, isMoving ? 'run' : 'st');
      if (R.deadT > 0) setAct(H, 'die'); else if (H.act !== 'at' && H.act !== 'hurt') setAct(H, isMoving ? 'run' : 'st');
      const drawn = hw && hw.anim && drawAnim(hw.anim, H.act || 'st', H.dir || 0, H.actT || 0, H.x, H.y, HERO_SCALE);
      label(H.x, H.y - (drawn ? Math.min(drawn, 90) * 0.9 : 52) - 6, `${S.name || (FAC[S.fac] && FAC[S.fac].n) || ''} · Lv${S.lvl}`, NAME_COL.hero, 12, R.life / Math.max(1, R.P.life), '#4fd04f');
      if (!drawn && !(hw && drawSprite(img(hw.img), hw.sz, H.x, H.y, 0.9, [3, 4, 5].includes(H.dir || 0), R.deadT > 0 ? 0.35 : 1))) { c.fillStyle = SERIES_COL[heroSeries()]; c.beginPath(); c.arc(H.x, H.y - 20, 14, 0, 7); c.fill(); }
      if (R.hurtT > 0) { c.fillStyle = '#f004'; c.beginPath(); c.arc(H.x, H.y - 24, 20, 0, 7); c.fill(); }
      drawHeroAura(c, performance.now() / 1000, false);
      if (H.chatBubble && H.chatT > 0) { H.chatT -= dt; drawChatBubble(c, H.x, H.y - 70, H.chatBubble); }
      continue;
    }
    const sc = e.cls === 'boss' ? 1.15 : e.cls === 'elite' ? 0.95 : 0.8;
    c.fillStyle = '#0007'; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.38, 0, 0, 7); c.fill();
    c.strokeStyle = SERIES_COL[e.series]; c.lineWidth = e.cls === 'normal' ? 1.2 : 2.4; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.38, 0, 0, 7); c.stroke();
    e.animKey = MON[e.tid].anim; stepAct(e, dt, e.moving ? 'run' : 'st');
    const ah = e.animKey && drawAnim(e.animKey, e.act || 'st', e.dir || 0, e.actT || 0, e.x, e.y, sc * MON_SCALE, e.hitT > 0 ? 0.75 : 1);
    if (!ah && !drawSprite(e.img, e.sz, e.x, e.y, sc, e.face < 0, e.hitT > 0 ? 0.6 : 1)) { c.fillStyle = SERIES_COL[e.series]; c.beginPath(); c.arc(e.x, e.y - e.r, e.r, 0, 7); c.fill(); }
    if (e.hitT > 0) e.hitT -= dt;
    const top = e.y - (ah ? Math.min(ah, 90) * 0.85 : e.img && e.img.naturalHeight ? e.img.naturalHeight * sc : e.r * 2) - 8;
    label(e.x, top, enemyName(e), e.goldBoss ? NAME_COL.gold : NAME_COL[e.cls] || NAME_COL.normal, e.cls === 'boss' ? 12 : 11, e.hp / e.max, e.cls === 'boss' ? '#ff5030' : '#e03a2a');
    if (e.poison > 0) { c.fillStyle = '#8fe34a'; c.fillRect(e.x - 22, top + 5, 44 * e.poison / 3, 2); }
  }
  // hieu ung
  R.fx = R.fx.filter(f => { if (!SPR_FX[f.k]) return true; const ok = stepFx(f, dt); if (ok) drawFx(f); return ok; });
  for (const f of R.fx) {
    if (SPR_FX[f.k]) continue;
    f.life -= dt; const a = clamp(f.life / f.max, 0, 1);
    c.globalAlpha = a; c.strokeStyle = f.color;
    if (f.k === 'line') { c.lineWidth = 3; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke(); }
    else { c.lineWidth = 2; c.beginPath(); c.arc(f.x, f.y - 10, 8 + (1 - a) * 30, 0, 7); c.stroke(); }
  }
  c.globalAlpha = 1; R.fx = R.fx.filter(f => f.life > 0);
  c.textAlign = 'center';
  flushLabels();                                                            // ten + thanh mau tren dau (chong chong nhau)
  for (const t of R.txt) { t.life -= dt; t.y -= 32 * dt; c.globalAlpha = clamp(t.life / 0.5, 0, 1); c.font = `${t.size}px "Noto Sans", sans-serif`; c.fillStyle = '#000'; c.fillText(t.t, t.x + 1, t.y + 1); c.fillStyle = t.color; c.fillText(t.t, t.x, t.y); }
  c.globalAlpha = 1; R.txt = R.txt.filter(t => t.life > 0);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);                                     // lop giao dien: toa do man hinh
  if (typeof drawJoystick === 'function') drawJoystick(c);
  drawMinimap(c);
  if (R.banner && R.banner.t > 0) {
    R.banner.t -= dt; c.globalAlpha = clamp(R.banner.t, 0, 1);
    c.fillStyle = '#000a'; c.fillRect(0, AR.h * 0.36, AR.w, 54);
    c.font = '20px Grenze, serif'; c.fillStyle = '#f3d88a'; c.fillText(R.banner.text, AR.w / 2, AR.h * 0.36 + 26);
    c.font = '12px "Noto Sans", sans-serif'; c.fillStyle = '#d8ccb4'; c.fillText(R.banner.sub, AR.w / 2, AR.h * 0.36 + 44);
    c.globalAlpha = 1;
  }
}
