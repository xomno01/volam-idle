/* ======================= RENG TIM: HUYEN TINH KHOANG THACH (KPlayer::Compound, KPlayer::Enchase) =======================
   Hop (CPA_FUSION): 3 mon (nhan + ngoc boi + day chuyen) -> 1 Huyen Tinh cap ngau nhien [tong cap / 10, tong cap / 5]; phi 1000 luong (Cong dong).
   Thang cap (CPA_CRYOLITE): 3 Huyen Tinh cung cap -> 1 cap +1; 2/11 rui ro, that bai mat het.
   Thang cap khoang (CPA_PROPMINE): 1 khoang +1 cap, 2/11 vo.
   Kham (ECA_ENCHASE): 1 mon trang + 1 Huyen Tinh + 1 khoang (loai ung voi dong 1..6) -> mon Tim; that bai 5% mat Huyen Tinh va khoang.
   Khoang ung dong k (0..5): dong chan = hien (tien to), dong le = an (hau to); khong khop he hoac loai mon thi khong kham duoc.
   Hang so cong thuc: window.RCP (tools/export_tables.py). Gia tri dong: affixLevel (magicattriblevel.txt), hang chon theo (cap HT + cap khoang)/2 (Uoc luong cach danh so hang). */
'use strict';
const RCP_R = window.RCP.recipes;
const VIO_SLOTS = 6, HT_MAX = 10, ORE_MAX = 10;
let rcRand = Math.random;                    // test thay the
const rcInt = (a, b) => a + Math.floor(rcRand() * (b - a + 1));
const rcFail = f => rcInt(0, f[1] - 1) < f[0];   // GetRandomNumber(0,10) <= 1 -> 2/11

const mats = () => { const m = S.mats || (S.mats = {}); for (const g of ['ht', 'ore', 'shard', 'misc']) m[g] = m[g] || {}; return m; };
const oreKey = (place, a, lvl) => `${place}:${a}:${lvl}`;
const oreParse = k => { const [place, a, lvl] = k.split(':').map(Number); return { place, a, lvl }; };
function matAdd(group, key, n = 1) { const m = mats()[group]; m[key] = (m[key] || 0) + n; if (m[key] <= 0) delete m[key]; }
const matHave = (group, key) => mats()[group][key] || 0;

