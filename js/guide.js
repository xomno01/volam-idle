/* ======================= HUONG DAN + THONG TIN GIAI THICH =======================
   1 huong dan nguoi moi (5 buoc) + goi y theo ngu canh · 2 danh sach "viec can lam" o the Giang ho · 3 chi tiet luc chien
   4 goi y cong diem co xem truoc · 5 bach khoa (vung / quai, bo Hoang Kim, nguyen lieu ren) */
'use strict';

/* ---------- 1. huong dan ---------- */
const TUT = [
  ['Hành tẩu tự động', 'Nhân vật tự đánh quái, nhặt đồ, uống thuốc và vượt ải. Bạn không cần bấm gì để chơi. Kéo joystick bên trái để tự điều khiển khi muốn; bấm ⚙ Tự động để quay lại.', 'log'],
  ['Trang bị và nhặt đồ', 'Đồ rơi trên đất, nhân vật tự nhặt món khớp bộ lọc (thẻ Hành trang). Món mạnh hơn được tự mặc (có thể tắt ở thẻ Khác). Bấm vào một món để xem so sánh và lý do thay đổi sức mạnh.', 'inv'],
  ['Điểm tiềm năng và võ công', 'Mỗi cấp bạn nhận điểm tiềm năng (thẻ Nhân vật) và điểm kỹ năng (thẻ Võ công). Dùng nút + để cộng, − để rút lại, i để xem kỹ năng làm gì, và "Gợi ý" để xem trước cách cộng hiệu quả.', 'skill'],
  ['Rèn đồ', 'Có ba chặng: Tím (hợp Huyền Tinh từ nhẫn / dây chuyền / ngọc bội rồi khảm), Hoàng Kim (gom mảnh từ trùm) và Bạch Kim. Bật "Tự động rèn đồ" ở thẻ Khác nếu không muốn bấm tay.', 'inv'],
  ['Quà, Luyện Công và sao lưu', 'Nút 🎁 có điểm danh, nhiệm vụ và thành tựu. ⚔ Luyện Công là chế độ sống sót 10 phút. Game chạy trên máy bạn: hãy vào thẻ Khác → Tải file lưu để sao lưu và chơi trên thiết bị khác.', 'more'],
];
function tutorialModal(i = 0) {
  const t = TUT[i]; if (!t) { S.tut = 1; closeModal(true); save(); return; }
  if (t[2] && curTab !== t[2] && S.fac) showTab(t[2]);
  modal(`<h3>${esc(t[0])} <small>${i + 1}/${TUT.length}</small></h3><p class="desc">${esc(t[1])}</p>
    <div class="btnrow">${i > 0 ? '<button class="btn" id="tPrev">Trước</button>' : ''}<button class="btn" id="tNext">${i === TUT.length - 1 ? 'Bắt đầu chơi' : 'Tiếp'}</button><button class="btn" id="tSkip">Bỏ qua</button></div>`, () => {
    const p = $('#tPrev'); if (p) p.onclick = () => tutorialModal(i - 1);
    $('#tNext').onclick = () => tutorialModal(i + 1);
    $('#tSkip').onclick = () => { S.tut = 1; closeModal(true); save(); };
  });
  S.tut = 1;   // da thay: khong tu hien lai (van mo lai duoc o the Khac)
}
/* Goi y theo ngu canh: moi goi y chi hien mot lan */
const HINTS = {
  pts: 'Bạn có điểm tiềm năng chưa cộng: mở thẻ Nhân vật (nút "Gợi ý" cho cách cộng hiệu quả).',
  skill: 'Có điểm kỹ năng: mở thẻ Võ công, bấm i để xem kỹ năng làm gì.',
  forge: 'Bạn vừa nhặt nguyên liệu rèn (Huyền Tinh / khoáng). Mở một món đồ → Rèn đồ → Lò Huyền Tinh, hoặc bật "Tự động rèn đồ" ở thẻ Khác.',
  gift: 'Có quà chờ nhận ở nút 🎁.',
  full: 'Hành trang gần đầy: chỉnh bộ lọc nhặt đồ ở thẻ Hành trang để bớt đồ thừa.',
};
function hint(key) {
  if (!S || !S.fac || R.quiet) return;
  const h = S.hints || (S.hints = {}); if (h[key] || !HINTS[key]) return;
  h[key] = 1; toast(HINTS[key]); log(`<span class="dim">Gợi ý: ${esc(HINTS[key])}</span>`);
}
function checkHints() {
  if (!S || !S.fac) return;
  if (S.attrPts > 0 && S.lvl >= 2) hint('pts');
  else if (S.skPts > 0 && FAC[S.fac].skills.some(id => canLearn(SK[id]))) hint('skill');
  else if (Object.keys(mats().ht).length || Object.keys(mats().ore).length) hint('forge');
  else if (S.inv.length >= INV_MAX - 5) hint('full');
}

