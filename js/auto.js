/* ======================= TU DONG REN DO (giam so lan bam) =======================
   Bat o the Khac (S.autoForge, mac dinh TAT). Chay moi 30 giay choi va khi vao lai game, dung dung ham ren thu cong (recipes.js)
   nen giu nguyen luat, ti le va rui ro. Thu tu: ghep manh Hoang Kim -> kham Tim vao do dang thieu dong -> hop Huyen Tinh tu do thua
   -> thang cap Huyen Tinh du 3 vien. Khong dung nguyen lieu cua Bach Kim, khong thang cap khoang (rui ro vo). */
'use strict';
const AUTO_FORGE_MAX = { fuse: 5, ench: 6, up: 8 };
function enchaseTargets() {
  const worn = Object.values(S.eq).filter(Boolean), pool = worn.concat(S.inv);
  return pool.filter(it => !it.set && it.d >= 0 && it.d <= 9 && (it.mag || []).length < VIO_SLOTS && ((it.mag || []).length === 0 ? it.r === 0 : it.vio))
    .sort((a, b) => (worn.includes(b) - worn.includes(a)) || (b.lvl - a.lvl));
}
/* Tim mot cap (mon, cap Huyen Tinh, khoang) kham duoc ngay, hoac null */
function findEnchase() {
  const hts = Object.keys(mats().ht).map(Number).sort((a, b) => b - a), ores = Object.keys(mats().ore);
  if (!hts.length || !ores.length) return null;
  for (const it of enchaseTargets()) {
    const n = it.mag.length;
    for (const key of ores) {
      if (oreParse(key).place !== n) continue;
      for (const ht of hts) if (typeof enchaseCheck(it, ht, key) !== 'string') return { it, ht, key };
    }
  }
  return null;
}
const forgeReadyCounts = () => ({
  shard: Object.keys(mats().shard).filter(n => SHARDS[n] && matHave('shard', n) >= SHARDS[n]).length,
  up: Object.keys(mats().ht).map(Number).filter(l => l < HT_MAX && matHave('ht', l) >= 3).length,
  ench: findEnchase() ? 1 : 0,
  fuse: fusePool().length >= 3 && S.gold >= fuseCost() * 2 ? 1 : 0,
});
/* Do thua co the hop Huyen Tinh: nhan / day chuyen / ngoc boi trong tui, khong phai do manh hon do dang mac */
function fusePool() { return S.inv.filter(canFuse).filter(x => !betterThanEquipped(x)).sort((a, b) => itemPower(a) - itemPower(b)); }
function autoForge() {
  if (!S || !S.fac || !S.autoForge) return null;
  const st = { shard: 0, ench: 0, fuse: 0, up: 0, fail: 0 };
  for (const n of Object.keys(mats().shard)) if (SHARDS[n] && matHave('shard', n) >= SHARDS[n] && S.inv.length < INV_MAX) { if (combineShards(n).ok) st.shard++; }
  for (let g = 0; g < AUTO_FORGE_MAX.ench; g++) { const f = findEnchase(); if (!f) break; const r = enchase(f.it, f.ht, f.key); if (r.ok) st.ench++; else st.fail++; }
  for (let g = 0; g < AUTO_FORGE_MAX.fuse; g++) { const p = fusePool().slice(0, 3); if (p.length < 3 || S.gold < fuseCost() * 2 || !fuse(p).ok) break; st.fuse++; }
  let ups = 0;
  for (let l = 1; l < HT_MAX; l++) while (matHave('ht', l) >= 3 && ups < AUTO_FORGE_MAX.up) { ups++; const r = upgradeHT(l); if (r.ok) st.up++; else st.fail++; }
  const parts = [];
  if (st.shard) parts.push(`ghép ${st.shard} món Hoàng Kim`);
  if (st.ench) parts.push(`khảm ${st.ench} dòng Tím`);
  if (st.fuse) parts.push(`hợp ${st.fuse} Huyền Tinh`);
  if (st.up) parts.push(`thăng cấp ${st.up} Huyền Tinh`);
  if (st.fail) parts.push(`${st.fail} lần thất bại`);
  if (parts.length) { R.dirty = true; invDirty = true; log(`<span class="dim">Tự rèn: ${parts.join(', ')}.</span>`); }
  return st;
}

/* ======================= TU MUA VU KHI O BIEN KINH =======================
   Vu khi roi rat it (3-5 mon / 20 phut dau) nen phai noi cong / doc (Ngu Doc, Con Lon...), co sat thuong chieu nhan theo bac vu khi (weaponTierMul),
   nhieu khi khong co vu khi moi trong khi ngan luong nam khong. Moi 30 giay choi: neu cua hang ban vu khi DUNG LOAI phai, du cap, du yeu cau
   (hoac thieu it va dang bat tu cong diem), manh hon vu khi tot nhat dang co it nhat 25% va gia khong qua 60% ngan luong -> mua va mac.
   Tat o the Khac (S.autoBuy). Khong mua khi dang co do tot hon trong tui. */
const AUTO_BUY_GAIN = 1.25, AUTO_BUY_BUDGET = 0.6;
function bestOwnedWeaponDmg() {
  const f = FAC[S.fac]; let best = 0;
  for (const it of S.inv.concat(S.eq.weapon ? [S.eq.weapon] : []))
    if (it.d <= 1 && sexOk(it) && (it.req || []).every(([id, v]) => id !== 36 || S.lvl >= v) && (f.wcode < 0 || weaponCode({ weapon: it }) === f.wcode)) best = Math.max(best, weaponDmg(it));   // tinh ca vu khi dang thieu diem tiem nang (da mua, cho cong diem): khong mua lai
  return best;
}
function autoBuyWeapon() {
  const f = FAC[S.fac]; if (!f || S.autoBuy === false || f.wcode < 0 || !J.shops.weapon) return null;
  if (S.inv.length >= INV_MAX) return null;
  const have = bestOwnedWeaponDmg(); let pick = null;
  for (const g of J.shops.weapon.items) {
    if (g.g === 1) continue;
    const it = goodsItem(g); if (!it || it.d > 1 || weaponCode({ weapon: it }) !== f.wcode || !sexOk(it)) continue;
    const price = shopPrice(g), dmg = weaponDmg(it);
    if (price > S.gold * AUTO_BUY_BUDGET || dmg < have * AUTO_BUY_GAIN) continue;
    const lv = (it.req.find(q => q[0] === 36) || [0, 0])[1]; if (lv > S.lvl) continue;
    if ((it.req || []).some(([id, v]) => (id === 37 || id === 39) && v >= 0 && !reqOk(it))) continue;
    const need = Object.values(reqDeficit(it)).reduce((a, b) => a + b, 0);
    if (need > 0 && !(S.autoPts === true && need <= S.attrPts + PTS_PER_LEVEL * REQ_SAVE_LEVELS)) continue;
    if (!pick || dmg > pick.dmg) pick = { g, dmg, price, need };
  }
  if (!pick) return null;
  const it = makeItem(pick.g.d, pick.g.k, pick.g.lvl, 0); if (!it) return null;
  it.s = shopSeries(pick.g, it); S.gold -= pick.price;
  addItem(it, true, true, true);
  log(`<span class="dim">Tự mua <b>${esc(it.n)}</b> ở Biện Kinh (${fmt(pick.price)} lượng).</span>`);
  if (S.autoPts === true) autoSpendAttrs();
  autoEquipAll(); R.dirty = true; invDirty = true;
  return it;
}
