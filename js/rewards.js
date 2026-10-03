/* ======================= PHAN THUONG NGOAI GAME GOC (docs/DE_XUAT.md) =======================
   1 diem danh 7/30 ngay · 2 nhiem vu ngay · 3 thanh tuu + danh hieu · 4 trum Hoang Kim dinh ky · 5 thuong offline theo moc
   6 thap thu thach · 7 chuyen sinh (toi da 5 lan) · 8 dong hanh · 9 su kien theo mua · 10 ruong Phuc Duyen */
'use strict';
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = () => dayKey(new Date());
const GB_EVERY = 2700, GB_RETRY = 300;     // trum Hoang Kim: moi 45 phut choi (2700 giay mo phong); thua thi 5 phut sau quay lai
const REBORN_LV = MAX_LEVEL, REBORN_MAX = 5;   // chuyen sinh o cap toi da (180)
const FD_COST = 10;
function RW() { // trang thai phan thuong trong file luu (tao / bo sung truong khi nap file cu)
  const r = S.rw || (S.rw = {});
  r.stat = Object.assign({ kills: 0, bosses: 0, goldBoss: 0, picked: 0, towerBest: 0, reborn: 0, chests: 0, tokens: 0 }, r.stat || {});
  r.login = Object.assign({ last: '', streak: 0, total: 0, got: {}, claimed: true }, r.login || {});
  r.ach = r.ach || {}; r.title = r.title || ''; r.fd = r.fd || 0; if (r.gbT == null) r.gbT = GB_EVERY;
  r.pet = r.pet || null;
  return r;
}

/* ---------- phan thuong chung ---------- */
function grant(g, why) {
  const out = [];
  if (g.gold) { const v = Math.round(g.gold * (1 + S.lvl / 10)); S.gold += v; out.push(`${fmt(v)} lượng`); }
  if (g.pot) { const st = potStock(g.pot.kind); st[g.pot.tier] = (st[g.pot.tier] || 0) + g.pot.n; out.push(`${g.pot.n} ${g.pot.kind === 'life' ? 'Kim Sáng Dược' : 'Ngưng Thần đan'}`); }
  if (g.fd) { RW().fd += g.fd; out.push(`${g.fd} Phúc Duyên`); }
  if (g.item) { const it = (() => { const d = irnd(0, 9); return makeItem(d, sexPart(d, 0), clamp(Math.round(S.lvl / 12) + 1, 1, 10), g.item); })(); if (it) { addItem(it, true, true, true); out.push(esc(it.n)); } }
  if (g.set) { const it = forceSetItem(); if (it) { addItem(it, true, true); out.push(`<b style="color:${RAR_COL[it.r]}">${esc(it.n)}</b>`); } }
  if (g.pts) { S.attrPts += g.pts; out.push(`${g.pts} điểm tiềm năng`); }
  if (out.length) { log(`🎁 ${esc(why)}: ${out.join(', ')}`); if (!R.quiet) uiSfx('learn'); save(); }
  return out;
}
function forceSetItem() { // do bo Hoang Kim cua phai, cap yeu cau gan cap nhan vat
  const fid = FAC[S.fac] ? FAC[S.fac].id : -1, cap = S.lvl + 15;
  const req = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  const G = J.sets.gold.filter(r => sexReqOk(r.req));
  let pool = G.filter(r => req(r, 39) === fid && req(r, 36) <= cap);
  if (!pool.length) pool = G.filter(r => req(r, 36) <= cap);
  if (!pool.length) pool = G.filter(r => req(r, 39) === fid);
  // uu tien mon o o chua co do bo (thuong thuong duoc mac ngay, khong chat thanh do ban ve chai) va dung gioi tinh / cap mac duoc
  const free = pool.filter(r => { const sl = DETAIL_SLOT[r.d]; return sl === 'ring' ? !(S.eq.ring1 && S.eq.ring1.set && S.eq.ring2 && S.eq.ring2.set) : !(S.eq[sl] && S.eq[sl].set); });
  if (free.length) pool = free;
  return pool.length ? makeSetItem('gold', pick(pool), 5) : null;
}

