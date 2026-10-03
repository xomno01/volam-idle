const http = require("http");
const fs = require("fs");
const path = require("path");
const auth = require("./server/auth");
const admin = require("./server/admin");
const engine = require("./server/engine");
const guild = require("./server/guild");
const battleground = require("./server/battleground");
const GameSocketServer = require("./server/ws");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(JSON.stringify(data));
}

let gameSocket = null;

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // --- API ADMIN ENDPOINTS ---
  if (pathname.startsWith("/api/admin/")) {
    if (req.method === "POST" && pathname === "/api/admin/login") {
      const { password } = await readBody(req);
      const result = admin.adminLogin(password);
      return sendJson(res, result.ok ? 200 : 401, result);
    }

    // Middleware kiểm tra quyền Admin
    const authHeader = req.headers["authorization"] || "";
    const tokenHeader = req.headers["x-admin-token"] || "";
    const tokenQuery = parsedUrl.searchParams.get("token") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "") || tokenHeader || tokenQuery;

    if (!admin.verifyAdminToken(token)) {
      return sendJson(res, 403, { ok: false, error: "Từ chối truy cập: Mã phiên quản trị không hợp lệ hoặc đã hết hạn" });
    }

    if (req.method === "GET" && pathname === "/api/admin/overview") {
      const overview = admin.getServerOverview(gameSocket, engine);
      return sendJson(res, 200, overview);
    }

    if (req.method === "GET" && pathname === "/api/admin/players") {
      const q = parsedUrl.searchParams.get("q") || "";
      const result = admin.listPlayers(q, gameSocket);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/player/update") {
      const { userId, updates } = await readBody(req);
      const result = admin.updatePlayerStats(userId, updates, gameSocket);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/player/give") {
      const { userId, gift } = await readBody(req);
      const result = admin.givePlayerRewards(userId, gift, gameSocket);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/server-gift") {
      const { gift } = await readBody(req);
      const result = admin.giveServerWideGift(gift, gameSocket);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/player/kick") {
      const { userId, reason } = await readBody(req);
      const result = admin.kickPlayer(userId, reason, gameSocket);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/player/ban") {
      const { userId, reason } = await readBody(req);
      const result = admin.banPlayer(userId, reason, gameSocket);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/player/unban") {
      const { userId } = await readBody(req);
      const result = admin.unbanPlayer(userId);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/broadcast") {
      const { text, color } = await readBody(req);
      if (gameSocket) gameSocket.broadcastNotice(text, color || "#ffdd4a");
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/api/admin/spawn-boss") {
      const { zoneId, bossTid } = await readBody(req);
      const boss = engine.spawnCustomBoss(zoneId, bossTid);
      if (gameSocket) {
        gameSocket.broadcastNotice(`⚔ Boss Hoàng Kim [${boss.n}] đã xuất hiện tại bản đồ!`, "#ff4444");
      }
      return sendJson(res, 200, { ok: true, boss });
    }

    if (req.method === "POST" && pathname === "/api/admin/tongkim/start") {
      const result = battleground.startTongKimRegistration(120);
      if (gameSocket) {
        gameSocket.broadcastNotice("⚔️ CHIẾN TRƯỜNG TỐNG KIM ĐÃ MỞ BÁO DANH! Các hiệp khách mau mau gia nhập!", "#38bdf8");
      }
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/congthanh/start") {
      const result = battleground.startCongThanh(1800);
      if (gameSocket) {
        gameSocket.broadcastNotice("🚩 CÔNG THÀNH CHIẾN BIỆN KINH ĐÃ BẮT ĐẦU! Mau cùng bang hội phá hủy Long Trụ!", "#f59e0b");
      }
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/admin/server-wipe") {
      const result = admin.wipeServerData(gameSocket);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { ok: false, error: "Admin API not found" });
  }

  // --- API PUBLIC REST ENDPOINTS ---
  if (pathname.startsWith("/api/")) {
    if (req.method === "POST" && pathname === "/api/register") {
      const { username, password } = await readBody(req);
      const result = auth.register(username, password);
      return sendJson(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "POST" && pathname === "/api/login") {
      const { username, password } = await readBody(req);
      const result = auth.login(username, password);
      return sendJson(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "POST" && pathname === "/api/save") {
      const { token, slot, state } = await readBody(req);
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập hoặc phiên đã hết hạn" });
      const result = auth.saveCharacter(user.id, slot || 0, state);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && pathname === "/api/load") {
      const token = parsedUrl.searchParams.get("token");
      const slot = parsedUrl.searchParams.get("slot") || 0;
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập hoặc phiên đã hết hạn" });
      const result = auth.loadCharacter(user.id, slot);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && pathname === "/api/leaderboard") {
      const lb = auth.getLeaderboard();
      return sendJson(res, 200, { ok: true, leaderboard: lb });
    }

    if (req.method === "GET" && pathname === "/api/stats") {
      return sendJson(res, 200, {
        ok: true,
        onlineCount: gameSocket ? gameSocket.clients.size : 0,
        serverTime: Date.now()
      });
    }

    // --- BANG HỘI API ---
    if (req.method === "GET" && pathname === "/api/guild/list") {
      return sendJson(res, 200, { ok: true, guilds: guild.getGuildList() });
    }

    if (req.method === "POST" && pathname === "/api/guild/create") {
      const { token, name, emblem } = await readBody(req);
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập" });
      const result = guild.createGuild(user, name, emblem);
      return sendJson(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "POST" && pathname === "/api/guild/join") {
      const { token, guildId } = await readBody(req);
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập" });
      const result = guild.joinGuild(guildId, user);
      return sendJson(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "POST" && pathname === "/api/guild/leave") {
      const { token, guildId } = await readBody(req);
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập" });
      const result = guild.leaveGuild(guildId, user.id);
      return sendJson(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "GET" && pathname === "/api/guild/my") {
      const token = parsedUrl.searchParams.get("token");
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập" });
      const myGuild = guild.getPlayerGuild(user.id);
      return sendJson(res, 200, { ok: true, guild: myGuild });
    }

    // --- TỐNG KIM API ---
    if (req.method === "GET" && pathname === "/api/tongkim/status") {
      return sendJson(res, 200, { ok: true, ...battleground.getTongKimSummary() });
    }

    if (req.method === "POST" && pathname === "/api/tongkim/join") {
      const { token, side } = await readBody(req);
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập" });
      const result = battleground.joinTongKim(user.id, user.username, side);
      return sendJson(res, result.ok ? 200 : 400, result);
    }

    // --- CÔNG THÀNH CHIẾN API ---
    if (req.method === "GET" && pathname === "/api/congthanh/status") {
      return sendJson(res, 200, { ok: true, ...battleground.getCongThanhSummary() });
    }

    if (req.method === "POST" && pathname === "/api/congthanh/attack") {
      const { token, damage } = await readBody(req);
      const user = auth.verifyToken(token);
      if (!user) return sendJson(res, 401, { ok: false, error: "Chưa đăng nhập" });
      const myGuild = guild.getPlayerGuild(user.id);
      const result = battleground.attackPillar(
        user.id,
        user.username,
        myGuild ? myGuild.id : null,
        myGuild ? myGuild.name : null,
        damage
      );
      if (result.conquered && gameSocket) {
        gameSocket.broadcastNotice(`🚩 LONG TRỤ BIỆN KINH ĐÃ BỊ CÔNG PHÁ! Bang Hội [${result.newMasterGuild}] đã xưng bá và chiếm quyền Biện Kinh Thành!`, "#ff4444");
      }
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { ok: false, error: "API not found" });
  }

  // --- STATIC ASSET SERVING ---
  let reqPath = decodeURI(pathname);
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
  if (reqPath === "/admin" || reqPath === "/admin/") reqPath = "/admin.html";

  let filePath = path.join(ROOT, reqPath);

  // Security check: No escaping ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Khởi chạy WebSocket Server gắn kèm trên cùng cổng HTTP
gameSocket = new GameSocketServer(server);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚔ VÕ LÂM ONLINE SERVER ĐÃ KHỞI CHẠY THÀNH CÔNG!`);
  console.log(`🌐 Web Game: http://localhost:${PORT}`);
  console.log(`👑 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`⚡ WebSocket Gateway: ws://localhost:${PORT}`);
  console.log(`🛡️ REST APIs: http://localhost:${PORT}/api/*`);
  console.log(`====================================================`);
});
