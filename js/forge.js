/* ======================= REN DO: CUONG HOA + TAY LUYEN (cho tieu ngan luong lau dai) =======================
   Cuong hoa +1..+10: moi cap +8% thuoc tinh goc (ENH_STEP, core.js). Gia tang x1.8 moi cap va theo cap nhan vat,
   ti le thanh cong giam dan (thap nhat 35%); that bai chi mat ngan luong, khong vo do.
   Tay luyen: gieo lai toan bo dong thuoc tinh ma thuat (dung luat magicattrib.txt: he, loai do, tien / hau to);
   do Hoang Kim / Bach Kim co dong co dinh nen khong tay luyen duoc. */
'use strict';
// QA-087: voi tran 180, do duoc cuoi game nguoi choi giu 9,18 TY luong trong khi cuong hoa +10 chi ~6,4 trieu
// -> vang mat gia tri hoan toan (tieu chi cua chinh du an: "+10 phai >= 1% ngan luong cuoi game"). Doi he so cap
// nhan vat sang BAC HAI de chi phi bam kip thu nhap.
const enhCost = it => Math.round((1000 + it.lvl * 1000 + (it.r || 0) * 2000) * Math.pow(1.8, it.enh || 0) * Math.pow(1 + S.lvl / 10, 2));
const enhChance = it => Math.max(0.35, 1 - 0.07 * (it.enh || 0));
const rerollCost = it => Math.round((500 + it.lvl * 400) * (1 + (it.mag || []).length * 0.5) * (1 + S.lvl / 15));
const canReroll = it => !it.set && !it.vio && (it.mag || []).length > 0;
function payGold(c) { if (S.gold < c) { toast('Không đủ ngân lượng'); return false; } S.gold -= c; return true; }
function enhance(it) {
  if (!owned(it)) { closeModal(); return; }
  if ((it.enh || 0) >= ENH_MAX || !payGold(enhCost(it))) return;
  if (Math.random() < enhChance(it)) { it.enh = (it.enh || 0) + 1; toast(`Cường hóa thành công: +${it.enh}`); uiSfx('learn'); log(`Cường hóa <b>${esc(it.n)}</b> lên +${it.enh}`); }
  else { toast('Cường hóa thất bại (mất ngân lượng)'); uiSfx('use'); }
  R.dirty = true; invDirty = true; save(); forgeModal(it);
}
function reroll(it) {
  if (!owned(it)) { closeModal(); return; }
  if (!canReroll(it) || !payGold(rerollCost(it))) return;
  it.mag = rollMagic(it, magicLevels(it.mag.length, it.lvl), R.P ? R.P.lucky : 0); delete it.leg;
  toast('Tẩy luyện xong'); uiSfx('learn');
  R.dirty = true; invDirty = true; save(); forgeModal(it);
}
const oreLabel = k => { const o = oreParse(k), r = oreRows(o.a)[0]; return `Dòng ${o.place + 1} (${o.place % 2 ? 'ẩn' : 'hiện'}) · ${r ? r.n : attrName(o.a)} · cấp ${o.lvl} ×${matHave('ore', k)}`; };
function afterRc(r, reopen) {
  toast(r.msg); uiSfx(r.ok ? 'learn' : 'use'); log(esc(r.msg));
  R.dirty = true; invDirty = true; save(); reopen();
}
function enchaseCard(it) {
  const n = (it.mag || []).length, can = !it.set && it.d >= 0 && it.d <= 9 && (n === 0 ? it.r === 0 : it.vio) && n < VIO_SLOTS;
  if (!can) return `<div class="card"><b>Khảm Tím</b> <small class="dim">${it.set ? 'Đồ bộ không khảm được' : n >= VIO_SLOTS ? 'Đã đủ 6 dòng' : 'Chỉ khảm đồ trắng hoặc đồ Tím chưa đủ dòng'}</small></div>`;
  const hts = Object.keys(mats().ht).map(Number).sort((a, b) => a - b);
  const ores = Object.keys(mats().ore).filter(k => oreParse(k).place === n);
  return `<div class="card"><b>Khảm Tím</b> <small class="dim">dòng ${n + 1}/6 (${n % 2 ? 'ẩn' : 'hiện'}) · thất bại 5% mất đá</small><br>
    <div class="btnrow"><select id="cHt">${hts.map(l => `<option value="${l}">Huyền Tinh cấp ${l} ×${matHave('ht', l)}</option>`).join('') || '<option value="">Chưa có Huyền Tinh</option>'}</select></div>
    <div class="btnrow"><select id="cOre">${ores.map(k => `<option value="${k}">${esc(oreLabel(k))}</option>`).join('') || `<option value="">Chưa có khoáng dòng ${n + 1}</option>`}</select></div>
    <div class="btnrow"><button class="btn" id="fKham" ${hts.length && ores.length ? '' : 'disabled'}>Khảm</button><button class="btn" id="fHtLo">Lò Huyền Tinh</button></div></div>`;
}
function platCard(it) {
  if (!it.set || it.set.kind !== 'platina') return '';
  const lv = it.plv || 0; if (lv >= PLAT_MAX) return '<div class="card"><b>Thăng cấp Bạch Kim</b> <small class="dim">Đã tối đa +10</small></div>';
  const u = PLAT_UP[lv], ok = S.gold >= platCost(u.cost.van) && matHave('misc', 'wc') >= u.inputs[0].qty && matHave('misc', 'mys') >= u.inputs[1].qty;
  return `<div class="card"><b>Thăng cấp Bạch Kim</b> <small class="dim">+${lv} → +${lv + 1} · thành công ${u.rate}% · mỗi cấp +${Math.round(PLAT_STEP * 100)}% thuộc tính gốc</small><br>
    <small>${u.inputs[0].qty} Thủy Tinh Trắng (có ${matHave('misc', 'wc')}) · ${u.inputs[1].qty} Thần Bí Khoáng Thạch (có ${matHave('misc', 'mys')}) · ${fmt(platCost(u.cost.van))} lượng</small>
    <div class="btnrow"><button class="btn" id="fPlat" ${ok ? '' : 'disabled'}>Thăng cấp</button></div></div>`;
}
/* A1: REN NGAU NHIEN — tra vang theo cap, chon 1 trong 3 muc cuoc; that bai MAT TOAN BO vang (nguoi dung chon).
   Muc 'hiem' tra ve do TIM that su (dung co che kham san co: it.vio = true, r = 3) nen la "option cao" that. */
