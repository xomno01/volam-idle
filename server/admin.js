const crypto = require("crypto");
const { loadData, saveData } = require("./db");

// Cấu hình Admin (Mật khẩu: Vinhloc123)
const config = loadData("admin_config", {
  adminPassword: process.env.ADMIN_PASSWORD || "Vinhloc123",
  serverNotice: ""
});

const adminSessions = new Set();

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function adminLogin(password) {
  if (!password || password !== config.adminPassword) {
    return { ok: false, error: "Mật mã quản trị không chính xác!" };
  }
  const token = "adm_" + crypto.randomBytes(32).toString("hex");
  adminSessions.add(token);
  return { ok: true, token };
}

function verifyAdminToken(token) {
  return token && adminSessions.has(token);
}

function getServerOverview(gameSocket, engine) {
  const users = loadData("users", {});
  const saves = loadData("saves", {});
  const bans = loadData("bans", {});
  const mem = process.memoryUsage();

  return {
    ok: true,
    serverTime: Date.now(),
    uptime: Math.round(process.uptime()),
    ccu: gameSocket ? gameSocket.clients.size : 0,
    totalAccounts: Object.keys(users).length,
    totalCharacters: Object.keys(saves).length,
    totalBans: Object.keys(bans).length,
    memoryUsageMB: Math.round(mem.rss / (1024 * 1024)),
    heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
    nodeVersion: process.version,
    platform: process.platform,
    tickRate: engine ? engine.TICK_RATE : 20
  };
}

function listPlayers(search = "", gameSocket) {
  const users = loadData("users", {});
  const saves = loadData("saves", {});
  const bans = loadData("bans", {});

  // Thu thập ID các user đang online
  const onlineMap = new Map(); // userId -> socketClientData
  if (gameSocket) {
    for (const client of gameSocket.clients.values()) {
      if (client.user && client.user.id) {
        onlineMap.set(client.user.id, client);
      }
    }
  }

  const list = [];
  const q = (search || "").toLowerCase().trim();

  for (const user of Object.values(users)) {
    const userSaves = saves[user.id] || {};
    const mainSlot = userSaves[0] || {};
    const state = mainSlot.state || {};

    const name = state.name || user.username;
    const fac = state.fac || 0;
    const lvl = state.lvl || 1;
    const gold = state.gold || 0;
    const stage = state.stage || 1;
    const isOnline = onlineMap.has(user.id);
    const isBanned = !!bans[user.id];

    if (!q || user.username.includes(q) || name.toLowerCase().includes(q) || user.id.includes(q)) {
      list.push({
        userId: user.id,
        username: user.username,
        name,
        fac,
        lvl,
        gold,
        stage,
        isOnline,
        isBanned,
        createdAt: user.createdAt || Date.now(),
        updatedAt: mainSlot.updatedAt || user.createdAt || Date.now()
      });
    }
  }

  // Sắp xếp: Ai online lên đầu, sau đó theo cấp độ giảm dần
  list.sort((a, b) => (b.isOnline - a.isOnline) || (b.lvl - a.lvl));
  return { ok: true, players: list };
}

function updatePlayerStats(userId, updates, gameSocket) {
  const saves = loadData("saves", {});
  if (!saves[userId]) saves[userId] = {};
  if (!saves[userId][0]) saves[userId][0] = { state: {}, updatedAt: Date.now() };

  const s = saves[userId][0].state;
  if (updates.name) s.name = String(updates.name).slice(0, 16);
  if (updates.lvl !== undefined) s.lvl = Math.max(1, Math.min(200, updates.lvl | 0));
  if (updates.gold !== undefined) s.gold = Math.max(0, updates.gold | 0);
  if (updates.stage !== undefined) s.stage = Math.max(1, updates.stage | 0);
  if (updates.fac !== undefined) s.fac = Math.max(0, updates.fac | 0);

  saves[userId][0].updatedAt = Date.now();
  saveData("saves", saves);

  // Nếu người chơi đang online, đồng bộ vào ram client
  if (gameSocket) {
    for (const client of gameSocket.clients.values()) {
      if (client.user && client.user.id === userId) {
        if (updates.name) client.name = s.name;
        if (updates.lvl) client.lvl = s.lvl;
        if (updates.fac !== undefined) client.fac = s.fac;
        // Báo cho client cập nhật
        gameSocket.sendToUser(userId, {
          type: "ADMIN_UPDATE_STATE",
          state: s
        });
        break;
      }
    }
  }

  return { ok: true, state: s };
}

