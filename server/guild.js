const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "guilds.json");

class GuildManager {
  constructor() {
    this.guilds = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const list = JSON.parse(raw);
        for (const g of list) {
          this.guilds.set(g.id, g);
        }
      }
    } catch (e) {
      console.error("[GUILD] Lỗi nạp file guilds.json:", e);
    }
  }

  save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const list = Array.from(this.guilds.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
    } catch (e) {
      console.error("[GUILD] Lỗi lưu file guilds.json:", e);
    }
  }

  createGuild(masterUser, name, emblem = "⚔️") {
    name = (name || "").trim().slice(0, 16);
    if (!name || name.length < 3) return { ok: false, error: "Tên bang phải từ 3 đến 16 ký tự" };

    // Kiểm tra tên bang đã tồn tại chưa
    for (const g of this.guilds.values()) {
      if (g.name.toLowerCase() === name.toLowerCase()) {
        return { ok: false, error: "Tên bang hội này đã có người sử dụng" };
      }
    }

    // Kiểm tra người này đã có bang chưa
    if (this.getPlayerGuild(masterUser.id)) {
      return { ok: false, error: "Đại hiệp hiện đã có bang hội, không thể lập thêm" };
    }

    const guildId = "g_" + Date.now();
    const newGuild = {
      id: guildId,
      name,
      emblem,
      masterId: masterUser.id,
      masterName: masterUser.username,
      level: 1,
      fund: 0,
      notice: "Chào mừng các hiệp khách gia nhập bang!",
      members: [
        {
          id: masterUser.id,
          username: masterUser.username,
          role: "master", // master, officer, member
          joinedAt: Date.now(),
          contrib: 0
        }
      ],
      createdAt: Date.now()
    };

    this.guilds.set(guildId, newGuild);
    this.save();
    return { ok: true, guild: newGuild };
  }

  joinGuild(guildId, user) {
    const guild = this.guilds.get(guildId);
    if (!guild) return { ok: false, error: "Bang hội không tồn tại" };

    if (this.getPlayerGuild(user.id)) {
      return { ok: false, error: "Đại hiệp đã tham gia một bang hội khác" };
    }

    if (guild.members.length >= 50) {
      return { ok: false, error: "Bang hội đã đủ 50 thành viên" };
    }

    guild.members.push({
      id: user.id,
      username: user.username,
      role: "member",
      joinedAt: Date.now(),
      contrib: 0
    });

    this.save();
    return { ok: true, guild };
  }

  leaveGuild(guildId, userId) {
    const guild = this.guilds.get(guildId);
    if (!guild) return { ok: false, error: "Bang hội không tồn tại" };

    if (guild.masterId === userId) {
      // Nếu bang chỉ còn 1 mình bang chủ thì giải tán
      if (guild.members.length <= 1) {
        this.guilds.delete(guildId);
        this.save();
        return { ok: true, disbanded: true };
      }
      return { ok: false, error: "Bang chủ không thể rời bang, hãy nhường chức trước hoặc giải tán" };
    }

    guild.members = guild.members.filter(m => m.id !== userId);
    this.save();
    return { ok: true, guild };
  }

  getPlayerGuild(userId) {
    for (const g of this.guilds.values()) {
      if (g.members.some(m => m.id === userId)) {
        return g;
      }
    }
    return null;
  }

  getGuildList() {
    return Array.from(this.guilds.values()).map(g => ({
      id: g.id,
      name: g.name,
      emblem: g.emblem,
      masterName: g.masterName,
      memberCount: g.members.length,
      level: g.level,
      fund: g.fund,
      notice: g.notice
    }));
  }
}

module.exports = new GuildManager();