/* ---------- 2. viec can lam ---------- */
function todoList() {
  const out = [];
  if (!S || !S.fac) return out;
  if (S.attrPts > 0) out.push({ k: 'attr', t: `${S.attrPts} điểm tiềm năng`, go: () => showTab('char') });
  if (S.skPts > 0 && FAC[S.fac].skills.some(id => canLearn(SK[id]))) out.push({ k: 'skill', t: `${S.skPts} điểm kỹ năng`, go: () => showTab('skill') });
  const better = S.inv.filter(it => betterThanEquipped(it)).length;
  if (better) out.push({ k: 'gear', t: `${better} món mạnh hơn đồ đang mặc`, go: () => showTab('inv') });
  if (giftPending()) out.push({ k: 'gift', t: 'Có quà chờ nhận', go: () => giftModal() });
  const fr = forgeReadyCounts(), fn = fr.shard + fr.up + fr.ench + fr.fuse;
  if (fn && !S.autoForge) out.push({ k: 'forge', t: `Rèn đồ: ${[fr.shard && 'ghép mảnh', fr.ench && 'khảm', fr.fuse && 'hợp Huyền Tinh', fr.up && 'thăng cấp'].filter(Boolean).join(', ')}`, go: () => htModal() });
  if (S.inv.length >= INV_MAX - 3) out.push({ k: 'full', t: 'Hành trang gần đầy', go: () => showTab('inv') });
  if (S.lvl >= 5 && Date.now() - (S.bakAt || 0) > 7 * 86400000) out.push({ k: 'bak', t: 'Nên tải file sao lưu', go: () => showTab('more') });
  return out;
}
function todoHTML() {
  const l = todoList(); if (!l.length) return '';
  return `<div class="todo" id="todoBox"><b>Việc cần làm</b>${l.map((x, i) => `<button class="chip2 todochip" data-i="${i}">${esc(x.t)}</button>`).join('')}</div>`;
}
function bindTodo() {
  const l = todoList();
  document.querySelectorAll('#todoBox .todochip').forEach(b => b.onclick = () => { const x = l[+b.dataset.i]; if (x) x.go(); });
}

/* ---------- 3. chi tiet luc chien ---------- */
function powerBreakdown() {
  const P = R.P, L = S.lvl, eDef = 8 + 3.2 * L, eAr = 30 + 9 * L, a = P.main;
  const hit = a.useAR ? hitPercent(P.ar, eDef, a.ignore) / 100 : 1, dodge = 1 - hitPercent(eAr, P.def) / 100;
  const avgRes = ELEM.reduce((t, e) => t + P.res[e], 0) / ELEM.length;
  const info = { power: power(P), dps: a.dps * hit, hit, dodge, avgRes, ehp: P.life / Math.max(0.2, 1 - avgRes / 100) / Math.max(0.3, 1 - dodge), main: a.n };
  const full = power(calc(S.eq)), slots = [];
  for (const [k, vi] of SLOTS) { const it = S.eq[k]; if (!it) continue; const eq = Object.assign({}, S.eq); delete eq[k]; slots.push({ n: vi, name: it.n, v: full / Math.max(1, power(calc(eq))) - 1 }); }
  const attrs = [];
  for (const k of Object.keys(ATTR_VI)) {
    const sv = S.attr[k]; if (!sv) continue;
    S.attr[k] = 0; let p0; try { p0 = power(calc(S.eq)); } finally { S.attr[k] = sv; }
    attrs.push({ n: ATTR_VI[k], pts: sv, v: full / Math.max(1, p0) - 1 });
  }
  return { info, slots: slots.sort((a, b) => b.v - a.v), attrs: attrs.sort((a, b) => b.v - a.v) };
}
function powerModal() {
  const b = powerBreakdown(), i = b.info, pc = v => (v * 100).toFixed(1) + '%', row = (n, v, d) => `<span>${esc(n)}${d ? ` <small class="dim">${esc(d)}</small>` : ''}</span><span class="${v > 0.0005 ? 'cp' : 'dim'}">${v > 0 ? '+' : ''}${pc(v)}</span>`;
  modal(`<h3>Lực chiến ${fmt(R.power)}</h3>
    <p class="desc">Lực chiến = DPS thực tế<sup>0,7</sup> × máu hiệu dụng<sup>0,3</sup>, tính so với quái cùng cấp (${S.lvl}). Mỗi dòng dưới đây là mức lực chiến sẽ <b>mất</b> nếu bỏ đi thành phần đó.</p>
    <div class="card stats"><span>Chiêu chính</span><span>${esc(i.main)}</span><span>DPS thực tế</span><span>${fmt(i.dps)}</span><span>Tỉ lệ trúng quái cùng cấp</span><span>${Math.round(i.hit * 100)}%</span>
      <span>Máu hiệu dụng</span><span>${fmt(i.ehp)}</span><span>Kháng trung bình</span><span>${Math.round(i.avgRes)}%</span><span>Quái bị né</span><span>${Math.round(i.dodge * 100)}%</span></div>
    <h3>Từ trang bị</h3><div class="card stats">${b.slots.map(s => row(s.n, s.v, s.name)).join('') || '<span class="dim">Chưa mặc gì</span>'}</div>
    <h3>Từ điểm tiềm năng đã cộng</h3><div class="card stats">${b.attrs.map(a => row(a.n, a.v, a.pts + ' điểm')).join('') || '<span class="dim">Chưa cộng điểm</span>'}</div>`);
}

