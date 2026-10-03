/* ======================= GIAO DIEN (5 the) ======================= */
'use strict';
let curTab = 'log', invDirty = true;
function log(h) { if (R.quiet) return; R.logs.unshift(h); if (R.logs.length > 40) R.logs.pop(); R.logDirty = true; }
let toastT; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }
function modal(html, bind, locked) { $('#mBody').innerHTML = html; $('#modal').classList.remove('hidden'); $('#modal').dataset.locked = locked ? '1' : ''; if (bind) bind(); try { $('#modal .mbox').focus({ preventScroll: true }); } catch (e) { /* bo qua */ } }
function closeModal(force) { if ($('#modal').dataset.locked && !force) return; $('#modal').classList.add('hidden'); }

/* ---------- tui do ---------- */
/* Do thua: khong dung duoc va khong manh hon do dang mac cung o (tru do bo, do Tim dang kham, Bach Kim); vu khi sai loai cua phai.
   Nhan / day chuyen / ngoc boi yeu van giu toi da 6 mon lam nguyen lieu hop Huyen Tinh. */
const FUSE_KEEP = 6;
function isJunk(it) {
  if (it.set || it.vio || it.plv) return false;
  if (!sexOk(it)) return true;                         // trang phuc khac gioi tinh: khong bao gio mac duoc
  const f = FAC[S.fac];
  if (DETAIL_SLOT[it.d] === 'weapon' && f && f.wcode >= 0 && weaponCode({ weapon: it }) !== f.wcode) return true;
  const eq = S.eq[slotFor(it)]; if (!eq || betterThanEquipped(it) || itemPower(it) > itemPower(eq) * 0.85) return false;
  if (FUSE_SLOTS.includes(it.d) && S.inv.filter(x => FUSE_SLOTS.includes(x.d) && !x.set && !x.vio).length < FUSE_KEEP) return false;
  return true;
}
/* Don do thua da nhat truoc (do manh len thi do cu thanh thua): moi 30 giay choi va khi vao lai game */
function sweepJunk() {
  if (S.autoJunk === false) return 0;
  let n = 0;
  for (let guard = 0; guard < INV_MAX; guard++) {
    const j = S.inv.filter(isJunk).sort((a, b) => itemPower(a) - itemPower(b))[0]; if (!j) break;
    S.inv.splice(S.inv.indexOf(j), 1); S.gold += itemValue(j); n++;
  }
  if (n) invDirty = true; return n;
}
function addItem(it, quiet, picked, keep) {
  if (!picked && !lootMatch(it)) { S.gold += itemValue(it); return false; } // khong qua mat dat (offline): mon khong khop bo loc tu ban
  if (S.inv.length >= INV_MAX && (it.set || it.vio || it.plv)) makeRoom(it, true);   // do quy (bo / Tim / Bach Kim): nhuong cho bang cach ban mon yeu nhat
  if (S.inv.length >= INV_MAX) { S.gold += itemValue(it); if (!quiet) log('<span class="dim">Túi đầy, tự bán ' + esc(it.n) + '</span>'); return false; }
  if (!keep && S.autoJunk !== false && isJunk(it)) { S.gold += itemValue(it); return false; }   // do thua: tu ban, khong chat hanh trang
  S.inv.unshift(it); invDirty = true;
  if (!quiet && it.r >= 2) log(`Nhặt được <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span>`);
  if (S.autoEquip && betterThanEquipped(it)) equip(it, true);
  return true;
}
/* So sanh bang luc chien that (tinh ca mon vu khi cua phai, khang, ...), khong chi chi so cua mon do */
function equipGain(it) {
  if (!reqOk(it)) return -1;
  const eq = Object.assign({}, S.eq); eq[slotFor(it)] = it;
  return power(calc(eq)) / Math.max(1, power(calc(S.eq))) - 1;
}
// tu mac chi doi vu khi cung loai voi mon vu khi cua phai (Con cho Thieu Lam, am khi cho Duong Mon...);
// nguoi choi van mac tay duoc moi loai
function betterThanEquipped(it) {
  const f = FAC[S.fac];
  if (DETAIL_SLOT[it.d] === 'weapon' && f && f.wcode >= 0 && weaponCode({ weapon: it }) !== f.wcode) return false;
  return equipGain(it) > 0.01;
}
function equip(it, quiet) {
  if (!reqOk(it)) { if (!quiet) toast('Chưa mặc được: ' + reqProblems(it).join('; ')); return; }
  const slot = slotFor(it), old = S.eq[slot];
  S.inv = S.inv.filter(x => x !== it); if (old) S.inv.unshift(old);
  S.eq[slot] = it; R.dirty = true; invDirty = true; if (!quiet) uiSfx(it.d <= 1 ? 'equipWeapon' : 'equipCloth');
  if (!quiet) { closeModal(); refresh(); }
}
function unequip(slot) { const it = S.eq[slot]; if (!it) return; if (S.inv.length >= INV_MAX) { toast('Túi đầy'); return; } delete S.eq[slot]; S.inv.unshift(it); R.dirty = true; invDirty = true; closeModal(); refresh(); }
/* Ban mon khong khop bo loc (nut trong the Hanh trang, cua hang, Tho Dia Phu): khong bao gio ban do bo, do Tim dang kham, Bach Kim da thang cap */
const sellProtected = it => !!(it.set || it.vio || it.plv);
function sellUnmatched() {
  const w = S.inv.filter(i => !lootMatch(i) && !sellProtected(i)); let g = 0;
  for (const i of w) g += itemValue(i);
  S.gold += g; S.inv = S.inv.filter(i => !w.includes(i)); invDirty = true;
  return { n: w.length, gold: g, kept: S.inv.filter(i => !lootMatch(i)).length };
}
function sell(it) { if (!S.inv.includes(it)) { closeModal(); return; } S.inv = S.inv.filter(x => x !== it); S.gold += itemValue(it); invDirty = true; closeModal(); refresh(); }
function findItem(uid) { uid = +uid; return S.inv.find(i => i.uid === uid) || Object.values(S.eq).find(i => i && i.uid === uid) || (R.ground.find(d => d.it.uid === uid) || {}).it; }
function itemCell(it) {
  if (!it) return '';
  return `<button class="it r${it.r}${reqOk(it) ? '' : ' bad'}" data-uid="${it.uid}"${reqOk(it) ? '' : ` title="${esc('Chưa mặc được: ' + reqProblems(it).join('; '))}"`}>${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}<i>${it.lvl}</i>${it.s >= 0 ? `<b class="s5" style="background:${SERIES_COL[it.s]}"></b>` : ''}${betterThanEquipped(it) && S.inv.includes(it) ? '<em>▲</em>' : ''}</button>`;
}
function itemHTML(it) {
  return `<div class="idet"><div class="pic r${it.r}">${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}</div><div><h4 style="color:${RAR_COL[it.r]}">${esc(it.n)}${it.enh ? ` <span class="enh">+${it.enh}</span>` : ''}</h4>
  <small class="dim">${esc(J.items[it.d].n)} · cấp ${it.lvl}${it.s >= 0 ? ` · <span style="color:${SERIES_COL[it.s]}">hệ ${SERIES[it.s]}</span>` : ''}</small></div></div>
  <div class="sl">${itemLines(it).map(([k, t]) => `<div class="${k}">${esc(t)}</div>`).join('')}</div>`;
}
/* Cong diem tiem nang de du yeu cau Suc manh / Than phap / Sinh khi / Noi cong cua mon do (neu du diem) */
function fixReqPoints(it) {
  const d = reqDeficit(it), need = Object.values(d).reduce((a, b) => a + b, 0);
  if (!need) return false; if (S.attrPts < need) { toast(`Cần ${need} điểm tiềm năng, đang có ${S.attrPts}`); return false; }
  for (const k in d) { S.attr[k] += d[k]; S.attrPts -= d[k]; }
  R.dirty = true; recalc(); toast('Đã cộng điểm để đủ điều kiện'); return true;
}
function cmpLines(it, slot) {
  if (slot) return '';
  const ok = reqOk(it), c = equipCompare(it, !ok), col = v => v > 0.0005 ? 'cp' : v < -0.0005 ? 'cn' : 'dim';
  const row = (n, v, t) => `<span class="${col(v)}">${n} ${t}</span>`;
  const head = ok ? 'So với đang mặc' : 'Nếu đủ điều kiện, so với đang mặc';
  const probs = ok ? [] : reqProblems(it);
  const wrong = DETAIL_SLOT[it.d] === 'weapon' && FAC[S.fac] && FAC[S.fac].wcode >= 0 && weaponCode({ weapon: it }) !== FAC[S.fac].wcode;
  const need = Object.values(reqDeficit(it)).reduce((a, b) => a + b, 0), onlyAttr = probs.length > 0 && probs.length === Object.keys(reqDeficit(it)).length;
  return `<div class="cmp2"><small class="dim">${head}:</small><div class="cmpv">${row('Sức mạnh', c.gain, pctTxt(c.gain))} ${row('DPS', c.dps, pctTxt(c.dps))} ${row('Sinh lực', c.life, numTxt(c.life))} ${row('Né', c.def, numTxt(c.def))} ${row('Kháng TB', c.res, numTxt(c.res) + '%')}</div>
    ${probs.length ? `<div class="reqbad"><b>Chưa mặc được, thiếu:</b><br>${probs.map(esc).join('<br>')}${onlyAttr ? `<br><small>Cần ${need} điểm tiềm năng${S.attrPts >= need ? ` (đang có ${S.attrPts}): bấm "Cộng điểm" để đủ điều kiện` : `, đang có ${S.attrPts}: lên cấp thêm`}.</small>` : ''}</div>` : ''}
    <div class="reqnote"><b>Vì sao:</b><br>${c.why.map(esc).join('<br>')}</div>
    ${wrong ? '<div class="reqnote">Sai loại vũ khí của môn phái: tự mặc sẽ bỏ qua, bạn vẫn mặc tay được.</div>' : ''}</div>`;
}
/* Quet toan bo hanh trang: mac mon cho suc manh that tang nhieu nhat, lap lai den khi het mon manh hon (sau khi len cap / cong diem / roi do) */
function autoEquipAll() {
  if (!S.autoEquip) return 0; let n = 0;
  for (let g = 0; g < 14; g++) {
    let best = null, bg = 0.01;
    for (const it of S.inv) {
      if (!reqOk(it)) continue;
      const f = FAC[S.fac]; if (DETAIL_SLOT[it.d] === 'weapon' && f && f.wcode >= 0 && weaponCode({ weapon: it }) !== f.wcode) continue;
      const gn = equipGain(it); if (gn > bg) { bg = gn; best = it; }
    }
    if (!best) break; equip(best, true); n++;
  }
  if (n) { invDirty = true; R.dirty = true; } return n;
}
function itemModal(it, slot) {
  const cur = !slot && S.eq[slotFor(it)];
  modal(`${itemHTML(it)}${cmpLines(it, slot)}${cur ? `<div class="cmp"><small class="dim">Đang mặc:</small>${itemHTML(cur)}</div>` : ''}
    <div class="btnrow">${slot ? `<button class="btn" id="bUn">Tháo</button>` : `<button class="btn" id="bEq" ${reqOk(it) ? '' : 'disabled'}>Trang bị</button>${!reqOk(it) && Object.keys(reqDeficit(it)).length && reqProblems(it).length === Object.keys(reqDeficit(it)).length ? '<button class="btn" id="bReqPts">Cộng điểm</button>' : ''}<button class="btn red" id="bSell">Bán (${fmt(itemValue(it))})</button>${S.inv.includes(it) ? '<button class="btn" id="bStashIt">Gửi kho</button>' : ''}`}${findItem(it.uid) && it.d <= 10 ? '<button class="btn" id="bForge">Rèn đồ</button>' : ''}</div>`,
  () => { const b1 = $('#bEq'), b2 = $('#bSell'), b3 = $('#bUn'), b4 = $('#bForge'); const bs = $('#bStashIt'); if (bs) bs.onclick = () => { const r = stashDeposit(it); toast(r.msg); if (r.ok) { closeModal(); refresh(); } }; const bp = $('#bReqPts'); if (bp) bp.onclick = () => { if (fixReqPoints(it)) { if (reqOk(it)) equip(it); else itemModal(it, slot); } };
    if (b1) b1.onclick = () => equip(it); if (b2) b2.onclick = () => sell(it); if (b3) b3.onclick = () => unequip(slot); if (b4) b4.onclick = () => forgeModal(it); });
}

