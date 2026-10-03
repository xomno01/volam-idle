/* ======================= LOI: tien ich, hang so, chi muc du lieu ======================= */
'use strict';
const J = window.JX, W = window.JW;
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => { n = Math.round(n); const a = Math.abs(n); return a < 1e4 ? '' + n : a < 1e6 ? (n / 1e3).toFixed(a < 1e5 ? 1 : 0) + 'k' : a < 1e9 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e9).toFixed(2) + 'B'; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Ngày theo GIỜ MÁY, dạng YYYY-MM-DD (toISOString là UTC: lượt "mỗi ngày" sẽ mở lại lúc 7 giờ sáng ở Việt Nam) */
const localISODay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function wpick(list, w) { let t = 0; for (const x of list) t += w(x); let r = Math.random() * t; for (const x of list) { r -= w(x); if (r <= 0) return x; } return list[list.length - 1]; }

/* ---------- ngu hanh: 0 Kim, 1 Moc, 2 Thuy, 3 Hoa, 4 Tho ---------- */
const SERIES = J.series;
const SERIES_COL = ['#f3d35b', '#6fd46a', '#5fb8ff', '#ff6a3a', '#c8965a'];
const KHAC = { 0: 1, 1: 4, 4: 2, 2: 3, 3: 0 }; // Kim khac Moc, Moc khac Tho, Tho khac Thuy, Thuy khac Hoa, Hoa khac Kim
const counters = (a, t) => a >= 0 && t >= 0 && KHAC[a] === t;
/* nguyen to sat thuong: vat ly, doc, bang, hoa, loi (thu tu rmax trong world.js) */
const ELEM = ['phys', 'poison', 'cold', 'fire', 'light'];
const ELEM_VI = { phys: 'Vật lý', poison: 'Độc', cold: 'Băng', fire: 'Hỏa', light: 'Lôi' };
const ELEM_COL = { phys: '#f0e6d0', poison: '#8fe34a', cold: '#7fd0ff', fire: '#ff7a2a', light: '#d9b6ff' };
const ELEM_ATTR = { phys: 'physicsdamage_v', poison: 'poisondamage_v', cold: 'colddamage_v', fire: 'firedamage_v', light: 'lightingdamage_v' };
const ELEM_ADD = { phys: 'addphysicsdamage_v', poison: 'addpoisondamage_v', cold: 'addcolddamage_v', fire: 'addfiredamage_v', light: 'addlightingdamage_v' };
const ELEM_RES = { phys: 'physicsres_p', poison: 'poisonres_p', cold: 'coldres_p', fire: 'fireres_p', light: 'lightingres_p' };
const ELEM_ENH = { poison: 'poisonenhance_p', cold: 'coldenhance_p', fire: 'fireenhance_p', light: 'lightingenhance_p' };

/* ---------- hang so cong thuc (docs/CONG_THUC.md) ---------- */
/* Hoa giai / trieu tieu sat thuong tu do bo: tran de dong an cua ca bo (10 mon) khong lam nhan vat bat tu */
const BLOCK_MAX = 35, ABSORB_MAX = 0.45, ABSORB_K = 220, SKILL_ENH_MAX = 60;
const MAX_RESIST = 95, PLAYER_RES_MAX = 75, MAX_HIT = 95, MIN_HIT = 40, CRIT_MULT = 2;
const STR_PER_DMG = 5, DEX_PER_DMG = 5, ENG_PER_DMG = 4;
/* Can bang rieng game idle (ban goc khong co): 1 Noi cong = +1% sat thuong nguyen to cua chieu, 1 Suc manh (Than phap voi am khi) = +1% sat thuong vat ly */
const ENG_PER_PCT = 1, STR_PER_PCT = 1, DEX_PCT_RANGED = 0.5, IDLE_LIFE_PER_LEVEL = 8; // +8 sinh luc moi cap cho moi he (quai danh lien tuc theo dot)
// Tran cap 180 (nguoi choi chon phuong an (a)): du lieu co 399 nhom bo Hoang Kim + 318 nhom Bach Kim trai
// tu cap 0 den 180, truoc day tran 99 khien vai tram nhom KHONG BAO GIO cham toi duoc (noi dung chet).
const PTS_PER_LEVEL = 5, SKILL_PTS_PER_LEVEL = 1, MAX_LEVEL = Math.min(180, J.exp.length);
/* QA-083: bang exp goc KHONG tron tren cap 100 — buoc nhay 1,2 -> 1,667 -> 1,5 roi PHANG o 170-200
   (J.exp[169..199] deu = 2e9). Do la ly do nhip len cap vo ly khi mo tran len 180. Tu cap 100 tro di
   noi tiep quy dao 1-99 (ti le ~1,087/cap) cho tron va doan duoc. */
