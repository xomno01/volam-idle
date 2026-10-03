/* ======================= BẢNG THỬ NGHIỆM (admin panel) =======================
   Mục đích: trải nghiệm nhanh một tính năng mà không phải cày cuốc.
   GIỚI HẠN THEO YÊU CẦU: mỗi ngày chỉ MỞ ĐƯỢC 1 LẦN và CHỌN DUY NHẤT 1 option.
   Mốc ngày lưu ở S.adminDay (migrate đã chuẩn hoá). Đây KHÔNG phải công cụ chống gian lận:
   game chạy hoàn toàn trên máy người chơi nên ai quyết tâm vẫn sửa được — nó chỉ để trải nghiệm có kiểm soát. */
'use strict';
const ADMIN_OPTS = [
  { k: 'lv', n: 'Lên thẳng cấp trần',
    d: 'Cấp = trần hiện tại, cộng đủ điểm tiềm năng (5/cấp) và điểm võ công (1/cấp)',
    fn: () => { const gap = Math.max(0, MAX_LEVEL - S.lvl); S.lvl = MAX_LEVEL; S.attrPts += gap * PTS_PER_LEVEL; S.skPts += gap * SKILL_PTS_PER_LEVEL; return 'Cấp ' + MAX_LEVEL + ' (+' + gap * PTS_PER_LEVEL + ' điểm tiềm năng, +' + gap + ' điểm võ công)'; } },
  { k: 'gold', n: 'Ngân lượng',
    d: 'Cộng 10.000.000 lượng',
    fn: () => { S.gold += 1e7; return '+10.000.000 lượng'; } },
  { k: 'mats', n: 'Nguyên liệu đầy đủ',
    d: '99 Huyền Tinh mỗi cấp 1–5, 20 Tinh Hồng Bảo Thạch, 50 Thủy Tinh Trắng / Thần Bí Khoáng Thạch',
    fn: () => { for (let l = 1; l <= 5; l++) matAdd('ht', l, 99); matAdd('misc', 'thbt', 20); matAdd('misc', 'wc', 50); matAdd('misc', 'mys', 50); return 'đã thêm nguyên liệu'; } },
  { k: 'zones', n: 'Mở toàn bộ vùng',
    d: 'Mở hết ải để xem mọi bản đồ và mọi loại quái',
    fn: () => { S.maxStage = Math.max(S.maxStage, STAGES); S.stage = S.maxStage; return 'mở tới ải ' + STAGES; } },
  { k: 'enh', n: 'Cường hoá +10 toàn bộ đồ đang mặc',
    d: 'Mọi món đang mặc lên +' + ENH_MAX + ' (thuộc tính gốc +' + Math.round(ENH_STEP * ENH_MAX * 100) + '%)',
    fn: () => { let n = 0; for (const k in S.eq) { const it = S.eq[k]; if (it) { it.enh = ENH_MAX; n++; } } return 'đã cường hoá ' + n + ' món lên +' + ENH_MAX; } },
  { k: 'gear', n: 'Một bộ Hoàng Kim đủ ô',
    d: 'Phát đủ bộ Hoàng Kim của phái đang chơi, mặc được ở cấp hiện tại (mức may mắn tối đa). Đồ đang mặc được cất vào hành trang',
    fn: () => {
      const f = FAC[S.fac]; if (!f) return 'chưa chọn phái';
      const lvOf = r => (r.req.find(q => q[0] === 36) || [0, 0])[1];
      const facOf = r => (r.req.find(q => q[0] === 39) || [0, -1])[1];
      const mine = J.sets.gold.filter(r => facOf(r) === f.id && sexReqOk(r.req));
      if (!mine.length) return 'không có bộ nào phù hợp';
      // bộ mặc được ngay (đủ cấp) -- nếu chưa có bộ nào thì lấy bộ thấp cấp nhất
      const ok = mine.filter(r => lvOf(r) <= S.lvl), pool = ok.length ? ok : mine.filter(r => lvOf(r) === Math.min(...mine.map(lvOf)));
      const grp = {}; for (const r of pool) (grp[r.grp] = grp[r.grp] || []).push(r);
      const best = Object.values(grp).sort((a, b) => b.length - a.length || lvOf(b[0]) - lvOf(a[0]))[0].slice(0, 11);
      let n = 0;
      for (const r of best) {
        const k = slotFor(r); if (!k) continue;
        try {
          const it = makeSetItem('gold', r, 10), old = S.eq[k];
          if (old) { if (S.inv.length >= INV_MAX) makeRoom(old, true); S.inv.unshift(old); }   // không làm mất đồ đang mặc
          S.eq[k] = it; n++;
        } catch (e) { /* bo qua mon loi */ }
      }
      return 'đã mặc ' + n + ' món bộ Hoàng Kim' + (ok.length ? '' : ' (chưa đủ cấp: cần lên cấp để dùng)');
    } },
  { k: 'unlock', n: 'Mở khoá tính năng',
    d: 'Tháp thử thách, đồng hành (không cần đủ cấp), gọi ngay Trùm Hoàng Kim và thêm 5 lượt Tài Xỉu hôm nay',
    fn: () => { const r = RW(); r.unlockAll = 1; r.gbT = 0; const t = txState(); t.luot = Math.max(0, t.luot - 5); return 'đã mở khoá (tháp, đồng hành, trùm Hoàng Kim, +5 lượt Tài Xỉu)'; } },
];
const adminHomNay = () => localISODay();
const adminDaDung = () => false; // MOD: Khong gioi han luot dung
function adminApply(k) {
  const o = ADMIN_OPTS.find(x => x.k === k); if (!o) return;
  let kq = 'xong';
  try { kq = o.fn() || 'xong'; } catch (e) { toast('Lỗi: ' + (e && e.message)); return; }
  R.dirty = true; invDirty = true;
  try { recalc(); } catch (e) { /* bo qua */ }
  save();
  toast('Thử nghiệm: ' + o.n + ' — ' + kq);
  try { log('<span style="color:#8fe34a">[Thử nghiệm]</span> ' + esc(o.n) + ' — ' + esc(kq)); } catch (e) { /* bo qua */ }
  if (typeof renderAll === 'function') renderAll();
}
function adminModal() {
  modal('<h3>Bảng thử nghiệm <small style="color:#8fe34a">★ MOD: Vô hạn lượt dùng</small></h3>'
    + '<p class="desc">Chọn option để kích hoạt ngay (bạn có thể bấm nhiều lần tùy thích):</p>'
    + ADMIN_OPTS.map(o => '<div class="card"><b>' + esc(o.n) + '</b><br><small class="dim">' + esc(o.d) + '</small>'
      + '<div class="btnrow"><button class="btn" data-ad="' + o.k + '">Kích hoạt</button></div></div>').join('')
    + '<div class="btnrow"><button class="btn" onclick="closeModal()">Đóng</button></div>', () => {
      document.querySelectorAll('#mBody [data-ad]').forEach(b => b.onclick = () => { adminApply(b.dataset.ad); });
    });
}
window.adminModal = adminModal;

