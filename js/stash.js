/* ======================= KHO DUNG CHUNG GIUA CAC SLOT =======================
   Mot kho cho ca 3 nhan vat (khoa localStorage 'jxidle_stash', tach rieng khoi file luu nhan vat): do trong hanh trang (khong phai do dang mac),
   ngan luong va nguyen lieu ren (Huyen Tinh, khoang, manh, Thuy Tinh Trang, Than Bi). Ky ten + ban sao luu nhu file luu nhan vat.
   Chong nhan doi: moi thao tac di chuyen mot lan, ghi ben "nguon" truoc roi moi ghi ben "dich"; ghi dich loi thi hoan lai nguon.
   Do vao kho giu nguyen trang thai (cuong hoa, Tim, Bach Kim, bo...); khi lay ra cap lai uid cua nhan vat hien tai. */
'use strict';
const STASH_KEY = 'jxidle_stash', STASH_MAX = 60, STASH_V = 1;
const stashNew = () => ({ v: STASH_V, id: Math.random().toString(36).slice(2, 10), rev: 0, gold: 0, items: [], mats: { ht: {}, ore: {}, shard: {}, misc: {} } });
function stashClean(o) {                                  // lam sach noi dung doc tu may (mat khau / file co the hong)
  const st = stashNew(); if (!o || typeof o !== 'object') return st;
  st.id = typeof o.id === 'string' ? o.id : st.id; st.rev = Math.max(0, +o.rev || 0);
  st.gold = Number.isFinite(+o.gold) ? Math.max(0, Math.floor(+o.gold)) : 0;
  st.items = (Array.isArray(o.items) ? o.items : []).filter(it => it && typeof it === 'object' && Array.isArray(it.base) && Array.isArray(it.mag)).slice(0, STASH_MAX);
  for (const g of ['ht', 'ore', 'shard', 'misc']) for (const k in ((o.mats || {})[g] || {})) { const n = Math.floor(+o.mats[g][k]); if (n > 0) st.mats[g][k] = n; }
  return st;
}
/* { st, err } : err = 'tampered' neu chu ky sai va khong co ban sao luu hop le */
function stashRead() {
  let raw = null; try { raw = localStorage.getItem(STASH_KEY); } catch (e) { return { st: stashNew(), err: 'storage' }; }
  if (!raw) return { st: stashNew() };
  const tryUnpack = t => { try { const u = unpack(t); return u.ok ? stashClean(u.state) : null; } catch (e) { return null; } };
  const st = tryUnpack(raw); if (st) return { st };
  let bak = null; try { bak = localStorage.getItem(STASH_KEY + '_bak'); } catch (e) { /* bo qua */ }
  const b = bak && tryUnpack(bak); if (b) return { st: b, restored: true };
  return { st: stashNew(), err: 'tampered' };
}
function stashWrite(st) {
  st.rev++;
  const prev = localStorage.getItem(STASH_KEY);
  if (prev) { try { if (unpack(prev).ok) localStorage.setItem(STASH_KEY + '_bak', prev); } catch (e) { /* bo qua ban hong */ } }
  localStorage.setItem(STASH_KEY, pack(st));
}
/* Chay mot thao tac tren kho: fn(st) tra ve { ok, msg }; ghi kho neu ok. Loi doc / ghi -> thong bao, khong doi gi */
function stashTx(fn) {
  const { st, err } = stashRead();
  if (err === 'tampered') return { ok: false, msg: 'Kho đã bị chỉnh sửa ngoài game (sai chữ ký), không dùng được' };
  if (err) return { ok: false, msg: 'Không đọc được bộ nhớ trình duyệt' };
  let r; try { r = fn(st); } catch (e) { return { ok: false, msg: e.message || 'Lỗi kho' }; }
  if (!r || !r.ok) return r || { ok: false, msg: '' };
  const fail = () => { if (r.undo) r.undo(); save(); return { ok: false, msg: 'Không ghi được kho (bộ nhớ đầy hoặc bị chặn)' }; };
  if (r.from === 'char') { save(); try { stashWrite(st); } catch (e) { return fail(); } }          // gui vao kho: luu nhan vat (da mat mon) truoc, roi moi ghi kho
  else { try { stashWrite(st); } catch (e) { r.undo && r.undo(); return { ok: false, msg: 'Không ghi được kho (bộ nhớ đầy hoặc bị chặn)' }; } save(); }   // lay ra: ghi kho (da mat mon) truoc, roi moi luu nhan vat
  return r;
}
const stashCount = () => stashRead().st.items.length;
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- do ---------- */
function stashDeposit(it) {
  if (!S.inv.includes(it)) return { ok: false, msg: 'Chỉ gửi được món trong hành trang (không phải đồ đang mặc)' };
  return stashTx(st => {
    if (st.items.length >= STASH_MAX) return { ok: false, msg: `Kho đầy (${STASH_MAX} món)` };
    const copy = clone(it), i = S.inv.indexOf(it);
    S.inv.splice(i, 1); st.items.push(copy); invDirty = true;                     // nguon (hanh trang) truoc; ghi kho loi -> undo
    return { ok: true, from: 'char', msg: `Gửi vào kho: ${it.n}`, undo: () => { S.inv.splice(i, 0, it); invDirty = true; } };
  });
}
function stashWithdraw(idx) {
  if (S.inv.length >= INV_MAX) return { ok: false, msg: 'Hành trang đầy' };
  return stashTx(st => {
    const it = st.items[idx]; if (!it) return { ok: false, msg: 'Món không còn trong kho' };
    st.items.splice(idx, 1); it.uid = S.uid++; S.inv.unshift(it); invDirty = true; R.dirty = true;
    return { ok: true, msg: `Lấy ra: ${it.n}`, undo: () => { S.inv.shift(); } };
  });
}
/* ---------- vang ---------- */
function stashGold(dir, n) {
  n = Math.floor(+n); if (!(n > 0)) return { ok: false, msg: 'Nhập số ngân lượng' };
  return stashTx(st => {
    if (dir === 'in') { if (n > S.gold) return { ok: false, msg: 'Không đủ ngân lượng' }; S.gold -= n; st.gold += n; return { ok: true, from: 'char', msg: `Gửi ${fmt(n)} lượng`, undo: () => { S.gold += n; } }; }
    if (n > st.gold) return { ok: false, msg: 'Kho không đủ ngân lượng' }; st.gold -= n; S.gold += n; return { ok: true, msg: `Rút ${fmt(n)} lượng`, undo: () => { S.gold -= n; } };
  });
}
/* ---------- nguyen lieu ---------- */
function stashMat(dir, group, key, n) {
  return stashTx(st => {
    const have = dir === 'in' ? matHave(group, key) : (st.mats[group][key] || 0); n = n == null ? have : Math.min(have, Math.floor(+n));
    if (!(n > 0)) return { ok: false, msg: 'Không có gì để chuyển' };
    if (dir === 'in') { matAdd(group, key, -n); st.mats[group][key] = (st.mats[group][key] || 0) + n; }
    else { st.mats[group][key] -= n; if (st.mats[group][key] <= 0) delete st.mats[group][key]; matAdd(group, key, n); }
    return { ok: true, from: dir === 'in' ? 'char' : 'stash', msg: `${dir === 'in' ? 'Gửi' : 'Rút'} ${n} ${matName(group, key)}`, undo: () => matAdd(group, key, dir === 'in' ? n : -n) };
  });
}
function matName(group, key) {
  if (group === 'ht') return `Huyền Tinh cấp ${key}`;
  if (group === 'shard') return `Mảnh ${key}`;
  if (group === 'misc') return key === 'wc' ? 'Thủy Tinh Trắng' : key === 'mys' ? 'Thần Bí Khoáng Thạch' : key === 'thbt' ? 'Tinh Hồng Bảo Thạch' : key;
  const o = oreParse(key), r = oreRows(o.a)[0]; return `Khoáng dòng ${o.place + 1} · ${r ? r.n : attrName(o.a)} · cấp ${o.lvl}`;
}

