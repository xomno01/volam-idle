const assert = require("assert");
const http = require("http");
const WebSocket = require("ws");

const BASE_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3000";

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
      });
    }).on("error", reject);
  });
}

async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP VÕ LÂM ONLINE ===");

  // 1. Test Auth: Register Player 1
  const p1User = "kiemthan_" + Math.floor(Math.random() * 10000);
  console.log(`[TEST 1] Đăng ký tài khoản: ${p1User}...`);
  const regRes = await postJson(`${BASE_URL}/api/register`, {
    username: p1User,
    password: "password123"
  });
  assert.strictEqual(regRes.ok, true, "Đăng ký phải thành công");
  assert.ok(regRes.token, "Phải có token");
  const p1Token = regRes.token;
  console.log("  -> Đăng ký thành công!");

  // 2. Test Auth: Login
  console.log(`[TEST 2] Đăng nhập tài khoản...`);
  const loginRes = await postJson(`${BASE_URL}/api/login`, {
    username: p1User,
    password: "password123"
  });
  assert.strictEqual(loginRes.ok, true, "Đăng nhập phải thành công");
  console.log("  -> Đăng nhập thành công!");

  // 3. Test Cloud Save & Load
  console.log(`[TEST 3] Lưu và Nạp dữ liệu đám mây (Cloud Save/Load)...`);
  const dummyState = { name: "Lệnh Hồ Xung", lvl: 45, stage: 12, gold: 500000 };
  const saveRes = await postJson(`${BASE_URL}/api/save`, {
    token: p1Token,
    slot: 0,
    state: dummyState
  });
  assert.strictEqual(saveRes.ok, true, "Lưu cloud phải thành công");

  const loadRes = await getJson(`${BASE_URL}/api/load?token=${p1Token}&slot=0`);
  assert.strictEqual(loadRes.ok, true, "Nạp cloud phải thành công");
  assert.strictEqual(loadRes.state.name, "Lệnh Hồ Xung", "Dữ liệu nạp phải khớp");
  console.log("  -> Cloud Save/Load hoạt động hoàn hảo!");

  // 4. Test WebSocket Real-time Multiplayer (Player 1 & Player 2)
  console.log(`[TEST 4] Kiểm thử Đồng bộ nhiều người chơi thời gian thực (WebSocket)...`);

  const ws1 = new WebSocket(WS_URL);
  const ws2 = new WebSocket(WS_URL);

  let p1ReceivedJoin = false;
  let p2ReceivedMove = false;
  let bothReceivedDmg = 0;
  let p2ReceivedChat = false;
  let sharedMonsterId = null;

  await new Promise((resolve) => {
    let connected = 0;
    const onOpen = () => {
      connected++;
      if (connected === 2) resolve();
    };
    ws1.on("open", onOpen);
    ws2.on("open", onOpen);
  });

  ws1.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.type === "ZONE_INIT") {
      assert.ok(msg.monsters.length > 0, "Bãi quái phải có quái vật");
      sharedMonsterId = msg.monsters[0].id;
    }
    if (msg.type === "PLAYER_JOIN" && msg.player.name === "Độc Cô Cầu Bại") {
      p1ReceivedJoin = true;
    }
    if (msg.type === "MONSTER_DAMAGE") {
      bothReceivedDmg++;
    }
  });

  ws2.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.type === "REMOTE_PLAYER_MOVE" && msg.x === 850 && msg.y === 920) {
      p2ReceivedMove = true;
    }
    if (msg.type === "MONSTER_DAMAGE") {
      bothReceivedDmg++;
    }
    if (msg.type === "CHAT" && msg.text === "Huynh đệ, cùng ta diệt quái!") {
      p2ReceivedChat = true;
    }
  });

  // Player 1 join Hoa Son (Zone 2)
  ws1.send(JSON.stringify({
    type: "AUTH",
    token: p1Token,
    name: "Lệnh Hồ Xung",
    fac: 0,
    lvl: 45
  }));
  ws1.send(JSON.stringify({ type: "JOIN_MAP", zoneId: 2, x: 768, y: 768 }));

  await new Promise(r => setTimeout(r, 200));

  // Player 2 join Hoa Son (Zone 2)
  ws2.send(JSON.stringify({
    type: "SET_PROFILE",
    name: "Độc Cô Cầu Bại",
    fac: 3,
    lvl: 80
  }));
  ws2.send(JSON.stringify({ type: "JOIN_MAP", zoneId: 2, x: 800, y: 800 }));

  await new Promise(r => setTimeout(r, 300));
  assert.strictEqual(p1ReceivedJoin, true, "Player 1 phải nhìn thấy Player 2 vào map");
  console.log("  -> Player 1 đã nhận diện Player 2 xuất hiện trong cùng bản đồ!");

  // Player 1 di chuyển
  ws1.send(JSON.stringify({
    type: "MOVE",
    x: 850,
    y: 920,
    dir: 2,
    isAttacking: false
  }));

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(p2ReceivedMove, true, "Player 2 phải thấy Player 1 di chuyển tới (850, 920)");
  console.log("  -> Player 2 đã nhận gói tin di chuyển mượt mà của Player 1!");

  // Player 1 tấn công quái vật chung
  assert.ok(sharedMonsterId, "Phải có ID quái vật chung");
  ws1.send(JSON.stringify({
    type: "ATTACK_MONSTER",
    monsterId: sharedMonsterId,
    skillDamage: 120
  }));

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(bothReceivedDmg, 2, "Cả Player 1 và Player 2 đều phải nhận thông báo sát thương quái");
  console.log("  -> Cả 2 người chơi cùng nhìn thấy quái vật bị mất máu thời gian thực!");

  // Player 1 chat thế giới
  ws1.send(JSON.stringify({
    type: "CHAT",
    channel: "world",
    text: "Huynh đệ, cùng ta diệt quái!"
  }));

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(p2ReceivedChat, true, "Player 2 phải nhận được tin nhắn chat của Player 1");
  console.log("  -> Kênh chat thế giới hoạt động tức thì!");

  ws1.close();
  ws2.close();

  console.log("\n=======================================================");
  console.log("🎉 TẤT CẢ CÁC BÀI KIỂM THỬ THỜI GIAN THỰC ĐỀU ĐẠT 100%!");
  console.log("=======================================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error("❌ Thất bại:", err);
  process.exit(1);
});
