const http = require("http");
const fs = require("fs");
const path = require("path");
const auth = require("./server/auth");
const admin = require("./server/admin");
const engine = require("./server/engine");
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
