/**
 * KIỂM THỬ TOÀN DIỆN HỆ THỐNG ONLINE & ADMIN DASHBOARD
 * Võ Lâm Online - Automated Integration Test Suite
 */
const http = require('http');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

function post(path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(BASE_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE_URL + path, {
      method: 'GET',
      headers: { ...headers }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   BẮT ĐẦU CHẠY KIỂM THỬ HỆ THỐNG VÕ LÂM ONLINE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Kiểm tra Admin Auth
    console.log('[1] Kiểm tra Xác thực Admin...');
    const badAdmin = await post('/api/admin/login', { password: 'wrong_password' });
    assert(!badAdmin.data.ok, 'Đăng nhập mật khẩu sai bị từ chối');

    const goodAdmin = await post('/api/admin/login', { password: 'Vinhloc123' });
    assert(goodAdmin.data.ok && goodAdmin.data.token, 'Đăng nhập mật khẩu Vinhloc123 thành công');
    const adminToken = goodAdmin.data.token;
    const adminHeaders = { 'x-admin-token': adminToken };

    // 2. Reset ban đầu để fresh
    console.log('\n[2] Reset dữ liệu test ban đầu...');
    const wipeRes = await post('/api/admin/server-wipe', { confirmKey: 'WIPE-CONFIRM' }, adminHeaders);
    assert(wipeRes.data.ok, 'Reset server thành công bằng WIPE-CONFIRM');

    // 3. Đăng ký & Đăng nhập Người chơi
    console.log('\n[3] Kiểm tra Đăng ký & Đăng nhập Người chơi...');
    const shortUser = await post('/api/register', { username: 'ab', password: '123' });
    assert(!shortUser.data.ok, 'Tài khoản quá ngắn bị từ chối');

    const regP1 = await post('/api/register', { username: 'hiepkhach1', password: 'password123' });
    assert(regP1.data.ok && regP1.data.token, 'Đăng ký hiepkhach1 thành công');
    const p1Token = regP1.data.token;
    const p1Id = regP1.data.user.id;

    const regDup = await post('/api/register', { username: 'hiepkhach1', password: 'password123' });
    assert(!regDup.data.ok, 'Trùng tài khoản hiepkhach1 bị chặn');

    const regP2 = await post('/api/register', { username: 'hiepkhach2', password: 'password456' });
    assert(regP2.data.ok, 'Đăng ký hiepkhach2 thành công');
    const p2Token = regP2.data.token;
    const p2Id = regP2.data.user.id;

    const loginFail = await post('/api/login', { username: 'hiepkhach1', password: 'sai_mat_khau' });
    assert(!loginFail.data.ok, 'Đăng nhập sai mật khẩu bị chặn');

    const loginOk = await post('/api/login', { username: 'hiepkhach1', password: 'password123' });
    assert(loginOk.data.ok && loginOk.data.user.username === 'hiepkhach1', 'Đăng nhập đúng mật khẩu thành công');

    // 4. Lưu và Nạp dữ liệu đám mây
    console.log('\n[4] Kiểm tra Lưu trữ đám mây (Cloud Save)...');
    const saveState = {
      name: 'Lệnh Hồ Xung',
      fac: 'huashan',
      lvl: 25,
      gold: 50000,
      stage: 5,
      mats: { ht: { 3: 5 } }
    };
    const saveRes = await post('/api/save', { token: p1Token, slot: 0, state: saveState });
    assert(saveRes.data.ok, 'Lưu nhân vật Lệnh Hồ Xung lên Cloud thành công');

    const loadRes = await get(`/api/load?token=${p1Token}&slot=0`);
    assert(loadRes.data.ok && loadRes.data.state.name === 'Lệnh Hồ Xung', 'Tải nhân vật từ Cloud chuẩn xác');

    // 5. Admin Overview & Player List
    console.log('\n[5] Kiểm tra Admin Dashboard Overview & Danh sách người chơi...');
    const overview = await get('/api/admin/overview', adminHeaders);
    assert(overview.data.ok && overview.data.totalAccounts >= 2, `Overview báo cáo tổng ${overview.data.totalAccounts} tài khoản`);

    const players = await get('/api/admin/players', adminHeaders);
    assert(players.data.ok && players.data.players.length === 2, `Danh sách người chơi đủ 2 người`);

    const searchP1 = await get('/api/admin/players?q=hiepkhach1', adminHeaders);
    assert(searchP1.data.ok && searchP1.data.players[0].username === 'hiepkhach1', 'Tìm kiếm người chơi chính xác');

    // 6. Admin Sửa chỉ số & Phát quà
    console.log('\n[6] Kiểm tra Sửa chỉ số & Phát quà...');
    const updateStats = await post('/api/admin/player/update', {
      userId: p1Id,
      updates: { lvl: 80, gold: 999999, name: 'Độc Cô Cầu Bại' }
    }, adminHeaders);
    assert(updateStats.data.ok && updateStats.data.state.lvl === 80, 'Admin đổi cấp độ thành 80 thành công');

    const giveGift = await post('/api/admin/player/give', {
      userId: p1Id,
      gift: { gold: 5000000, htLevel: 5, htAmount: 10, message: 'Thưởng Admin' }
    }, adminHeaders);
    assert(giveGift.data.ok && giveGift.data.state.mats.ht[5] === 10, 'Tặng 10 Huyền Tinh Cấp 5 thành công');

    // 7. WebSocket Real-time & Kiểm tra Broadcast "Thông Báo Toàn Server"
    console.log('\n[7] Kiểm tra Kết nối WebSocket & Phát Thông Báo Toàn Server...');
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);

    let ws1Connected = false, ws2Connected = false;
    let ws1NoticeReceived = null, ws2NoticeReceived = null;
    let ws2KickedReceived = false;

    await new Promise((resolve) => {
      let openCount = 0;
      const onOpen = () => {
        openCount++;
        if (openCount === 2) resolve();
      };
      ws1.on('open', onOpen);
      ws2.on('open', onOpen);
    });

    ws1.send(JSON.stringify({ type: 'AUTH', token: p1Token, name: 'Độc Cô Cầu Bại', fac: 1, lvl: 80 }));
    ws2.send(JSON.stringify({ type: 'AUTH', token: p2Token, name: 'Thiếu Hiệp 2', fac: 2, lvl: 10 }));

    ws1.on('message', data => {
      try {
        const m = JSON.parse(data);
        if (m.type === 'SYSTEM_NOTICE') ws1NoticeReceived = m;
      } catch (e) {}
    });

    ws2.on('message', data => {
      try {
        const m = JSON.parse(data);
        if (m.type === 'SYSTEM_NOTICE') ws2NoticeReceived = m;
        if (m.type === 'KICKED') ws2KickedReceived = true;
      } catch (e) {}
    });

    // Đợi 200ms để auth hoàn tất
    await new Promise(r => setTimeout(r, 200));

    // Admin phát thông báo
    const broadcastRes = await post('/api/admin/broadcast', {
      text: '📢 HỠI CÁC HIỆP KHÁCH: MÁY CHỦ SẮP KHAI MỞ SỰ KIỆN!',
      color: '#ffdd4a'
    }, adminHeaders);
    assert(broadcastRes.data.ok, 'Gửi yêu cầu phát Broadcast từ Admin thành công');

    // Đợi 300ms nhận tin
    await new Promise(r => setTimeout(r, 300));
    assert(ws1NoticeReceived && ws1NoticeReceived.text.includes('KHAI MỞ SỰ KIỆN'), 'Người chơi 1 nhận được Thông Báo Toàn Server qua WebSocket!');
    assert(ws2NoticeReceived && ws2NoticeReceived.text.includes('KHAI MỞ SỰ KIỆN'), 'Người chơi 2 nhận được Thông Báo Toàn Server qua WebSocket!');

    // 8. Admin Triệu Hồi Boss
    console.log('\n[8] Kiểm tra Admin Triệu Hồi Boss...');
    const spawnRes = await post('/api/admin/spawn-boss', { zoneId: 2, bossTid: 'ani061' }, adminHeaders);
    assert(spawnRes.data.ok && spawnRes.data.boss, `Triệu hồi thành công Boss [${spawnRes.data.boss.n}] tại bản đồ 2`);

    // 9. Admin Kick Người Chơi
    console.log('\n[9] Kiểm tra Admin Kick Người Chơi...');
    const kickRes = await post('/api/admin/player/kick', { userId: p2Id, reason: 'Treo máy quá lâu' }, adminHeaders);
    assert(kickRes.data.ok, 'Lệnh kick gửi thành công');
    await new Promise(r => setTimeout(r, 400));
    assert(ws2KickedReceived, 'Người chơi 2 nhận được gói KICKED từ Quản trị viên');

    // 10. Admin Ban & Unban
    console.log('\n[10] Kiểm tra Khóa (Ban) và Mở Khóa Tài Khoản...');
    const banRes = await post('/api/admin/player/ban', { userId: p2Id, reason: 'Sử dụng auto trái phép' }, adminHeaders);
    assert(banRes.data.ok, 'Khóa tài khoản hiepkhach2 thành công');

    const tryLoginBanned = await post('/api/login', { username: 'hiepkhach2', password: 'password456' });
    assert(!tryLoginBanned.data.ok && tryLoginBanned.data.error.includes('khóa'), 'Tài khoản bị khóa không thể đăng nhập lại');

    const unbanRes = await post('/api/admin/player/unban', { userId: p2Id }, adminHeaders);
    assert(unbanRes.data.ok, 'Mở khóa tài khoản hiepkhach2 thành công');

    const tryLoginUnbanned = await post('/api/login', { username: 'hiepkhach2', password: 'password456' });
    assert(tryLoginUnbanned.data.ok, 'Tài khoản sau khi mở khóa đăng nhập bình thường');

    // 11. Final Wipe Server
    console.log('\n[11] Reset server sạch sẽ cuối cùng...');
    const finalWipe = await post('/api/admin/server-wipe', { confirmKey: 'WIPE-CONFIRM' }, adminHeaders);
    assert(finalWipe.data.ok, 'Wipe server sạch dữ liệu thành công chuẩn bị phục vụ người chơi');

    // Đóng sockets
    try { ws1.close(); } catch (e) {}
    try { ws2.close(); } catch (e) {}

  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình chạy test:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`   KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log('======================================================\n');

  if (failed === 0) {
    console.log('🎉 TẤT CẢ CÁC TÍNH NĂNG ĐỀU HOẠT ĐỘNG HOÀN HẢO 100%!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite();
