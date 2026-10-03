/* ======================= LUU GAME (localStorage 'jxidle') ======================= */
'use strict';
const SAVE_V = 1, OFFLINE_MAX = 8 * 3600;
/* 3 slot nhan vat: slot 0 giu khoa cu 'jxidle' (tuong thich file luu truoc day), slot 1, 2 = 'jxidle_2', 'jxidle_3'.
   Con tro 'jxidle_slot' = chi so slot dang choi, hoac 'menu' (hien man hinh chon nhan vat o lan vao tiep theo). */
const SLOT_N = 3, SLOT_PTR = 'jxidle_slot';
let SLOT = 0, SAVE_LOCK = false;                 // SAVE_LOCK: dang xoa / doi nhan vat -> moi lan save() (pagehide, an tab...) bi chan, khong ghi lai nhan vat vua xoa
const slotKey = i => i === 0 ? 'jxidle' : 'jxidle_' + (i + 1);
const saveKey = () => slotKey(SLOT);
let S;
const FEMALE_FAC = ['emei', 'cuiyan'];       // phai nu: trang phuc nu; con lai nam
function newSave() {
  return { v: SAVE_V, name: 'Tân thủ', fac: null, sex: 0, lvl: 1, xp: 0, gold: 0, attrPts: 0, attr: { str: 0, dex: 0, vit: 0, eng: 0 },
    skPts: 1, sk: {}, main: 0, eq: {}, inv: [], stage: 1, maxStage: 1, wave: 1, push: true, uid: 1, autoSell: 0,
    kps: 0.2, totalKills: 0, autoEquip: true, autoPts: false, diff: 1, autoForge: false, autoBuy: true, tut: 0, hints: {}, bakAt: 0, potOff: false, potUsed: 0, potStock: { life: {}, mana: {} }, ctrl: 'auto', joy: 'fixed', slots: [0, 0, 0, 0], snd: { on: true, vol: 0.7, music: true, mvol: 0.4 }, lootF: { minRar: 1, minLvl: 1, groups: [], series: [], auto: true }, ground: [], mats: { ht: {}, ore: {}, shard: {}, misc: {} }, last: Date.now() };
}
/* Chu ky file luu (cyrb53 + muoi): phat hien sua tay localStorage / ma xuat. Khong ngan duoc nguoi quyet tam (game chay hoan toan o may nguoi choi) nhung chan sua vo tinh va nhap ma da bi doi. */
const SAVE_SALT = 'jx-idle-v1:';
function sigOf(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const s = SAVE_SALT + str;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
/* QA-038: chi copy khoa an toan cua du lieu nguoi dung -> chan prototype pollution qua '__proto__'. */
function safeKeys(x) { const out = {}; if (!x || typeof x !== 'object') return out; for (const k of Object.keys(x)) if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') out[k] = x[k]; return out; }
/* QA-037: toc do ha quai (kps) khong nam trong file luu/ma nhap - no dieu khien thuong offline.
   Luu rieng theo slot de nguoi choi that giu duoc toc do do, con file save nhap thi khong. */
const kpsKey = () => saveKey() + '_kps';
function readKps() { try { const v = parseFloat(localStorage.getItem(kpsKey())); return Number.isFinite(v) ? clamp(v, 0.02, 3) : 0.2; } catch (e) { return 0.2; } }
function saveKps() { try { localStorage.setItem(kpsKey(), String(S.kps)); } catch (e) { /* bo qua */ } }
function pack(state) { const body = JSON.stringify(state); return JSON.stringify({ d: body, h: sigOf(body) }); }
function unpack(txt) {                       // -> { state, ok } ; ok=false neu chu ky sai; file cu (khong goi) coi la hop le 1 lan roi ky lai
  const o = JSON.parse(txt);
  if (o && typeof o.d === 'string' && typeof o.h === 'string') return { state: JSON.parse(o.d), ok: sigOf(o.d) === o.h };
  return { state: o, ok: true, legacy: true };
}
let saveFailN = 0, saveWarned = false;   // QA-039: truoc day loi ghi bi nuot im lang
function save() {
  if (SAVE_LOCK || !S || !S.fac) return;
  S.last = Date.now(); if (typeof saveGround === 'function' && R.ground) saveGround();
  try {
    const k = saveKey(), prev = localStorage.getItem(k);
    if (prev) { try { if (unpack(prev).ok) localStorage.setItem(k + '_bak', prev); } catch (e) { /* bo qua ban hong */ } }   // ban sao luu = ban hop le truoc do
    localStorage.setItem(k, pack(S)); localStorage.setItem(SLOT_PTR, String(SLOT));
    saveFailN = 0;
  } catch (e) {
    saveFailN++;
    if (!saveWarned) {                    // canh bao MOT lan moi phien, khong spam khi bo nho day keo dai
      saveWarned = true;
      try { if (typeof toast === 'function') toast('Không lưu được: bộ nhớ trình duyệt đầy hoặc bị chặn. Tiến trình có thể mất khi đóng tab.'); } catch (x) { /* bo qua */ }
    }
  }
}
function migrate(o) {
  const s = Object.assign(newSave(), safeKeys(o));            // QA-038
  s.attr = Object.assign({ str: 0, dex: 0, vit: 0, eng: 0 }, safeKeys(o.attr));
  if (s.fac && !FAC[s.fac]) s.fac = null;
  for (const id in s.sk) if (!SK[id]) delete s.sk[id];
  s.stage = clamp(s.stage | 0 || 1, 1, STAGES + 400);
  // am thanh: file luu cu chi co {on:false} mac dinh (chua tung chinh) -> dung cau hinh moi
  s.snd = Object.assign({ on: true, vol: 0.7, music: true, mvol: 0.4 }, o.snd && 'vol' in o.snd ? o.snd : {});
  s.lootF = Object.assign({ minRar: 1, minLvl: 1, groups: [], series: [], auto: true }, o.lootF || {});
  if (o.autoSell && !o.lootF) s.lootF.minRar = o.autoSell;      // tu ban cu -> muc do hiem toi thieu cua bo loc
  // do sinh truoc khi co ngu hanh trang bi: khong co thu tu tien/hau to -> giu moi dong luon hieu luc
  for (const it of s.inv.concat(Object.values(s.eq), (s.ground || []).map(g => g && g.it))) if (it && (it.mag || []).some(m => m.pre === undefined)) it.leg = true;
  if (!o.autoPtsOff) { s.autoPts = false; s.autoPtsOff = 1; }     // tu cong diem tiem nang / ky nang nay mac dinh TAT (ca file luu cu: tat mot lan, bat lai o the Khac)
  s.mats = { ht: safeKeys((o.mats || {}).ht), ore: safeKeys((o.mats || {}).ore), shard: safeKeys((o.mats || {}).shard), misc: safeKeys((o.mats || {}).misc) };
  // QA-019: bao dam rw.stat/ach/lvGot LUON ton tai -> moi truy cap S.rw.stat.* deu an toan (truoc day rw co the la {}).
  s.rw = Object.assign({ fd: 0, title: '', pet: null, gbT: (typeof GB_EVERY === 'number' ? GB_EVERY : 0) }, safeKeys(o.rw));
  s.rw.stat = Object.assign({ kills: 0, bosses: 0, goldBoss: 0, picked: 0, towerBest: 0, reborn: 0, chests: 0, tokens: 0 }, safeKeys(s.rw.stat));
  s.rw.ach = (s.rw.ach && typeof s.rw.ach === 'object') ? s.rw.ach : {};
  s.rw.lvGot = (s.rw.lvGot && typeof s.rw.lvGot === 'object') ? s.rw.lvGot : {};
  // A: ten nhan vat + gioi tinh; B: toc do game; C: moc ngay da dung bang thu nghiem
  s.name = typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 16) : 'Tân thủ';
  s.sex = (s.sex | 0) === 1 ? 1 : 0;
  s.speed = [1, 1.5, 2.5].includes(+s.speed) ? +s.speed : 1;
  s.adminDay = typeof s.adminDay === 'string' ? s.adminDay.slice(0, 10) : '';
  s.lvl = clamp(Math.floor(+s.lvl) || 1, 1, MAX_LEVEL);
  s.xp = Number.isFinite(+s.xp) ? Math.max(0, +s.xp) : 0;       // QA-036: chan xp = Infinity tu file nhap
  s.kps = 0.2;                                                  // QA-037: do lai khi choi, khong nhan tu file
  s.gold = Number.isFinite(+s.gold) ? Math.max(0, +s.gold) : 0; s.skPts = Math.max(0, Math.floor(+s.skPts) || 0); s.attrPts = Math.max(0, Math.floor(+s.attrPts) || 0);
  s.inv = (Array.isArray(s.inv) ? s.inv : []).filter(it => it && typeof it === 'object' && Array.isArray(it.base) && Array.isArray(it.mag)).slice(0, INV_MAX);
  let maxUid = 0; for (const it of s.inv.concat(Object.values(s.eq || {}))) if (it && it.uid > maxUid) maxUid = it.uid; s.uid = Math.max(+s.uid || 1, maxUid + 1);
  { const seen = new Set(); s.inv = s.inv.filter(it => { if (seen.has(it.uid)) { it.uid = s.uid++; } seen.add(it.uid); return true; }); }   // uid trung (nhap ma sua tay): cap lai
  s.diff = [0, 1, 2].includes(+o.diff) ? +o.diff : 1; s.hints = o.hints && typeof o.hints === 'object' ? o.hints : {};
  // gioi tinh theo phai CHI cho file luu cu chua tung chon (mac dinh 0 -> phai nu mac nham do nam). Nguoi choi da chon / doi gioi tinh
  // (startFaction / the Khac dat sexSet) thi giu nguyen - truoc day moi lan nap game deu bi ghi de ve gioi tinh mac dinh cua phai.
  if (s.fac && !s.sexSet) s.sex = FEMALE_FAC.includes(s.fac) ? 1 : 0;
  const wrongSex = k => s.eq[k] && !sexReqOkFor(s.eq[k], s.sex);
  for (const k of Object.keys(s.eq || {})) if (!s.eq[k] || typeof s.eq[k] !== 'object') delete s.eq[k]; else if (wrongSex(k)) { if (s.inv.length < INV_MAX) s.inv.push(s.eq[k]); delete s.eq[k]; }   // trang phuc sai gioi tinh dang mac: thao ve tui
  s.v = SAVE_V;
  return s;
}
/* Tom tat mot slot (cho man hinh chon nhan vat): null = trong */
function slotInfo(i) {
  try {
    const t = localStorage.getItem(slotKey(i)); if (!t) return null;
    let u; try { u = unpack(t); } catch (e) { u = null; }
    if (!u || !u.ok) { const b = localStorage.getItem(slotKey(i) + '_bak'); try { u = b && unpack(b); } catch (e) { u = null; } }
    const o = u && u.state; if (!o || !o.fac) return null;
    return { fac: o.fac, lvl: o.lvl | 0 || 1, stage: o.stage | 0 || 1, last: o.last || 0, name: o.name || '' };
  } catch (e) { return null; }
}
/* Chon slot luc khoi dong: con tro hop le -> dung; chua co con tro -> neu dung 1 slot co nhan vat thi vao thang (file luu cu), nhieu slot thi hien man hinh chon */
function pickSlot() {
  let p = null; try { p = localStorage.getItem(SLOT_PTR); } catch (e) { /* che do rieng tu */ }
  const used = [...Array(SLOT_N).keys()].filter(i => slotInfo(i));
  if (p === 'menu') return { slot: used[0] ?? 0, menu: used.length > 0 };
  const n = +p; if (p !== null && Number.isInteger(n) && n >= 0 && n < SLOT_N) return { slot: n, menu: false };
  if (used.length > 1) return { slot: used[0], menu: true };
  return { slot: used[0] ?? 0, menu: false };
}
/* Xoa han mot slot: chan save() truoc, xoa khoa va ban sao luu, roi tai lai trang (neu khong, su kien pagehide se ghi nhan vat tro lai) */
function deleteSlot(i) {
  SAVE_LOCK = true;
  try { localStorage.removeItem(slotKey(i)); localStorage.removeItem(slotKey(i) + '_bak'); localStorage.setItem(SLOT_PTR, 'menu'); } catch (e) { /* bo qua */ }
  location.reload();
}
function switchCharacter() { save(); SAVE_LOCK = true; try { localStorage.setItem(SLOT_PTR, 'menu'); } catch (e) { /* bo qua */ } location.reload(); }
function load() {
  try {
    const t = localStorage.getItem(saveKey());
    if (t) {
      let u = unpack(t);
      if (!u.ok) {                                          // chu ky sai: dung ban sao luu hop le truoc do, neu khong thi cho chay tiep nhung danh dau
        const b = localStorage.getItem(saveKey() + '_bak'); let ub = null; try { ub = b && unpack(b); } catch (e) { /* hong */ }
        if (ub && ub.ok) u = ub; else u.state.tampered = 1;
        window.__tampered = true;
      }
      S = migrate(u.state); S.kps = readKps(); return true;
    }
  } catch (e) { console.warn('Khong doc duoc file luu, tao moi', e); }
  S = newSave(); S.kps = readKps(); return false;
}
/* ---------- File luu de chuyen thiet bi (.jxsave) ----------
   Dinh dang: JSON { game: 'jxidle', v, exported, fac, lvl, data } voi data = chuoi pack() co chu ky (cung dinh dang luu trong may).
   Nap vao BAT KY slot nao: kiem tra chu ky + noi dung, ghi bang migrate(), giu ban sao luu slot cu. Cung nhan ma van ban cu (base64) va file tho. */
function saveFileText() {
  save();
  return JSON.stringify({ game: 'jxidle', v: SAVE_V, exported: Date.now(), fac: S.fac, lvl: S.lvl, data: pack(S) });
}
function saveFileName() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `jxidle_${S.fac}_cap${S.lvl}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.jxsave`; }
function downloadSaveFile() {
  if (!S.fac) return false;
  const blob = new Blob([saveFileText()], { type: 'application/json' }), a = document.createElement('a');
  S.bakAt = Date.now(); save();
  a.href = URL.createObjectURL(blob); a.download = saveFileName(); document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return true;
}
/* Doc noi dung file / ma -> trang thai hop le (nem loi neu hong, sai chu ky hoac khong phai file cua game) */
function parseSaveText(txt) {
  txt = String(txt || '').trim().replace(/^\uFEFF/, '');
  if (!txt) throw new Error('File rỗng');
  let packed;
  if (txt[0] === '{') {
    const o = JSON.parse(txt);
    if (o && o.game === 'jxidle' && typeof o.data === 'string') packed = o.data;
    else if (o && typeof o.d === 'string' && typeof o.h === 'string') packed = txt;      // file tho (khoa luu trong may)
    else throw new Error('Không phải file lưu của game');
  } else packed = decodeURIComponent(escape(atob(txt)));                                  // ma van ban (Xuat ma)
  const u = unpack(packed);
  if (!u.ok) throw new Error('File đã bị chỉnh sửa (sai chữ ký)');
  const o = u.state;
  if (!o || typeof o !== 'object' || !o.fac || !FAC[o.fac] || !('lvl' in o)) throw new Error('File không có nhân vật hợp lệ');
  return o;
}
/* Ghi nhan vat vao slot i (giu ban sao luu cu), dat con tro, tai lai trang */
function writeSlot(i, state) {
  const s = migrate(state); s.last = Date.now();
  SAVE_LOCK = true;
  try {
    const k = slotKey(i), prev = localStorage.getItem(k);
    if (prev) localStorage.setItem(k + '_bak', prev);
    localStorage.setItem(k, pack(s));
    localStorage.setItem(SLOT_PTR, String(i));
  } catch (e) { SAVE_LOCK = false; throw new Error('Không ghi được (bộ nhớ trình duyệt đầy hoặc bị chặn)'); }
  return s;
}
function exportSave() { save(); return btoa(unescape(encodeURIComponent(pack(S)))); }
function importSave(txt) {
  const u = unpack(decodeURIComponent(escape(atob(txt.trim()))));
  if (!u.ok) throw new Error('Mã đã bị chỉnh sửa');
  const o = u.state;
  if (!o || typeof o !== 'object' || !('lvl' in o)) throw new Error('Mã không hợp lệ');
  S = migrate(o); save(); R.dirty = true;
}