const EXP_TAIL_R = J.exp[98] / J.exp[97];
function expNeed(L) {
  const l = Math.max(1, Math.min(Math.floor(L) || 1, MAX_LEVEL));
  return l <= 99 ? J.exp[l - 1] : J.exp[98] * Math.pow(EXP_TAIL_R, l - 99);
}

/* ---------- thuoc tinh ma thuat ---------- */
const ATTR_ID = Object.fromEntries(J.attr.map((n, i) => [n, i]));
function attrText(name, p) {
  const t = J.attrDesc[name];
  if (!t) return name + ': ' + p.filter(v => v).join(' / ');
  return t.replace(/#([a-zA-Z])([123A])([-+~%]?)/g, (m, k, i, flag) => {
    const v = i === 'A' ? Math.floor((p[0] || 0) / 256) : (p[+i - 1] || 0);
    if (k === 'l') return J.skills[v] ? J.skills[v].n : '#' + v;   // #l3 = ten ky nang (tham so 3 la id ky nang)
    return (flag === '+' && v > 0 ? '+' : '') + v;
  }).replace(/#[a-zA-Z][123A][-+~]?/g, '')
    .replace(/Kỹ năng (\d+)/, (m, id) => (J.skills[id] ? 'Kỹ năng ' + J.skills[id].n : m));   // dong +cap ky nang: hien ten
}

/* ---------- mon phai, ky nang, quai ---------- */
const FACTIONS = J.factions.filter(f => f.skills && f.skills.length);
const FAC = Object.fromEntries(FACTIONS.map(f => [f.key, f]));
const SK = J.skills;
/* Game idle: chieu tan cong dau tien cua moi phai hoc duoc tu cap 1 (ban goc: cap 10, truoc do chi danh thuong) */
for (const f of FACTIONS) {
  const first = f.skills.map(id => SK[id]).filter(s => s && s.enemy && ['physicsenhance_p', 'physicsdamage_v', 'poisondamage_v', 'colddamage_v', 'firedamage_v', 'lightingdamage_v'].some(a => s.attr[a])).sort((a, b) => a.req - b.req || a.id - b.id);
  if (first.length) { first[0].req = 1; f.starter = first[0].id; }
  // loai vu khi cua phai = tham so 3 cua mon vu khi (addphysicsdamage_p) co cap yeu cau thap nhat
  const mastery = f.skills.map(id => SK[id]).filter(s => s && !s.enemy && s.attr.addphysicsdamage_p).sort((a, b) => a.req - b.req || a.id - b.id)[0];
  const a = mastery && mastery.attr.addphysicsdamage_p[0];
  f.wcode = Array.isArray(a) && [0, 1, 2, 3, 4, 5, 7, 9].includes(a[2]) ? a[2] : -1;
}
const skVal = (s, attr, L) => { const a = s.attr[attr]; if (!a) return null; const v = a[clamp(L, 1, a.length) - 1]; return Array.isArray(v) ? v : [v, 0, 0]; };
const DMG_ATTRS = ['physicsenhance_p', 'physicsdamage_v', 'poisondamage_v', 'colddamage_v', 'firedamage_v', 'lightingdamage_v'];
const isAttack = s => !!(s && s.enemy && DMG_ATTRS.some(a => s.attr[a]));
const ZONES = W.zones, MON = W.mon;
const ZONE_STAGES = 10, WAVES = 4;
const STAGES = ZONES.length * ZONE_STAGES;
/* QA-084: chan ai chay loan. stageLevel() bao hoa o tran ngay khi qua vung cuoi, nhung ai cu tang mai ->
   nguoi choi danh quai cap tran khi con rat thap (do duoc voi tran 180: cap 90 da o AI 109.341 va giu
   22,8 ty luong). Chan o dung moc ma quai dat tran. */
