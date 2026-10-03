/* ======================= LUYEN CONG: CHE DO SINH TON (ngoai game goc) =======================
   Vao bang phai + trang bi + chi so cua nhan vat treo may. Tran 10 phut tren ban do that (anh vung dang danh, lat guong
   noi lien nen khong co mep), quai tran toi tu vong quanh man hinh, so luong tang dan toi ~320. Ha quai roi ngoc kinh nghiem;
   moi lan len cap trong tran chon 1 trong 3: chieu tan cong cua phai (1-5 sao) hoac noi cong (1-5 sao); het lua chon thi "Nhan het".
   Trum o phut 2 / 4 / 6 / 8. Ket thuc: ngan luong + kinh nghiem + do ve nhan vat treo may, quy doi theo toc do ha quai
   khi treo (S.kps) de khong lan at treo may: 0.5 .. 2.5 lan luong treo may cung thoi gian (thang tran x1.3). */
'use strict';
const SV_DUR = 600, SV_BOSS_T = [120, 240, 360, 480], SV_MAX_EN = 320, SV_CELL = 64, SV_STAR_MAX = 5, SV_GEM_MAX = 350, SV_MAX_TRAPS = 30;
const SV_REWARD_MIN = 0.5, SV_REWARD_MAX = 2.5, SV_WIN_BONUS = 1.3;
const SV = { on: false, up: {}, traps: [], chests: [] };
const svNeed = l => Math.round(3 + l * 2 + l * l * 0.15);
const SV_REGEN = 0.005; // hoi 0.5% sinh luc / giay

/* ---------- nang cap dung chung (do JX, 1-5 sao) ---------- */
const SV_UPS = {
  wrist:  { n: 'Hộ Uyển',       ic: 'ui/slot.png', desc: 'Hiệu lực chiêu +15%',           stat: s => `+${15 * s}%` },
  boot:   { n: 'Giày',          ic: 'ui/slot.png', desc: 'Tốc chạy +8%',                  stat: s => `+${8 * s}%` },
  pouch:  { n: 'Ám Khí Nang',   ic: 'ui/slot.png', desc: 'Tốc độ đạn +15%, tầm +10%',     stat: s => `+${15 * s}%` },
  mag:    { n: 'Hấp Tinh',      ic: 'ui/ring.png', desc: 'Tầm hút ngọc +30%',             stat: s => `×${(1 + 0.3 * s).toFixed(1)}` },
  mirror: { n: 'Hộ Tâm Kính',   ic: 'ui/slot.png', desc: 'Giảm sát thương nhận 6%',        stat: s => `-${6 * s}%` },
  med:    { n: 'Kim Sáng Dược', ic: 'ui/slot.png', desc: 'Hồi sinh lực +0.3%/giây',       stat: s => `+${(0.3 * s).toFixed(1)}%/s` },
};

/* ---------- lua chon: chieu tan cong + noi cong cua phai ---------- */
const PAS_KIND = [ // loai thuong theo thuoc tinh chinh cua chieu noi cong goc
  [/lifemax|vitality|lifereplenish/, 'hp', 'Sinh lực +12%'], [/fastwalkrun/, 'spd', 'Tốc chạy +8%'],
  [/attackspeed|castspeed/, 'cd', 'Hồi chiêu -7%'], [/res_p|armordefense|adddefense|resist/, 'def', 'Giảm sát thương nhận -8%'],
  [/./, 'dmg', 'Sát thương +12%'],
];
const ELEM_TRAPS = [343, 303, 345, 347, 349];
function svActives() {
  const f = FAC[S.fac];
  const list = f.skills.filter(id => isAttack(SK[id]) && SK[id].req <= Math.max(1, S.lvl));
  const tId = ELEM_TRAPS[f.series];
  if (tId && !list.includes(tId) && SK[tId] && SK[tId].req <= Math.max(10, S.lvl)) list.push(tId);
  return list;
}
function svPassives() { const f = FAC[S.fac]; return f.skills.filter(id => SK[id] && !isAttack(SK[id]) && SK[id].req <= Math.max(1, S.lvl) && Object.keys(SK[id].attr).length); }
function pasKind(id) { const keys = Object.keys(SK[id].attr).join(' '); return PAS_KIND.find(([re]) => re.test(keys)) || PAS_KIND[PAS_KIND.length - 1]; }
function svSkillLv(id) { const s = SK[id]; return S.sk[id] ? skillLv(id) : clamp(Math.floor((S.lvl - s.req) / 3) + 1, 1, 20); }   // QA-088: dung chung ham cap hieu dung (co tran +2)
function svInfo(id) { return SV.info[id] || (SV.info[id] = activeInfo(R.P, SK[id], svSkillLv(id))); }
function svBonus(k) { let v = 0; for (const id in SV.pas) if (pasKind(id)[1] === k) v += SV.pas[id]; return v; }
function svOptions() {
  const opt = [];
  for (const id of svActives()) if ((SV.picks[id] || 0) < SV_STAR_MAX) opt.push({ t: 'sk', id });
  for (const id of svPassives()) if ((SV.pas[id] || 0) < SV_STAR_MAX) opt.push({ t: 'pas', id });
  for (const id in SV_UPS) if (((SV.up && SV.up[id]) || 0) < SV_STAR_MAX) opt.push({ t: 'up', id });
  for (let i = opt.length - 1; i > 0; i--) { const j = irnd(0, i); [opt[i], opt[j]] = [opt[j], opt[i]]; }
  return opt.length ? opt.slice(0, 3) : [{ t: 'all' }];
}
function svApply(o) {
  // QA-058: dem SO LUOT CHON, khac han dem SAO (picks/pas chi tang voi 'sk'/'pas';
  // con 'up' toan cuc va fallback 'all' ho tro khong tang o nao). Dung cho tong ket cuoi tran + kiem thu.
  SV.choices = (SV.choices || 0) + 1;
  if (o.t === 'sk') { SV.picks[o.id] = (SV.picks[o.id] || 0) + 1; SV.cds[o.id] = SV.cds[o.id] || 0; }
  else if (o.t === 'pas') SV.pas[o.id] = (SV.pas[o.id] || 0) + 1;
  else if (o.t === 'up') { SV.up = SV.up || {}; SV.up[o.id] = (SV.up[o.id] || 0) + 1; if (o.id === 'mag') SV.mag = SV.up.mag; }
  else if (o.t === 'mag') { SV.up = SV.up || {}; SV.up.mag = (SV.up.mag || 0) + 1; SV.mag = SV.up.mag; }
  else { SV.hp = Math.min(SV.maxhp, SV.hp + SV.maxhp * 0.3); SV.gold += Math.round(moneyDrop({ L: SV.L0, cls: 'elite' }) * 3); }
  SV.maxhp = R.P.life * (1 + 0.12 * svBonus('hp'));
  svBarUpdate();
}