/* Tien trinh offline: uoc tinh theo toc do ha quai do duoc khi dang choi (S.kps), toi da 8 gio */
/* Treo may: 2 gio dau tinh day du, tu gio thu 3 chi con 40%, tran 8 gio / lan va 12 gio / 24 gio thuc (chong chinh dong ho); luon thap hon choi that.
   Dong ho lui (S.last o tuong lai) khong cho tien trinh. */
const OFFLINE_FULL = 2 * 3600, OFFLINE_TAIL = 0.4, OFFLINE_RATE = 0.75, OFFLINE_DAY_MAX = 12 * 3600;
function offlineGains() {
  const now = Date.now(), raw = (now - S.last) / 1000;
  if (!(raw >= 60) || !S.fac) return null;
  const d = S.offDay = (S.offDay && now - S.offDay.t0 < 86400000 && S.offDay.t0 <= now) ? S.offDay : { t0: now, secs: 0 };
  const capped = Math.min(OFFLINE_MAX, raw, Math.max(0, OFFLINE_DAY_MAX - d.secs));
  if (capped < 60) return null;
  d.secs += capped; S.last = now;   // tính xong là đóng mốc: nếu trình duyệt sập trước lần lưu kế tiếp (10 giây) thì không nhận lại thưởng offline lần nữa
  const secs = capped, eff = Math.min(secs, OFFLINE_FULL) + OFFLINE_TAIL * Math.max(0, secs - OFFLINE_FULL);
  const kills = Math.floor(eff * clamp(S.kps || 0.1, 0.02, 3) * 0.8 * OFFLINE_RATE);
  if (!kills) return null;
  const L = stageLevel(S.stage), lv0 = S.lvl;
  const xp = expFor(L) * kills * (S.lvl - L > 10 ? 0.2 : S.lvl - L > 5 ? 0.6 : 1);
  const gold = moneyDrop({ L, cls: 'normal' }) * kills;
  gainXp(xp); S.gold += gold;
  let got = 0, sold = 0;
  const nDrops = Math.min(30, Math.floor(kills * 0.08));
  for (let i = 0; i < nDrops; i++) {
    const it = rollDrops({ L, cls: Math.random() < 0.15 ? 'elite' : 'normal', bonusDrop: 1 })[0];
    if (!it) continue;
    if (addItem(it, true)) got++; else sold++;
  }
  autoEquipAll(); sweepJunk(); autoBuyWeapon(); autoForge();
  const chests = offlineChests(secs);                       // rương tu luyen theo moc 1 / 4 / 8 gio (rewards.js)
  return { secs, kills, xp, gold, lv0, lv1: S.lvl, got, sold, chests };
}
