const assert = require("assert");
const http = require("http");

const BASE_URL = "http://localhost:3000";

function postJson(url, data, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData)
    };
    if (token) headers["x-admin-token"] = token;

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: "POST",
      headers
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function getJson(url, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) headers["x-admin-token"] = token;

    http.get({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    }).on("error", reject);
  });
}

async function runAdminTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ ADMIN DASHBOARD ===");

  // 1. Kiểm tra đăng nhập sai mật khẩu
  console.log("[TEST 1] Đăng nhập sai mật khẩu...");
  const wrongLogin = await postJson(`${BASE_URL}/api/admin/login`, { password: "wrongpassword" });
  assert.strictEqual(wrongLogin.status, 401, "Phải trả về 401 khi sai mật khẩu");
  assert.strictEqual(wrongLogin.data.ok, false);
  console.log("  -> Chặn thành công mật khẩu sai!");

  // 2. Đăng nhập đúng với mật khẩu Vinhloc123
  console.log("[TEST 2] Đăng nhập với mật mã Vinhloc123...");
  const correctLogin = await postJson(`${BASE_URL}/api/admin/login`, { password: "Vinhloc123" });
  assert.strictEqual(correctLogin.status, 200, "Phải đăng nhập thành công với mật khẩu Vinhloc123");
  assert.strictEqual(correctLogin.data.ok, true);
  assert.ok(correctLogin.data.token, "Phải có admin token");
  const adminToken = correctLogin.data.token;
  console.log("  -> Đăng nhập Admin thành công với token:", adminToken.slice(0, 15) + "...");

  // 3. Kiểm tra API Overview
  console.log("[TEST 3] Kiểm tra thông số máy chủ (Overview)...");
  const overview = await getJson(`${BASE_URL}/api/admin/overview`, adminToken);
  assert.strictEqual(overview.status, 200);
  assert.strictEqual(overview.data.ok, true);
  assert.ok(overview.data.memoryUsageMB > 0, "Phải có thông số RAM");
  assert.strictEqual(overview.data.tickRate, 20, "Tick rate phải là 20Hz");
  console.log(`  -> Thông số: RAM = ${overview.data.memoryUsageMB}MB, CCU = ${overview.data.ccu}, Uptime = ${overview.data.uptime}s`);

  // 4. Kiểm tra danh sách người chơi
  console.log("[TEST 4] Lấy danh sách người chơi...");
  const players = await getJson(`${BASE_URL}/api/admin/players`, adminToken);
  assert.strictEqual(players.status, 200);
  assert.strictEqual(players.data.ok, true);
  assert.ok(Array.isArray(players.data.players), "Players phải là mảng");
  console.log(`  -> Tìm thấy ${players.data.players.length} tài khoản trong hệ thống`);

  // 5. Cập nhật chỉ số người chơi
  if (players.data.players.length > 0) {
    const target = players.data.players[0];
    console.log(`[TEST 5] Sửa chỉ số người chơi [${target.username}]...`);
    const updateRes = await postJson(`${BASE_URL}/api/admin/player/update`, {
      userId: target.userId,
      updates: { lvl: 99, gold: 88888888 }
    }, adminToken);
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.state.lvl, 99);
    assert.strictEqual(updateRes.data.state.gold, 88888888);
    console.log("  -> Đã cập nhật thành công Cấp 99 và 88.888.888 lượng!");

    // 6. Phát quà cho người chơi
    console.log(`[TEST 6] Phát quà (Huyền Tinh + Ngân lượng) cho [${target.username}]...`);
    const giftRes = await postJson(`${BASE_URL}/api/admin/player/give`, {
      userId: target.userId,
      gift: { gold: 10000000, htLevel: 5, htAmount: 99 }
    }, adminToken);
    assert.strictEqual(giftRes.status, 200);
    console.log("  -> Phát quà cá nhân thành công!");
  }

  // 7. Phát quà TOÀN SERVER (Server-wide Gift)
  console.log("[TEST 7] Thưởng quà TOÀN BỘ MÁY CHỦ (Server-wide gift)...");
  const serverGift = await postJson(`${BASE_URL}/api/admin/server-gift`, {
    gift: { gold: 5000000, htLevel: 4, htAmount: 20 }
  }, adminToken);
  assert.strictEqual(serverGift.status, 200);
  assert.strictEqual(serverGift.data.ok, true);
  console.log(`  -> Đã phát quà thành công cho ${serverGift.data.affectedCount} tài khoản!`);

  // 8. Triệu hồi Boss Hoàng Kim
  console.log("[TEST 8] Triệu hồi Boss Hoàng Kim tức thời...");
  const bossRes = await postJson(`${BASE_URL}/api/admin/spawn-boss`, {
    zoneId: 2,
    bossTid: "ani061"
  }, adminToken);
  assert.strictEqual(bossRes.status, 200);
  assert.strictEqual(bossRes.data.ok, true);
  console.log(`  -> Đã triệu hồi thành công Boss [${bossRes.data.boss.n}]!`);

  // 9. Phát thông báo toàn Server
  console.log("[TEST 9] Phát thông báo toàn server (Broadcast)...");
  const bcastRes = await postJson(`${BASE_URL}/api/admin/broadcast`, {
    text: "Quản trị viên phát thưởng sự kiện khai mở máy chủ!",
    color: "#ffdd4a"
  }, adminToken);
  assert.strictEqual(bcastRes.status, 200);
  assert.strictEqual(bcastRes.data.ok, true);
  console.log("  -> Đã phát sóng thông báo toàn server thành công!");

  console.log("\n=======================================================");
  console.log("🎉 TẤT CẢ TÍNH NĂNG ADMIN ĐỀU HOÀN HẢO 100%!");
  console.log("=======================================================");
  process.exit(0);
}

runAdminTests().catch(err => {
  console.error("❌ Thất bại:", err);
  process.exit(1);
});