/* ---------- thanh chieu: 6 o chu dong (vong hoi chieu) + 6 o bi dong ---------- */
function svBarUpdate() {
  const bar = $('#svBar'); if (!bar) return;
  const by = o => Object.keys(o).map(Number).sort((a, b) => o[b] - o[a] || SK[a].req - SK[b].req);
  const act = by(SV.picks), pas = by(SV.pas);
  for (const id in SV_UPS) if (SV.up && SV.up[id]) pas.push(id);
  const cell = (id, stars, cd) => {
    if (!id) return `<div class="svcell"><img src="ui/slot.png" alt=""></div>`;
    const s = SV_UPS[id] || (id === 'mag' ? { n: 'Hấp Tinh', ic: 'ui/ring.png' } : SK[id]);
    return `<div class="svcell" data-id="${id}"><img src="${esc(s.ic || 'ui/slot.png')}" alt=""><b class="star">${'★'.repeat(stars)}</b>${cd ? '<div class="cd"></div>' : ''}</div>`;
  };
  const row = (ids, stars, cd) => ids.slice(0, 6).map(id => cell(id, stars(id), cd)).concat(Array(Math.max(0, 6 - Math.min(6, ids.length))).fill(cell(0))).join('');
  bar.innerHTML = `<div class="svrow act">${row(act, id => SV.picks[id], true)}</div><div class="svrow pas">${row(pas, id => SV_UPS[id] ? SV.up[id] : (id === 'mag' ? SV.mag : SV.pas[id]), false)}</div>`;
  bar.querySelectorAll('.svcell[data-id]').forEach(el => el.onclick = () => svSlotInfo(el.dataset.id));
}
function svBarCd() {
  const bar = $('#svBar'); if (!bar || SV.choosing || SV.over) return;
  bar.querySelectorAll('.svcell .cd').forEach(el => { const id = el.parentNode.dataset.id; el.style.setProperty('--cd', SV.cdMax[id] ? clamp(SV.cds[id] / SV.cdMax[id], 0, 1) : 0); });
}
function svSlotInfo(id) {
  if (!SV.on || SV.over) return;
  SV.paused = true;
  if (SV_UPS[id] || id === 'mag') {
    const u = SV_UPS[id] || SV_UPS.mag, stars = (SV.up && SV.up[id]) || (id === 'mag' ? SV.mag : 0);
    const body = `${u.desc} (mỗi sao cộng thêm, hiện ${u.stat(stars)}).`;
    return modal(`<h3>${esc(u.n)} <small>${'★'.repeat(stars)}</small></h3><p class="desc">${body}</p>
      <div class="btnrow"><button class="btn" id="svGood">Tiếp tục</button></div>`, () => {
      $('#svGood').onclick = () => { closeModal(true); SV.paused = false; };
    }, true);
  }
  const stars = SV.picks[id] || SV.pas[id], ser = svSkillSeries(id);
  const elemDesc = ['Kim · chí mạng +10%', 'Mộc · độc cộng dồn/giây', 'Thủy · làm chậm 30% (5★ đóng băng)', 'Hỏa · nổ lan diện rộng', 'Thổ · đẩy lùi + choáng'][ser];
  const body = SV.picks[id] ? `${fmt(svInfo(id).tot)} sát thương/đòn${isTrap(id) ? ' · cạm bẫy' : svInfo(id).targets > 1 ? ' · nhiều mục tiêu' : ''}${svInfo(id).melee ? ' · cận chiến' : ''}${svInfo(id).around ? ' · quanh người' : ''} · <b style="color:${SERIES_COL[ser]}">${elemDesc}</b>`
    : `Nội công · ${pasKind(id)[2]} (mỗi sao cộng thêm).`;
  const n = id === 'mag' ? 'Hấp Tinh' : SK[id].n;
  modal(`<h3>${esc(n)} <small>${'★'.repeat(stars)}</small></h3><p class="desc">${body}</p>
    <div class="btnrow"><button class="btn" id="svGood">Tiếp tục</button></div>`, () => {
    $('#svGood').onclick = () => { closeModal(true); SV.paused = false; };
  }, true);
}

/* ---------- bat dau / ket thuc ---------- */
function svStart() {
  if (!S.fac || SV.on) return;
  if (R.town) backFromTown();
  if (R.tower) towerExit(false);
  R.dirty = true; recalc();
  const main = R.P.main.id || svActives().sort((a, b) => SK[b].req - SK[a].req)[0];
  const L0 = Math.max(1, S.lvl);
  Object.assign(SV, { on: true, t: 0, kills: 0, lvl: 1, xp: 0, need: svNeed(1), en: [], gems: [], shots: [], traps: [], chests: [], chestTimer: 0, bombs: 0, ultCd: 0, ultCdMax: 60, hpCd: 0, flash: 0, shake: 0, rerolls: 0, picks: { [main]: 1 }, pas: {}, up: { wrist: 0, boot: 0, pouch: 0, mag: 0, mirror: 0, med: 0 }, mag: 0,
    cds: { [main]: 0.5 }, cdMax: {}, dmg: {}, info: {}, paused: false, choosing: false, over: false, boss: 0, bossKills: 0, spawnAcc: 0,
    L0, zone: svZone(), gold: 0, grid: new Map(), hurtT: 0 });
  SV.maxhp = SV.maxhp0 = R.P.life; SV.hp = SV.maxhp;
  SV.ref = Math.max(1, svInfo(main).tot);
  SV.keep = { x: H.x, y: H.y };
  obsLoad(SV.zone.id); if (OBS.g) [H.x, H.y] = inWorld(WORLD.w / 2, WORLD.h / 2); else { H.x = 0; H.y = 0; } R.enemies = []; R.corpses = []; R.ground = R.ground || []; R.fx = []; R.txt = []; INPUT.target = null;
  R.bgImg = SV.zone.bg ? img(SV.zone.bg) : R.bgImg; playMusic(SV.zone.id); preloadZoneSounds(SV.zone);
  document.body.classList.add('sv'); resizeArena(); closeModal(true);
  $('#svHud').classList.remove('hidden'); $('#svBar').classList.remove('hidden'); svBarUpdate();
  R.banner = { t: 2.5, text: 'Luyện Công', sub: `${SV.zone.n} · sống sót 10 phút` };
  log(`Vào <b>Luyện Công</b> tại ${esc(SV.zone.n)}.`);
}
function svExit() {
  SV.on = false; SV.en = []; SV.gems = []; SV.shots = []; SV.traps = []; SV.chests = []; R.fx = [];
  document.body.classList.remove('sv'); $('#svHud').classList.add('hidden'); $('#svBar').classList.add('hidden');
  { const z = zoneOf(Math.min(S.stage, STAGES)); obsLoad(z.id); }
  [H.x, H.y] = inWorld(SV.keep ? SV.keep.x : WORLD.w / 2, SV.keep ? SV.keep.y : WORLD.h / 2);
  resizeArena(); snapCamera(); R.enemies = []; R.spawnT = 0.5; S.wave = 1; R.zoneShown = null; R.dirty = true;
  refresh(); save();
}
function svRewards(win) {
  const idleK = Math.max(0.05, S.kps || 0.1) * SV.t;
  const k = clamp(SV.kills * 0.3, idleK * SV_REWARD_MIN, idleK * SV_REWARD_MAX) * (win ? SV_WIN_BONUS : 1);
  const L = SV.L0, gold = Math.round(moneyDrop({ L, cls: 'normal' }) * k) + SV.gold, lv0 = S.lvl;
  S.gold += gold; gainXp(expFor(L) * k);
  const items = [];
  for (let i = 0; i < SV.bossKills; i++) items.push(...rollDrops({ L, cls: 'boss' }));
  for (let i = 0; i < Math.floor(SV.kills / 150); i++) items.push(...rollDrops({ L, cls: 'elite', bonusDrop: 2 }));
  let got = 0; for (const it of items) if (addItem(it, true)) got++;   // addItem tu cong vang khi khong nhan mon
  if (typeof RW === 'function') { RW().stat.kills += SV.kills; questTick('kills', SV.kills); achCheck(); }
  return { gold, xp: Math.round(expFor(L) * k), lv0, lv1: S.lvl, items: got, k: Math.round(k), idleK: Math.round(idleK) };
}
function svEnd(win) {
  if (SV.over) return; SV.over = true; INPUT.active = false;
  const r = svRewards(win), m = Math.floor(SV.t / 60), s = Math.floor(SV.t % 60);
  modal(`<h3>${win ? 'Luyện Công hoàn tất!' : 'Trọng thương'}</h3>
    <p class="desc">${esc(SV.zone.n)} · ${m}:${String(s).padStart(2, '0')} · hạ ${SV.kills} quái · ${SV.bossKills} trùm · cấp tu luyện ${SV.lvl}</p>
    <div class="card stats"><span>Ngân lượng</span><span>+${fmt(r.gold)}</span><span>Kinh nghiệm</span><span>+${fmt(r.xp)}</span>
    <span>Cấp nhân vật</span><span>${r.lv0} → ${r.lv1}</span><span>Vật phẩm</span><span>${r.items}</span></div>
    <p class="desc small">Thưởng quy đổi = ${r.k} quái treo máy (treo máy cùng thời gian ≈ ${r.idleK}; tối đa ×${SV_REWARD_MAX}${win ? `, thắng ×${SV_WIN_BONUS}` : ''}).</p>
    ${svStatsHTML()}
    <div class="btnrow"><button class="btn" id="svOk">Về giang hồ</button></div>`, () => { $('#svOk').onclick = () => { closeModal(true); svExit(); }; }, true);
}