/* ---------- the: chien truong ---------- */
function renderLog() {
  const z = zoneOf(Math.min(S.stage, STAGES));
  const zl = ZONES.map((q, i) => {
    const first = i * ZONE_STAGES + 1, open = S.maxStage >= first, cur = zoneIdx(Math.min(S.stage, STAGES)) === i;
    return `<button class="zrow${cur ? ' cur' : ''}${open ? '' : ' lock'}" data-z="${i}" ${open ? '' : 'disabled'}><b>${esc(q.n)}</b><span>Cấp ${q.lo}–${q.hi}</span></button>`;
  }).join('');
  $('#t-log').innerHTML = `${todoHTML()}<div class="card stagectl"><div><b>${esc(z.n)}</b> · Ải ${inZone(S.stage)}/${ZONE_STAGES}${isBossStage(S.stage) ? ' <span class="boss">(Trùm)</span>' : ''}<br><small class="dim">Quái cấp ${stageLevel(S.stage)} · ngũ hành: ${z.sw.map((w, i) => w ? `<span style="color:${SERIES_COL[i]}">${SERIES[i]}</span>` : '').filter(Boolean).join(' ')}</small></div>
    <div class="row"><button class="btn sm" id="bPrev">◀</button><button class="btn sm ${S.push ? 'on' : ''}" id="bPush">${S.push ? 'Vượt ải' : 'Luyện công'}</button><button class="btn sm" id="bNext" ${S.stage < S.maxStage ? '' : 'disabled'}>▶</button></div></div>
    <div class="log" id="logBox">${R.logs.map(l => `<div>${l}</div>`).join('')}</div>
    <h3>Bản đồ luyện công</h3><div class="zlist">${zl}</div>`;
  bindTodo();
  $('#bPrev').onclick = () => gotoStage(S.stage - 1);
  $('#bNext').onclick = () => gotoStage(S.stage + 1);
  $('#bPush').onclick = () => { S.push = !S.push; renderLog(); };
  document.querySelectorAll('.zrow').forEach(b => b.onclick = () => gotoStage(+b.dataset.z * ZONE_STAGES + 1));
}
function renderLogOnly() { const b = $('#logBox'); if (b) b.innerHTML = R.logs.map(l => `<div>${l}</div>`).join(''); }
function gotoStage(st) { st = clamp(st, 1, S.maxStage); if (st === S.stage) return; S.stage = st; S.wave = 1; S.push = false; R.enemies = []; R.spawnT = 0.3; refresh(); }

