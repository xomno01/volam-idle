/* ======================= KHOI DONG + VONG LAP ======================= */
'use strict';
let lastT = performance.now(), saveT = 0, uiT = 0, drawTog = false;
/* Tuy chon hien thi luu rieng cho thiet bi (khong theo nhan vat): thu gon, co chu, tiet kiem pin */
const UI_KEY = 'jxidle_ui', UI_FS = [0.9, 1, 1.15, 1.3], UI_FS_NAME = ['Nhỏ', 'Vừa', 'Lớn', 'Rất lớn'];
let UIP = null;
function uiPrefs() {
  if (!UIP) { try { UIP = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) { UIP = {}; } }
  UIP.fs = Number.isInteger(UIP.fs) && UIP.fs >= 0 && UIP.fs < UI_FS.length ? UIP.fs : 1; UIP.saver = !!UIP.saver; UIP.compact = !!UIP.compact;
  return UIP;
}
function applyUiPrefs() { const p = uiPrefs(); document.documentElement.style.setProperty('--fs', UI_FS[p.fs]); document.body.classList.toggle('saver', p.saver); document.body.classList.toggle('compact', p.compact); }
function setUiPref(o) { Object.assign(uiPrefs(), o); try { localStorage.setItem(UI_KEY, JSON.stringify(UIP)); } catch (e) { /* che do rieng tu */ } applyUiPrefs(); fitApp(); }
function onZoneChange(z) { obsLoad(z.id); [H.x, H.y] = inWorld(H.x, H.y); for (const e of R.enemies) [e.x, e.y] = inWorld(e.x, e.y); for (const d of R.ground) [d.x, d.y] = inWorld(d.x, d.y); snapCamera(); R.bgImg = z.bg ? img(z.bg) : null; playMusic(z.id); preloadZoneSounds(z); if (curTab === 'log') refresh(); }
function onStageChange() { if (curTab === 'log') refresh(); }
function onLevelUp() { if (S.autoPts === true) { autoSpendAttrs(); autoSpendSkills(); } autoEquipAll(); if (!R.quiet) { checkHints(); updateDots(); renderPad(); dotGift(); if (LV_MS.some(m => m[0] === S.lvl)) toast(`Đạt mốc cấp ${S.lvl}: nhận quà ở nút 🎁`); } }
/* Mo phong buoc co dinh 60 lan / giay + noi suy vi tri khi ve: chuyen dong deu, khong giat theo toc do khung hinh */
const STEP = 1 / 60, MAX_STEPS = 10, LERP_MAX = 120;
let simAcc = 0;
function movers() { return [H, R.petPos].concat(SV.on ? SV.en : R.enemies).filter(Boolean); }
/* B: toc do game (x1 / x1.5 / x2.5). Nhan vao THOI GIAN MO PHONG, khong phai so buoc moi khung,
   nen mo phong van buoc co dinh 1/60s -> vat ly va ti le trung don khong doi, chi nhanh hon.
   Giao dien (uiT) va nhip luu (saveT) VAN chay theo thoi gian thuc. */