const STAGE_CAP = STAGES + 2 * Math.max(0, MAX_LEVEL - 160);
/* QA-085: khoa AI THEO CAP. Truoc day ai chi tang khi giet du quai, ma duong cong mau quai tho hon
   duong cong sat thuong nguoi choi -> ai vuot rat xa (do duoc: cap 90 da o ai 109.341), nguoi choi
   farm quai cap tran khi con thap => kinh nghiem va NGAN LUONG khong lo (22,8 ty luong / 400 gio).
   Chi cho vuot ai khi quai cua ai ke tiep khong cao hon cap nhan vat qua STAGE_GATE. */
const STAGE_GATE = 5;

/* ---------- trang bi ---------- */
const SLOTS = [['weapon', 'Vũ khí'], ['armor', 'Áo'], ['helm', 'Mũ'], ['belt', 'Đai lưng'], ['boot', 'Giày'], ['cuff', 'Hộ uyển'],
  ['amulet', 'Dây chuyền'], ['ring1', 'Nhẫn 1'], ['ring2', 'Nhẫn 2'], ['pendant', 'Ngọc bội'], ['horse', 'Ngựa']];
const SLOT_VI = Object.fromEntries(SLOTS);
const DETAIL_SLOT = ['weapon', 'weapon', 'armor', 'ring', 'amulet', 'boot', 'belt', 'helm', 'cuff', 'pendant', 'horse']; // theo equip_detail
const MELEE_KIND = ['sword', 'blade', 'wand', 'spear', 'hammer', 'dualblades'], RANGE_KIND = ['darts', 'knife', 'crossbow'];
const AFFIX_KEY = { armor: 'armor', ring: 'ring', amulet: 'necklace', boot: 'boot', belt: 'belt', helm: 'helm', cuff: 'cuff', pendant: 'pendant' };
const RAR_VI = ['Thường', 'Xanh', 'Vàng', 'Tím', 'Hoàng Kim', 'Bạch Kim'], RAR_COL = ['#e8e0d0', '#6aa8ff', '#ffd24a', '#c77bff', '#ffb52e', '#eaf6ff'];
const INV_MAX = 60;
/* Cuong hoa trang bi (forge.js): moi cap +8% thuoc tinh goc (sat thuong vu khi, phong thu, khang goc...) */
/* QA-088: tran cho hai option de "do tot" khong pha vo ky nang.
   +cap ky nang (allskill_v / *skill_v): toi da 2 cap.
   Hut sinh luc / noi luc: option hiem, toi da 5%. */
const SKILL_LV_MAX = 2, LEECH_MAX = 5;
const ENH_MAX = 10, ENH_STEP = 0.08;
const PLAT_STEP = 0.05;   // Bach Kim: moi cap thang +5% thuoc tinh goc (Uoc luong)
const enhMul = it => 1 + ENH_STEP * ((it && it.enh) || 0) + PLAT_STEP * ((it && it.plv) || 0);
/* The gioi cua moi vung = anh ban do that 3x3 vung (1536 x 1536 diem) ghep 2x2 lat guong (render.js drawTiledBg)
   -> 3072 x 3072, lien mach khong thay mep; camera chay theo nhan vat */
const WORLD = { w: 3072, h: 3072, pad: 20 };
const clampWorld = (x, y) => [clamp(x, WORLD.pad, WORLD.w - WORLD.pad), clamp(y, WORLD.pad + 30, WORLD.h - WORLD.pad)];
/* vi tri trong the gioi, o di duoc gan nhat khi co vat can (mapobs.js) */
const inWorld = (x, y) => { const p = clampWorld(x, y); return typeof OBS !== 'undefined' && OBS.g ? obsSnap(p[0], p[1]) : p; };
/* Dong "Duong" (am duong: lifemax_yan_v, coldres_yan_p, allres_yan_p...) cung tac dung nhu dong thuong cung ten: gop ve ten goc.
   Truoc day calc() chi doc ten goc nen toan bo dong Duong (6000+ dong cua do bo Hoang Kim / Bach Kim / do thuong) khong cong chi so nao */
/* QA-040: ton trong thiet lap he thong "giam chuyen dong". Mac dinh theo OS; nguoi choi ghi de bang S.lowFx
   (o the Khac). Truoc day game bo qua hoan toan prefers-reduced-motion. */
const thichGiamChuyenDong = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const giamHieuUng = () => (S && S.lowFx !== undefined && S.lowFx !== null) ? !!S.lowFx : thichGiamChuyenDong();
const canonAttr = n => n.indexOf('_yan') >= 0 ? n.replace('_yan', '') : n;
const attrName = id => J.attr[id] || ('#' + id);