/* ---------- quai ---------- */
/* Do kho theo chinh nhan vat (moi phai / moi cap nhu nhau): mau quai = don danh goc (1 sao) x (0.6 + phut x 0.4),
   sat thuong cham = sinh luc toi da x (2% + 0.4% / phut); tinh anh x4 mau x2 sat thuong, trum x30 mau x4 sat thuong */
const SV_HP = { normal: 1, elite: 4, boss: 30 }, SV_DMG = { normal: 1, elite: 2, boss: 4 };
/* diem trong the gioi hop le (co vat can: o di duoc gan nhat; the gioi cu vo han: giu nguyen) */
const svFree = (x, y) => OBS.g ? inWorld(x, y) : [x, y];
function svSpawn(cls) {
  const z = SV.zone, L = SV.L0 + Math.floor(SV.t / 60), a = rnd(0, Math.PI * 2);
  const rr = Math.hypot(AR.w, AR.h) / 2 + 40 + rnd(0, 80);
  const tid = cls === 'boss' ? z.boss : pick(z.m), m = MON[tid];
  const e = { tid, n: m.n, L, cls, x: svFree(H.x + Math.cos(a) * rr, H.y + Math.sin(a) * rr)[0], y: svFree(H.x + Math.cos(a) * rr, H.y + Math.sin(a) * rr)[1], r: CLS[cls].r * 0.8,
    hp: SV.ref * (0.6 + SV.t / 150) * SV_HP[cls], dmg: SV.maxhp0 * (0.02 + SV.t / 15000) * SV_DMG[cls], spd: cls === 'boss' ? 42 : cls === 'elite' ? 55 : 60 + rnd(0, 20),
    hitCd: 0, act: 'run', actT: rnd(0, 1), dir: 0, series: wpick([0, 1, 2, 3, 4], i => z.sw[i] + 1), hitT: 0 };
  e.max = e.hp; SV.en.push(e);
  if (cls === 'boss') { R.banner = { t: 2.2, text: `${m.n} xuất hiện!`, sub: 'Trùm Luyện Công' }; log(`Trùm <b class="boss">${esc(m.n)}</b> xuất hiện trong Luyện Công`); }
  return e;
}
function svGrid() {
  const g = SV.grid; g.clear();
  for (const e of SV.en) { const k = Math.floor(e.x / SV_CELL) + ',' + Math.floor(e.y / SV_CELL); let a = g.get(k); if (!a) g.set(k, a = []); a.push(e); }
}
function svNear(x, y, r, fn) { // duyet quai trong ban kinh r (luoi o vuong)
  const c0 = Math.floor((x - r) / SV_CELL), c1 = Math.floor((x + r) / SV_CELL), r0 = Math.floor((y - r) / SV_CELL), r1 = Math.floor((y + r) / SV_CELL);
  for (let i = c0; i <= c1; i++) for (let j = r0; j <= r1; j++) { const a = SV.grid.get(i + ',' + j); if (!a) continue;
    for (const e of a) if (e.hp > 0 && (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.r) ** 2) if (fn(e) === false) return; }
}
function svNearest(r) { let b = null, bd = r * r; for (const e of SV.en) { if (e.hp <= 0) continue; const d = (e.x - H.x) ** 2 + (e.y - H.y) ** 2; if (d < bd) { bd = d; b = e; } } return b; }
function svMoveEnemies(dt) {
  const def = Math.min(0.8, 0.08 * svBonus('def') + 0.06 * ((SV.up && SV.up.mirror) || 0));
  for (const e of SV.en) {
    if (e.hp <= 0) continue;
    if (e.dmgAccT > 0) {
      e.dmgAccT -= dt;
      if (e.dmgAccT <= 0) {
        if (!giamHieuUng() && R.txt.length < 45 && (e.cls !== 'normal' || Math.random() < 0.35)) {
          addText(e.x, e.y - 30, fmt(e.dmgAcc), '#ffe9a0', e.cls === 'boss' ? 14 : 10);
        }
        e.dmgAcc = 0;
      }
    }
    if (e.poisonT > 0) {                                              // doc giam mau theo thoi gian (Moc)
      e.poisonT -= dt;
      const pdmg = (e.poison || 0) * dt;
      e.hp -= pdmg;
      if (e.poisonId) SV.dmg[e.poisonId] = (SV.dmg[e.poisonId] || 0) + Math.min(e.hp, pdmg);
      if (Math.random() < 0.05 && R.txt.length < 40) addText(e.x, e.y - 25, fmt(pdmg * 6), '#6fd46a', 9);
      if (e.hp <= 0) continue;
    }
    if (e.frozen > 0) { e.frozen -= dt; continue; }                   // dong bang khong the di chuyen (Thuy 5 sao)
    if (e.stun > 0) { e.stun -= dt; continue; }                       // choang khong the di chuyen (Tho)
    let spdMul = 1;
    if (e.slow > 0) { e.slow -= dt; spdMul = 0.7; }                   // lam cham 30% (Thuy)
    const dx = H.x - e.x, dy = H.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > 1500) { const a = rnd(0, Math.PI * 2), rr = Math.hypot(AR.w, AR.h) / 2 + 60; [e.x, e.y] = svFree(H.x + Math.cos(a) * rr, H.y + Math.sin(a) * rr); continue; }
    if (OBS.g) obsChase(e, H.x, H.y, e.spd * spdMul * dt); else { e.x += dx / d * e.spd * spdMul * dt; e.y += dy / d * e.spd * spdMul * dt; }
    e.dir = dirOf(dx, dy); e.moving = d > e.r + 12;
    const a = SV.grid.get(Math.floor(e.x / SV_CELL) + ',' + Math.floor(e.y / SV_CELL));
    if (a) for (let i = 0, n = 0; i < a.length && n < 6; i++) { const o = a[i]; if (o === e) continue; n++;   // tach nhau, khong chong len
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = (e.r + o.r) * 0.8;
      if (od > 0.01 && od < min) { const p = (min - od) / od * 0.5; obsMove(e, e.x + ox * p, e.y + oy * p); } }
    e.hitCd -= dt; if (e.hitT > 0) e.hitT -= dt;
    if (d < e.r + 16 && e.hitCd <= 0) { e.hitCd = 0.8; if (!(R.P.block && Math.random() * 100 < R.P.block)) SV.hp -= e.dmg * (1 - def) * (1 - (R.P.absorb || 0)); SV.hurtT = 0.2; e.act = 'at'; e.actT = 0; }
  }
}

