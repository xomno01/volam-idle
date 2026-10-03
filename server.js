const http = require("http");
const fs = require("fs");
const path = require("path");
const auth = require("./server/auth");
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // --- API REST ENDPOINTS ---
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
const gameSocket = new GameSocketServer(server);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚔ VÕ LÂM ONLINE SERVER ĐÃ KHỞI CHẠY THÀNH CÔNG!`);
  console.log(`🌐 Web Client: http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Gateway: ws://localhost:${PORT}`);
  console.log(`🛡️ REST APIs: http://localhost:${PORT}/api/*`);
  console.log(`====================================================`);
});