/* ---------- 1. diem danh 7 ngay (vong lap) + moc 10/20/30 ngay ---------- */
const LOGIN7 = [{ gold: 200 }, { pot: { kind: 'life', tier: 2, n: 10 } }, { gold: 400, fd: 5 }, { pot: { kind: 'mana', tier: 2, n: 10 } }, { item: 4 }, { gold: 800, fd: 10 }, { set: 1, fd: 20 }];
const LOGIN30 = { 10: { gold: 3000, pts: 10 }, 20: { set: 1, pts: 20 }, 30: { set: 1, fd: 50, pts: 30 } };
function loginCheck() {
  if (!S || !S.fac) return;
  const L = RW().login, t = today();
  if (L.last === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  L.streak = L.last === dayKey(y) ? L.streak + 1 : 1;
  L.last = t; L.total++; L.claimed = false;
  dailyQuests(true); dotGift();
}
function claimLogin() {
  const L = RW().login; if (L.claimed) return;
  L.claimed = true;
  grant(LOGIN7[(L.streak - 1) % 7], `Điểm danh ngày ${L.streak}`);
  // mốc 10 / 20 / 30 ngày: nhận bù nếu hôm đạt mốc quên bấm nhận (trước đây qua ngày là mất quà)
  for (const k of Object.keys(LOGIN30).map(Number).sort((a, b) => a - b)) if (L.total >= k && !L.got[k]) { L.got[k] = 1; grant(LOGIN30[k], `Điểm danh ${k} ngày`); }
  achCheck();
}

/* ---------- 1b. qua moc cap (nhan 1 lan, khong nhan lai sau chuyen sinh): chu yeu tieu hao + tien loi,
   chi so vinh vien chi la vai diem tiem nang -> khong lam lech can bang giua cac phai ---------- */
const LV_MS = [
  [10, { gold: 300, pot: { kind: 'life', tier: 1, n: 10 } }, 'Mở khóa: tháp thử thách'],
  [20, { gold: 600, pot: { kind: 'mana', tier: 2, n: 10 }, fd: 5 }, 'Mở khóa: đồng hành'],
  [30, { item: 4, fd: 5 }, ''],
  [40, { gold: 1500, pot: { kind: 'life', tier: 3, n: 10 }, pts: 3 }, ''],
  [50, { item: 5, fd: 10 }, 'Danh hiệu «Thiếu hiệp»'],
  [60, { gold: 3000, pot: { kind: 'mana', tier: 3, n: 10 }, pts: 3 }, ''],
  [70, { set: 1, fd: 10 }, ''],
  [80, { gold: 5000, pot: { kind: 'life', tier: 4, n: 10 }, pts: 4 }, ''],
  [90, { item: 6, fd: 15 }, ''],
  [95, { set: 1, fd: 20, pts: 5 }, 'Danh hiệu «Đại hiệp»'],
  [97, { gold: 10000, pot: { kind: 'life', tier: 5, n: 20 }, fd: 20 }, ''],
  [99, { set: 1, fd: 30, pts: 5 }, 'Danh hiệu «Tông sư»'],
  // QA-083: tran nay la 180 -> moc thuong phai trai deu toi 180 (truoc day dung o 99 nen 100-180 khong co gi)
  [105, { gold: 20000, pot: { kind: 'life', tier: 5, n: 20 }, pts: 5 }, ''],
  [110, { item: 6, fd: 20 }, ''],
  [115, { gold: 30000, pts: 5 }, ''],
  [120, { set: 1, fd: 25, pts: 8 }, 'Danh hiệu «Bá chủ»'],
  [130, { gold: 60000, pot: { kind: 'mana', tier: 5, n: 20 }, fd: 25 }, ''],
  [140, { set: 1, pts: 10 }, ''],
  [150, { gold: 120000, fd: 40, pts: 10 }, 'Danh hiệu «Vô song»'],
  [160, { set: 1, fd: 40 }, ''],
  [170, { gold: 200000, pts: 12 }, ''],
  [180, { set: 1, fd: 60, pts: 15 }, 'Danh hiệu «Thiên hạ đệ nhất» · đỉnh cao · mở khóa chuyển sinh'],
];
const TOWER_LV = 10, PET_LV = 20;
const unlocked = lv => S.lvl >= lv || RW().stat.reborn > 0 || !!RW().unlockAll;
function lvMsReady() { const g = RW().lvGot || {}; return LV_MS.filter(([lv]) => S.lvl >= lv && !g[lv]); }
function claimLvMs(lv) {
  const r = RW(), m = LV_MS.find(x => x[0] === lv); r.lvGot = r.lvGot || {};
  if (!m || S.lvl < lv || r.lvGot[lv]) return;
  r.lvGot[lv] = 1; grant(m[1], `Mốc cấp ${lv}`); achCheck(); refreshGift();
}

/* ---------- 2. nhiem vu ngay (4 viec ngau nhien moi ngay) ---------- */
const DQ_POOL = [
  ['kills', 'Hạ {n} quái', lv => 150 + lv * 3], ['bosses', 'Hạ {n} trùm', () => 2], ['picked', 'Nhặt {n} món đồ', () => 8],
  ['stages', 'Vượt {n} ải', () => 5], ['pots', 'Dùng {n} bình thuốc', () => 10], ['tower', 'Leo {n} tầng tháp thử thách', () => 3],
];
function dailyQuests(reset) {
  const r = RW();
  if (!reset && r.dq && r.dq.day === today()) return r.dq;
  const pool = DQ_POOL.filter(q => q[0] !== 'tower' || unlocked(TOWER_LV)).sort(() => Math.random() - 0.5).slice(0, 4);
  r.dq = { day: today(), list: pool.map(([k, t, f]) => ({ k, t: t.replace('{n}', f(S.lvl)), need: f(S.lvl), have: 0, done: false })) };
  return r.dq;
}
function questTick(k, n = 1) {
  if (!S || !S.fac) return;
  if (k === 'picked') RW().stat.picked += n;
  for (const q of dailyQuests().list) if (q.k === k && !q.done && q.have < q.need) { q.have = Math.min(q.need, q.have + n); if (q.have >= q.need) dotGift(); }
}
function claimQuest(i) { const q = dailyQuests().list[i]; if (!q || q.done || q.have < q.need) return; q.done = true; grant({ gold: 300, fd: 5 }, `Nhiệm vụ: ${q.t}`); }

/* ---------- 3. thanh tuu + danh hieu (deo 1 danh hieu: cong chi so nho) ---------- */
const ACH = [
  ['lv30', 'Xuất sơn', () => S.lvl >= 30 || RW().stat.reborn > 0, { gold: 1000 }, ['lifemax_p', 3]],
  ['lv50', 'Thiếu hiệp', () => (RW().lvGot || {})[50], { fd: 5 }, ['lifemax_p', 4]],
  ['lv80', 'Danh chấn giang hồ', () => S.lvl >= 80 || RW().stat.reborn > 0, { gold: 5000, pts: 10 }, ['attackspeed_v', 3]],
  // QA-018/023: id 'lv100'/'lv150' la ten LICH SU (tran cap la 99, moc that la 95 va 99).
  // KHONG doi id: 'ach' luu theo id, doi id se khien nguoi choi cu nhan LAI thuong.
  // Bo nhanh chet lvGot[100]/lvGot[150] - khong moc nao sinh ra hai khoa do.
  // QA-083: tran 180 -> hai thanh tuu cu (moc 95 va 99) nay chia lai cho moc giua va moc tran.
  // Giu nguyen id de save cu khong nhan lai thuong.
  ['lv100', 'Đại hiệp', () => (RW().lvGot || {})[95] || (RW().lvGot || {})[120], { fd: 10 }, ['allres_p', 4]],
  ['lv150', 'Tông sư', () => (RW().lvGot || {})[99] || (RW().lvGot || {})[180], { fd: 20 }, ['allres_p', 6]],
  ['k1000', 'Sát thủ', () => RW().stat.kills >= 1000, { fd: 10 }, ['manamax_p', 4]],
  ['k10000', 'Vạn nhân địch', () => RW().stat.kills >= 10000, { set: 1 }, ['attackspeed_v', 5]],
  ['b50', 'Diệt trùm', () => RW().stat.bosses >= 50, { fd: 20 }, ['allres_p', 3]],
  ['zone8', 'Nửa giang sơn', () => S.maxStage >= STAGES / 2, { gold: 8000 }, ['fastwalkrun_p', 5]],
  ['zone16', 'Trường Bạch sơn chủ', () => S.maxStage > STAGES, { set: 1, pts: 20 }, ['lifemax_p', 6]],
  ['setfull', 'Hoàng Kim đủ bộ', () => enoughToActive(S.eq), { fd: 30 }, ['allres_p', 5]],
  ['tower20', 'Leo tháp tầng 20', () => RW().stat.towerBest >= 20, { fd: 20 }, ['attackspeed_v', 6]],
  ['tower50', 'Chinh phục Tháp', () => RW().stat.towerBest >= TOWER_MAX, { set: 1, fd: 30 }, ['allres_p', 4]],
  ['reborn1', 'Chuyển sinh', () => RW().stat.reborn >= 1, { fd: 50 }, ['lifemax_p', 8]],
  ['gold5', 'Săn trùm Hoàng Kim', () => RW().stat.goldBoss >= 5, { fd: 20 }, ['lucky_v', 10]],
  ['login30', 'Giang hồ lão luyện', () => RW().login.total >= 30, { set: 1 }, ['manamax_p', 6]],
];
function achCheck() {
  if (!S || !S.fac) return;
  const r = RW();
  for (const [id, n, ok, reward] of ACH) if (!r.ach[id] && ok()) { r.ach[id] = 1; grant(reward, `Thành tựu «${n}»`); if (!R.quiet) toast(`Thành tựu: ${n}`); dotGift(); }
}
function titleAttr(A) { // goi tu calc(): chi so cua danh hieu dang deo
  if (!S.rw || !S.rw.title) return;
  const t = ACH.find(a => a[0] === S.rw.title); if (t && S.rw.ach[t[0]]) addAttr(A, t[4][0], [t[4][1], 0, 0]);
}

/* ---------- 4. trum Hoang Kim dinh ky ---------- */
function goldBossTick(dt) { if (S.fac && !R.town && !R.tower) RW().gbT -= dt; }
function goldBossDue() { return !R.tower && RW().gbT <= 0; }
function spawnGoldBoss() {
  // cap trum khong vuot cap nhan vat + 2 (nhip len cap cham: nhan vat thuong danh ai cao hon cap minh)
  const z = zoneOf(Math.min(S.stage, STAGES)), L = Math.min(stageLevel(S.stage), S.lvl) + 2, [x, y] = inWorld(H.x + 240, H.y - 120);
  const e = makeEnemy(z.boss, L, 'boss', x, y);
  e.hp = e.max = e.max * 2; e.dmg *= 1.15; e.goldBoss = true; e.n = 'Trùm Hoàng Kim · ' + e.n;
  R.enemies.push(e); RW().gbT = GB_EVERY;
  R.banner = { t: 2.5, text: 'Trùm Hoàng Kim xuất hiện!', sub: 'Hạ để nhận đồ Hoàng Kim' }; log('<b style="color:#ffb52e">Trùm Hoàng Kim xuất hiện!</b>');
}

/* ---------- 5. thuong offline theo moc 1 / 4 / 8 gio ---------- */
function offlineChests(secs) {
  let n = 0;
  if (secs >= 3600) { grant({ gold: 500, pot: { kind: 'life', tier: 2, n: 5 } }, 'Tu luyện 1 giờ'); n++; }
  if (secs >= 4 * 3600) { grant({ gold: 1500, fd: 10 }, 'Tu luyện 4 giờ'); n++; }
  if (secs >= 8 * 3600 - 60) { grant({ set: 1, fd: 20 }, 'Tu luyện 8 giờ'); n++; }
  return n;
}

/* ---------- 6. thap thu thach (Phong Ky) ---------- */
/* Thap co DIEM DUNG: TOWER_MAX tang (het tang cuoi la chinh phuc, khong leo them), moi ngay chi TOWER_TRIES luot vao.
   Quai cap = 8 + 1,8 x tang (tang 50 ~ cap 98) va cang len cang them mau / sat thuong (towerMul); truoc day cap quai = 10 + 4 x tang
   nen tu tang 23 moi quai deu cap 99 (khong tang them) va khong co diem ket thuc.
   Phan thuong (kinh nghiem, do, ngan luong) CHI nhan o lan dau qua tang (tang > ky luc); luot vao lai khong con cay duoc. */
const TOWER_MAX = 50, TOWER_TRIES = 3, TOWER_XP = 0.35;
const towerLevel = f => Math.min(MAX_LEVEL, 8 + Math.round(f * 1.8));
const towerMul = f => 1 + f * 0.035;
function towerTries() { const r = RW(); if (!r.tw || r.tw.day !== today()) r.tw = { day: today(), n: 0 }; return r.tw; }
const towerFirst = () => !!R.tower && R.tower.floor > RW().stat.towerBest;   // dang o tang chua tung qua: moi co thuong
function towerStart() {
  const r = RW(), t = towerTries();
  if (R.town) backFromTown();
  if (r.stat.towerBest >= TOWER_MAX) { toast('Bạn đã chinh phục toàn bộ Tháp thử thách'); return; }
  if (t.n >= TOWER_TRIES) { toast(`Hôm nay đã dùng hết ${TOWER_TRIES} lượt vào tháp, mai quay lại`); return; }
  t.n++;
  R.tower = { floor: Math.max(1, r.stat.towerBest + 1) }; R.enemies = []; R.corpses = []; R.spawnT = 0.5;
  R.banner = { t: 2, text: `Tháp thử thách · tầng ${R.tower.floor}`, sub: `Gục ngã là mất lượt (còn ${TOWER_TRIES - t.n} lượt hôm nay)` }; closeModal(true);
}
function towerSpawn() {
  const f = R.tower.floor, L = towerLevel(f), z = ZONES[Math.min(ZONES.length - 1, Math.floor(f / 3))], boss = f % 5 === 0;
  R.enemies = []; R.stall = 0;
  const n = boss ? 1 : 3 + (f % 3), k = towerMul(f);
  for (let i = 0; i < n; i++) {
    const [x, y] = inWorld(H.x + rnd(-260, 260), H.y + rnd(-220, 220)), e = makeEnemy(boss ? z.boss : pick(z.m), L, boss ? 'boss' : 'elite', x, y);
    e.hp = e.max = e.max * k; e.dmg *= 1 + (k - 1) * 0.6; R.enemies.push(e);
  }
}
function towerCleared() {
  const r = RW(), f = R.tower.floor;
  if (f > r.stat.towerBest) { r.stat.towerBest = f; grant(f % 10 === 0 ? { set: 1, fd: 15 } : f % 5 === 0 ? { fd: 10, gold: 300 * f } : { gold: 150 * f, fd: 2 }, `Tháp tầng ${f}`); }
  questTick('tower'); achCheck();
  if (f >= TOWER_MAX) { log(`<b class="up">Chinh phục Tháp thử thách (${TOWER_MAX} tầng)!</b>`); R.banner = { t: 3, text: 'Chinh phục Tháp!', sub: `Đã qua tầng ${TOWER_MAX}` }; towerExit(false, true); return; }
  heal(R.P.life * 0.3, true); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.3);
  R.tower.floor++; R.spawnT = 1.5; R.banner = { t: 1.5, text: `Tầng ${R.tower.floor}`, sub: `Quái cấp ${towerLevel(R.tower.floor)}` };
}
function towerExit(dead, won) {
  if (!R.tower) return;
  if (!won) log(`${dead ? 'Gục ở' : 'Rời'} tháp thử thách tầng ${R.tower.floor}. Kỷ lục: ${RW().stat.towerBest}`);
  R.tower = null; R.enemies = []; S.wave = 1; R.spawnT = 0.5; R.zoneShown = null;
}