/* ---------- chieu ---------- */
const SK_FAC = {};
for (const f of J.factions) for (const id of f.skills) SK_FAC[id] = f.series;
const svStar = id => SV.picks[id] || 0;
const isTrap = id => { const s = id && SK[id]; return !!(s && /bẫy|cạm bẫy/i.test(s.d || '')); };
function svSkillSeries(id) {
  const s = id && SK[id];
  if (s && s.series >= 0) return s.series;
  if (id && SK_FAC[id] !== undefined) return SK_FAC[id];
  return FAC[S.fac] ? FAC[S.fac].series : 0;
}
function svDamage(e, dmg, id, noElem) {
  const d = Math.min(e.hp, dmg); e.hp -= dmg; e.hitT = 0.1; SV.dmg[id] = (SV.dmg[id] || 0) + d;
  e.dmgAcc = (e.dmgAcc || 0) + dmg;
  if (!e.dmgAccT) e.dmgAccT = 0.3;
  if (e.hp <= 0 && e.dmgAcc > 0) {
    if (!giamHieuUng() && R.txt.length < 45 && e.cls !== 'normal') addText(e.x, e.y - 30, fmt(e.dmgAcc), '#ffe9a0', 14);
    e.dmgAcc = 0; e.dmgAccT = 0;
  }
  if (noElem || e.hp <= 0) return;
  const ser = svSkillSeries(id), st = svStar(id);
  if (ser === 2) {                                                    // Thuy: lam cham 30%, sao 5 dong bang 0.5s
    e.slow = Math.max(e.slow || 0, 2.0);
    if (st >= 5) e.frozen = Math.max(e.frozen || 0, 0.5);
  } else if (ser === 1) {                                             // Moc: doc cong don theo giay
    e.poison = (e.poison || 0) + dmg * 0.15;
    e.poisonT = Math.max(e.poisonT || 0, 2.5);
    e.poisonId = id;
  } else if (ser === 3) {                                             // Hoa: no lan nho quanh muc tieu
    svNear(e.x, e.y, 52, o => { if (o !== e) svDamage(o, dmg * 0.35, id, true); });
    if (R.fx.length < FX_MAX) R.fx.push({ k: 'boom', s: 'boom', x: e.x, y: e.y - 10, t: 0, life: 0.25, dir: 0 });
  } else if (ser === 4) {                                             // Tho: day lui + choang ngan
    e.stun = Math.max(e.stun || 0, 0.45);
    const kx = e.x - H.x, ky = e.y - H.y, kl = Math.hypot(kx, ky) || 1;
    obsMove(e, e.x + (kx / kl) * 26, e.y + (ky / kl) * 26);
  }
}
function svHit(a, id) {
  const st = svStar(id), ser = svSkillSeries(id);
  const critRate = (a.crit || 0) + (ser === 0 ? 10 : 0);              // Kim: chi mang +10%
  const crit = Math.random() * 100 < critRate ? CRIT_MULT : 1;
  return a.tot * (1 + 0.3 * (st - 1)) * (1 + 0.12 * svBonus('dmg')) * rnd(0.9, 1.1) * crit;
}
function svCast(id) {
  const a = svInfo(id), st = Math.max(1, svStar(id)), m = JFX.m[JFX.s[id]];
  castFx({ id });                                                    // hieu ung tai cho ra chieu (PreCastSpr)
  const pouch = (SV.up && SV.up.pouch) || 0, wrist = (SV.up && SV.up.wrist) || 0;
  if (isTrap(id)) {                                                   // cam bay quanh muc tieu hoac duoi chan
    const t = svNearest(380);
    const count = 1 + Math.floor((st - 1) / 2);
    const baseRad = (40 + 12 * st) * (1 + 0.15 * wrist);
    for (let i = 0; i < count; i++) {
      if (SV.traps.length >= SV_MAX_TRAPS) break;
      const ang = Math.random() * Math.PI * 2, dist = Math.random() * (t ? 45 : 30);
      const tx = (t ? t.x : H.x) + Math.cos(ang) * dist;
      const ty = (t ? t.y : H.y) + Math.sin(ang) * dist;
      SV.traps.push({ x: tx, y: ty, r: baseRad, life: 4.0 * (1 + 0.15 * wrist), id, a, st });
    }
    return true;
  }
  if (a.around) {                                                     // quanh nguoi: vong sat thuong
    const r = clamp(a.rad, 90, 200) * (1 + 0.15 * (st - 1)) * (1 + 0.15 * wrist);
    svNear(H.x, H.y, r, e => svDamage(e, svHit(a, id), id));
    if (m && (m.hit || m.fly)) R.fx.push({ k: 'boom', s: m.hit || m.fly, x: H.x, y: H.y - 10, t: 0, life: animDur(m.hit || m.fly) * (1 + 0.15 * wrist), dir: 0 });
    else R.fx.push({ k: 'ring', x: H.x, y: H.y, color: ELEM_COL.phys, life: 0.4 * (1 + 0.15 * wrist), max: 0.4 * (1 + 0.15 * wrist) });
    return true;
  }
  const t = svNearest(a.melee ? 160 : 560 * (1 + 0.10 * pouch)); if (!t) return false;
  if (a.melee) {                                                      // can chien: chem quanh muc tieu
    let n = 1 + st; svNear(t.x, t.y, (70 + 10 * st) * (1 + 0.15 * wrist), e => { svDamage(e, svHit(a, id), id); return --n > 0; });
    skillFx(H, t, a); return true;
  }
  const shots = 1 + Math.floor((st - 1) / 2), pierce = (a.targets > 1 ? 1 : 0) + Math.floor(st / 3);
  const base = Math.atan2(t.y - H.y, t.x - H.x), v = 520 * (1 + 0.15 * pouch), life = 1.1 * (1 + 0.10 * pouch);
  for (let i = 0; i < shots; i++) {
    const ang = base + (i - (shots - 1) / 2) * 0.22;
    SV.shots.push({ x: H.x, y: H.y - 20, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life, id, a, pierce, hit: new Set(), m, t: 0, dir: dir16(Math.cos(ang), Math.sin(ang)) });
  }
  return true;
}
function svShots(dt) {
  SV.shots = SV.shots.filter(s => {
    s.t += dt; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    let alive = s.life > 0;
    svNear(s.x, s.y + 20, 18, e => {
      if (s.hit.has(e)) return true; s.hit.add(e); svDamage(e, svHit(s.a, s.id), s.id);
      if (s.m && s.m.hit && R.fx.length < FX_MAX) {
        R.fx.push({ k: 'boom', s: s.m.hit, x: e.x, y: e.y - 14, t: 0, life: animDur(s.m.hit), dir: 0 });
        if (!giamHieuUng() && R.fx.length < FX_MAX - 1 && Math.random() < 0.35) {
          R.fx.push({ k: 'boom', s: s.m.hit, x: e.x + rnd(-8, 8), y: e.y - 14 + rnd(-8, 8), t: 0, life: animDur(s.m.hit) * 0.85, dir: 0 });
        }
      }
      if (s.pierce-- <= 0) { alive = false; return false; } return true;
    });
    return alive;
  });
}
function svTraps(dt) {
  SV.traps = SV.traps.filter(tr => {
    tr.life -= dt;
    if (tr.life <= 0) return false;
    let triggered = false;
    svNear(tr.x, tr.y, 24, () => { triggered = true; return false; });
    if (triggered) {
      svNear(tr.x, tr.y, tr.r, e => svDamage(e, svHit(tr.a, tr.id), tr.id));
      const ser = svSkillSeries(tr.id);
      if (R.fx.length < FX_MAX) {
        R.fx.push({ k: 'boom', s: 'boom', x: tr.x, y: tr.y, t: 0, life: 0.35, dir: 0 });
        R.fx.push({ k: 'ring', x: tr.x, y: tr.y, color: SERIES_COL[ser], life: 0.3, max: 0.3 });
      }
      return false;
    }
    return true;
  });
}
function svSkills(dt) {
  const cdMul = Math.max(0.4, 1 - 0.07 * svBonus('cd'));
  for (const id in SV.picks) {
    SV.cds[id] = (SV.cds[id] || 0) - dt; if (SV.cds[id] > 0) continue;
    const a = svInfo(id), st = svStar(id);
    const cast = svCast(+id);
    SV.cdMax[id] = cast ? Math.max(0.3, 1.1 / Math.max(0.3, a.rate)) * (1 - 0.06 * (st - 1)) * cdMul : 0;
    SV.cds[id] = cast ? SV.cdMax[id] : 0.2;
    if (cast && H.act !== 'at') { H.act = 'at'; H.actT = 0; }
  }
}

