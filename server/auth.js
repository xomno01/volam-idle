const crypto = require("crypto");
const { loadData, saveData } = require("./db");

// Persistent sessions token -> { userId, createdAt }
let sessionsCache = null;
function getSessions() {
  if (!sessionsCache) sessionsCache = loadData("sessions", {});
  return sessionsCache;
}
function saveSession(token, userId) {
  const sess = getSessions();
  sess[token] = { userId, createdAt: Date.now() };
  saveData("sessions", sess);
}

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

function generateToken() {
  return "vlo_" + crypto.randomBytes(24).toString("hex");
}

function register(username, password) {
  username = (username || "").trim().toLowerCase();
  if (!username || username.length < 3 || username.length > 20) {
    return { ok: false, error: "Tên tài khoản phải từ 3 đến 20 ký tự" };
  }
  if (!password || password.length < 4) {
    return { ok: false, error: "Mật khẩu phải từ 4 ký tự trở lên" };
  }

  const users = loadData("users", {});
  if (users[username]) {
    return { ok: false, error: "Tên tài khoản này đã được sử dụng" };
  }

  const { hash, salt } = hashPassword(password);
  const user = {
    id: "u_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    username,
    hash,
    salt,
    createdAt: Date.now()
  };

  users[username] = user;
  saveData("users", users);

  const token = generateToken();
  saveSession(token, user.id);

  return { ok: true, token, user: { id: user.id, username: user.username } };
}

function login(username, password) {
  username = (username || "").trim().toLowerCase();
  const users = loadData("users", {});
  const user = users[username];
  if (!user) {
    return { ok: false, error: "Tài khoản hoặc mật khẩu không chính xác" };
  }

  if (!verifyPassword(password, user.hash, user.salt)) {
    return { ok: false, error: "Tài khoản hoặc mật khẩu không chính xác" };
  }

  const bans = loadData("bans", {});
  if (bans[user.id]) {
    return { ok: false, error: "Tài khoản của bạn đã bị khóa: " + (bans[user.id].reason || "Vi phạm quy định") };
  }

  const token = generateToken();
  saveSession(token, user.id);

  return { ok: true, token, user: { id: user.id, username: user.username } };
}

function verifyToken(token) {
  if (!token) return null;
  const sess = getSessions();
  const entry = sess[token];
  if (!entry || !entry.userId) return null;
  
  const bans = loadData("bans", {});
  if (bans[entry.userId]) return null;

  const users = loadData("users", {});
  for (const u of Object.values(users)) {
    if (u.id === entry.userId) return { id: u.id, username: u.username };
  }
  return null;
}

function saveCharacter(userId, slot, state) {
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  const saves = loadData("saves", {});
  if (!saves[userId]) saves[userId] = {};
  
  saves[userId][slot] = {
    state,
    updatedAt: Date.now()
  };
  saveData("saves", saves);

  // Cập nhật Leaderboard
  updateLeaderboard(userId, state);
  return { ok: true };
}

function loadCharacter(userId, slot) {
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  const saves = loadData("saves", {});
  const userSaves = saves[userId];
  if (!userSaves || !userSaves[slot]) {
    return { ok: true, state: null };
  }
  return { ok: true, state: userSaves[slot].state, updatedAt: userSaves[slot].updatedAt };
}

function updateLeaderboard(userId, state) {
  if (!state || !state.name) return;
  const lb = loadData("leaderboard", []);
  const idx = lb.findIndex(x => x.userId === userId);
  const entry = {
    userId,
    name: state.name || "Hiệp Khách",
    fac: state.fac || 0,
    lvl: state.lvl || 1,
    stage: state.stage || 1,
    gold: state.gold || 0,
    updatedAt: Date.now()
  };

  if (idx >= 0) {
    lb[idx] = entry;
  } else {
    lb.push(entry);
  }

  // Sắp xếp theo cấp độ giảm dần, sau đó theo ải
  lb.sort((a, b) => b.lvl - a.lvl || b.stage - a.stage || b.gold - a.gold);
  saveData("leaderboard", lb.slice(0, 50));
}

function getLeaderboard() {
  return loadData("leaderboard", []);
}

module.exports = {
  register,
  login,
  verifyToken,
  saveCharacter,
  loadCharacter,
  getLeaderboard
};