const RF_MUC = [
  { k: 'thuong', n: 'Thường', ty: 0.60, dong: [1, 3], heSo: 1, mo: 'Xanh (1–2 dòng) hoặc Vàng (3 dòng)' },
  { k: 'kha', n: 'Khá', ty: 0.45, dong: [3, 4], heSo: 2.2, mo: 'Vàng, 3–4 dòng' },
  { k: 'hiem', n: 'Hiếm', ty: 0.30, dong: [4, 6], heSo: 6, mo: 'Tím, 4–6 dòng' },
];
const rfCost = m => Math.round((6000 + S.lvl * 700) * m.heSo * (1 + S.lvl / 60));   // QA-087: bam kip thu nhap cuoi game
function randomForge(key) {
  const m = RF_MUC.find(x => x.k === key); if (!m) return { ok: false, msg: 'Mức không hợp lệ' };
  const gia = rfCost(m);
  if (S.gold < gia) return { ok: false, msg: 'Cần ' + fmt(gia) + ' lượng' };
  if (S.inv.length >= INV_MAX) return { ok: false, msg: 'Hành trang đầy' };
  S.gold -= gia;                                   // tra truoc: that bai cung mat
  if (Math.random() > m.ty) return { ok: false, lost: true, msg: 'Rèn thất bại (thành công ' + Math.round(m.ty * 100) + '%) — mất ' + fmt(gia) + ' lượng' };
  const d = irnd(0, 9), g = J.items[d];
  if (!g || !g.list.length) return { ok: false, lost: true, msg: 'Rèn hỏng — mất ' + fmt(gia) + ' lượng' };
  const t = clamp(Math.round(S.lvl / 12), 1, 10);
  let it = null;
  for (let tr = 0; tr < 8 && !(it && sexOk(it)); tr++) it = makeItem(d, sexPart(d, pick(g.list).k), t, irnd(m.dong[0], m.dong[1]));   // không rèn ra trang phục khác giới tính (không mặc được)
  if (!it || !sexOk(it)) return { ok: false, lost: true, msg: 'Rèn hỏng — mất ' + fmt(gia) + ' lượng' };
  if (m.k === 'hiem') { it.vio = true; it.r = 3; }
  addItem(it, true, true, true);
  return { ok: true, it, msg: 'Rèn thành công: ' + it.n + ' (' + it.mag.length + ' dòng)' };
}
function forgeModal(it) {
  const max = (it.enh || 0) >= ENH_MAX;
  modal(`<h3>Rèn đồ <small>${fmt(S.gold)} lượng</small></h3>${itemHTML(it)}
    <div class="card"><b>Cường hóa</b> <small class="dim">+${it.enh || 0} / +${ENH_MAX} · mỗi cấp +${Math.round(ENH_STEP * 100)}% thuộc tính gốc</small><br>
      ${max ? '<small class="dim">Đã cường hóa tối đa</small>' : `<small>Giá ${fmt(enhCost(it))} lượng · thành công ${Math.round(enhChance(it) * 100)}% · thất bại chỉ mất ngân lượng</small>`}
      <div class="btnrow"><button class="btn" id="fEnh" ${max || S.gold < enhCost(it) ? 'disabled' : ''}>Cường hóa lên +${(it.enh || 0) + 1}</button></div></div>
    <div class="card"><b>Tẩy luyện</b> <small class="dim">gieo lại ${(it.mag || []).length} dòng thuộc tính</small><br>
      ${canReroll(it) ? `<small>Giá ${fmt(rerollCost(it))} lượng</small>` : '<small class="dim">Đồ trắng / đồ bộ / đồ Tím không tẩy luyện được</small>'}
      <div class="btnrow"><button class="btn red" id="fRe" ${canReroll(it) && S.gold >= rerollCost(it) ? '' : 'disabled'}>Tẩy luyện</button></div></div>
    ${enchaseCard(it)}${platCard(it)}`, () => {
    $('#fEnh').onclick = () => enhance(it); $('#fRe').onclick = () => reroll(it);
    const k = $('#fKham'), lo = $('#fHtLo');
    if (k) k.onclick = () => afterRc(enchase(it, +$('#cHt').value, $('#cOre').value), () => forgeModal(it));
    if (lo) lo.onclick = () => htModal();
    const pu = $('#fPlat'); if (pu) pu.onclick = () => afterRc(upgradePlatina(it), () => forgeModal(it));
  });
}
/* Lo Huyen Tinh: hop tu 3 mon, thang cap Huyen Tinh va khoang */
let htSel = [], pkSel = [];
function htModal() {
  const pool = S.inv.filter(canFuse), hts = Object.keys(mats().ht).map(Number).sort((a, b) => a - b), ores = Object.keys(mats().ore).sort();
  htSel = htSel.filter(i => pool.includes(i));
  const shards = Object.keys(mats().shard), gpool = S.inv.filter(canPlatBase); pkSel = pkSel.filter(i => gpool.includes(i));
  modal(`<h3>Lò Huyền Tinh · Mảnh · Bạch Kim <small>${fmt(S.gold)} lượng</small></h3>
    <div class="card"><b>Hợp thành</b> <small class="dim">3 món nhẫn / dây chuyền / ngọc bội → Huyền Tinh · ${fmt(fuseCost())} lượng</small>
      <div class="btnrow" id="htPool">${pool.map(i => `<button class="btn ${htSel.includes(i) ? 'red' : ''}" data-u="${i.uid}">${esc(i.n)}</button>`).join('') || '<small class="dim">Hành trang không có món phù hợp</small>'}</div>
      <div class="btnrow"><button class="btn" id="htFuse" ${htSel.length === 3 && S.gold >= fuseCost() ? '' : 'disabled'}>Hợp (${htSel.length}/3)</button></div></div>
    <div class="card"><b>Huyền Tinh</b> <small class="dim">3 viên cùng cấp → 1 viên cấp +1 (rủi ro 2/11)</small>
      ${hts.map(l => { const co = matHave('ht', l), thieu = Math.max(0, 3 - co), bh = htInsureCost(l);
        return `<div class="btnrow"><small>Cấp ${l} ×${co}</small><button class="btn" data-up="${l}" ${co >= 3 && l < HT_MAX ? '' : 'disabled'}>Thăng cấp</button><button class="btn" data-bh="${l}" ${co >= 3 && l < HT_MAX && S.gold >= bh.van && matHave('misc', 'thbt') >= bh.thbt ? '' : 'disabled'}>+BH ${fmt(bh.van)}</button>${thieu > 0 && l < HT_MAX ? `<button class="btn" data-buy="${l}" ${S.gold >= htBuyCost(l) * thieu ? '' : 'disabled'}>Mua ${thieu} viên ${fmt(htBuyCost(l) * thieu)}</button>` : ''}</div>`; }).join('') || '<small class="dim">Chưa có Huyền Tinh</small>'}
      <small class="dim">Bảo hiểm (+BH): thất bại vẫn giữ 3 viên · cần Tinh Hồng Bảo Thạch (có ${matHave('misc', 'thbt')}) rơi từ tinh anh / trùm</small></div>
    <div class="card"><b>Rèn ngẫu nhiên</b> <small class="dim">trả vàng, hỏng MẤT HẾT vàng · bậc món theo cấp nhân vật</small>
      <div class="btnrow">${RF_MUC.map(m => `<button class="btn" data-rf="${m.k}" ${S.gold >= rfCost(m) ? '' : 'disabled'}>${m.n} ${Math.round(m.ty * 100)}% · ${fmt(rfCost(m))}</button>`).join('')}</div>
      <small class="dim">${RF_MUC.map(m => m.n + ': ' + m.mo).join(' · ')}</small></div>
    <div class="card"><b>Mảnh Hoàng Kim</b> <small class="dim">đủ mảnh ghép thành món bộ (rơi từ trùm)</small>
      ${shards.map(n => `<div class="btnrow"><small>${esc(n)} ${matHave('shard', n)}/${SHARDS[n]}</small><button class="btn" data-sh="${esc(n)}" ${matHave('shard', n) >= SHARDS[n] ? '' : 'disabled'}>Ghép</button></div>`).join('') || '<small class="dim">Chưa có mảnh</small>'}</div>
    <div class="card"><b>Chế Bạch Kim</b> <small class="dim">2 Hoàng Kim giống nhau + ${PLAT_MAKE.inputs[1].qty} Thủy Tinh Trắng (có ${matHave('misc', 'wc')}) + ${PLAT_MAKE.inputs[2].qty} Thần Bí Khoáng Thạch (có ${matHave('misc', 'mys')}) + ${fmt(platCost(PLAT_MAKE.cost.van))} lượng · thành công ${PLAT_MAKE.rate}%</small>
      <div class="btnrow" id="pkPool">${gpool.map(i => `<button class="btn ${pkSel.includes(i) ? 'red' : ''}" data-p="${i.uid}">${esc(i.n)}</button>`).join('') || '<small class="dim">Hành trang chưa có Hoàng Kim bộ</small>'}</div>
      <div class="btnrow"><button class="btn" id="pkMake" ${pkSel.length === 2 && pkSel[0].n === pkSel[1].n ? '' : 'disabled'}>Chế (${pkSel.length}/2)</button></div></div>
    <div class="card"><b>Khoáng thạch</b> <small class="dim">+1 cấp, rủi ro 2/11 vỡ</small>
      ${ores.map(k => `<div class="btnrow"><small>${esc(oreLabel(k))}</small><button class="btn" data-ore="${k}" ${oreParse(k).lvl < ORE_MAX ? '' : 'disabled'}>Thăng cấp</button></div>`).join('') || '<small class="dim">Chưa có khoáng thạch (rơi từ trùm và tinh anh)</small>'}</div>`, () => {
    document.querySelectorAll('#mBody #htPool [data-u]').forEach(b => b.onclick = () => {
      const it = pool.find(i => i.uid === +b.dataset.u), k = htSel.indexOf(it);
      if (k >= 0) htSel.splice(k, 1); else if (htSel.length < 3) htSel.push(it);
      htModal();
    });
    document.querySelectorAll('#mBody [data-sh]').forEach(b => b.onclick = () => afterRc(combineShards(b.dataset.sh), htModal));
    document.querySelectorAll('#mBody #pkPool [data-p]').forEach(b => b.onclick = () => {
      const it = gpool.find(i => i.uid === +b.dataset.p), k = pkSel.indexOf(it);
      if (k >= 0) pkSel.splice(k, 1); else if (pkSel.length < 2) pkSel.push(it);
      htModal();
    });
    $('#pkMake').onclick = () => { const r = makePlatina(pkSel[0], pkSel[1]); pkSel = []; afterRc(r, htModal); };
    $('#htFuse').onclick = () => { const r = fuse(htSel.slice()); htSel = []; afterRc(r, htModal); };
    document.querySelectorAll('#mBody [data-up]').forEach(b => b.onclick = () => afterRc(upgradeHT(+b.dataset.up), htModal));
    document.querySelectorAll('#mBody [data-bh]').forEach(b => b.onclick = () => afterRc(upgradeHT(+b.dataset.bh, true), htModal));
    document.querySelectorAll('#mBody [data-buy]').forEach(b => b.onclick = () => afterRc(buyHT(+b.dataset.buy, 3 - matHave('ht', +b.dataset.buy)), htModal));
    document.querySelectorAll('#mBody [data-rf]').forEach(b => b.onclick = () => afterRc(randomForge(b.dataset.rf), htModal));
    document.querySelectorAll('#mBody [data-ore]').forEach(b => b.onclick = () => afterRc(upgradeOre(b.dataset.ore), htModal));
  });
}