/* ---------- ngoc kinh nghiem, len cap ---------- */
function svUltSkill() {
  const f = FAC[S.fac]; if (!f) return null;
  const attacks = f.skills.map(id => SK[id]).filter(s => s && isAttack(s));
  attacks.sort((a, b) => (b.req || 0) - (a.req || 0));
  return attacks[0] || null;
}
function svCastUlt() {
  if (!SV.on || SV.paused || SV.over) return;
  const u = svUltSkill();
  if (!u || S.lvl < (u.req || 0) || (SV.ultCd && SV.ultCd > 0)) return;
  SV.ultCd = 60; SV.ultCdMax = 60;
  SV.flash = 0.5; SV.shake = 0.6;
  uiSfx('levelup');
  const baseDmg = SV.ref * 8;
  for (const e of SV.en) {
    if (e.hp <= 0) continue;
    const dmg = e.cls === 'boss' ? Math.min(baseDmg, e.max * 0.20) : baseDmg;
    svDamage(e, dmg, u.id);
  }
}
function svUseBomb() {
  if (!SV.on || SV.paused || SV.over || (SV.bombs || 0) <= 0) return;
  SV.bombs--;
  SV.flash = 0.3; SV.shake = 0.4;
  uiSfx('hit');
  const baseDmg = SV.ref * 5;
  for (const e of SV.en) {
    if (e.hp <= 0) continue;
    const dmg = e.cls === 'boss' ? Math.min(baseDmg, e.max * 0.15) : baseDmg;
    svDamage(e, dmg, 'bomb');
  }
  svUpdateHud();
}
function svUseHp() {
  if (!SV.on || SV.paused || SV.over || SV.hp >= SV.maxhp || (SV.hpCd && SV.hpCd > 0)) return;
  SV.hpCd = 10;
  SV.hp = Math.min(SV.maxhp, SV.hp + SV.maxhp * 0.35);
  addText(H.x, H.y - 20, '+35% HP', '#4cd964', 12);
  uiSfx('heal');
}
function svSpawnChest(x, y) {
  if (SV.chests.length >= 8) return;
  const [cx, cy] = svFree(x !== undefined ? x : H.x + rnd(-250, 250), y !== undefined ? y : H.y + rnd(-200, 200));
  SV.chests.push({ x: cx, y: cy, life: 90 });
}
function svChests(dt) {
  SV.chestTimer = (SV.chestTimer || 0) + dt;
  if (SV.chestTimer >= 60) { SV.chestTimer = 0; svSpawnChest(); }
  SV.chests = SV.chests.filter(ch => {
    ch.life -= dt;
    if (ch.life <= 0) return false;
    if (Math.hypot(H.x - ch.x, H.y - ch.y) <= 32) {
      svOpenChest(ch);
      return false;
    }
    return true;
  });
}
function svOpenChest(ch) {
  uiSfx('equip');
  const roll = Math.random();
  if (roll < 0.25) {
    SV.hp = Math.min(SV.maxhp, SV.hp + SV.maxhp * 0.30);
    addText(ch.x, ch.y - 20, '+30% HP', '#4cd964', 13);
  } else if (roll < 0.50) {
    for (const g of SV.gems) g.pull = true;
    addText(ch.x, ch.y - 20, 'Nam Châm!', '#5fb8ff', 13);
  } else if (roll < 0.75) {
    SV.bombs = (SV.bombs || 0) + 1;
    addText(ch.x, ch.y - 20, '+1 Bom!', '#ff7a45', 13);
  } else {
    const g = irnd(30, 80);
    SV.gold = (SV.gold || 0) + g;
    addText(ch.x, ch.y - 20, `+${g} Vàng`, '#ffd24a', 13);
  }
}
function svKill(e) {
  SV.kills++;
  const v = (e.cls === 'boss' ? 60 : e.cls === 'elite' ? 6 : 1) * (1 + Math.floor(SV.t / 120)); // ngoc to dan theo thoi gian
  if (SV.gems.length >= SV_GEM_MAX) { const g = SV.gems[irnd(0, SV.gems.length - 1)]; g.v += v; } // qua nhieu: gop ngoc
  else SV.gems.push({ x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 6), v });
  if (e.cls === 'boss') { SV.bossKills++; SV.gold += moneyDrop({ L: e.L, cls: 'boss' }) * 3; burst(e.x, e.y, '#ffd24a'); svSpawnChest(e.x, e.y); }
  else if (e.cls === 'elite' && Math.random() < 0.4) svSpawnChest(e.x, e.y);
}
function svGems(dt) {
  const mag = 130 * (1 + 0.3 * ((SV.up && SV.up.mag) || SV.mag || 0));              // tam hut ngoc (chay tron van nhat duoc)
  SV.gems = SV.gems.filter(g => {
    const dx = H.x - g.x, dy = H.y - g.y, d = Math.hypot(dx, dy);
    if (d < 18) { SV.xp += g.v; return false; }
    if (d < mag || g.pull) { g.pull = true; const k = Math.min(1, 420 * dt / d); g.x += dx * k; g.y += dy * k; }
    return true;
  });
  if (SV.xp >= SV.need && !SV.choosing) { SV.xp -= SV.need; SV.lvl++; SV.need = svNeed(SV.lvl); svChoose(); }
}
function svStarInfo(id, n) { // mo ta sao ke tiep, suy ra tu chinh cong thuc sat thuong/so dan trong svHit + svCast
  const a = svInfo(id), dmg = st => a.tot * (1 + 0.3 * (st - 1)) * (1 + 0.12 * svBonus('dmg'));
  const out = [`Sát thương ${fmt(dmg(n - 1))} → ${fmt(dmg(n))}`];
  if (isTrap(id)) {
    out.push(`vùng nổ +${12 * n}px`);
    if (Math.floor((n - 1) / 2) > Math.floor((n - 2) / 2)) out.push(`${1 + Math.floor((n - 1) / 2)} bẫy`);
  } else if (a.around) out.push('bán kính +15%');
  else if (a.melee) out.push(`${n} mục tiêu chém`);
  else {
    if (Math.floor((n - 1) / 2) > Math.floor((n - 2) / 2)) out.push(`${1 + Math.floor((n - 1) / 2)} đạn`);
    if (Math.floor(n / 3) > Math.floor((n - 1) / 3)) out.push('+1 xuyên');
  }
  return out.join(' · ');
}
function svCard(o, i) {
  const stars = n => '★'.repeat(n) + '☆'.repeat(SV_STAR_MAX - n);
  if (o.t === 'all') return `<button class="svopt" data-i="${i}"><b>Nhận hết</b><small>Hồi 30% sinh lực + ngân lượng</small></button>`;
  if (o.t === 'up' || o.t === 'mag') {
    const id = o.t === 'mag' ? 'mag' : o.id, u = SV_UPS[id] || SV_UPS.mag, n = ((SV.up && SV.up[id]) || 0) + 1;
    return `<button class="svopt" data-i="${i}">${u.ic ? `<img src="${esc(u.ic)}" alt="">` : ''}<b>${esc(u.n)}${n === 1 ? ' <i class="new">MỚI</i>' : ''}</b><em>${stars(n)}</em><small>${u.desc} (${u.stat(n)})</small></button>`;
  }
  const s = SK[o.id];
  if (o.t === 'pas') return `<button class="svopt" data-i="${i}">${s.ic ? `<img src="${esc(s.ic)}" alt="">` : ''}<b>${esc(s.n)}</b><em>${stars((SV.pas[o.id] || 0) + 1)}</em><small>Nội công · ${pasKind(o.id)[2]}</small></button>`;
  const n = (SV.picks[o.id] || 0) + 1, tot = fmt(svInfo(o.id).tot), ser = svSkillSeries(o.id);
  const elemTag = ` · <span style="color:${SERIES_COL[ser]}">${SERIES[ser]}</span>`;
  return `<button class="svopt" data-i="${i}">${s.ic ? `<img src="${esc(s.ic)}" alt="">` : ''}<b>${esc(s.n)}${n === 1 ? ' <i class="new">MỚI</i>' : ''}</b><em>${stars(n)}</em><small>${n === 1 ? `Chiêu mới · ${tot}/đòn${elemTag}` : `${svStarInfo(o.id, n)} · ${tot}/đòn${elemTag}`}</small></button>`;
}
function svChoose() {
  SV.choosing = true; INPUT.active = false; uiSfx('levelup');
  const render = () => {
    const opts = svOptions();
    const free = (SV.rerolls || 0) === 0;
    const cost = free ? 0 : 50 * SV.rerolls;
    const canReroll = free || (SV.gold >= cost);
    modal(`<h3>Lên cấp tu luyện ${SV.lvl}</h3><p class="desc">Chọn một:</p>
      <div class="svopts">${opts.map(svCard).join('')}</div>
      <div class="btnrow"><button class="btn" id="svReroll"${canReroll ? '' : ' disabled'}>Đổi lựa chọn (${free ? 'miễn phí' : `${cost} vàng`})</button></div>`, () => {
      document.querySelectorAll('.svopt').forEach(b => b.onclick = () => { svApply(opts[+b.dataset.i]); SV.choosing = false; closeModal(true); });
      const rb = $('#svReroll');
      if (rb) rb.onclick = () => {
        if (!canReroll) return;
        if (cost > 0) SV.gold -= cost;
        SV.rerolls = (SV.rerolls || 0) + 1;
        render();
      };
    }, true);
  };
  render();
}