/* ---------- the: nhan vat ---------- */
const ATTR_VI = { str: 'Sức mạnh', dex: 'Thân pháp', vit: 'Sinh khí', eng: 'Nội công' };
function renderChar() {
  const P = R.P, f = FAC[S.fac];
  const eq = SLOTS.map(([k, vi]) => `<div class="slot" data-slot="${k}">${S.eq[k] ? itemCell(S.eq[k]) : `<span>${vi}</span>`}</div>`).join('');
  const attrs = Object.keys(ATTR_VI).map(k => `<div class="attr"><span>${ATTR_VI[k]}</span><b>${Math.round(P[k])}</b><span class="pm"><button class="plus" data-a="${k}" ${S.attrPts ? '' : 'disabled'}>+</button><button class="minus" data-a="${k}" title="Rút lại 1 điểm" ${S.attr[k] > 0 ? '' : 'disabled'}>−</button></span></div>`).join('');
  const res = ELEM.map(e => `<span>Kháng ${ELEM_VI[e]}</span><span>${Math.round(P.res[e])}%</span>`).join('');
  $('#t-char').innerHTML = `<div class="card"><b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b> · hệ ${SERIES[f.series]} · Cấp ${S.lvl}<br><small class="dim">Lực chiến ${fmt(R.power)}</small> <button class="btn sm" id="bPower">Chi tiết</button></div>
    <div class="eqgrid">${eq}</div>
    <p class="dim small">Dòng ẩn (2, 4, 6) của mỗi món mở khi hệ nhân vật hoặc 2 món liên kết <b>tương sinh</b> với hệ món đó (Kim→Thủy→Mộc→Hỏa→Thổ→Kim). Đang mở: ${SLOTS.filter(([k]) => S.eq[k] && S.eq[k].mag.length > 1).map(([k, vi]) => `${vi} ${hiddenActive(S.eq[k])}/${Math.floor(S.eq[k].mag.length / 2)}`).join(' · ') || '—'}</p>
    <h3>Tiềm năng <small>${S.attrPts} điểm</small> <button class="btn sm" id="bSugAt">Gợi ý</button></h3><div class="card">${attrs}</div>
    <h3>Chỉ số</h3><div class="card stats">
      <span>Sinh lực</span><span>${fmt(P.life)}</span><span>Nội lực</span><span>${fmt(P.mana)}</span>
      <span>Sát thương vũ khí</span><span>${Math.round(P.wmin)}–${Math.round(P.wmax)}</span>
      <span>Chiêu chính</span><span>${esc(P.main.n)} (${fmt(P.main.tot)})</span>
      <span>Chính xác</span><span>${Math.round(P.ar)}</span><span>Né tránh</span><span>${Math.round(P.def)}</span>
      <span>Chí mạng</span><span>${Math.round(P.main.crit)}%</span><span>Tốc độ đánh</span><span>${P.aspd.toFixed(2)}</span>${res}</div>`;
  document.querySelectorAll('#t-char .plus').forEach(b => b.onclick = () => { if (!S.attrPts) return; S.attrPts--; S.attr[b.dataset.a]++; R.dirty = true; recalc(); renderChar(); });
  $('#bPower').onclick = powerModal; $('#bSugAt').onclick = suggestModal;
  document.querySelectorAll('#t-char .minus').forEach(b => b.onclick = () => unspendAttr(b.dataset.a));
  document.querySelectorAll('#t-char .slot .it').forEach(b => b.onclick = () => itemModal(findItem(b.dataset.uid), b.parentNode.dataset.slot));
}