/* ---------- 7. chuyen sinh (level_exp.txt co 5 cot chuyen sinh -> toi da 5 lan) ---------- */
function rebornBonus() { const n = S.rw && S.rw.stat ? S.rw.stat.reborn || 0 : 0; return { xp: 0.2 * n, dmg: 0.1 * n }; }
function doReborn() {
  const r = RW();
  if (S.lvl < REBORN_LV || r.stat.reborn >= REBORN_MAX) return;
  if (!confirm('Chuyển sinh: về cấp 1, giữ trang bị và võ công. Tiếp tục?')) return;
  r.stat.reborn++;
  S.lvl = 1; S.xp = 0; S.attr = { str: 0, dex: 0, vit: 0, eng: 0 }; S.attrPts = r.stat.reborn * 50;
  S.stage = 1; S.wave = 1; S.push = true; R.tower = null; R.enemies = []; R.dirty = true; R.zoneShown = null;
  log(`<b class="up">Chuyển sinh lần ${r.stat.reborn}!</b> +${r.stat.reborn * 20}% kinh nghiệm, +${r.stat.reborn * 10}% sát thương`);
  if (S.autoPts === true) autoSpendAttrs();
  achCheck(); closeModal(true); refresh(); save();
}

/* ---------- 8. dong hanh (thu nuoi danh cung, len cap theo quai ha) ---------- */
function petChoices() {
  const zs = ZONES.slice(0, zoneIdx(Math.min(S.maxStage, STAGES)) + 1);
  return [...new Set(zs.flatMap(z => z.m))].filter(t => MON[t] && MON[t].anim).slice(0, 12);
}
function petAdopt(tid) { const old = RW().pet; RW().pet = { tid, lvl: old ? old.lvl : 1, xp: old ? old.xp : 0 }; R.petPos = null; toast('Đồng hành: ' + MON[tid].n); save(); refreshGift(); }
function petDmg(p) { const l = Math.min(PET_MAX, p.lvl); return (6 + l * 5) * (1 + l * 0.04) * (1 + rebornBonus().dmg); }
function petTick(dt) {
  const p = S.rw && S.rw.pet; if (!p || R.town || !MON[p.tid]) { R.petPos = null; return; }
  const pp = R.petPos || (R.petPos = { x: H.x - 30, y: H.y + 10, t: 0, act: 'st', actT: 0, dir: 0 });
  const t = alive().sort((a, b) => Math.hypot(a.x - pp.x, a.y - pp.y) - Math.hypot(b.x - pp.x, b.y - pp.y))[0];
  const goal = t || { x: H.x - 36, y: H.y + 12 }, d = Math.hypot(goal.x - pp.x, goal.y - pp.y), reach = t ? t.r + 14 : 10;
  pp.moving = d > reach;
  if (pp.moving) { const k = Math.min(1, 170 * dt / d); pp.dir = dirOf(goal.x - pp.x, goal.y - pp.y); pp.x += (goal.x - pp.x) * k; pp.y += (goal.y - pp.y) * k; }
  if (Math.hypot(H.x - pp.x, H.y - pp.y) > 500) { pp.x = H.x - 30; pp.y = H.y + 10; }   // lac xa: dich chuyen ve canh chu
  pp.t -= dt;
  if (t && !pp.moving && pp.t <= 0) { pp.t = 1.2; const dmg = petDmg(p); t.hp -= dmg; t.hitT = 0.1; pp.act = 'at'; pp.actT = 0; pp.dir = dirOf(t.x - pp.x, t.y - pp.y); addText(t.x, t.y - 30, fmt(dmg), '#9fe36a', 11); }
}
/* Đồng hành tối đa cấp 100: sát thương ~ cấp^2 nhưng kinh nghiệm cần chỉ ~ cấp^1 mỗi cấp, không có trần thì sau vài chục giờ treo máy
   đồng hành đánh mạnh hơn cả nhân vật (không bị né, không bị kháng) và quái chết trước khi nhân vật kịp ra đòn */