/* ---------- vong lap ---------- */
function svTick(dt) {
  if (!SV.on || SV.paused || SV.choosing || SV.over) return;
  SV.t += dt;
  if (SV.t >= SV_DUR) { svEnd(true); return; }
  const [vx, vy] = inputVec(), sp = 150 * (R.P.speed || 1) * (1 + 0.08 * svBonus('spd')) * (1 + 0.08 * ((SV.up && SV.up.boot) || 0));
  obsFrame();
  if (vx || vy) { const [nx, ny] = OBS.g ? clampWorld(H.x + vx * sp * dt, H.y + vy * sp * dt) : [H.x + vx * sp * dt, H.y + vy * sp * dt]; obsMove(H, nx, ny); H.dir = dirOf(vx, vy); }
  const target = Math.min(SV_MAX_EN, 10 + SV.t * 0.35 + Math.max(0, SV.t - 300) * 0.4);
  SV.spawnAcc += dt * (3 + SV.t / 40);
  while (SV.spawnAcc >= 1) { SV.spawnAcc--; if (SV.en.length < target) svSpawn(Math.random() < 0.04 + SV.t / 6000 ? 'elite' : 'normal'); }
  if (SV.boss < SV_BOSS_T.length && SV.t >= SV_BOSS_T[SV.boss]) { SV.boss++; svSpawn('boss'); SV.shake = 0.5; }
  if (SV.ultCd > 0) SV.ultCd -= dt;
  if (SV.hpCd > 0) SV.hpCd -= dt;
  svGrid(); svMoveEnemies(dt); svSkills(dt); svShots(dt); svTraps(dt); svChests(dt);
  for (const e of SV.en) if (e.hp <= 0 && !e.dead) { e.dead = true; svKill(e); if (R.corpses.length < (giamHieuUng() ? 10 : 30)) { e.act = 'die'; e.actT = 0; e.animKey = MON[e.tid].anim; R.corpses.push(e); } }
  SV.en = SV.en.filter(e => !e.dead);
  svGems(dt);
  const medRegen = (SV.up && SV.up.med) ? SV.maxhp * 0.003 * SV.up.med : 0;
  SV.hp = Math.min(SV.maxhp, SV.hp + ((R.P.regen || 0) + SV.maxhp * SV_REGEN + medRegen) * dt); if (SV.hurtT > 0) SV.hurtT -= dt;
  if (SV.hp <= 0) { SV.hp = 0; svEnd(false); }
}
function svPause() {
  if (!SV.on || SV.over || SV.choosing) return;
  SV.paused = true; INPUT.active = false;
  modal(`<h3>Tạm dừng</h3><p class="desc">${Math.floor(SV.t / 60)}:${String(Math.floor(SV.t % 60)).padStart(2, '0')} · hạ ${SV.kills} quái · cấp tu luyện ${SV.lvl}</p>${svStatsHTML()}
    <div class="btnrow"><button class="btn" id="svGo">Tiếp tục</button><button class="btn red" id="svQuit">Rút lui (nhận thưởng)</button></div>`, () => {
    $('#svGo').onclick = () => { SV.paused = false; closeModal(true); };
    $('#svQuit').onclick = () => { SV.paused = false; closeModal(true); svEnd(false); };
  }, true);
}
function svStatsHTML() {
  const rows = Object.keys(SV.picks).map(id => [id, SV.dmg[id] || 0]).sort((a, b) => b[1] - a[1]), tot = rows.reduce((t, r) => t + r[1], 0) || 1;
  const pas = Object.keys(SV.pas).map(id => `${esc(SK[id].n)} ${'★'.repeat(SV.pas[id])}`)
    .concat(Object.keys(SV_UPS).filter(id => (SV.up && SV.up[id]) || (id === 'mag' && SV.mag)).map(id => `${esc(SV_UPS[id].n)} ${'★'.repeat((SV.up && SV.up[id]) || SV.mag)}`));
  return `<table class="svtab"><tr><th>Chiêu</th><th>Sát thương</th><th>DPS</th><th>%</th></tr>${rows.map(([id, d]) =>
    `<tr><td>${esc(SK[id].n)} <small>${'★'.repeat(SV.picks[id])}</small></td><td>${fmt(d)}</td><td>${fmt(d / Math.max(1, SV.t))}</td><td>${Math.round(d / tot * 100)}</td></tr>`).join('')}</table>
    ${pas.length ? `<p class="desc small">Nội công: ${pas.join(' · ')}</p>` : ''}`;
}