/* ---------- the: ky nang ---------- */
/* Rut lai 1 diem ky nang (cong nham): tra diem, bo chieu khoi o / chieu chinh khi ve 0 */
function unlearnSkill(id) {
  const L = S.sk[id] || 0; if (!L) return false;
  if (L <= 1) delete S.sk[id]; else S.sk[id] = L - 1;
  S.skPts++;
  if (!S.sk[id] && S.main === id) S.mainLock = false;
  R.dirty = true; recalc(); fillSlots(); renderSkill(); renderPad(); updateDots(); save();
  toast(`Rút 1 điểm: ${SK[id].n} ${S.sk[id] || 0}/${SK[id].max}`);
  return true;
}
/* Rut lai 1 diem tiem nang */
function unspendAttr(k) {
  if (!(S.attr[k] > 0)) return false;
  S.attr[k]--; S.attrPts++; R.dirty = true; recalc(); renderChar(); updateDots(); save(); return true;
}
const SK_HIDE = /^(skill_attackradius|missle_|skill_cost_v|skill_eventskilllevel|addskilldamage|skill_)/;
function skillEffectLines(s, L) {
  const out = [];
  for (const name in s.attr) {
    if (SK_HIDE.test(name) || !J.attrDesc[name]) continue;
    const p = skVal(s, name, L); if (!p) continue;
    const t = attrText(name, p); if (t && !/^\s*$/.test(t)) out.push(t);
  }
  return out;
}
/* Thong tin ky nang: mo ta, yeu cau, hieu qua o cap hien tai va cap ke tiep, sat thuong / noi luc / tam danh */
function skillModal(id) {
  const s = SK[id]; if (!s) return;
  const L = S.sk[id] || 0, act = isAttack(s), Le = skillLv(id), show = Math.max(1, Le), next = L < s.max ? L + 1 : 0;   // QA-088: Le = cap HIEU DUNG (da hoc + thuong trang bi)
  const lines = (lv) => skillEffectLines(s, lv).map(t => `<div>${esc(t)}</div>`).join('') || '<div class="dim">—</div>';
  let atk = '';
  if (act) {
    const a = activeInfo(R.P, s, show);   // QA-088: dung cap hieu dung, khop voi P.main luc chien dau
    atk = `<div class="card stats"><span>Sát thương mỗi đòn</span><span>${fmt(a.tot)}</span><span>DPS ước tính</span><span>${fmt(a.dps)}</span>${a.crossSkillPct ? `<span>Hiệp lực nội / ngoại công</span><span>+${a.crossSkillPct}%</span>` : ''}<span>Nội lực tiêu hao</span><span>${Math.round(a.cost)}</span><span>Tầm đánh</span><span>${Math.round(a.rad)}</span><span>Mục tiêu</span><span>${a.targets > 1 ? 'nhiều (tối đa ' + a.targets + ')' : 'đơn'}</span></div>`;
  }
  modal(`<h3>${esc(s.n)} <small>${Le}/${s.max}${Le > L ? ` <b style="color:#8fe34a">(+ ${Le - L} từ trang bị)</b>` : ''}</small></h3>
    <p class="desc">${esc(s.d || 'Không có mô tả.')}</p>
    <div class="idet"><span class="tag${act ? ' attack' : ''}">${act ? 'Tấn công' : 'Nội tại'}</span><small class="dim">Yêu cầu cấp ${s.req}${S.lvl < s.req ? ` (bạn cấp ${S.lvl})` : ''}</small></div>
    ${atk}
    <div class="sl"><b>${L ? 'Cấp hiện tại ' + Le + (Le > L ? ` (học ${L} + ${Le - L} trang bị)` : '') : 'Nếu học (cấp 1)'}</b>${lines(show)}</div>
    ${next && L ? `<div class="sl"><b>Cấp kế tiếp ${next}</b>${lines(next)}</div>` : ''}
    <div class="btnrow">${act && L ? '<button class="btn" id="skMain">Chọn làm chiêu chính</button>' : ''}<button class="btn" id="skPlus" ${canLearn(s) ? '' : 'disabled'}>+ Cộng điểm</button><button class="btn red" id="skMinus" ${L ? '' : 'disabled'}>− Rút điểm</button></div>`, () => {
    const m = $('#skMain'); if (m) m.onclick = () => { S.main = s.id; S.mainLock = true; R.dirty = true; recalc(); renderSkill(); toast('Chiêu chính: ' + s.n); skillModal(id); };
    $('#skPlus').onclick = () => { if (!canLearn(s)) return; S.skPts--; S.sk[id] = (S.sk[id] || 0) + 1; uiSfx('learn'); R.dirty = true; recalc(); renderSkill(); save(); skillModal(id); };
    $('#skMinus').onclick = () => { if (unlearnSkill(id)) skillModal(id); };
  });
}
function renderSkill() {
  const f = FAC[S.fac];
  const rows = f.skills.map(id => {
    const s = SK[id], L = S.sk[id] || 0, act = isAttack(s);
    const a = act && L ? activeInfo(R.P, s, skillLv(+id)) : null;   // QA-088: cap hieu dung
    return `<div class="skl${S.lvl < s.req ? ' lock' : ''}${R.P.main.id === +id ? ' main' : ''}" data-id="${id}">
      <img class="sic" src="${esc(s.ic || '')}" alt=""><div class="info"><b>${esc(s.n)}</b> <span class="tag${act ? ' attack' : ''}">${act ? 'Tấn công' : 'Nội tại'}</span>
      <small>Cấp yêu cầu ${s.req}${a ? ` · ${fmt(a.tot)} sát thương · ${a.targets > 1 ? 'nhiều mục tiêu' : 'đơn mục tiêu'}` : ''}</small></div>
      <span class="lvl">${skillLv(+id)}/${s.max}</span><span class="pm"><button class="plus" data-id="${id}" title="Cộng 1 điểm" ${canLearn(s) ? '' : 'disabled'}>+</button><button class="minus" data-id="${id}" title="Rút lại 1 điểm" ${L > 0 ? '' : 'disabled'}>−</button><button class="skinfo" data-id="${id}" title="Thông tin kỹ năng">i</button></span>
      ${act && L ? `<div class="slots">Ô: ${[0, 1, 2, 3].map(i => `<button data-slot="${i}" data-sid="${id}" class="${(S.slots || [])[i] === +id ? 'on' : ''}">${i + 1}</button>`).join('')}</div>` : ''}</div>`;
  }).join('');
  $('#t-skill').innerHTML = `<h3>${esc(f.n)} <small>${S.skPts} điểm kỹ năng</small> <button class="btn sm" id="bSugSk">Gợi ý</button></h3><div class="card"><label><input type="checkbox" id="cRot" ${S.rot === false ? '' : 'checked'}> Xoay chiêu tự động khi farm: luân phiên các chiêu gán ở ô 1 đến 4 (phím R), luôn có 2 chiêu mạnh nhất, bỏ chiêu hết nội lực</label></div><p class="dim small">Chiêu nội công và ngoại công cùng nguyên tố hỗ trợ nhau tối đa 12%. Chạm vào chiêu tấn công đã học để khóa làm chiêu chính${S.mainLock ? ' (<a id="bAutoMain">bỏ khóa</a>)' : ' (đang tự chọn chiêu mạnh nhất)'}.</p>${rows}`;
  document.querySelectorAll('#t-skill .plus').forEach(b => b.onclick = e => { e.stopPropagation(); const s = SK[b.dataset.id]; if (!canLearn(s)) return; S.skPts--; S.sk[s.id] = (S.sk[s.id] || 0) + 1; uiSfx('learn'); R.dirty = true; recalc(); renderSkill(); save(); });
  document.querySelectorAll('#t-skill .minus').forEach(b => b.onclick = e => { e.stopPropagation(); unlearnSkill(+b.dataset.id); });
  document.querySelectorAll('#t-skill .skinfo').forEach(b => b.onclick = e => { e.stopPropagation(); skillModal(+b.dataset.id); });
  document.querySelectorAll('#t-skill .slots button').forEach(b => b.onclick = e => { e.stopPropagation(); assignSlot(+b.dataset.slot, +b.dataset.sid); renderSkill(); });
  $('#bSugSk').onclick = suggestModal;
  $('#cRot').onchange = () => toggleRot();
  const am = $('#bAutoMain'); if (am) am.onclick = () => { S.mainLock = false; R.dirty = true; recalc(); renderSkill(); };
  document.querySelectorAll('#t-skill .skl').forEach(r => r.onclick = () => { const s = SK[r.dataset.id]; if (isAttack(s) && S.sk[s.id]) { S.main = s.id; S.mainLock = true; R.dirty = true; recalc(); renderSkill(); toast('Chiêu chính: ' + s.n); } else skillModal(s.id); });
}