function givePlayerRewards(userId, gift, gameSocket) {
  const saves = loadData("saves", {});
  if (!saves[userId]) saves[userId] = {};
  if (!saves[userId][0]) saves[userId][0] = { state: { gold: 0, mats: { ht: {}, misc: {} } }, updatedAt: Date.now() };

  const s = saves[userId][0].state;
  if (!s.mats) s.mats = { ht: {}, misc: {} };
  if (!s.mats.ht) s.mats.ht = {};
  if (!s.mats.misc) s.mats.misc = {};

  if (gift.gold) {
    s.gold = (s.gold || 0) + (gift.gold | 0);
  }

  // Tặng Huyền Tinh
  if (gift.htLevel && gift.htAmount) {
    const l = Math.max(1, Math.min(5, gift.htLevel | 0));
    s.mats.ht[l] = (s.mats.ht[l] || 0) + (gift.htAmount | 0);
  }

  // Tặng Thủy Tinh / Tinh Hồng Bảo Thạch
  if (gift.thbt) s.mats.misc.thbt = (s.mats.misc.thbt || 0) + (gift.thbt | 0);
  if (gift.wc) s.mats.misc.wc = (s.mats.misc.wc || 0) + (gift.wc | 0);

  saves[userId][0].updatedAt = Date.now();
  saveData("saves", saves);

  if (gameSocket) {
    gameSocket.sendToUser(userId, {
      type: "ADMIN_UPDATE_STATE",
      state: s,
      notice: gift.message || "Bạn đã nhận được quà tặng từ Quản Trị Viên (Admin)!"
    });
  }

  return { ok: true, state: s };
}

function giveServerWideGift(gift, gameSocket) {
  const users = loadData("users", {});
  for (const userId of Object.keys(users)) {
    givePlayerRewards(userId, gift, gameSocket);
  }
  return { ok: true, affectedCount: Object.keys(users).length };
}

function kickPlayer(userId, reason, gameSocket) {
  if (!gameSocket) return { ok: false, error: "GameSocket chưa sẵn sàng" };
  let kicked = false;
  for (const [ws, client] of gameSocket.clients.entries()) {
    if (client.user && client.user.id === userId) {
      gameSocket.send(ws, {
        type: "KICKED",
        reason: reason || "Bạn đã bị ngắt kết nối bởi Quản Trị Viên."
      });
      setTimeout(() => ws.close(), 300);
      kicked = true;
      break;
    }
  }
  return { ok: true, kicked };
}

function banPlayer(userId, reason, gameSocket) {
  const bans = loadData("bans", {});
  bans[userId] = {
    reason: reason || "Vi phạm quy định máy chủ",
    bannedAt: Date.now()
  };
  saveData("bans", bans);

  // Kick ngay lập tức nếu đang online
  kickPlayer(userId, "Tài khoản của bạn đã bị khóa: " + (reason || "Vi phạm quy định"), gameSocket);
  return { ok: true };
}

function unbanPlayer(userId) {
  const bans = loadData("bans", {});
  if (bans[userId]) {
    delete bans[userId];
    saveData("bans", bans);
  }
  return { ok: true };
}

function wipeServerData(gameSocket) {
  // 1. Kick tất cả người chơi đang online kèm thông báo
  if (gameSocket) {
    for (const ws of gameSocket.clients.keys()) {
      gameSocket.send(ws, {
        type: "KICKED",
        reason: "Máy chủ đang được làm mới (Reset Server). Vui lòng đăng ký tài khoản mới để bắt đầu lại!"
      });
      try { ws.close(); } catch (e) {}
    }
    gameSocket.clients.clear();
  }

  // 2. Ghi đè rỗng toàn bộ dữ liệu
  saveData("users", {});
  saveData("saves", {});
  saveData("bans", {});
  saveData("leaderboard", []);
  saveData("sessions", {});

  return { ok: true, message: "Đã xóa toàn bộ dữ liệu người chơi và làm mới máy chủ hoàn toàn!" };
}

module.exports = {
  adminLogin,
  verifyAdminToken,
  getServerOverview,
  listPlayers,
  updatePlayerStats,
  givePlayerRewards,
  giveServerWideGift,
  kickPlayer,
  banPlayer,
  unbanPlayer,
  wipeServerData
};