/* ban do Luyen Cong: vung co khoang cap chua cap nhan vat (da mo), khong thi vung dang danh */
function svZone() {
  const open = ZONES.filter((z, i) => S.maxStage >= i * ZONE_STAGES + 1);
  return open.find(z => S.lvl >= z.lo && S.lvl <= z.hi) || open[open.length - 1] || zoneOf(Math.min(S.stage, STAGES));
}
function svIntro() {
  if (!S.fac) return;
  const z = svZone();
  modal(`<h3>Luyện Công</h3><p class="desc">Sống sót 10 phút tại <b>${esc(z.n)}</b> (quái mạnh dần mỗi phút theo chính sức mạnh nhân vật; trùm ở phút 2 / 4 / 6 / 8).
    Tự đánh bằng võ công của phái; kéo trên sân hoặc WASD để di chuyển, nhặt ngọc để lên cấp tu luyện và chọn chiêu / nội công (1–5 sao).
    Kết thúc (thắng, gục hoặc rút lui) nhận ngân lượng, kinh nghiệm và vật phẩm cho nhân vật. Phím P / Esc: tạm dừng.</p>
    <div class="btnrow"><button class="btn" id="svGoIn">Vào Luyện Công</button></div>`, () => { $('#svGoIn').onclick = svStart; });
}