/* ---------- 4. goi y cong diem (xem truoc, chua ap dung) ---------- */
function snapPts() { return { sk: Object.assign({}, S.sk), skPts: S.skPts, attr: Object.assign({}, S.attr), attrPts: S.attrPts, main: S.main, mainLock: S.mainLock }; }
function restorePts(s) { S.sk = Object.assign({}, s.sk); S.skPts = s.skPts; S.attr = Object.assign({}, s.attr); S.attrPts = s.attrPts; S.main = s.main; S.mainLock = s.mainLock; R.dirty = true; recalc(); }
/* Cong diem tiem nang tham lam theo luc chien (khong dong den vu khi / trang bi) */
function spendAttrsGreedy() {
  let n = 0;
  while (S.attrPts > 0) {
    const base = power(calc()); let best = 'vit', bg = -Infinity;
    for (const k of ['str', 'dex', 'vit', 'eng']) { S.attr[k]++; const g = power(calc()) - base; S.attr[k]--; if (g > bg) { bg = g; best = k; } }
    S.attr[best]++; S.attrPts--; n++;
  }
  if (n) R.dirty = true; return n;
}
function suggestPlan() {
  const s0 = snapPts(), p0 = power(calc()), plan = { skills: [], attrs: [], gainSk: 0, gainAt: 0 };
  try {
    if (S.skPts > 0) {
      const before = Object.assign({}, S.sk); autoSpendSkills();
      for (const id in S.sk) { const d = S.sk[id] - (before[id] || 0); if (d > 0) plan.skills.push({ id: +id, n: SK[id].n, d, to: S.sk[id], max: SK[id].max }); }
      plan.gainSk = power(calc()) / Math.max(1, p0) - 1;
    }
    restorePts(s0);
    if (S.attrPts > 0) {
      const before = Object.assign({}, S.attr); spendAttrsGreedy();
      for (const k of Object.keys(ATTR_VI)) { const d = S.attr[k] - before[k]; if (d > 0) plan.attrs.push({ k, n: ATTR_VI[k], d }); }
      plan.gainAt = power(calc()) / Math.max(1, p0) - 1;
    }
  } finally { restorePts(s0); }
  return plan;
}
function suggestModal() {
  const p = suggestPlan(), pc = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
  const sk = p.skills.length ? `<div class="card"><b>Võ công</b> <small class="cp">lực chiến ${pc(p.gainSk)}</small>${p.skills.map(x => `<div>${esc(x.n)}: +${x.d} → ${x.to}/${x.max}</div>`).join('')}<div class="btnrow"><button class="btn" id="sgSk">Áp dụng</button></div></div>` : '';
  const at = p.attrs.length ? `<div class="card"><b>Tiềm năng</b> <small class="cp">lực chiến ${pc(p.gainAt)}</small>${p.attrs.map(x => `<div>${x.n}: +${x.d}</div>`).join('')}<div class="btnrow"><button class="btn" id="sgAt">Áp dụng</button></div></div>` : '';
  modal(`<h3>Gợi ý cộng điểm</h3><p class="desc">Xem trước, chưa cộng gì. Gợi ý chọn cách tăng lực chiến nhiều nhất với trang bị hiện tại. Bạn vẫn rút điểm được bằng nút −.</p>${sk}${at}${!sk && !at ? '<p class="dim">Bạn không có điểm nào để cộng.</p>' : ''}`, () => {
    const a = $('#sgSk'); if (a) a.onclick = () => { autoSpendSkills(); recalc(); save(); refresh(); suggestModal(); };
    const b = $('#sgAt'); if (b) b.onclick = () => { spendAttrsGreedy(); recalc(); save(); refresh(); suggestModal(); };
  });
}

