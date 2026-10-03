/* ======================= DO HOANG KIM / BACH KIM (KItemGenerator::Gen_GoldEquipment, KItemList) ======================= */
'use strict';
const GOLD_EXT = 2; // MAX_ITEM_MAGICATTRIB (8) - MAX_ITEM_NORMAL_MAGICATTRIB (6): 2 dong mo rong theo bo
/* gia tri = min + (max - min) * cap_sinh / MAX_ITEM_LUCK (10) */
function geValue(idx, g) {
  const m = J.ge[idx]; if (!m) return null;
  return { a: m.a, p: m.p.map(([lo, hi]) => (lo === -1 && hi === -1 ? -1 : Math.round(lo + (hi - lo) * g / 10))), pre: 1 };
}
function makeSetItem(kind, row, luck) {
  const g = () => clamp(irnd(Math.min(10, luck), 10), 0, 10);
  const it = { uid: S.uid++, d: row.d, k: row.k, n: row.n, ic: row.ic || '', lvl: row.lvl, s: row.s, price: row.price,
    base: row.base.map(x => x.slice()), req: row.req.map(x => x.slice()), r: kind === 'gold' ? 4 : 5,
    set: { kind, grp: row.grp, n1: row.n1 || 99, n2: row.n2 || 99, sid: row.sid } };
  it.mag = row.mag.map(i => geValue(i, g())).filter(Boolean);
  it.ext = row.ext.map(i => geValue(i, g())).filter(Boolean);
  return it;
}
/* Roi do bo: chu yeu tu trum; uu tien bo cua mon phai nhan vat (requiremenpai), yeu cau cap khong qua xa cap nhan vat */
function rollSetDrop(e) {
  // QA-043/QA-065: can lai theo dung "Kinh te do" trong CONG_THUC.md / DANH_GIA.md muc 6:
  //   trum vung 1,5% + 0,1%/vung; tinh anh 0,1%; quai thuong 0%. Ma cu de 4% + 0,3%/vung va 0,015% -> gap ~2,7 lan.
  // QA-080/QA-081: do bo truoc day roi 1-5 mon/GIO (do 1 gio o cap 20/50/90) -> hoan tat nhieu bo moi gio,
  // "peak" som va het thu de kham pha. Ha ti le ~5 lan va thu hep cua so cap tu +6 xuong +2 de bo roi ra
  // GAN CAP NGUOI CHOI (399 nhom bo trai tu cap 0 den 180 nen cua so rong lam loang pool).
  const chance = e.cls === 'boss' ? 0.001 + zoneIdx(Math.min(S.stage, STAGES)) * 0.0002 : e.cls === 'elite' ? 0.0001 : 0;
  if (Math.random() >= chance) return null;
  // QA-080: 'e.L >= 100' KHONG BAO GIO dung (quai toi da cap MAX_LEVEL = 99) -> nhanh Bach Kim la CODE CHET,
  // do 0 mon Bach Kim/gio. Doi sang moc cap nhan vat.
  const kind = S.lvl >= REBORN_LV && Math.random() < 0.25 ? 'platina' : 'gold';
  const lvCap = S.lvl + 2, fid = FAC[S.fac] ? FAC[S.fac].id : -1;
  const reqOf = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  let pool = J.sets[kind].filter(r => reqOf(r, 36) <= lvCap && sexReqOk(r.req));
  const mine = pool.filter(r => reqOf(r, 39) === fid);
  if (mine.length && Math.random() < 0.7) pool = mine;
  if (!pool.length) return null;
  return makeSetItem(kind, pick(pool), R.P ? Math.min(10, Math.floor(R.P.lucky / 10)) : 0);
}
/* IsEnoughToActive: co mot bo dang mac du NeedToActive2 mon -> mo het dong an cua MOI trang bi */
function setCounts(eq) {
  const c = {};
  for (const k in eq) {
    const it = eq[k]; if (!it || !it.set || k === 'horse') continue;
    if (k === 'ring1' && eq.ring2 && eq.ring2.set && eq.ring2.set.grp === it.set.grp && eq.ring2.set.sid === it.set.sid) continue; // 2 nhan giong nhau tinh 1
    c[it.set.grp] = (c[it.set.grp] || 0) + 1;
  }
  return c;
}
function enoughToActive(eq) {
  const c = setCounts(eq);
  for (const k in eq) { const it = eq[k]; if (it && it.set && c[it.set.grp] >= it.set.n2) return true; }
  return false;
}
/* GetGoldEquipEnhance: so dong mo rong = so mon cung bo / NeedToActive1 (du bo hoac ngua: ca 2) */
function goldEnhance(it, eq) {
  const slot = slotOfEquipped(it, eq); if (!slot) return 0;
  if (slot === 'horse' || enoughToActive(eq)) return GOLD_EXT;
  return Math.min(GOLD_EXT, Math.floor((setCounts(eq)[it.set.grp] || 0) / Math.max(1, it.set.n1)));
}
function setMembers(it) { return J.sets[it.set.kind].filter(r => r.grp === it.set.grp); }