const PET_MAX = 100;
function petGainXp(n) {
  const p = S.rw && S.rw.pet; if (!p) return;
  if (p.lvl >= PET_MAX) { p.lvl = PET_MAX; p.xp = 0; return; }
  p.xp += n; const need = 20 + p.lvl * 12;
  if (p.xp >= need) { p.xp -= need; p.lvl++; log(`Đồng hành ${esc(MON[p.tid].n)} lên cấp ${p.lvl}`); }
}
function drawPet(c, dt) {
  const p = S.rw && S.rw.pet, pp = R.petPos; if (!p || !pp || !MON[p.tid]) return;
  pp.animKey = MON[p.tid].anim; stepAct(pp, dt, pp.moving ? 'run' : 'st'); if (pp.act !== 'at') setAct(pp, pp.moving ? 'run' : 'st');
  c.fillStyle = '#0007'; c.beginPath(); c.ellipse(pp.x, pp.y, 10, 4, 0, 0, 7); c.fill();
  drawAnim(pp.animKey, pp.act || 'st', pp.dir || 0, pp.actT || 0, pp.x, pp.y, 0.75 * MON_SCALE);
  label(pp.x, pp.y - 42, `${MON[p.tid].n} · Lv${p.lvl}`, NAME_COL.pet, 10, -1);
}

