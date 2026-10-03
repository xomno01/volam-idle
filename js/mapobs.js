/* ======================= VAT CAN BAN DO THAT (tools/export_maps.py -> mapobs.js: window.JMO) =======================
   Moi vung (zone) co anh nen rong A x A vung (512 diem) va luoi vat can 16 x 32 o moi vung, o = 32 x 16 diem (KRegion.h).
   Chi di duoc o o trong thuoc thanh phan lien thong lon nhat (khong bi nhot trong o bi bao kin). Khong co du lieu -> the gioi cu 3072, khong vat can. */
'use strict';
const OBS = { g: null, key: null };
const OBS_DEFAULT_WORLD = 3072;

function obsLoad(key) {
  const m = !window.NO_OBS && window.JMO && window.JMO[String(key === 'town' ? W.town.id : key)];   // NO_OBS: tests tinh nang khac tat vat can
  OBS.key = key; OBS.g = null;
  if (!m) { WORLD.w = WORLD.h = OBS_DEFAULT_WORLD; return false; }
  const bin = atob(m.obs), bits = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i);
  const n = m.gw * m.gh, ok = new Uint8Array(n);
  for (let k = 0; k < n; k++) ok[k] = bits[k >> 3] >> (k & 7) & 1 ? 0 : 1;          // 1 = di duoc
  // thanh phan lien thong lon nhat (8 huong, khong cat goc cheo qua o chan)
  const comp = new Int32Array(n).fill(-1), q = new Int32Array(n);
  let best = -1, bestN = 0, id = 0;
  for (let s = 0; s < n; s++) {
    if (!ok[s] || comp[s] >= 0) continue;
    let h = 0, t = 0; q[t++] = s; comp[s] = id;
    while (h < t) {
      const c = q[h++], cx = c % m.gw, cy = (c / m.gw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= m.gw || y >= m.gh) continue;
        const k = y * m.gw + x; if (!ok[k] || comp[k] >= 0) continue;
        if (dx && dy && (!ok[cy * m.gw + x] || !ok[y * m.gw + cx])) continue;
        comp[k] = id; q[t++] = k;
      }
    }
    if (t > bestN) { bestN = t; best = id; }
    id++;
  }
  for (let k = 0; k < n; k++) ok[k] = comp[k] === best ? 1 : 0;
  OBS.g = { gw: m.gw, gh: m.gh, cw: m.cw, ch: m.ch, w: m.w, h: m.h, ok, free: bestN };
  WORLD.w = m.w; WORLD.h = m.h;
  return true;
}
const obsCell = (x, y) => { const g = OBS.g; return [Math.floor(x / g.cw), Math.floor(y / g.ch)]; };
function obsAt(x, y) {                                    // diem co di duoc khong
  const g = OBS.g; if (!g) return true;
  const cx = Math.floor(x / g.cw), cy = Math.floor(y / g.ch);
  return cx >= 0 && cy >= 0 && cx < g.gw && cy < g.gh && g.ok[cy * g.gw + cx] === 1;
}
const OBS_R = 9;                                           // ban kinh chan: kiem tra tam + trai / phai
const obsWalk = (x, y) => obsAt(x, y) && obsAt(x - OBS_R, y) && obsAt(x + OBS_R, y);
/* o di duoc gan nhat (xoan oc theo o) */
function obsSnap(x, y) {
  const g = OBS.g; if (!g || obsWalk(x, y)) return [x, y];
  const [cx, cy] = obsCell(clamp(x, 0, g.w - 1), clamp(y, 0, g.h - 1));
  for (let r = 1; r < Math.max(g.gw, g.gh); r++) {
    let bd = 1e9, bp = null;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const px = (cx + dx + 0.5) * g.cw, py = (cy + dy + 0.5) * g.ch;
      if (!obsWalk(px, py)) continue;
      const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; bp = [px, py]; }
    }
    if (bp) return bp;
  }
  return [g.w / 2, g.h / 2];
}
/* di chuyen co truot: thu ca buoc, roi tung truc */
function obsMove(o, nx, ny) {
  if (!OBS.g) { o.x = nx; o.y = ny; return true; }
  if (obsWalk(nx, ny)) { o.x = nx; o.y = ny; return true; }
  if (obsWalk(nx, o.y)) { o.x = nx; return true; }
  if (obsWalk(o.x, ny)) { o.y = ny; return true; }
  return false;
}
/* tam nhin thang giua hai diem (lay mau moi 8 diem) */
function obsLine(x0, y0, x1, y1) {
  if (!OBS.g) return true;
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!obsWalk(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
/* A* tren luoi o, 8 huong, hang doi uu tien dang heap nhi phan; tra ve [{x,y}] (tam o) hoac null. Gioi han so o duyet de khong giat. */
function obsPath(x0, y0, x1, y1, maxN = 8000) {
  const g = OBS.g; if (!g) return null;
  const sx = clamp(Math.floor(x0 / g.cw), 0, g.gw - 1), sy = clamp(Math.floor(y0 / g.ch), 0, g.gh - 1);
  let tx = clamp(Math.floor(x1 / g.cw), 0, g.gw - 1), ty = clamp(Math.floor(y1 / g.ch), 0, g.gh - 1);
  const free = (x, y) => x >= 0 && y >= 0 && x < g.gw && y < g.gh && g.ok[y * g.gw + x] === 1;
  if (!free(tx, ty)) { const [px, py] = obsSnap(x1, y1); tx = Math.floor(px / g.cw); ty = Math.floor(py / g.ch); }
  const key = (x, y) => y * g.gw + x, came = new Map(), gs = new Map([[key(sx, sy), 0]]);
  const hh = (x, y) => Math.hypot((x - tx) * g.cw, (y - ty) * g.ch);
  const heap = [[hh(sx, sy), sx, sy]];                              // [f, x, y]
  const push = n => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let n = 0;
  while (heap.length && n++ < maxN) {
    const [, cx, cy] = pop();
    if (cx === tx && cy === ty) {
      const out = []; let k = key(cx, cy);
      while (k !== undefined) { out.push({ x: (k % g.gw + 0.5) * g.cw, y: (Math.floor(k / g.gw) + 0.5) * g.ch }); k = came.get(k); }
      return out.reverse();
    }
    const cg = gs.get(key(cx, cy));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = cx + dx, y = cy + dy; if (!free(x, y)) continue;
      if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue;
      const ng = cg + Math.hypot(dx * g.cw, dy * g.ch);
      if (ng < (gs.get(key(x, y)) ?? 1e18)) { gs.set(key(x, y), ng); came.set(key(x, y), key(cx, cy)); push([ng + hh(x, y), x, y]); }
    }
  }
  return null;
}
/* Truong khoang cach (BFS tu o cua nhan vat, 8 huong) dung chung cho moi quai: quai khong bi vat can chan tam nhin chi viec buoc sang o co khoang cach nho nhat.
   Tinh lai khi nhan vat sang o khac, toi da mot lan moi vai buoc: ~1 ms, thay cho moi quai tu chay A* (lam khung hinh giat o ban do nhieu nui). */
const FIELD = { g: null, cell: -1, d: null };
function obsField(hx, hy) {
  const g = OBS.g; if (!g) return null;
  const cx = clamp(Math.floor(hx / g.cw), 0, g.gw - 1), cy = clamp(Math.floor(hy / g.ch), 0, g.gh - 1), c0 = cy * g.gw + cx;
  if (FIELD.g === g && FIELD.cell === c0) return FIELD.d;
  const n = g.gw * g.gh, d = FIELD.g === g && FIELD.d ? FIELD.d : new Int32Array(n); d.fill(-1);
  const q = FIELD.q && FIELD.q.length === n ? FIELD.q : (FIELD.q = new Int32Array(n)); let h = 0, t = 0;
  let s = c0; if (!g.ok[s]) { const [px, py] = obsSnap(hx, hy); s = clamp(Math.floor(py / g.ch), 0, g.gh - 1) * g.gw + clamp(Math.floor(px / g.cw), 0, g.gw - 1); }
  d[s] = 0; q[t++] = s;
  while (h < t) {
    const c = q[h++], x = c % g.gw, y = (c / g.gw) | 0, nd = d[c] + 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const px = x + dx, py = y + dy; if (px < 0 || py < 0 || px >= g.gw || py >= g.gh) continue;
      const k = py * g.gw + px; if (d[k] >= 0 || !g.ok[k]) continue;
      if (dx && dy && (!g.ok[y * g.gw + px] || !g.ok[py * g.gw + x])) continue;
      d[k] = nd; q[t++] = k;
    }
  }
  FIELD.g = g; FIELD.cell = c0; FIELD.d = d; return d;
}
/* quai duoi theo nhan vat: thang neu thong tam nhin, khong thi di xuong doc truong khoang cach */
function obsChase(o, tx, ty, step) {
  const g = OBS.g;
  if (!g) { const d = Math.hypot(tx - o.x, ty - o.y) || 1, k = Math.min(1, step / d); o.x += (tx - o.x) * k; o.y += (ty - o.y) * k; return; }
  const d0 = Math.hypot(tx - o.x, ty - o.y) || 1;
  if (d0 < 260 && obsLine(o.x, o.y, tx, ty)) { const k = Math.min(1, step / d0); obsMove(o, o.x + (tx - o.x) * k, o.y + (ty - o.y) * k); return; }
  const f = obsField(tx, ty); if (!f) return;
  const cx = clamp(Math.floor(o.x / g.cw), 0, g.gw - 1), cy = clamp(Math.floor(o.y / g.ch), 0, g.gh - 1), here = f[cy * g.gw + cx];
  if (here < 0) { const k = Math.min(1, step / d0); obsMove(o, o.x + (tx - o.x) * k, o.y + (ty - o.y) * k); return; }
  let best = here, bx = cx, by = cy;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= g.gw || y >= g.gh) continue;
    const v = f[y * g.gw + x]; if (v < 0 || v >= best) continue;
    if (dx && dy && (!g.ok[cy * g.gw + x] || !g.ok[y * g.gw + cx])) continue;
    best = v; bx = x; by = y;
  }
  if (bx === cx && by === cy) { const k = Math.min(1, step / d0); obsMove(o, o.x + (tx - o.x) * k, o.y + (ty - o.y) * k); return; }   // o dich: ap sat nhan vat
  const wx = (bx + 0.5) * g.cw, wy = (by + 0.5) * g.ch, d = Math.hypot(wx - o.x, wy - o.y) || 1, k = Math.min(1, step / d);
  obsMove(o, o.x + (wx - o.x) * k, o.y + (wy - o.y) * k);
}
/* di ve (tx, ty) mot buoc `step` diem: thang neu thong, khong thi theo duong A* (luu trong o._pp, tinh lai khi muc tieu doi o) */
let obsBudget = 2;                                       // so lan A* toi da moi khung hinh
const obsFrame = () => { obsBudget = 2; };
function obsSteer(o, tx, ty, step) {
  if (!OBS.g) { const d = Math.hypot(tx - o.x, ty - o.y) || 1, k = Math.min(1, step / d); o.x += (tx - o.x) * k; o.y += (ty - o.y) * k; return; }
  if (obsLine(o.x, o.y, tx, ty)) {
    o._pp = null; const d = Math.hypot(tx - o.x, ty - o.y) || 1, k = Math.min(1, step / d);
    if (!obsMove(o, o.x + (tx - o.x) * k, o.y + (ty - o.y) * k)) o._stuck = (o._stuck || 0) + 1; else o._stuck = 0;
    return;
  }
  const [cx, cy] = obsCell(tx, ty), pk = cx + ',' + cy;
  if ((o._pk !== pk || (!o._pp && (o._pr = (o._pr || 0) - 1) < 0)) && obsBudget > 0) { obsBudget--; o._pp = obsPath(o.x, o.y, tx, ty); o._pk = pk; o._pi = 0; o._pr = o._pp ? 0 : 30; }   // that bai: thu lai sau 30 khung
  const p = o._pp; if (!p || !p.length) return;
  while (o._pi < p.length - 1 && Math.hypot(p[o._pi].x - o.x, p[o._pi].y - o.y) < 10) o._pi++;
  const w = p[Math.min(o._pi, p.length - 1)], d = Math.hypot(w.x - o.x, w.y - o.y) || 1, k = Math.min(1, step / d);
  obsMove(o, o.x + (w.x - o.x) * k, o.y + (w.y - o.y) * k);
}