/* ---------- hop Huyen Tinh tu 3 mon ---------- */
const FUSE_SLOTS = RCP_R.violet_fuse.inputs[0].detail;      // nhan, day chuyen, ngoc boi
const fuseCost = () => RCP_R.violet_fuse.cost.luong;
/* chong dupe / tham chieu cu: chi thao tac mon dang nam trong hanh trang (hoac dang mac, voi kham / thang cap) */
const ownedInv = it => !!it && S.inv.includes(it);
const owned = it => ownedInv(it) || (!!it && Object.values(S.eq).includes(it));
const canFuse = it => ownedInv(it) && FUSE_SLOTS.includes(it.d) && !it.set && !it.vio && !Object.values(S.eq).includes(it);
function fuse(items) {
  if (!items || items.length !== 3 || !items.every(canFuse) || new Set(items).size !== 3) return { ok: false, msg: 'Cần đúng 3 món nhẫn / dây chuyền / ngọc bội chưa mặc' };
  if (S.gold < fuseCost()) return { ok: false, msg: 'Không đủ ngân lượng' };
  const sum = items.reduce((t, i) => t + (i.lvl || 1), 0), [dmin, dmax] = RCP_R.violet_fuse.level_div;
  const lvl = clamp(rcInt(Math.max(1, Math.floor(sum / dmin)), Math.max(1, Math.floor(sum / dmax))), 1, HT_MAX);
  S.gold -= fuseCost();
  for (const i of items) S.inv.splice(S.inv.indexOf(i), 1);
  matAdd('ht', lvl);
  return { ok: true, lvl, msg: `Hợp thành Huyền Tinh Khoáng Thạch cấp ${lvl}` };
}
/* ---------- thang cap ---------- */
/* A2: mua vien bu bang vang khi thieu nguyen lieu thang cap (tien van thanh nguyen lieu) */
const htBuyCost = lvl => Math.round(12000 * (lvl + 1) * 1.3);
function buyHT(lvl, n) {
  if (lvl >= HT_MAX) return { ok: false, msg: 'Huyền Tinh đã tối đa' };
  const gia = htBuyCost(lvl) * n;
  if (S.gold < gia) return { ok: false, msg: 'Không đủ ngân lượng' };
  S.gold -= gia; matAdd('ht', lvl, n);
  return { ok: true, msg: `Mua ${n} Huyền Tinh cấp ${lvl} (−${fmt(gia)} lượng)` };
}
/* A2: bao hiem mot lan thang cap - that bai KHONG mat nguyen lieu. Tra truoc bang vang + Tinh Hong Bao Thach */
const htInsureCost = lvl => ({ van: Math.round(20000 * (lvl + 1)), thbt: 1 });
function upgradeHT(lvl, baoHiem) {
  if (lvl >= HT_MAX) return { ok: false, msg: 'Đã tối đa' };
  if (matHave('ht', lvl) < 3) return { ok: false, msg: 'Cần 3 viên cùng cấp' };
  const bh = htInsureCost(lvl);
  if (baoHiem) {
    if (S.gold < bh.van) return { ok: false, msg: `Cần ${fmt(bh.van)} lượng để mua bảo hiểm` };
    if (matHave('misc', 'thbt') < bh.thbt) return { ok: false, msg: `Cần ${bh.thbt} Tinh Hồng Bảo Thạch để mua bảo hiểm (đang có ${matHave('misc', 'thbt')})` };
    S.gold -= bh.van; matAdd('misc', 'thbt', -bh.thbt);
  }
  matAdd('ht', lvl, -3);
  if (rcFail(RCP_R.violet_up.fail)) {
    if (baoHiem) { matAdd('ht', lvl, 3); return { ok: false, lost: false, msg: 'Thăng cấp thất bại — bảo hiểm giữ lại 3 viên Huyền Tinh' }; }
    return { ok: false, lost: true, msg: 'Thăng cấp thất bại, mất nguyên liệu' };
  }
  matAdd('ht', lvl + 1);
  return { ok: true, lvl: lvl + 1, msg: `Thăng cấp thành công: Huyền Tinh cấp ${lvl + 1}${baoHiem ? ' (đã mua bảo hiểm)' : ''}` };
}
function upgradeOre(key) {
  const o = oreParse(key);
  if (o.lvl >= ORE_MAX) return { ok: false, msg: 'Đã tối đa' };
  if (!matHave('ore', key)) return { ok: false, msg: 'Không có khoáng thạch' };
  matAdd('ore', key, -1);
  if (rcFail(RCP_R.ore_up.fail)) return { ok: false, lost: true, msg: 'Thăng cấp khoáng thất bại, khoáng vỡ' };
  matAdd('ore', oreKey(o.place, o.a, o.lvl + 1));
  return { ok: true, msg: `Khoáng thạch lên cấp ${o.lvl + 1}` };
}
/* ---------- kham ---------- */
const itemKind = it => it.d === 0 ? MELEE_KIND[it.k] : it.d === 1 ? RANGE_KIND[it.k] : AFFIX_KEY[DETAIL_SLOT[it.d]];
/* hang magicattriblevel cho thuoc tinh a: cap 1..n theo thu tu cap */
const oreRows = a => J.affixLevel.filter(r => r.a === a).sort((x, y) => x.lvl - y.lvl);
function enchaseCheck(it, htLvl, key) {
  if (!owned(it)) return 'Món không còn trong hành trang';
  if (!it || it.set || !(it.d >= 0 && it.d <= 9)) return 'Món này không khảm được';
  const o = oreParse(key), n = (it.mag || []).length;
  if (n === 0 ? it.r > 0 : !it.vio) return 'Chỉ khảm đồ trắng hoặc đồ Tím chưa đủ dòng';
  if (n >= VIO_SLOTS) return 'Đã đủ 6 dòng';
  if (o.place !== n) return `Khoáng này ứng dòng ${o.place + 1}, món đang cần dòng ${n + 1}`;
  if (matHave('ht', htLvl) < 1) return 'Không có Huyền Tinh cấp này';
  if (matHave('ore', key) < 1) return 'Không có khoáng thạch này';
  const rows = oreRows(o.a); if (!rows.length) return 'Khoáng không hợp lệ';
  const row = rows[clamp(Math.floor((htLvl + o.lvl) / 2), 1, rows.length) - 1];
  if (row.s >= 0 && row.s !== it.s) return `Khoáng hệ ${SERIES[row.s]}, món hệ ${SERIES[it.s]}`;
  if (!((row.w || {})[itemKind(it)] > 0)) return 'Thuộc tính này không gắn được vào loại trang bị này';
  return row;
}
function enchase(it, htLvl, key) {
  const row = enchaseCheck(it, htLvl, key);
  if (typeof row === 'string') return { ok: false, msg: row };
  matAdd('ht', htLvl, -1); matAdd('ore', key, -1);
  if (rcInt(0, 99) < RCP_R.enchase.fail_pct) return { ok: false, lost: true, msg: 'Khảm thất bại (5%): mất Huyền Tinh và khoáng thạch' };
  const place = it.mag.length;
  const p = row.p.map(([mn, mx]) => mn === -1 && mx === -1 ? -1 : rcInt(Math.min(mn, mx), Math.max(mn, mx)));
  it.mag.push({ a: row.a, p, n: row.n, pre: place % 2 === 0 ? 1 : 0, vlv: oreParse(key).lvl });
  it.vio = 1; it.r = 3;
  if (typeof betterThanEquipped === 'function' && S.autoEquip && S.inv.includes(it) && betterThanEquipped(it)) equip(it, true);   // du dong de manh hon do dang mac thi tu mac
  return { ok: true, msg: `Khảm dòng ${place + 1}: ${row.n}` };
}
/* ---------- khoang roi ---------- */
const orePool = place => [...new Set(J.affixLevel.filter(r => r.pre === (place % 2 === 0 ? 1 : 0) && r.lvl === 1).map(r => r.a))];
/* ty le roi (tinh chinh bang tools/sim_craft.py: moi gio choi ~ 4 khoang + 5 Huyen Tinh) */
const DROP = { ore: { boss: 0.20, elite: 0.03, normal: 0.003 }, ht: { boss: 0.22, elite: 0.033, normal: 0.0033 },
  shard: { boss: 0.06, elite: 0.009, normal: 0.0003 }, wc: { boss: 0.12, elite: 0.015, normal: 0.001 }, mys: { boss: 0.12, elite: 0.015, normal: 0.001 } };