/* ---------- 9. su kien theo mua (theo thang hien tai) ---------- */
function eventNow() {
  const m = new Date().getMonth() + 1;
  if (m === 1 || m === 2) return { n: 'Tết Nguyên Đán', token: 'Bánh Chưng', col: '#ff5a4a' };
  if (m === 9 || m === 10) return { n: 'Tết Trung Thu', token: 'Bánh Trung Thu', col: '#ffd24a' };
  if (m === 12) return { n: 'Giáng Sinh', token: 'Chuông Bạc', col: '#9fe3ff' };
  return { n: 'Hội Võ Lâm', token: 'Lệnh Bài Võ Lâm', col: '#c8a2ff' };
}
const EVENT_SHOP = [[10, { gold: 1000 }], [20, { pot: { kind: 'life', tier: 3, n: 10 } }], [30, { item: 5 }], [40, { fd: 20 }], [60, { set: 1 }]];
function eventBuy(i) {
  const [cost, g] = EVENT_SHOP[i], st = RW().stat;
  if (st.tokens < cost) { toast(`Cần ${cost} ${eventNow().token}`); return; }
  st.tokens -= cost; grant(g, eventNow().n); refreshGift();
}

/* ---------- 10. ruong Phuc Duyen ---------- */
const FD_TABLE = [[40, { gold: 600 }], [20, { pot: { kind: 'life', tier: 3, n: 5 } }], [15, { pot: { kind: 'mana', tier: 3, n: 5 } }], [12, { item: 4 }], [8, { item: 6 }], [4, { pts: 5 }], [1, { set: 1 }]];
function openChest() {
  const r = RW(); if (r.fd < FD_COST) { toast(`Cần ${FD_COST} điểm Phúc Duyên`); return; }
  r.fd -= FD_COST; r.stat.chests++;
  const got = grant(wpick(FD_TABLE, x => x[0])[1], 'Rương Phúc Duyên');
  toast('Rương Phúc Duyên: ' + got.join(', ').replace(/<[^>]+>/g, '')); refreshGift();
}

/* ---------- moc noi vao tro choi ---------- */
function rwOnKill(e) {
  if (!S.fac) return;
  const r = RW(); r.stat.kills++; questTick('kills');
  if (e.cls === 'boss') { r.stat.bosses++; questTick('bosses'); }
  if (e.goldBoss) { r.stat.goldBoss++; grant({ set: 1, fd: 10 }, 'Hạ Trùm Hoàng Kim'); }
  if (Math.random() < 0.05) { r.stat.tokens++; const ev = eventNow(); addText(e.x, e.y - 50, '+1 ' + ev.token, ev.col, 11); }
  petGainXp(e.cls === 'boss' ? 10 : e.cls === 'elite' ? 3 : 1);
  if (r.stat.kills % 25 === 0 || e.cls === 'boss') achCheck();
}
function giftPending() {
  if (!S || !S.fac) return false;
  const r = RW();
  return !r.login.claimed || lvMsReady().length > 0 || dailyQuests().list.some(q => !q.done && q.have >= q.need) || r.fd >= FD_COST;
}
function dotGift() { const b = $('#giftBtn'); if (b) b.classList.toggle('on', giftPending()); }