/* ---------- file kho (.jxkho): chuyen kho sang thiet bi khac ---------- */
function stashFileText() { const { st } = stashRead(); return JSON.stringify({ game: 'jxidle-stash', v: STASH_V, exported: Date.now(), data: pack(st) }); }
function parseStashText(txt) {
  txt = String(txt || '').trim().replace(/^﻿/, ''); if (!txt) throw new Error('File rỗng');
  const w = JSON.parse(txt);
  if (!w || w.game !== 'jxidle-stash' || typeof w.data !== 'string') throw new Error('Không phải file kho của game');
  const u = unpack(w.data); if (!u.ok) throw new Error('File đã bị chỉnh sửa (sai chữ ký)');
  return stashClean(u.state);
}
function stashImport(st) {                               // thay the kho hien tai bang kho trong file
  const cur = stashRead(); const n = stashClean(st); n.rev = Math.max(cur.st.rev, n.rev);
  try { stashWrite(n); } catch (e) { return { ok: false, msg: 'Không ghi được kho' }; }
  return { ok: true, msg: 'Đã nạp kho từ file' };
}

/* ---------- giao dien ---------- */
let stashTab = 'item';
function stashCell(it, i) {
  return `<button class="it r${it.r}${reqOk(it) ? '' : ' bad'}" data-si="${i}" title="${esc(it.n)}">${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}<i>${it.lvl}</i>${it.s >= 0 ? `<b class="s5" style="background:${SERIES_COL[it.s]}"></b>` : ''}${it.enh ? `<em>+${it.enh}</em>` : ''}</button>`;
}
function stashDone(r, reopen) { toast(r.msg || (r.ok ? 'Xong' : 'Không thực hiện được')); if (r.ok) uiSfx('use'); if (reopen !== false) stashModal(); refresh(); }
function stashModal(tab) {
  if (tab) stashTab = tab;
  const { st, err } = stashRead();
  const tabs = [['item', 'Đồ'], ['mat', 'Nguyên liệu'], ['gold', 'Ngân lượng'], ['file', 'File kho']];
  let body = '';
  if (err) body = `<p class="reqbad">${err === 'tampered' ? 'Kho đã bị chỉnh sửa ngoài game (sai chữ ký) và không có bản sao lưu hợp lệ. Có thể nạp lại từ file kho.' : 'Không đọc được bộ nhớ trình duyệt.'}</p>`;
  if (stashTab === 'item') {
    body += `<p class="desc">Bấm món trong <b>hành trang</b> để gửi vào kho. Bấm món trong <b>kho</b> để xem và lấy ra. Kho dùng chung cho cả 3 slot (${st.items.length}/${STASH_MAX} món).</p>
      <h3>Hành trang <small>${S.inv.length}/${INV_MAX}</small></h3><div class="invgrid" id="stInv">${S.inv.map(itemCell).join('') || '<small class="dim">Trống</small>'}</div>
      <h3>Kho chung <small>${st.items.length}/${STASH_MAX}</small></h3><div class="invgrid" id="stBox">${st.items.map(stashCell).join('') || '<small class="dim">Kho trống</small>'}</div>`;
  } else if (stashTab === 'mat') {
    const rows = []; for (const g of ['ht', 'ore', 'shard', 'misc']) for (const k of new Set([...Object.keys(mats()[g]), ...Object.keys(st.mats[g])])) rows.push([g, k]);
    body += `<p class="desc">Nguyên liệu rèn đang có / trong kho.</p>` + (rows.map(([g, k]) => `<div class="qrow"><span>${esc(matName(g, k))}<small>có ${matHave(g, k)} · kho ${st.mats[g][k] || 0}</small></span><span></span><span class="pm"><button class="btn sm" data-mi="${g}|${k}" ${matHave(g, k) ? '' : 'disabled'}>Gửi hết</button><button class="btn sm" data-mo="${g}|${k}" ${st.mats[g][k] ? '' : 'disabled'}>Rút hết</button></span></div>`).join('') || '<small class="dim">Chưa có nguyên liệu</small>');
  } else if (stashTab === 'gold') {
    body += `<p class="desc">Ngân lượng: bạn <b>${fmt(S.gold)}</b> · kho <b>${fmt(st.gold)}</b>.</p><div class="row"><input type="number" id="stGold" min="1" placeholder="Số lượng"></div>
      <div class="btnrow"><button class="btn" id="stIn">Gửi vào kho</button><button class="btn" id="stOut">Rút ra</button><button class="btn" id="stInAll">Gửi hết</button><button class="btn" id="stOutAll">Rút hết</button></div>`;
  } else {
    body += `<p class="desc">Chuyển kho sang thiết bị khác: tải file kho (.jxkho) ở đây, nạp ở thiết bị kia. Nạp file sẽ <b>thay thế</b> kho hiện tại. File có chữ ký, sửa tay sẽ bị từ chối.</p>
      <div class="btnrow"><button class="btn" id="stDl">Tải file kho</button><button class="btn red" id="stUp">Nạp file kho</button></div>`;
  }
  modal(`<h3>Kho chung <small>${fmt(st.gold)} lượng · ${st.items.length} món</small></h3><div class="dtabs" id="stTabs">${tabs.map(([k, n]) => `<button data-st="${k}" class="${k === stashTab ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`, () => {
    const q = s => document.querySelectorAll('#mBody ' + s);
    q('#stTabs [data-st]').forEach(b => b.onclick = () => stashModal(b.dataset.st));
    q('#stInv .it').forEach(b => b.onclick = () => { const it = S.inv.find(i => i.uid === +b.dataset.uid); if (it) stashDone(stashDeposit(it)); });
    q('#stBox .it').forEach(b => b.onclick = () => stashItemModal(+b.dataset.si));
    q('[data-mi]').forEach(b => b.onclick = () => { const [g, k] = b.dataset.mi.split('|'); stashDone(stashMat('in', g, k)); });
    q('[data-mo]').forEach(b => b.onclick = () => { const [g, k] = b.dataset.mo.split('|'); stashDone(stashMat('out', g, k)); });
    const gv = () => $('#stGold').value;
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#stIn', () => stashDone(stashGold('in', gv()))); on('#stOut', () => stashDone(stashGold('out', gv())));
    on('#stInAll', () => stashDone(stashGold('in', S.gold))); on('#stOutAll', () => stashDone(stashGold('out', stashRead().st.gold)));
    on('#stDl', () => { const blob = new Blob([stashFileText()], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `jxidle_kho_${new Date().toISOString().slice(0, 10)}.jxkho`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast('Đã tải file kho'); });
    on('#stUp', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.jxkho,.json'; inp.style.display = 'none';
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return; const r = new FileReader(); r.onload = () => stashImportFlow(String(r.result)); r.readAsText(f); }; document.body.appendChild(inp); inp.click(); });
  });
}
function stashItemModal(i) {
  const it = stashRead().st.items[i]; if (!it) { stashModal(); return; }
  modal(`${itemHTML(it)}<div class="btnrow"><button class="btn" id="stTake">Lấy ra</button><button class="btn" id="stBack">Quay lại</button></div>`, () => {
    $('#stTake').onclick = () => stashDone(stashWithdraw(i)); $('#stBack').onclick = () => stashModal();
  });
}
function stashImportFlow(txt) {
  let st; try { st = parseStashText(txt); } catch (e) { toast(e.message || 'File không hợp lệ'); return; }
  const cur = stashRead().st;
  modal(`<h3>Nạp file kho</h3><p class="desc">File: <b>${st.items.length}</b> món, <b>${fmt(st.gold)}</b> lượng. Kho hiện tại: ${cur.items.length} món, ${fmt(cur.gold)} lượng. Nạp sẽ <b>thay thế</b> kho hiện tại.</p>
    <div class="btnrow"><button class="btn red" id="stOk">Thay thế kho</button><button class="btn" id="stNo">Hủy</button></div>`, () => {
    $('#stOk').onclick = () => { const r = stashImport(st); toast(r.msg); stashModal(); }; $('#stNo').onclick = () => stashModal('file');
  });
}