const dropP = (k, e) => DROP[k][e.cls] ?? DROP[k].normal;
function oreDrop(e) {
  const out = [];
  if (Math.random() < dropP('ore', e)) {
    // khoang roi ra phai dung duoc cho it nhat mot mon dang mac (cung he, cung loai trang bi): tranh khoang vo dung do rang buoc he / loai
    const place = rcInt(0, VIO_SLOTS - 1), worn = Object.values(S.eq).filter(it => it && it.d <= 9), tgt = worn.length ? pick(worn) : null;
    const fit = tgt ? J.affixLevel.filter(r => r.lvl === 1 && r.pre === (place % 2 === 0 ? 1 : 0) && (r.s < 0 || r.s === tgt.s) && ((r.w || {})[itemKind(tgt)] > 0)).map(r => r.a) : [];
    const a = fit.length ? pick([...new Set(fit)]) : pick(orePool(place)), lvl = clamp(Math.floor(e.L / 12) + rcInt(0, 1), 1, ORE_MAX);
    matAdd('ore', oreKey(place, a, lvl)); out.push(`Khoáng thạch dòng ${place + 1} cấp ${lvl}`);
  }
  if (Math.random() < dropP('ht', e)) { const l = clamp(Math.floor(e.L / 15) + 1, 1, HT_MAX); matAdd('ht', l); out.push(`Huyền Tinh Khoáng Thạch cấp ${l}`); }
  return out.length ? out.join(', ') : null;
}

/* ======================= MANH HOANG KIM (questkey.txt "Manh <ten> (k/N)", N = 9 / 6 / 4) ======================= */
const SHARDS = window.RCP.shards;
const shardRows = (() => { const m = new Map(); for (const r of J.sets.gold) if (SHARDS[r.n] && !m.has(r.n)) m.set(r.n, r); return m; })();
const reqOfRow = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
function shardDrop(e) {
  if (Math.random() >= dropP('shard', e)) return null;
  const cap = Math.max(S.lvl, e.L) + 10, fid = FAC[S.fac] ? FAC[S.fac].id : -1;
  let pool = [...shardRows.values()].filter(r => reqOfRow(r, 36) <= cap && sexReqOk(r.req));
  // da co manh do dang gom: 75% roi tiep manh cua mon do (tranh gom nua chung khong bao gio du bo)
  const part = pool.filter(r => matHave('shard', r.n) > 0 && matHave('shard', r.n) < SHARDS[r.n]);
  if (part.length && Math.random() < 0.75) pool = part;
  else { const mine = pool.filter(r => reqOfRow(r, 39) === fid); if (mine.length && Math.random() < 0.7) pool = mine; }
  if (!pool.length) return null;
  const r = pick(part.length && pool === part ? part.sort((a, b) => matHave('shard', b.n) - matHave('shard', a.n)).slice(0, 2) : pool); matAdd('shard', r.n); return `Mảnh ${r.n} (${matHave('shard', r.n)}/${SHARDS[r.n]})`;
}
function combineShards(name) {
  const need = SHARDS[name], row = shardRows.get(name);
  if (!need || !row) return { ok: false, msg: 'Mảnh không hợp lệ' };
  if (matHave('shard', name) < need) return { ok: false, msg: `Cần ${need} mảnh` };
  if (S.inv.length >= INV_MAX) return { ok: false, msg: 'Hành trang đầy' };
  matAdd('shard', name, -need);
  const it = makeSetItem('gold', row, 0); S.inv.push(it);
  return { ok: true, item: it, msg: `Ghép thành ${it.n}` };
}