/* ---------- ve ---------- */
function svUpdateHud() {
  const g = $('#svGold'), b = $('#svBombCnt'), u = $('#svUlt'), h = $('#svHpBtn');
  if (g) g.innerText = fmt(SV.gold || 0);
  if (b) b.innerText = SV.bombs || 0;
  if (u) {
    const ult = svUltSkill();
    const locked = !ult || S.lvl < (ult.req || 0);
    const lockEl = u.querySelector('.lock');
    if (lockEl) lockEl.innerText = locked ? `${ult ? ult.req : 80} mở` : (ult ? ult.n : '');
    u.disabled = locked || (SV.ultCd > 0);
    const p = SV.ultCd > 0 ? ((SV.ultCd / (SV.ultCdMax || 60)) * 100).toFixed(1) + '%' : '0%';
    const cd = u.querySelector('.cd'); if (cd) cd.style.setProperty('--p', p);
  }
  if (h) {
    h.disabled = SV.hpCd > 0 || SV.hp >= SV.maxhp;
    const p = SV.hpCd > 0 ? ((SV.hpCd / 10) * 100).toFixed(1) + '%' : '0%';
    const cd = h.querySelector('.cd'); if (cd) cd.style.setProperty('--p', p);
  }
}
function svDraw(dt) {
  const c = CX; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, AR.w, AR.h);
  let shX = 0, shY = 0;
  if (SV.shake > 0) { SV.shake -= dt; if (!giamHieuUng()) { shX = (Math.random() - 0.5) * 8; shY = (Math.random() - 0.5) * 8; } }   // QA-040: tat rung man hinh khi nguoi dung yeu cau giam chuyen dong
  const k = Math.min(1, dt * 8); CAM.x += (H.x - AR.w / 2 - CAM.x) * k; CAM.y += (H.y - AR.h * 0.5 - CAM.y) * k;
  if (OBS.g) { CAM.x = clamp(CAM.x, 0, Math.max(0, WORLD.w - AR.w)); CAM.y = clamp(CAM.y, 0, Math.max(0, WORLD.h - AR.h)); }
  c.setTransform(DPR, 0, 0, DPR, (-Math.round(CAM.x) + shX) * DPR, (-Math.round(CAM.y) + shY) * DPR);
  drawTiledBg(c, R.bgImg);                                  // lat guong xen ke: di mai khong het ban do
  for (const ch of SV.chests) {
    if (!onScreen(ch.x, ch.y, 30)) continue;
    c.fillStyle = '#b8860b'; c.fillRect(ch.x - 10, ch.y - 8, 20, 16);
    c.strokeStyle = '#ffd700'; c.lineWidth = 1.5; c.strokeRect(ch.x - 10, ch.y - 8, 20, 16);
    c.fillStyle = '#ffd700'; c.fillRect(ch.x - 2, ch.y - 2, 4, 4);
  }
  for (const tr of SV.traps) {
    if (!onScreen(tr.x, tr.y, 40)) continue;
    const ser = svSkillSeries(tr.id);
    c.fillStyle = SERIES_COL[ser] + '33'; c.beginPath(); c.arc(tr.x, tr.y, 14, 0, 7); c.fill();
    c.strokeStyle = SERIES_COL[ser]; c.lineWidth = 1.5; c.beginPath(); c.arc(tr.x, tr.y, 14, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(tr.x - 5, tr.y - 5); c.lineTo(tr.x + 5, tr.y + 5); c.moveTo(tr.x + 5, tr.y - 5); c.lineTo(tr.x - 5, tr.y + 5); c.stroke();
  }
  for (const g of SV.gems) { if (!onScreen(g.x, g.y, 20)) continue; c.fillStyle = g.v >= 60 ? '#ffd24a' : g.v >= 6 ? '#c77bff' : '#6ad0ff';
    c.beginPath(); c.moveTo(g.x, g.y - 5); c.lineTo(g.x + 4, g.y); c.lineTo(g.x, g.y + 5); c.lineTo(g.x - 4, g.y); c.fill(); }
  for (const e of R.corpses) { e.actT += dt; const a = clamp(1.2 - e.actT, 0, 1); if (onScreen(e.x, e.y)) drawAnim(e.animKey, 'die', e.dir || 0, e.actT, e.x, e.y, (e.cls === 'boss' ? 1.1 : 0.75) * MON_SCALE, a); }
  R.corpses = R.corpses.filter(e => e.actT < 1.2);
  const ents = SV.en.filter(e => onScreen(e.x, e.y, 80)).concat([{ hero: true, y: H.y }]).sort((a, b) => a.y - b.y);
  let names = 0;
  for (const e of ents) {
    if (e.hero) { svDrawHero(c, dt); continue; }
    const sc = e.cls === 'boss' ? 1.1 : e.cls === 'elite' ? 0.9 : 0.72;
    e.animKey = MON[e.tid].anim; stepAct(e, dt, 'run'); if (e.act !== 'at') setAct(e, 'run');
    const eh = drawAnim(e.animKey, e.act, e.dir || 0, e.actT || 0, e.x, e.y, sc * MON_SCALE, e.hitT > 0 ? 0.6 : 1);
    if (!eh) { c.fillStyle = SERIES_COL[e.series]; c.beginPath(); c.arc(e.x, e.y - e.r, e.r, 0, 7); c.fill(); }
    if (names++ < 60) label(e.x, e.y - (eh ? Math.min(eh, 90) * 0.9 : e.r * 2) - 4, enemyName(e), e.cls === 'boss' ? NAME_COL.boss : NAME_COL[e.cls] || NAME_COL.normal, e.cls === 'boss' ? 12 : 10, e.hp / Math.max(1, e.max), e.cls === 'boss' ? '#ff5030' : '#e03a2a');   // toi da 60 nhan tren man hinh cho do roi mat
    if (e.frozen > 0) { c.fillStyle = '#5fb8ff66'; c.beginPath(); c.arc(e.x, e.y - 14, e.r + 4, 0, 7); c.fill(); }
    else if (e.slow > 0) { c.strokeStyle = '#5fb8ff88'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y - 14, e.r + 2, 0, 7); c.stroke(); }
    if (e.poisonT > 0) { c.fillStyle = '#6fd46a44'; c.beginPath(); c.arc(e.x, e.y - 14, e.r + 3, 0, 7); c.fill(); }
    if (e.stun > 0) { c.strokeStyle = '#f3d35b'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y - 28, 8, 0, 7); c.stroke(); }
  }
  for (const s of SV.shots) if (!(s.m && s.m.fly && drawFxSprite(s.m.fly, s.dir, s.t, s.x, s.y, true))) { c.fillStyle = ELEM_COL.phys; c.beginPath(); c.arc(s.x, s.y, 4, 0, 7); c.fill(); }
  R.fx = R.fx.filter(f => { if (f.k === 'ring') { f.life -= dt; c.globalAlpha = clamp(f.life / f.max, 0, 1); c.strokeStyle = f.color; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y - 10, 30 + (1 - f.life / f.max) * 150, 0, 7); c.stroke(); c.globalAlpha = 1; return f.life > 0; }
    if (!SPR_FX[f.k]) return false; const ok = stepFx(f, dt); if (ok) drawFx(f); return ok; });
  c.textAlign = 'center';
  flushLabels();
  for (const t of R.txt) { t.life -= dt; t.y -= 32 * dt; c.globalAlpha = clamp(t.life / 0.5, 0, 1); c.font = `${t.size}px "Noto Sans", sans-serif`; c.fillStyle = '#000'; c.fillText(t.t, t.x + 1, t.y + 1); c.fillStyle = t.color; c.fillText(t.t, t.x, t.y); }
  c.globalAlpha = 1; R.txt = R.txt.filter(t => t.life > 0);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (SV.flash > 0) {
    SV.flash -= dt;
    c.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, SV.flash * 1.3)})`;
    c.fillRect(0, 0, AR.w, AR.h);
  }
  if (SV.hurtT > 0) { c.fillStyle = `rgba(200,0,0,${SV.hurtT})`; c.fillRect(0, 0, AR.w, AR.h); }
  drawJoystick(c); svHud(c); svBarCd(); svUpdateHud();
  if (R.banner && R.banner.t > 0) { R.banner.t -= dt; c.globalAlpha = clamp(R.banner.t, 0, 1); c.fillStyle = '#000a'; c.fillRect(0, AR.h * 0.36, AR.w, 54);
    c.font = '20px Grenze, serif'; c.fillStyle = '#f3d88a'; c.fillText(R.banner.text, AR.w / 2, AR.h * 0.36 + 26); c.font = '12px "Noto Sans", sans-serif'; c.fillStyle = '#d8ccb4'; c.fillText(R.banner.sub, AR.w / 2, AR.h * 0.36 + 44); c.globalAlpha = 1; }
}
function svDrawHero(c, dt) {
  const hw = W.hero[S.fac]; c.fillStyle = '#0007'; c.beginPath(); c.ellipse(H.x, H.y, 16, 6, 0, 0, 7); c.fill();
  const mv = H.x !== H.svx || H.y !== H.svy; H.svx = H.x; H.svy = H.y;
  H.animKey = hw && hw.anim; stepAct(H, dt, mv ? 'run' : 'st'); if (H.act !== 'at' && H.act !== 'hurt') setAct(H, mv ? 'run' : 'st');
  const dh = hw && hw.anim && drawAnim(hw.anim, H.act || 'st', H.dir || 0, H.actT || 0, H.x, H.y, HERO_SCALE);
  if (!dh) { c.fillStyle = SERIES_COL[heroSeries()]; c.beginPath(); c.arc(H.x, H.y - 20, 14, 0, 7); c.fill(); }
  label(H.x, H.y - (dh ? Math.min(dh, 90) * 0.9 : 50) - 6, `${S.name || (FAC[S.fac] && FAC[S.fac].n) || ''} · Lv${S.lvl}`, NAME_COL.hero, 12, SV.hp / Math.max(1, SV.maxhp), '#4fd04f');
}
function svHud(c) {
  const w = AR.w, left = SV_DUR - SV.t;
  bar(0, 0, w, 5, SV.xp / SV.need, '#5fb8ff');
  c.font = '18px "Noto Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, w / 2 + 1, 27); c.fillStyle = '#f3d88a'; c.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, w / 2, 26);
  c.font = '12px "Noto Sans", sans-serif'; c.textAlign = 'left'; c.fillStyle = '#9fe3ff'; c.fillText(`Cấp ${SV.lvl}`, 8, 22);
  c.textAlign = 'right'; c.fillStyle = '#ffd7a0'; c.fillText(`☠ ${SV.kills}`, w - 44, 22);
}