const gameSpeed = () => (S && [1, 1.5, 2.5].includes(+S.speed) ? +S.speed : 1);
function simulateFrame(dt) {
  simAcc += dt * gameSpeed(); let n = 0;
  while (simAcc >= STEP && n < MAX_STEPS) {
    for (const o of movers()) { o._px = o.x; o._py = o.y; }
    if (SV.on) svTick(STEP); else tick(STEP);
    const hdx = H.x - H._px, hdy = H.y - H._py;
    if (Math.hypot(hdx, hdy) > 0.08) {
      H._lastMoveTime = performance.now();
      H._isMoving = true;
      if (H.act !== 'at' && typeof dirOf === 'function') H.dir = dirOf(hdx, hdy);
      if (Math.abs(hdx) > 0.02) H.face = hdx >= 0 ? 1 : -1;
    }
    simAcc -= STEP; n++;
  }
  if (n === MAX_STEPS) simAcc = 0;                       // may cham: bo phan tre, khong don buoc
  if (performance.now() - (H._lastMoveTime || 0) > 120) {
    H._isMoving = false;
  }
}
function drawLerp(dt) {
  const a = simAcc / STEP, list = movers().filter(o => o._px !== undefined && Math.hypot(o.x - o._px, o.y - o._py) < LERP_MAX);
  for (const o of list) { o._cx = o.x; o._cy = o.y; o.x = o._px + (o.x - o._px) * a; o.y = o._py + (o.y - o._py) * a; }
  try { if (SV.on) svDraw(dt); else draw(dt); }
  finally { for (const o of list) { o.x = o._cx; o.y = o._cy; } }
}
/* Vong lap khong bao gio chet: moi buoc co try / catch rieng va luon dat lai requestAnimationFrame. Truoc day mot loi trong mot khung
   (tick, ve, cap nhat giao dien) lam vong lap dung han, tro choi dung hinh va nut khong con tac dung.
   Loi lap lai lien tuc: don trang thai chien dau (hieu ung, quai, vat roi tren dat) de thoat ket. */
let loopErr = 0, loopLast = '';
function guard(what, fn) {
  try { fn(); loopErr = Math.max(0, loopErr - 0.02); }
  catch (e) {
    loopErr++; const k = what + ': ' + (e && e.message);
    if (k !== loopLast) { loopLast = k; console.error('[loi vong lap]', what, e); }
    if (loopErr > 30) {
      loopErr = 0; R.fx = []; R.txt = []; R.enemies = []; if (typeof SV !== 'undefined' && SV.on) { try { svExit(); } catch (x) { SV.on = false; } }
      R.spawnT = 0.5; R.deadT = 0; simAcc = 0; R.quiet = false; closeModal(true);
      // QA-054: truoc day xoa trang thai hoan toan IM LANG - nguoi choi mat quai/hieu ung ma khong biet vi sao.
      try { if (typeof toast === 'function') toast('Có lỗi lặp lại: đã dọn trạng thái chiến đấu để game tiếp tục.'); } catch (x) { /* bo qua */ }
      if (typeof log === 'function') log('<span class="dim">Phát hiện lỗi lặp lại — đã dọn quái và hiệu ứng để game chạy tiếp.</span>');
    }
  }
}
function frame(now) {
  const dt = Math.min(0.25, (now - lastT) / 1000); lastT = now;
  guard('tay cam', gamepadPoll);
  const sdt = dt * gameSpeed();   // B: hieu ung cung chay theo toc do game, neu khong se lech voi mo phong
  if (S.fac && !document.hidden) { guard('mo phong', () => simulateFrame(dt)); if (!uiPrefs().saver || (drawTog = !drawTog)) guard('ve', () => drawLerp(sdt)); }
  uiT += dt;
  if (uiT > 0.1 && S.fac) {
    uiT = 0;
    guard('giao dien', () => {
      updateTop(); updatePadCd();
      if (R.logDirty && curTab === 'log') { R.logDirty = false; renderLogOnly(); }
      if (invDirty && curTab === 'inv') renderInv();
    });
  }
  saveT += dt;
  if (saveT > 10 && S.fac) guard('luu', () => { saveT = 0; loginCheck(); achCheck(); dotGift(); const el = R.activeT || 0; if (el > 30) { S.kps = R.kills / el; saveKps(); } save(); });
  requestAnimationFrame(frame);
}
function showOffline(o) {
  if (!o) return;
  const h = Math.floor(o.secs / 3600), m = Math.floor(o.secs % 3600 / 60);
  modal(`<h3>Chào mừng trở lại!</h3><p class="desc">Vắng mặt ${h ? h + ' giờ ' : ''}${m} phút, nhân vật vẫn luyện công tại ${esc(zoneOf(Math.min(S.stage, STAGES)).n)}.</p>
    <div class="card stats"><span>Quái bị hạ</span><span>${fmt(o.kills)}</span><span>Kinh nghiệm</span><span>${fmt(o.xp)}</span>
    <span>Ngân lượng</span><span>${fmt(o.gold)}</span><span>Cấp</span><span>${o.lv0} → ${o.lv1}</span><span>Vật phẩm</span><span>${o.got}${o.sold ? ` (+${o.sold} bán)` : ''}</span>
    <span>Rương tu luyện</span><span>${o.chests || 0} / 3 mốc (1 · 4 · 8 giờ)</span></div>
    ${o.chests ? '<p class="desc">Quà các mốc đã vào túi — xem nhật ký Giang hồ.</p>' : ''}
    <div class="btnrow"><button class="btn" onclick="closeModal()">Nhận</button></div>`);
}
/* Chieu cao that cua vung nhin (Safari / Chrome dien thoai: 100vh tinh ca phan bi thanh cong cu che -> thanh tab bi day xuong
   duoi, khong cham duoc). Dat --app-h theo visualViewport moi khi doi kich thuoc. */