/* ---------- 5. bach khoa ---------- */
let codexTab = 'zone';
function codexModal(tab) {
  if (tab) codexTab = tab;
  const tabs = [['zone', 'Vùng và quái'], ['set', 'Bộ Hoàng Kim'], ['mat', 'Nguyên liệu rèn']];
  let body = '';
  if (codexTab === 'zone') {
    body = ZONES.map((z, i) => { const open = S.maxStage >= i * ZONE_STAGES + 1, nm = z.m.filter(t => MON[t]).map(t => esc(MON[t].n)).join(', ');
      return `<div class="card${open ? '' : ' lock'}"><b>${esc(z.n)}</b> <small class="dim">cấp ${z.lo}–${z.hi}${open ? '' : ' · chưa tới'}</small><br><small>Trùm: <b class="boss">${esc((MON[z.boss] || {}).n || '?')}</b></small><br><small class="dim">Quái: ${nm}</small><br><small>Ngũ hành: ${z.sw.map((w, k) => w ? `<span style="color:${SERIES_COL[k]}">${SERIES[k]}</span>` : '').filter(Boolean).join(' ') || '—'}</small></div>`; }).join('');
  } else if (codexTab === 'set') {
    const fid = FAC[S.fac] ? FAC[S.fac].id : -1, groups = new Map();
    for (const r of J.sets.gold) { if (!sexReqOk(r.req)) continue; const f = reqOfRow(r, 39); if (f !== fid && f !== -1) continue; (groups.get(r.grp) || groups.set(r.grp, []).get(r.grp)).push(r); }
    const list = [...groups.values()].sort((a, b) => reqOfRow(a[0], 36) - reqOfRow(b[0], 36));
    body = `<p class="desc">Bộ Hoàng Kim của phái bạn (${list.length} bộ). Mặc đủ số món của một bộ sẽ mở hết dòng ẩn của mọi trang bị. Bạch Kim chế từ 2 món Hoàng Kim giống nhau.</p>` +
      list.map(g => { const r0 = g[0], need = r0.n2 || 99; return `<div class="card"><b>${esc(r0.n.split(' ').slice(0, 2).join(' '))}…</b> <small class="dim">cấp ${reqOfRow(r0, 36)} · ${g.length} món · đủ ${need} món mở dòng ẩn</small><br><small class="dim">${g.map(r => esc(r.n)).join(' · ')}</small></div>`; }).join('') || '<p class="dim">Không có.</p>';
  } else {
    const d = k => `${Math.round(DROP[k].boss * 1000) / 10}% trùm · ${Math.round(DROP[k].elite * 1000) / 10}% tinh anh · ${Math.round(DROP[k].normal * 10000) / 100}% quái thường`;
    body = `<div class="card"><b>Chuỗi rèn</b><br><small>Tím: hợp Huyền Tinh (3 nhẫn / dây chuyền / ngọc bội, ${fmt(fuseCost())} lượng) → thăng cấp (3 viên cùng cấp → 1, rủi ro 2/11) → khảm 6 dòng (đúng hệ, thất bại 5%).<br>Hoàng Kim: gom mảnh từ trùm (9 / 6 / 4 mảnh) ghép thành món bộ.<br>Bạch Kim: 2 Hoàng Kim giống nhau + Thủy Tinh Trắng + Thần Bí Khoáng Thạch (${PLAT_MAKE.rate}% thành công), rồi thăng +1…+10.</small></div>
      <div class="card"><b>Huyền Tinh Khoáng Thạch</b> <small class="dim">đang có ${Object.values(mats().ht).reduce((a, b) => a + b, 0)}</small><br><small>Rơi: ${d('ht')}</small></div>
      <div class="card"><b>Khoáng thạch (dòng 1–6)</b> <small class="dim">đang có ${Object.values(mats().ore).reduce((a, b) => a + b, 0)}</small><br><small>Rơi: ${d('ore')}</small></div>
      <div class="card"><b>Mảnh Hoàng Kim</b> <small class="dim">đang gom ${Object.keys(mats().shard).length} loại</small><br><small>Rơi: ${d('shard')}</small></div>
      <div class="card"><b>Thủy Tinh Trắng / Thần Bí Khoáng Thạch</b> <small class="dim">${matHave('misc', 'wc')} / ${matHave('misc', 'mys')}</small><br><small>Quái cấp ≥ 60 hoặc trùm. Rơi: ${d('wc')}</small></div>`;
  }
  modal(`<h3>Bách khoa</h3><div class="dtabs">${tabs.map(([k, n]) => `<button data-c="${k}" class="${k === codexTab ? 'on' : ''}">${n}</button>`).join('')}</div><div class="codex">${body}</div>`, () => {
    document.querySelectorAll('#mBody .dtabs [data-c]').forEach(b => b.onclick = () => codexModal(b.dataset.c));
  });
}