/* ======================= BACH KIM: CHE +0 VA THANG CAP 1..10 (bang CLAUDE.md, nhan Cong dong) =======================
   Phi tinh theo "van" (1 van = 10.000 luong, Uoc luong) nhan he so kinh te idle PLAT_COST_SCALE (Uoc luong). */
const PLAT_MAKE = RCP_R['platina_make:0'], PLAT_UP = [...Array(10)].map((_, i) => RCP_R['platina_up:' + (i + 1)]);
const PLAT_COST_SCALE = 0.03, VAN = 10000, PLAT_MAX = 10;
const platCost = van => Math.round(van * VAN * PLAT_COST_SCALE);
const platByBase = (() => { const m = new Map(); for (const r of J.sets.platina) { const b = r.n.replace(/^\[[^\]]*\]\s*/, ''); (m.get(b) || m.set(b, []).get(b)).push(r); } return m; })();
const canPlatBase = it => ownedInv(it) && it.set && it.set.kind === 'gold' && platByBase.has(it.n) && !Object.values(S.eq).includes(it);
function makePlatina(a, b) {
  if (!canPlatBase(a) || !canPlatBase(b) || a === b || a.n !== b.n) return { ok: false, msg: 'Cần 2 món Hoàng Kim giống nhau, chưa mặc' };
  const need = PLAT_MAKE.inputs, cost = platCost(PLAT_MAKE.cost.van);
  if (S.gold < cost) return { ok: false, msg: 'Không đủ ngân lượng' };
  if (matHave('misc', 'wc') < need[1].qty || matHave('misc', 'mys') < need[2].qty) return { ok: false, msg: 'Thiếu Thủy Tinh Trắng / Thần Bí Khoáng Thạch' };
  S.gold -= cost; matAdd('misc', 'wc', -need[1].qty); matAdd('misc', 'mys', -need[2].qty);
  if (rcInt(0, 99) >= PLAT_MAKE.rate) return { ok: false, lost: true, msg: `Chế Bạch Kim thất bại (${100 - PLAT_MAKE.rate}%): mất nguyên liệu, Hoàng Kim giữ lại` };
  S.inv.splice(S.inv.indexOf(a), 1); S.inv.splice(S.inv.indexOf(b), 1);
  const it = makeSetItem('platina', pick(platByBase.get(a.n)), 10); it.plv = 0; S.inv.push(it);
  return { ok: true, item: it, msg: `Chế thành ${it.n}` };
}
function upgradePlatina(it) {
  if (!owned(it) || !it.set || it.set.kind !== 'platina') return { ok: false, msg: 'Chỉ thăng cấp đồ Bạch Kim đang có' };
  const lv = it.plv || 0; if (lv >= PLAT_MAX) return { ok: false, msg: 'Đã tối đa +10' };
  const u = PLAT_UP[lv], cost = platCost(u.cost.van);
  if (S.gold < cost) return { ok: false, msg: 'Không đủ ngân lượng' };
  if (matHave('misc', 'wc') < u.inputs[0].qty || matHave('misc', 'mys') < u.inputs[1].qty) return { ok: false, msg: 'Thiếu Thủy Tinh Trắng / Thần Bí Khoáng Thạch' };
  S.gold -= cost; matAdd('misc', 'wc', -u.inputs[0].qty); matAdd('misc', 'mys', -u.inputs[1].qty);
  if (rcInt(0, 99) >= u.rate) return { ok: false, lost: true, msg: `Thăng cấp thất bại (${100 - u.rate}%), giữ +${lv}` };
  it.plv = lv + 1; return { ok: true, msg: `Thăng cấp thành công: +${it.plv}` };
}
function platDrop(e) {
  const out = [];
  // B4: Tinh Hong Bao Thach - nguyen lieu MOI. Chi tinh anh / trum moi co ti le dang ke,
  // quai thuong cap cao thi rat hiem. Dung cho bao hiem Lo Huyen Tinh (A2) va qua Tai Xiu (D).
  const pThbt = e.cls === 'boss' ? 0.35 : e.cls === 'elite' ? 0.06 : (e.L >= 80 ? 0.004 : 0);
  if (pThbt > 0 && Math.random() < pThbt) { matAdd('misc', 'thbt'); out.push('1 Tinh Hồng Bảo Thạch'); }
  if (e.L < 60 && e.cls !== 'boss') return out.length ? out.join(', ') : null;
  if (Math.random() < dropP('wc', e)) { const n = rcInt(1, 2); matAdd('misc', 'wc', n); out.push(`${n} Thủy Tinh Trắng`); }
  if (Math.random() < dropP('mys', e)) { const n = rcInt(1, 3); matAdd('misc', 'mys', n); out.push(`${n} Thần Bí Khoáng Thạch`); }
  return out.length ? out.join(', ') : null;
}
const allDrops = e => [oreDrop(e), shardDrop(e), platDrop(e)].filter(Boolean);