function fitApp() {
  document.body.classList.toggle('mob', isMobileUI());
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  if (CV) resizeArena();
}
/* Che do thu gon: an bang thong tin + thanh tab, san dau chiem ca man hinh; nho theo trinh duyet */
function setCompact(on) { setUiPref({ compact: on }); if (!on && S.fac) refresh(); }
function init() {
  const pk = pickSlot(); SLOT = pk.slot;
  if (pk.menu) { S = newSave(); }          // man hinh chon nhan vat: chua nap nhan vat nao
  const had = pk.menu ? false : load();
  CV = $('#arena'); CX = CV.getContext('2d');
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) showTab(b.dataset.t); });   // uy quyen su kien: khong mat khi gan lai onclick
  $('#mClose').onclick = () => closeModal();
  $('#giftBtn').onclick = () => { if (S.fac) { uiSfx('click'); giftModal(); } };
  $('#svBtn').onclick = () => { uiSfx('click'); svIntro(); };
  $('#svPauseBtn').onclick = () => svPause();
  const ultBtn = $('#svUlt'); if (ultBtn) ultBtn.onclick = () => svCastUlt();
  const bombBtn = $('#svBomb'); if (bombBtn) bombBtn.onclick = () => svUseBomb();
  const hpBtn = $('#svHpBtn'); if (hpBtn) hpBtn.onclick = () => svUseHp();
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  window.addEventListener('resize', fitApp); window.addEventListener('orientationchange', fitApp);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitApp);
  $('#compactBtn').onclick = () => setCompact(!document.body.classList.contains('compact'));
  applyUiPrefs();
  fitApp();
  bindControls();
  const unlock = () => { audInit(); const z = zoneOf(Math.min(S.stage, STAGES)); preloadZoneSounds(z); if (AUD.music && sndCfg().music && AUD.music.paused) AUD.music.play().catch(() => {}); else if (!AUD.music && S.fac) playMusic(R.town ? W.town.id : z.id); };
  document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
  resizeArena(); [H.x, H.y] = inWorld(WORLD.w / 2, WORLD.h / 2); snapCamera(); restoreGround();
  if (pk.menu) { slotMenu(); }
  else if (!S.fac) { pickFaction(); }
  else {
    recalc(); R.life = R.P.life; R.mana = R.P.mana;
    if (had) { recalc(); showOffline(offlineGains()); }
    showTab('log'); log('Tiếp tục hành tẩu giang hồ…');
    if (window.__tampered) { log('<span class="dim">Dữ liệu lưu không khớp chữ ký (đã chỉnh sửa ngoài game): dùng bản sao lưu gần nhất nếu có.</span>'); toast('Phát hiện chỉnh sửa file lưu'); }
    loginCheck(); dotGift();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (S.fac) save(); if (SV.on) svPause(); }
    else if (S.fac && !SV.on && Date.now() - S.last > 60000) { R.dirty = true; recalc(); showOffline(offlineGains()); refresh(); }
    lastT = performance.now();
  });
  window.addEventListener('pagehide', () => { if (S.fac) save(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(); });   // Esc dong hop thoai (hop thoai khoa thi bo qua)
  requestAnimationFrame(frame);
}
init();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
