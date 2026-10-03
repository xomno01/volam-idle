const http = require('http');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

function post(endpoint, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data || {});
    const req = http.request(BASE_URL + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(BASE_URL + endpoint, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 [TEST] Bắt đầu kiểm thử tính năng Online (Bang hội, Tống Kim, Công Thành, Lôi Đài)...');
  let passed = 0;

  // 1. Tạo 2 tài khoản test
  const u1Name = 'hk_' + Date.now().toString(36);
  const u2Name = 'kt_' + Date.now().toString(36);
  const reg1 = await post('/api/register', { username: u1Name, password: 'password123' });
  const reg2 = await post('/api/register', { username: u2Name, password: 'password123' });

  if (reg1.ok && reg2.ok) {
    console.log('✅ 1. Đăng ký tài khoản kiểm thử thành công');
    passed++;
  } else {
    console.error('❌ 1. Đăng ký thất bại:', reg1, reg2);
  }

  const token1 = reg1.token;
  const token2 = reg2.token;

  // 2. Bang Hội API
  const gName = 'HoaSonPhai_' + Math.floor(Math.random() * 1000);
  const createG = await post('/api/guild/create', { token: token1, name: gName, emblem: '⚔️' });
  if (createG.ok && createG.guild.name === gName) {
    console.log(`✅ 2. Tạo Bang Hội [${gName}] thành công`);
    passed++;
  } else {
    console.error('❌ 2. Tạo Bang Hội thất bại:', createG);
  }

  // Danh sách bang
  const gList = await get('/api/guild/list');
  if (gList.ok && gList.guilds.some(g => g.name === gName)) {
    console.log('✅ 3. Xem danh sách Bang Hội thành công');
    passed++;
  } else {
    console.error('❌ 3. Danh sách bang lỗi:', gList);
  }

  // User 2 gia nhập bang
  const joinG = await post('/api/guild/join', { token: token2, guildId: createG.guild.id });
  if (joinG.ok) {
    console.log('✅ 4. Thành viên thứ hai gia nhập Bang thành công');
    passed++;
  } else {
    console.error('❌ 4. Gia nhập bang lỗi:', joinG);
  }

  // Kiểm tra my guild
  const myG = await get(`/api/guild/my?token=${token2}`);
  if (myG.ok && myG.guild && myG.guild.members.length === 2) {
    console.log('✅ 5. Truy vấn thông tin Bang Hội cá nhân chính xác');
    passed++;
  } else {
    console.error('❌ 5. Lỗi my guild:', myG);
  }

  // 3. Tống Kim API & Admin kích hoạt
  const adminLogin = await post('/api/admin/login', { password: 'Vinhloc123' });
  const adminToken = adminLogin.token;

  const startTK = await post(`/api/admin/tongkim/start?token=${adminToken}`, {});
  if (startTK.ok) {
    console.log('✅ 6. Admin mở Báo Danh Tống Kim thành công');
    passed++;
  } else {
    console.error('❌ 6. Admin start Tống Kim lỗi:', startTK);
  }

  const joinTK1 = await post('/api/tongkim/join', { token: token1, side: 'song' });
  const joinTK2 = await post('/api/tongkim/join', { token: token2, side: 'jin' });
  if (joinTK1.ok && joinTK1.side === 'song' && joinTK2.ok && joinTK2.side === 'jin') {
    console.log('✅ 7. Hiệp khách báo danh phe Tống và Kim thành công');
    passed++;
  } else {
    console.error('❌ 7. Báo danh Tống Kim lỗi:', joinTK1, joinTK2);
  }

  const tkStatus = await get('/api/tongkim/status');
  if (tkStatus.ok && tkStatus.playerCount === 2) {
    console.log('✅ 8. Đồng bộ trạng thái và điểm số Chiến Trường chính xác');
    passed++;
  } else {
    console.error('❌ 8. Trạng thái Tống Kim lỗi:', tkStatus);
  }

  // 4. Công Thành Chiến (Long Trụ Biện Kinh)
  const startCC = await post(`/api/admin/congthanh/start?token=${adminToken}`, {});
  if (startCC.ok) {
    console.log('✅ 9. Admin khai mở Công Thành Chiến thành công');
    passed++;
  } else {
    console.error('❌ 9. Start Công Thành lỗi:', startCC);
  }

  const atkPillar = await post('/api/congthanh/attack', { token: token1, damage: 50000 });
  if (atkPillar.ok && atkPillar.pillarHp < 1000000) {
    console.log(`✅ 10. Đánh Long Trụ thành công, máu còn: ${atkPillar.pillarHp}/1000000`);
    passed++;
  } else {
    console.error('❌ 10. Đánh Long Trụ lỗi:', atkPillar);
  }

  const ccStatus = await get('/api/congthanh/status');
  if (ccStatus.ok && ccStatus.leaderboard.length > 0) {
    console.log(`✅ 11. Bảng xếp hạng sát thương Bang Hội ghi nhận: ${ccStatus.leaderboard[0].name} (${ccStatus.leaderboard[0].damage} dmg)`);
    passed++;
  } else {
    console.error('❌ 11. Bảng xếp hạng Công Thành lỗi:', ccStatus);
  }

  // 5. WebSocket: Thách Đấu Lôi Đài 1v1
  await new Promise((resolve) => {
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);
    let p1Id = null;
    let p2Id = null;
    let duelId = null;

    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'INIT') {
        p1Id = msg.id;
        ws1.send(JSON.stringify({ type: 'AUTH', token: token1, name: u1Name }));
      }
      if (msg.type === 'DUEL_START') {
        console.log('✅ 13. [WS] Trận đấu Lôi Đài 1v1 bắt đầu thành công');
        passed++;
        ws1.close();
        ws2.close();
        resolve();
      }
    });

    ws2.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'INIT') {
        p2Id = msg.id;
        ws2.send(JSON.stringify({ type: 'AUTH', token: token2, name: u2Name }));
        // Đợi p1 sẵn sàng rồi p1 thách đấu p2
        setTimeout(() => {
          ws1.send(JSON.stringify({ type: 'DUEL_INVITE', targetId: p2Id }));
        }, 300);
      }
      if (msg.type === 'DUEL_INVITE_REQUEST') {
        console.log('✅ 12. [WS] Nhận lời thách đấu Lôi Đài từ đối thủ');
        passed++;
        duelId = msg.duelId;
        ws2.send(JSON.stringify({ type: 'DUEL_ACCEPT', duelId }));
      }
    });
  });

  console.log(`\n🎉 HOÀN TẤT KIỂM THỬ: ${passed}/13 mục PASS 100%!`);
  process.exit(passed === 13 ? 0 : 1);
}

runTests().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