/* ---------- the: tui do ---------- */
function renderInv() {
  invDirty = false;
  const f = lootFilter();
  const rar = RAR_VI.map((n, i) => `<option value="${i}" ${f.minRar === i ? 'selected' : ''}>${n}</option>`).join('');
  const lv = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${f.minLvl === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('');
  const grp = LOOT_ATTR_GROUPS.map(([n], i) => `<label class="chip2"><input type="checkbox" data-g="${i}" ${f.groups.includes(i) ? 'checked' : ''}>${n}</label>`).join('');
  const ser = SERIES.map((n, i) => `<label class="chip2" style="color:${SERIES_COL[i]}"><input type="checkbox" data-s="${i}" ${f.series.includes(i) ? 'checked' : ''}>${n}</label>`).join('');
  const onGround = R.ground.length, match = R.ground.filter(d => lootMatch(d.it)).length;
  $('#t-inv').innerHTML = `<div class="invbar"><span>${S.inv.length}/${INV_MAX}</span><span class="sp"></span>
    <button class="btn sm" id="bStash">Kho chung</button><button class="btn sm" id="bBest">Mặc đồ tốt</button><button class="btn sm red" id="bSellAll">Bán đồ không khớp lọc</button></div>
    <div class="invgrid">${S.inv.map(itemCell).join('')}</div>
    <h3>Đồ rơi trên đất <small>${onGround} món · ${match} khớp bộ lọc</small></h3>
    <div class="card lootf">
      <label><input type="checkbox" id="fAuto" ${f.auto ? 'checked' : ''}> Tự đi nhặt đồ khớp bộ lọc khi hết quái</label>
      <div class="row">Độ hiếm từ <select id="fRar">${rar}</select> · cấp đồ từ <select id="fLvl">${lv}</select></div>
      <div class="dim small">Có ít nhất một thuộc tính (bỏ trống = mọi thuộc tính):</div><div class="chips">${grp}</div>
      <div class="dim small">Hệ của món đồ (bỏ trống = mọi hệ):</div><div class="chips">${ser}</div>
      <div class="dim small">Chạm vào món đồ trên sân để đi nhặt tay. Trên 40 món thì món cũ nhất tự bán. Khi vắng mặt, đồ không khớp tự bán.</div>
    </div>`;
  const upd = () => { save(); renderInv(); };
  $('#fAuto').onchange = e => { f.auto = e.target.checked; upd(); };
  $('#fRar').onchange = e => { f.minRar = +e.target.value; upd(); };
  $('#fLvl').onchange = e => { f.minLvl = +e.target.value; upd(); };
  document.querySelectorAll('#t-inv [data-g]').forEach(b => b.onchange = () => { const g = +b.dataset.g; f.groups = b.checked ? [...new Set(f.groups.concat(g))] : f.groups.filter(x => x !== g); upd(); });
  document.querySelectorAll('#t-inv [data-s]').forEach(b => b.onchange = () => { const v = +b.dataset.s; f.series = b.checked ? [...new Set(f.series.concat(v))] : f.series.filter(x => x !== v); upd(); });
  $('#bStash').onclick = () => stashModal();
  $('#bBest').onclick = () => { for (const it of S.inv.slice()) if (betterThanEquipped(it)) equip(it, true); refresh(); };
  $('#bSellAll').onclick = () => { const r = sellUnmatched(); toast(`Bán ${r.n} món${r.kept ? ` (giữ ${r.kept} món bộ / Tím / Bạch Kim)` : ''}`); refresh(); };
  document.querySelectorAll('#t-inv .it').forEach(b => b.onclick = () => itemModal(findItem(b.dataset.uid)));
}

/* ---------- the: khac ---------- */
function renderMore() {
  const adminChu = (typeof adminDaDung === 'function' && adminDaDung()) ? 'Hôm nay đã dùng — xem' : 'Mở bảng thử nghiệm';
  const speedNow = (typeof gameSpeed === 'function') ? gameSpeed() : 1;
  const netUser = (window.NET && NET.user) ? NET.user.username : 'Chưa đăng nhập';
  const netHost = (window.NET && typeof NET.getServerHost === 'function') ? NET.getServerHost() : location.host;
  $('#t-more').innerHTML = `
    <h3>Tài khoản & Máy chủ Online</h3><div class="card lootf">
      <div class="row">Tài khoản <b style="color:#38bdf8">${esc(netUser)}</b></div>
      <div class="row">Máy chủ <code style="color:#94a3b8; font-size:11px;">${esc(netHost)}</code></div>
      <div class="btnrow" style="margin-top:6px">
        <button class="btn" id="bMoreAccount">👤 Quản lý tài khoản</button>
        <button class="btn" id="bMoreServer">🌐 Đổi máy chủ</button>
        <button class="btn red" id="bMoreLogout">🚪 Đăng xuất</button>
      </div>
    </div>
    <h3>Hoạt Động Online & Giang Hồ</h3><div class="card">
      <p class="dim small">Các tính năng bang hội, chiến trường Tống Kim, công thành Biện Kinh và lôi đài tỉ thí võ nghệ trực tuyến.</p>
      <div class="btnrow" style="margin-top:6px">
        <button class="btn" id="bMoreGuild">🏛️ Bang Hội</button>
        <button class="btn" id="bMoreTongKim">⚔️ Tống Kim</button>
        <button class="btn" id="bMoreSiege">🚩 Công Thành</button>
        <button class="btn" id="bMoreDuel">🤺 Lôi Đài</button>
      </div>
    </div>
    <h3>Nhân vật</h3><div class="card lootf">
      <div class="row">Tên <input id="cName" maxlength="16" value="${esc(S.name || '')}" style="flex:1"></div>
      <div class="row">Giới tính <select id="cSex"><option value="0" ${S.sex ? '' : 'selected'}>Nam</option><option value="1" ${S.sex ? 'selected' : ''}>Nữ</option></select></div>
      <div class="btnrow"><button class="btn" id="bName">Lưu tên và giới tính</button></div>
      <small class="dim">Giới tính quyết định mặc được trang phục nam / nữ — đổi xong món không hợp sẽ tự tháo ra.</small></div>
    <h3>Tốc độ game</h3><div class="card lootf">
      <div class="row">Tốc độ <select id="cSpeed">${[1, 1.5, 2.5].map(v => `<option value="${v}" ${speedNow === v ? 'selected' : ''}>x${v}</option>`).join('')}</select> <small class="dim">nhân vào thời gian mô phỏng, vật lý vẫn bước 1/60s</small></div></div>
    <h3>Bảng thử nghiệm</h3><div class="card">
      <p class="dim small">Mỗi ngày mở được <b>1 lần</b> và chọn <b>1</b> option để trải nghiệm nhanh tính năng (không phải công cụ gian lận — game chạy trên máy bạn).</p>
      <div class="btnrow"><button class="btn" id="bAdmin">${adminChu}</button></div></div><h3>Lưu game</h3><div class="card"><p class="dim small">Nhân vật lưu trong trình duyệt của từng thiết bị (3 slot). Để chơi trên thiết bị khác: bấm <b>Tải file lưu</b>, chuyển file <code>.jxsave</code> sang thiết bị kia (Zalo, Drive, cáp…), rồi mở game ở đó và bấm <b>Nạp từ file</b>. File có chữ ký chống <b>sửa vô tình</b> (game chạy hoàn toàn trên máy bạn nên không chống được gian lận có chủ đích). Nên tải file định kỳ để sao lưu.</p>
    <div class="btnrow"><button class="btn" id="bDl">Tải file lưu (.jxsave)</button><button class="btn" id="bFile">Nạp từ file</button></div>
    <p class="dim small">Hoặc dùng mã văn bản:</p><div class="btnrow"><button class="btn" id="bExp">Xuất mã</button><button class="btn" id="bImp">Nhập mã</button></div><textarea id="saveTxt" rows="4" placeholder="Mã lưu game"></textarea></div>
    <h3>Âm thanh</h3><div class="card lootf">
      <label><input type="checkbox" id="sOn" ${sndCfg().on ? 'checked' : ''}> Tiếng động (đòn đánh, chiêu, quái, rơi đồ)</label>
      <div class="row">Âm lượng <input type="range" id="sVol" min="0" max="1" step="0.05" value="${sndCfg().vol}"></div>
      <label><input type="checkbox" id="mOn" ${sndCfg().music ? 'checked' : ''}> Nhạc nền theo bản đồ</label>
      <div class="row">Nhạc <input type="range" id="mVol" min="0" max="1" step="0.05" value="${sndCfg().mvol}"></div></div>
    <h3>Tự động</h3><div class="card"><label><input type="checkbox" id="cAuto" ${S.autoEquip ? 'checked' : ''}> Tự mặc đồ tốt hơn khi nhặt</label><br>
      <label><input type="checkbox" id="cPot" ${S.potOff ? '' : 'checked'}> Tự dùng thuốc (Kim Sáng Dược / Ngưng Thần đan, trừ ngân lượng) · đã dùng ${fmt(S.potUsed || 0)}</label><br>
      <label><input type="checkbox" id="cJunk" ${S.autoJunk === false ? '' : 'checked'}> Tự bán đồ thừa (yếu hơn đồ đang mặc cùng ô, vũ khí sai loại của phái; giữ tối đa 6 nhẫn / dây chuyền / ngọc bội để hợp Huyền Tinh)</label><br>
      <label><input type="checkbox" id="cPts" ${S.autoPts === true ? 'checked' : ''}> Tự cộng điểm tiềm năng và võ công (mặc định tắt: tự cộng ở thẻ Nhân vật và Võ công)</label></div>
    <h3>Độ khó và trợ giúp</h3><div class="card lootf">
      <div class="row">Độ khó <select id="sDiff">${DIFFS.map((d, i) => `<option value="${i}" ${diffOf() === d ? 'selected' : ''}>${d.n}</option>`).join('')}</select> <small class="dim">${esc(diffOf().d)}</small></div>
      <label><input type="checkbox" id="cForge" ${S.autoForge ? 'checked' : ''}> Tự động rèn đồ (ghép mảnh Hoàng Kim, khảm Tím, hợp và thăng cấp Huyền Tinh; mỗi 30 giây)</label>
      <label><input type="checkbox" id="cBuy" ${S.autoBuy === false ? '' : 'checked'}> Tự mua vũ khí đúng loại ở Biện Kinh khi mạnh hơn ≥ 25% (tối đa 60% ngân lượng)</label>
      <div class="btnrow"><button class="btn" id="bStashM">Kho chung</button><button class="btn" id="bTut">Hướng dẫn</button><button class="btn" id="bCodex">Bách khoa</button><button class="btn" id="bSug">Gợi ý cộng điểm</button></div></div>
    <h3>Trợ năng</h3><div class="card lootf">
      <div class="row">Cỡ chữ <select id="uFs">${UI_FS.map((v, i) => `<option value="${i}" ${uiPrefs().fs === i ? 'selected' : ''}>${UI_FS_NAME[i]}</option>`).join('')}</select> <small class="dim">áp dụng cho bảng thông tin, thẻ và hộp thoại</small></div>
      <label><input type="checkbox" id="uSaver" ${uiPrefs().saver ? 'checked' : ''}> Tiết kiệm pin (vẽ 30 khung/giây, ngừng vẽ khi ẩn tab)</label>
      <small class="dim">Tay cầm: cần analog / D-pad để đi, A B X Y dùng chiêu 1–4, LB / RB uống thuốc HP / MP, Start tạm dừng Luyện Công. Phím Esc đóng hộp thoại.</small></div>
    <h3>Điều khiển & Hiển thị</h3><div class="card"><label><input type="checkbox" id="cJoy" ${joyFixed() ? 'checked' : ''}> Joystick cố định ở góc trái dưới (bỏ chọn: joystick nổi theo ngón tay)</label><br>
      <label><input type="checkbox" id="cLowFx" ${giamHieuUng() ? 'checked' : ''}> Giảm hiệu ứng (mượt hơn trên máy yếu / đông quái; tự bật nếu hệ điều hành yêu cầu giảm chuyển động)</label></div>
    <h3>Nguồn dữ liệu</h3><div class="card small dim">Kỹ năng, quái, trang bị, thuộc tính và tỉ lệ rơi đồ trích từ dữ liệu Võ Lâm Truyền Kỳ 1 (bản fan chơi offline, phi thương mại).</div>
    <div class="btnrow"><button class="btn" id="bSwitch">Đổi nhân vật / slot</button><button class="btn red" id="bReset">Xóa nhân vật</button></div>`;
  const bMoreAcc = $('#bMoreAccount'); if (bMoreAcc) bMoreAcc.onclick = () => { if (window.NET) NET.showAccountModal(); };
  const bMoreSrv = $('#bMoreServer'); if (bMoreSrv) bMoreSrv.onclick = () => { if (window.NET) NET.showServerModal(); };
  const bMoreLog = $('#bMoreLogout'); if (bMoreLog) bMoreLog.onclick = () => { if (window.NET) NET.logout(); };
  const bMoreGld = $('#bMoreGuild'); if (bMoreGld) bMoreGld.onclick = () => { if (window.NET) NET.showGuildModal(); };
  const bMoreTK = $('#bMoreTongKim'); if (bMoreTK) bMoreTK.onclick = () => { if (window.NET) NET.showTongKimModal(); };
  const bMoreSg = $('#bMoreSiege'); if (bMoreSg) bMoreSg.onclick = () => { if (window.NET) NET.showSiegeModal(); };
  const bMoreDu = $('#bMoreDuel'); if (bMoreDu) bMoreDu.onclick = () => { if (window.NET) NET.showDuelListModal(); };
  $('#bName').onclick = () => {
    const n = ($('#cName').value || '').trim().slice(0, 16) || 'Tân thủ';
    const sx = +$('#cSex').value ? 1 : 0, doi = sx !== S.sex;
    S.name = n; S.sex = sx; S.sexSet = 1;
    // trang phuc khong hop gioi tinh moi: thao ve hanh trang (truoc day bi XOA han, mat ca do bo / do cuong hoa)
    if (doi) { for (const k of Object.keys(S.eq)) { const it = S.eq[k]; if (it && !sexOk(it)) { delete S.eq[k]; S.inv.unshift(it); } } invDirty = true; autoEquipAll(); }
    R.dirty = true; recalc(); save(); renderMore(); toast('Đã lưu: ' + S.name + ' · ' + (S.sex ? 'Nữ' : 'Nam'));
  };
  $('#cSpeed').onchange = () => { S.speed = +$('#cSpeed').value === 2.5 ? 2.5 : (+$('#cSpeed').value === 1.5 ? 1.5 : 1); save(); toast('Tốc độ game x' + S.speed); };
  $('#bAdmin').onclick = () => { if (typeof adminModal === 'function') adminModal(); };
  $('#bDl').onclick = () => { if (downloadSaveFile()) toast('Đã tải file lưu: ' + saveFileName()); };
  $('#bFile').onclick = () => pickSaveFile(null);
  $('#bExp').onclick = () => { $('#saveTxt').value = exportSave(); toast('Đã xuất mã'); };
  $('#bImp').onclick = () => importFlow($('#saveTxt').value, null);
  $('#cAuto').onchange = e => { S.autoEquip = e.target.checked; save(); };
  $('#cJunk').onchange = e => { S.autoJunk = e.target.checked; save(); };
  $('#sOn').onchange = e => { audInit(); sndCfg().on = e.target.checked; audApply(); save(); };
  $('#mOn').onchange = e => { audInit(); sndCfg().music = e.target.checked; audApply(); if (sndCfg().music) playMusic(R.town ? W.town.id : zoneOf(Math.min(S.stage, STAGES)).id); save(); };
  $('#sVol').oninput = e => { sndCfg().vol = +e.target.value; audApply(); };
  $('#mVol').oninput = e => { sndCfg().mvol = +e.target.value; audApply(); };
  $('#sVol').onchange = $('#mVol').onchange = () => save();
  $('#cPot').onchange = e => { S.potOff = !e.target.checked; save(); };
  $('#cPts').onchange = e => { S.autoPts = e.target.checked; if (S.autoPts) { autoSpendAttrs(); autoSpendSkills(); recalc(); } save(); };
  $('#cJoy').onchange = e => { S.joy = e.target.checked ? 'fixed' : 'float'; save(); };
  $('#cLowFx').onchange = e => { S.lowFx = e.target.checked ? 1 : 0; save(); };
  $('#sDiff').onchange = e => { S.diff = +e.target.value; R.enemies = []; R.spawnT = 0.3; save(); toast('Độ khó: ' + diffOf().n); renderMore(); };
  $('#cBuy').onchange = e => { S.autoBuy = e.target.checked; save(); };
  $('#cForge').onchange = e => { S.autoForge = e.target.checked; if (S.autoForge) autoForge(); save(); };
  $('#bStashM').onclick = () => stashModal(); $('#bTut').onclick = () => tutorialModal(0); $('#bCodex').onclick = () => codexModal(); $('#bSug').onclick = suggestModal;
  $('#uFs').onchange = e => { setUiPref({ fs: +e.target.value }); }; $('#uSaver').onchange = e => setUiPref({ saver: e.target.checked });
  $('#bSwitch').onclick = () => switchCharacter();
  $('#bReset').onclick = () => modal(`<h3>Xóa nhân vật?</h3><p class="desc">Xóa nhân vật ở slot ${SLOT + 1} (${esc(FAC[S.fac] ? FAC[S.fac].n : '')} cấp ${S.lvl}). Toàn bộ tiến trình của slot này sẽ mất; các slot khác không ảnh hưởng.</p><div class="btnrow"><button class="btn red" id="bYes">Xóa</button></div>`, () => $('#bYes').onclick = () => deleteSlot(SLOT));
}

/* ---------- khung chung ---------- */
function showTab(t) {
  curTab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('hidden', el.id !== 't-' + t));
  refresh();
}
function refresh() {
  if (!S.fac) return;
  if (R.dirty) recalc();
  ({ log: renderLog, char: renderChar, skill: renderSkill, inv: renderInv, more: renderMore })[curTab]();
  renderPad();
  updateDots();
}
function updateDots() { $('#dotChar').classList.toggle('on', S.attrPts > 0); $('#dotSkill').classList.toggle('on', S.skPts > 0 && FAC[S.fac] && FAC[S.fac].skills.some(id => canLearn(SK[id]))); }
function updateTop() {
  const P = R.P; if (!P) return;
  { const hw = W.hero[S.fac], lb = $('.lvbox'); if (hw && lb) lb.style.setProperty('--pl', `url('${hw.img}')`); }
  $('#lv').textContent = S.lvl; $('#gold').textContent = fmt(S.gold); $('#heroName').textContent = FAC[S.fac] ? FAC[S.fac].n : '';
  $('#stageLbl').textContent = `Ải ${S.stage} · đợt ${S.wave}/${WAVES}`;
  const need = expNeed(S.lvl) || 1;   // QA-083: phai dung cung ham voi luc len cap, neu khong thanh XP hien thi lech
  $('#xpBar').style.width = (S.xp / need * 100) + '%'; $('#xpTxt').textContent = `${(S.xp / need * 100).toFixed(1)}%`;
  $('#hpBar').style.width = (R.life / P.life * 100) + '%'; $('#hpTxt').textContent = `${fmt(R.life)} / ${fmt(P.life)}`;
  $('#mpBar').style.width = (R.mana / P.mana * 100) + '%'; $('#mpTxt').textContent = `${fmt(R.mana)} / ${fmt(P.mana)}`;
  $('#mainSk').textContent = P.main.n;
}
/* Nap tu file .jxsave (hoac ma van ban): chon slot dich, canh bao ghi de, roi tai lai trang */
function pickSaveFile(after) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.jxsave,.json,.txt,application/json,text/plain'; inp.style.display = 'none';
  inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return; const r = new FileReader(); r.onload = () => importFlow(String(r.result), after); r.onerror = () => toast('Không đọc được file'); r.readAsText(f); };
  document.body.appendChild(inp); inp.click();
}
function importFlow(txt, after, slot) {
  let st; try { st = parseSaveText(txt); } catch (e) { toast(e.message || 'File không hợp lệ'); return; }
  const f = FAC[st.fac], desc = `${esc(f.n)} cấp ${Math.max(1, Math.min(MAX_LEVEL, st.lvl | 0))}`;
  const rows = [...Array(SLOT_N).keys()].map(i => { const o = slotInfo(i), g = o && FAC[o.fac];
    return `<div class="slotrow ${o ? '' : 'empty'}"><span><b>Slot ${i + 1}</b><small>${o && g ? esc(g.n) + ' cấp ' + o.lvl + ' (sẽ bị ghi đè)' : 'Trống'}</small></span><button class="btn ${o ? 'red' : ''}" data-into="${i}">${o ? 'Ghi đè' : 'Nạp vào'}</button></div>`; }).join('');
  modal(`<h3>Nạp file lưu</h3><p class="desc">Nhân vật trong file: <b>${desc}</b>. Chọn slot để nạp (slot đã có nhân vật sẽ giữ một bản sao lưu).</p><div class="slotlist">${rows}</div>${after ? '<div class="btnrow"><button class="btn" id="impBack">Quay lại</button></div>' : ''}`, () => {
    document.querySelectorAll('#mBody [data-into]').forEach(b => b.onclick = () => { try { if (SLOT === +b.dataset.into) SAVE_LOCK = true; writeSlot(+b.dataset.into, st); } catch (e) { toast(e.message); return; } location.reload(); });
    const bk = $('#impBack'); if (bk) bk.onclick = after;
  }, !!after && !S.fac);
}
/* Man hinh chon nhan vat: 3 slot. Chon / tao -> dat con tro roi tai lai trang; xoa co buoc xac nhan rieng */
function slotMenu(confirmDel) {
  const rows = [...Array(SLOT_N).keys()].map(i => {
    const o = slotInfo(i), f = o && FAC[o.fac];
    if (!o || !f) return `<div class="slotrow empty"><span><b>Slot ${i + 1}</b><small>Trống</small></span><button class="btn" data-play="${i}">Tạo nhân vật</button></div>`;
    const ago = o.last ? new Date(o.last).toLocaleString('vi-VN') : '';
    if (confirmDel === i) return `<div class="slotrow del"><span><b>Xóa slot ${i + 1}?</b><small>${esc(f.n)} cấp ${o.lvl} sẽ mất vĩnh viễn</small></span><button class="btn red" data-del-yes="${i}">Xóa</button><button class="btn" data-del-no="1">Hủy</button></div>`;
    return `<div class="slotrow"><img src="${esc((W.hero[o.fac] || {}).img || '')}" alt=""><span><b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b><small>Cấp ${o.lvl} · ải ${o.stage}${ago ? ' · ' + esc(ago) : ''}</small></span><button class="btn" data-play="${i}">Chơi</button><button class="btn red" data-del="${i}">Xóa</button></div>`;
  }).join('');
  modal(`<h3>Chọn nhân vật</h3><p class="desc">Mỗi slot là một nhân vật riêng, lưu độc lập.</p><div class="slotlist">${rows}</div><div class="btnrow"><button class="btn" id="slotImp">Nạp từ file lưu (.jxsave)</button></div>`, () => {
    $('#slotImp').onclick = () => pickSaveFile(() => slotMenu());
    document.querySelectorAll('#mBody [data-play]').forEach(b => b.onclick = () => { try { localStorage.setItem(SLOT_PTR, b.dataset.play); } catch (e) { /* bo qua */ } SAVE_LOCK = true; location.reload(); });
    document.querySelectorAll('#mBody [data-del]').forEach(b => b.onclick = () => slotMenu(+b.dataset.del));
    document.querySelectorAll('#mBody [data-del-no]').forEach(b => b.onclick = () => slotMenu());
    document.querySelectorAll('#mBody [data-del-yes]').forEach(b => b.onclick = () => deleteSlot(+b.dataset.delYes));
  }, true);
}
function pickFaction() {
  const cards = FACTIONS.map(f => `<button data-f="${f.key}" style="--c:${SERIES_COL[f.series]}"><img src="${(W.hero[f.key] || {}).img || ''}" alt=""><b>${esc(f.n)}</b><small>hệ ${SERIES[f.series]}</small><i class="s5b" style="background-image:url('ui/s${f.series}.png')"></i></button>`).join('');
  modal(`<h3>Chọn môn phái</h3><p class="desc">Mỗi phái thuộc một hệ ngũ hành. Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim.</p><div class="card lootf"><div class="row">Tên nhân vật <input id="pfName" maxlength="16" placeholder="Tân thủ" style="flex:1"></div><div class="row">Giới tính <select id="pfSex"><option value="">Theo phái (Nga My / Thúy Yên là nữ)</option><option value="0">Nam</option><option value="1">Nữ</option></select></div><small class="dim">Để trống thì lấy tên phái. Mặc định Nga My / Thúy Yên là nữ. Đổi lại được ở thẻ Khác.</small></div><div class="facpick">${cards}</div>`, () => {
    document.querySelectorAll('.facpick button').forEach(b => b.onclick = () => { const ne = $('#pfName'), sx = $('#pfSex'); startFaction(b.dataset.f, ne ? ne.value : '', (sx && sx.value !== '') ? +sx.value : null); });   // de trong gioi tinh = theo mac dinh cua phai
  }, true);
}
const NOTICE_TXT = 'JxOffline - Phi thương mại, ưu tiên giải trí trên chính thiết bị của mình';
/* Hien moi lan khoi tao nhan vat moi */
function noticeModal() {
  modal(`<h3>JxOffline</h3><p class="desc notice">${esc(NOTICE_TXT)}</p><div class="btnrow"><button class="btn" id="bNotice">Đã hiểu</button></div>`, () => { $('#bNotice').onclick = () => { closeModal(true); if (!S.tut) tutorialModal(0); }; });
  log(`<span class="dim">${esc(NOTICE_TXT)}</span>`);
}
function startFaction(key, tenNguoi, gioiTinh) {
  const f = FAC[key]; S.fac = key;
  // A: nguoi choi duoc tu dat ten va chon gioi tinh; de trong / khong truyen thi lay mac dinh theo phai
  S.sex = (gioiTinh === 0 || gioiTinh === 1) ? gioiTinh : (['emei', 'cuiyan'].includes(key) ? 1 : 0); S.sexSet = 1;   // sexSet: migrate() khong ghi de ve mac dinh cua phai
  S.name = (typeof tenNguoi === 'string' && tenNguoi.trim()) ? tenNguoi.trim().slice(0, 16) : f.n;
  if (f.starter) { S.sk[f.starter] = 1; S.skPts = Math.max(0, S.skPts - 1); S.main = f.starter; }
  starterGear();
  R.dirty = true; recalc(); R.life = R.P.life; R.mana = R.P.mana;
  loginCheck(); dotGift();                                  // ngay dau: co qua diem danh
  closeModal(true); save(); showTab('log');
  noticeModal();
  log(`Gia nhập <b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b>. Bắt đầu hành tẩu giang hồ!`);
}
function starterGear() {
  if (S.eq.weapon) return;
  const f = FAC[S.fac];
  const wc = f.wcode >= 0 ? f.wcode : 0;
  const it = wc === 7 ? makeItem(1, 0, 1, 0) : makeItem(0, wc === 9 ? 6 : wc, 1, 0);
  if (it) S.eq.weapon = it;
  const ar = makeItem(2, sexPart(2, 0), 1, 0); if (ar && sexOk(ar)) S.eq.armor = ar;
}