/* ---------- giao dien: nut 🎁 ---------- */
let giftTab = 'login';
function refreshGift() { if (!$('#modal').classList.contains('hidden') && $('#giftTabs')) giftModal(); dotGift(); }
function giftText(g) {
  const p = [];
  if (g.gold) p.push(`${fmt(g.gold * (1 + S.lvl / 10))} lượng`); if (g.pot) p.push(`${g.pot.n} bình thuốc`); if (g.fd) p.push(`${g.fd} Phúc Duyên`);
  if (g.item) p.push(`đồ ${g.item} dòng`); if (g.set) p.push('đồ Hoàng Kim'); if (g.pts) p.push(`${g.pts} tiềm năng`);
  return p.join(', ');
}
/* ======================= D: TAI XIU (3 xuc xac, cuoc vang, gioi han luot/ngay) =======================
   Cua: Xiu 4-10, Tai 11-17, Bo ba (3 mat giong nhau). Thang nhan qua ho tro NGAU NHIEN:
   Huyen Tinh, Thuy Tinh Trang, Than Bi Khoang Thach, Tinh Hong Bao Thach, diem tiem nang,
   diem vo cong, kinh nghiem - hoac MOT LOI CHUC (buff nho 1 gio). */
const TX_LUOT = 10, TX_BO_BA = 30;
/* Lời chúc (quà hiếm của Tài Xỉu): +10 may mắn trong 1 giờ. Trước đây chỉ được ghi vào file lưu, không có chỗ nào đọc -> quà vô dụng. */
const BLESS_LUCKY = 10;
function blessLucky() {
  const b = S && S.rw && S.rw.bless; if (!b || !b.length) return 0;
  const now = Date.now(); return b.some(x => x.until > now) ? BLESS_LUCKY : 0;   // nhiều lời chúc không cộng dồn
}
/* Hết hạn: bỏ khỏi file lưu và tính lại chỉ số (gọi định kỳ từ vòng lặp) */
function blessSweep() {
  const b = S && S.rw && S.rw.bless; if (!b || !b.length) return;
  const now = Date.now(), keep = b.filter(x => x.until > now);
  if (keep.length !== b.length) { S.rw.bless = keep; R.dirty = true; }
}
const txNgay = () => localISODay();   // giờ máy, cùng mốc với điểm danh / tháp
function txState() {
  const r = RW();
  if (!r.tx || r.tx.ngay !== txNgay()) r.tx = { ngay: txNgay(), luot: 0 };
  return r.tx;
}
const txLuotCon = () => TX_LUOT - txState().luot;
const txCuocMax = () => Math.round(20000 + S.lvl * 4000);
const txCuocMin = () => Math.round(txCuocMax() / 10);   // = mức cược thấp nhất trên giao diện
function txQua(bac) {                       // bac 1 = van thuong, 2 = bo ba
  const roll = irnd(1, 100);
  if (roll <= 30) { const n = irnd(1, 2) * bac; matAdd('misc', 'thbt', n); return n + ' Tinh Hồng Bảo Thạch'; }
  if (roll <= 55) { const n = irnd(1, 3) * bac; matAdd('misc', 'wc', n); return n + ' Thủy Tinh Trắng'; }
  if (roll <= 75) { const n = irnd(1, 2) * bac; matAdd('misc', 'mys', n); return n + ' Thần Bí Khoáng Thạch'; }
  if (roll <= 88) { const lvl = clamp(irnd(1, 4) * bac, 1, HT_MAX); matAdd('ht', lvl, 1); return 'Huyền Tinh cấp ' + lvl; }
  if (roll <= 93) { const n = 3 * bac; S.attrPts += n; return n + ' điểm tiềm năng'; }
  if (roll <= 97) { const n = 2 * bac; S.skPts += n; return n + ' điểm võ công'; }
  if (roll <= 99) { const xp = Math.round(expNeed(S.lvl) * 0.25 * bac); S.xp += xp; return 'Kinh nghiệm +' + fmt(xp); }
  const r = RW(); (r.bless = r.bless || []).push({ until: Date.now() + 3600000, ten: 'Lời chúc: may mắn +10 trong 1 giờ' });
  return 'MỘT LỜI CHÚC: may mắn +10 trong 1 giờ';
}
function taiXiu(cua, cuoc) {
  cuoc = Math.floor(cuoc);
  const t = txState();
  if (txLuotCon() <= 0) return { ok: false, msg: 'Hết lượt hôm nay (' + TX_LUOT + ' lượt/ngày) — mai quay lại' };
  if (!['tai', 'xiu', 'boba'].includes(cua)) return { ok: false, msg: 'Cửa không hợp lệ' };
  if (!(cuoc > 0)) return { ok: false, msg: 'Mức cược không hợp lệ' };
  if (cuoc < txCuocMin()) return { ok: false, msg: 'Cược tối thiểu ' + fmt(txCuocMin()) + ' lượng (quà thắng không phụ thuộc mức cược, cược 1 lượng thì thành lấy quà miễn phí)' };
  if (cuoc > txCuocMax()) return { ok: false, msg: 'Trần cược ' + fmt(txCuocMax()) + ' lượng' };
  if (S.gold < cuoc) return { ok: false, msg: 'Không đủ ngân lượng' };
  t.luot++;
  S.gold -= cuoc;
  const x = [rcInt(1, 6), rcInt(1, 6), rcInt(1, 6)], tong = x[0] + x[1] + x[2];
  const boBa = x[0] === x[1] && x[1] === x[2];
  const thang = cua === 'boba' ? boBa : (!boBa && (cua === 'tai' ? tong >= 11 : tong <= 10));
  const dau = 'Xúc xắc ' + x.join('-') + ' = ' + tong;
  if (!thang) return { ok: true, thang: false, xucXac: x, tong, msg: dau + ' — thua ' + fmt(cuoc) + ' lượng' };
  const heSo = cua === 'boba' ? TX_BO_BA : 2, tienThang = cuoc * heSo;
  S.gold += tienThang;
  const qua = txQua(cua === 'boba' ? 2 : 1);
  R.dirty = true;
  return { ok: true, thang: true, xucXac: x, tong, tienThang, qua, msg: dau + ' — THẮNG ' + fmt(tienThang) + ' lượng · nhận: ' + qua };
}
function giftBody(r) {
  if (giftTab === 'tx') {
    const con = txLuotCon(), maxc = txCuocMax(), muc = [Math.round(maxc / 10), Math.round(maxc / 4), maxc];
    const ok = c => con > 0 && S.gold >= c;
    return '<p class="desc">Tài Xỉu 3 xúc xắc · cược ngân lượng · còn <b>' + con + '/' + TX_LUOT + '</b> lượt hôm nay · trần cược ' + fmt(maxc) + ' lượng.</p>'
      + '<div class="card"><b>Luật</b> <small class="dim">Xỉu 4–10 (×2) · Tài 11–17 (×2) · Bộ ba (3 mặt giống nhau) ×' + TX_BO_BA + '. Bộ ba KHÔNG tính cho Tài/Xỉu.</small></div>'
      + '<div class="card"><b>Đặt cược</b> <small class="dim">thắng còn nhận quà hỗ trợ NGẪU NHIÊN: Huyền Tinh, Thủy Tinh Trắng, Thần Bí Khoáng Thạch, Tinh Hồng Bảo Thạch, điểm tiềm năng, điểm võ công, kinh nghiệm — hoặc MỘT LỜI CHÚC</small>'
      + muc.map(c => '<div class="btnrow"><small>' + fmt(c) + ' lượng</small>'
          + '<button class="btn" data-tx="xiu:' + c + '" ' + (ok(c) ? '' : 'disabled') + '>Xỉu</button>'
          + '<button class="btn" data-tx="tai:' + c + '" ' + (ok(c) ? '' : 'disabled') + '>Tài</button>'
          + '<button class="btn red" data-tx="boba:' + c + '" ' + (ok(c) ? '' : 'disabled') + '>Bộ ba</button></div>').join('')
      + '</div>'
      + (r.txLog && r.txLog.length ? '<div class="card"><b>Ván gần đây</b>' + r.txLog.slice(0, 6).map(s => '<div class="row"><small>' + esc(s) + '</small></div>').join('') + '</div>' : '');
  }
  if (giftTab === 'login') {
    const L = r.login, day = ((L.streak - 1) % 7 + 7) % 7;
    return `<p class="desc">Chuỗi ${L.streak} ngày · tổng ${L.total} ngày. Mốc 10 / 20 / 30 ngày có quà lớn.</p>
      <div class="days">${LOGIN7.map((g, i) => `<div class="day${i < day || (i === day && L.claimed) ? ' got' : ''}${i === day ? ' cur' : ''}"><b>Ngày ${i + 1}</b><small>${giftText(g)}</small></div>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="gLogin" ${L.claimed ? 'disabled' : ''}>${L.claimed ? 'Đã nhận hôm nay' : 'Nhận quà hôm nay'}</button></div>`;
  }
  if (giftTab === 'lvms') {
    const g = r.lvGot || {};
    return `<p class="desc">Quà mốc cấp: nhận một lần (chuyển sinh không nhận lại). Chủ yếu thuốc, ngân lượng, Phúc Duyên và mở khóa tính năng.</p>${LV_MS.map(([lv, rw, note]) => `<div class="qrow${S.lvl >= lv ? '' : ' lock'}"><span><b>Cấp ${lv}</b><small>${giftText(rw)}${note ? ' · ' + note : ''}</small></span><small></small><button class="btn sm" data-lv="${lv}" ${S.lvl >= lv && !g[lv] ? '' : 'disabled'}>${g[lv] ? 'Đã nhận' : 'Nhận'}</button></div>`).join('')}`;
  }
  if (giftTab === 'quest') return `<p class="desc">Làm mới mỗi ngày. Mỗi việc: lượng + 5 Phúc Duyên.</p>${dailyQuests().list.map((q, i) => `<div class="qrow"><span>${esc(q.t)}</span><small>${q.have}/${q.need}</small><button class="btn sm" data-q="${i}" ${q.done || q.have < q.need ? 'disabled' : ''}>${q.done ? 'Đã nhận' : 'Nhận'}</button></div>`).join('')}`;
  if (giftTab === 'ach') return `<p class="desc">Hoàn thành để nhận thưởng; đeo 1 danh hiệu để cộng chỉ số.</p>${ACH.map(([id, n, , g, t]) => `<div class="qrow${r.ach[id] ? '' : ' lock'}"><span><b>${n}</b><small>${giftText(g)} · danh hiệu: ${esc(attrText(t[0], [t[1], 0, 0]))}</small></span><small></small><button class="btn sm" data-t="${id}" ${r.ach[id] ? '' : 'disabled'}>${r.title === id ? 'Đang đeo' : 'Đeo'}</button></div>`).join('')}`;
  if (giftTab === 'chest') return `<p class="desc">Điểm Phúc Duyên: <b>${r.fd}</b> (điểm danh, nhiệm vụ, thành tựu, trùm). Mỗi lần mở: ${FD_COST} điểm.</p>
      <div class="chips">${FD_TABLE.map(([w, g]) => `<span class="chip2">${giftText(g)} · ${w}%</span>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="gChest" ${r.fd >= FD_COST ? '' : 'disabled'}>Mở rương Phúc Duyên</button></div>`;
  if (giftTab === 'event') {
    const ev = eventNow();
    return `<p class="desc">Sự kiện: <b style="color:${ev.col}">${ev.n}</b>. Quái rơi ${ev.token} (5%). Đang có: <b>${r.stat.tokens}</b>.</p>${EVENT_SHOP.map(([c, g], i) => `<div class="qrow"><span>${giftText(g)}</span><small>${c} ${ev.token}</small><button class="btn sm" data-e="${i}" ${r.stat.tokens >= c ? '' : 'disabled'}>Đổi</button></div>`).join('')}`;
  }
  if (giftTab === 'tower') return `<p class="desc">Tháp có ${TOWER_MAX} tầng, mỗi ngày ${TOWER_TRIES} lượt vào. Mỗi tầng một đợt tinh anh, tầng chia hết cho 5 là trùm (tầng 10, 20, 30, 40, 50 có đồ Hoàng Kim). Quái cấp 8 + 1,8 × tầng và mạnh dần theo tầng. Kinh nghiệm và phần thưởng chỉ nhận ở lần đầu qua tầng. Gục ngã là rời tháp và mất lượt.</p>
      <p>Kỷ lục: <b>tầng ${r.stat.towerBest}/${TOWER_MAX}</b>${R.tower ? ` · đang ở tầng ${R.tower.floor}` : ` · lượt hôm nay: ${TOWER_TRIES - towerTries().n}/${TOWER_TRIES}`}</p>
      <div class="btnrow">${R.tower ? '<button class="btn red" id="gTowerOut">Rời tháp</button>' : !unlocked(TOWER_LV) ? `<button class="btn" disabled>Cần cấp ${TOWER_LV}</button>` : r.stat.towerBest >= TOWER_MAX ? '<button class="btn" disabled>Đã chinh phục</button>' : towerTries().n >= TOWER_TRIES ? '<button class="btn" disabled>Hết lượt hôm nay</button>' : `<button class="btn" id="gTower">Vào tháp (tầng ${r.stat.towerBest + 1})</button>`}</div>`;
  if (giftTab === 'pet') {
    const p = r.pet;
    if (!unlocked(PET_LV)) return `<p class="desc">Đồng hành mở khóa ở cấp ${PET_LV}.</p>`;
    return `<p class="desc">Đồng hành đi theo và cùng đánh quái, lên cấp theo số quái hạ. Chọn trong các loài ở vùng đã tới (đổi loài vẫn giữ cấp).</p>${p && MON[p.tid] ? `<p>Đang dẫn: <b>${esc(MON[p.tid].n)}</b> · cấp ${p.lvl} · sát thương ${fmt(petDmg(p))}/đòn</p>` : ''}
      <div class="petpick">${petChoices().map(t => `<button data-p="${t}" class="${p && p.tid === t ? 'on' : ''}">${MON[t].img ? `<img src="${esc(MON[t].img)}" alt="">` : ''}<b>${esc(MON[t].n)}</b></button>`).join('')}</div>`;
  }
  const bo = rebornBonus(), full = r.stat.reborn >= REBORN_MAX;
  return `<p class="desc">Từ cấp ${REBORN_LV} (tối đa): về cấp 1, giữ trang bị và võ công, nhận 50 điểm tiềm năng × số lần chuyển sinh, thưởng vĩnh viễn +20% kinh nghiệm và +10% sát thương mỗi lần (tối đa ${REBORN_MAX} lần).</p>
      <p>Đã chuyển sinh: <b>${r.stat.reborn}</b> lần · hiện +${Math.round(bo.xp * 100)}% kinh nghiệm, +${Math.round(bo.dmg * 100)}% sát thương.</p>
      <div class="btnrow"><button class="btn red" id="gReborn" ${S.lvl >= REBORN_LV && !full ? '' : 'disabled'}>${full ? 'Đã chuyển sinh tối đa' : S.lvl >= REBORN_LV ? 'Chuyển sinh' : `Cần cấp ${REBORN_LV}`}</button></div>`;
}
function giftModal() {
  if (!S.fac) return;
  const r = RW(), tabs = [['login', 'Điểm danh'], ['lvms', 'Mốc cấp'], ['quest', 'Nhiệm vụ'], ['ach', 'Thành tựu'], ['chest', 'Phúc Duyên'], ['event', 'Sự kiện'], ['tower', 'Tháp'], ['tx', 'Tài Xỉu'], ['pet', 'Đồng hành'], ['reborn', 'Chuyển sinh']];
  modal(`<h3>Phần thưởng <small>Phúc Duyên ${r.fd}</small></h3><div class="dtabs" id="giftTabs">${tabs.map(([k, n]) => `<button data-g="${k}" class="${k === giftTab ? 'on' : ''}">${n}</button>`).join('')}</div>${giftBody(r)}`, () => {
    document.querySelectorAll('#mBody #giftTabs button').forEach(x => x.onclick = () => { giftTab = x.dataset.g; giftModal(); });
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#gLogin', () => { claimLogin(); refreshGift(); }); on('#gChest', openChest); on('#gTower', towerStart);
    on('#gTowerOut', () => { towerExit(false); refreshGift(); }); on('#gReborn', doReborn);
    document.querySelectorAll('#mBody [data-lv]').forEach(x => x.onclick = () => claimLvMs(+x.dataset.lv));
    document.querySelectorAll('#mBody [data-q]').forEach(x => x.onclick = () => { claimQuest(+x.dataset.q); refreshGift(); });
    document.querySelectorAll('#mBody [data-t]').forEach(x => x.onclick = () => { r.title = r.title === x.dataset.t ? '' : x.dataset.t; R.dirty = true; save(); refreshGift(); });
    document.querySelectorAll('#mBody [data-e]').forEach(x => x.onclick = () => eventBuy(+x.dataset.e));
    document.querySelectorAll('#mBody .petpick [data-p]').forEach(x => x.onclick = () => petAdopt(+x.dataset.p));
    document.querySelectorAll('#mBody [data-tx]').forEach(x => x.onclick = () => {
      const [cua, c] = x.dataset.tx.split(':');
      const res = taiXiu(cua, +c);
      if (res.xucXac) { const rr = RW(); rr.txLog = [res.msg, ...(rr.txLog || [])].slice(0, 20); }
      (typeof afterRc === 'function') ? afterRc(res, giftModal) : (toast(res.msg), save(), refreshGift());
    });
  });
}
