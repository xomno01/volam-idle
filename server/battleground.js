class BattlegroundManager {
  constructor() {
    // Trạng thái Tống Kim
    this.tongKim = {
      state: "IDLE", // IDLE, REGISTER, RUNNING, ENDED
      remainSeconds: 0,
      songScore: 0,
      jinScore: 0,
      players: new Map(), // userId => { side: 'song'|'jin', score: 0, kills: 0, deaths: 0, name: '' }
      interval: null
    };

    // Lôi Đài 1v1
    this.duels = new Map(); // duelId => { id, p1, p2, state: 'INVITED'|'FIGHTING'|'FINISHED', winner: null, createdAt }
  }

  // ================= TỐNG KIM =================
  startTongKimRegistration(durationSeconds = 120) {
    if (this.tongKim.state === "RUNNING") return { ok: false, error: "Chiến trường đang diễn ra!" };

    this.tongKim.state = "REGISTER";
    this.tongKim.remainSeconds = durationSeconds;
    this.tongKim.songScore = 0;
    this.tongKim.jinScore = 0;
    this.tongKim.players.clear();

    if (this.tongKim.interval) clearInterval(this.tongKim.interval);
    this.tongKim.interval = setInterval(() => {
      this.tongKim.remainSeconds--;
      if (this.tongKim.remainSeconds <= 0) {
        if (this.tongKim.state === "REGISTER") {
          this.startTongKimBattle(600); // 10 phút chiến đấu
        } else if (this.tongKim.state === "RUNNING") {
          this.endTongKim();
        }
      }
    }, 1000);

    return { ok: true, state: this.tongKim.state, remain: this.tongKim.remainSeconds };
  }

  startTongKimBattle(durationSeconds = 600) {
    this.tongKim.state = "RUNNING";
    this.tongKim.remainSeconds = durationSeconds;
    console.log("[TỐNG KIM] 🔥 Chiến trường chính thức BẮT ĐẦU!");
  }

  endTongKim() {
    this.tongKim.state = "ENDED";
    if (this.tongKim.interval) {
      clearInterval(this.tongKim.interval);
      this.tongKim.interval = null;
    }
    console.log("[TỐNG KIM] 🏁 Chiến trường KẾT THÚC!");
  }

  joinTongKim(userId, username, sideChoice = "auto") {
    if (this.tongKim.state === "IDLE" || this.tongKim.state === "ENDED") {
      return { ok: false, error: "Chiến trường chưa mở báo danh" };
    }

    let side = sideChoice;
    if (side !== "song" && side !== "jin") {
      // Tự cân bằng phe
      let songCount = 0, jinCount = 0;
      for (const p of this.tongKim.players.values()) {
        if (p.side === "song") songCount++;
        else jinCount++;
      }
      side = songCount <= jinCount ? "song" : "jin";
    }

    this.tongKim.players.set(userId, {
      userId,
      name: username,
      side,
      score: 0,
      kills: 0,
      deaths: 0,
      rank: "Binh Sĩ"
    });

    return { ok: true, side, state: this.getTongKimSummary() };
  }

  addScore(userId, pts = 10, isKill = false) {
    if (this.tongKim.state !== "RUNNING") return;
    const p = this.tongKim.players.get(userId);
    if (!p) return;

    p.score += pts;
    if (isKill) p.kills++;

    if (p.side === "song") this.tongKim.songScore += pts;
    else this.tongKim.jinScore += pts;

    // Cập nhật quân hàm
    if (p.score >= 5000) p.rank = "Nguyên Soái";
    else if (p.score >= 3000) p.rank = "Tiên Phong";
    else if (p.score >= 1500) p.rank = "Đô Thống";
    else if (p.score >= 500) p.rank = "Hiệu Úy";
  }

  getTongKimSummary() {
    const list = Array.from(this.tongKim.players.values()).sort((a, b) => b.score - a.score);
    return {
      state: this.tongKim.state,
      remainSeconds: this.tongKim.remainSeconds,
      songScore: this.tongKim.songScore,
      jinScore: this.tongKim.jinScore,
      playerCount: this.tongKim.players.size,
      leaderboard: list.slice(0, 10)
    };
  }

  // ================= LÔI ĐÀI 1v1 =================
  createDuel(p1, p2) {
    const duelId = "duel_" + Date.now();
    const duel = {
      id: duelId,
      p1: { id: p1.id, name: p1.name || p1.username, hp: p1.hp || 1000, maxHp: p1.maxHp || 1000 },
      p2: { id: p2.id, name: p2.name || p2.username, hp: p2.hp || 1000, maxHp: p2.maxHp || 1000 },
      state: "INVITED",
      createdAt: Date.now()
    };
    this.duels.set(duelId, duel);
    return duel;
  }

  getDuel(duelId) {
    return this.duels.get(duelId);
  }

  acceptDuel(duelId, p2Id) {
    const duel = this.duels.get(duelId);
    if (!duel || duel.p2.id !== p2Id) return { ok: false, error: "Lời thách đấu không tồn tại hoặc đã hết hạn" };
    duel.state = "FIGHTING";
    return { ok: true, duel };
  }

  declineDuel(duelId, p2Id) {
    const duel = this.duels.get(duelId);
    if (!duel) return { ok: false };
    this.duels.delete(duelId);
    return { ok: true, duel };
  }

  damageDuel(duelId, attackerId, damage) {
    const duel = this.duels.get(duelId);
    if (!duel || duel.state !== "FIGHTING") return null;

    let target = null;
    let attacker = null;
    if (duel.p1.id === attackerId) {
      attacker = duel.p1;
      target = duel.p2;
    } else if (duel.p2.id === attackerId) {
      attacker = duel.p2;
      target = duel.p1;
    } else {
      return null;
    }

    target.hp = Math.max(0, target.hp - damage);
    const isFinished = target.hp <= 0;
    if (isFinished) {
      duel.state = "FINISHED";
      duel.winner = attacker.id;
    }

    return {
      duelId,
      attackerId: attacker.id,
      targetId: target.id,
      damage,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      isFinished,
      winnerId: duel.winner,
      winnerName: attacker.name
    };
  }

  finishDuel(duelId, winnerId) {
    const duel = this.duels.get(duelId);
    if (!duel) return;
    duel.state = "FINISHED";
    duel.winner = winnerId;
  }

  // ================= CÔNG THÀNH CHIẾN (LONG TRỤ BIỆN KINH) =================
  startCongThanh(durationSeconds = 1800) { // 30 phút
    if (!this.congThanh) {
      this.congThanh = {
        state: "RUNNING",
        remainSeconds: durationSeconds,
        pillarHp: 1000000,
        maxPillarHp: 1000000,
        controllingGuildId: null,
        controllingGuildName: "Chưa có chủ quản",
        guildDamages: {}, // guildId => { name, damage }
        interval: null
      };
    } else {
      this.congThanh.state = "RUNNING";
      this.congThanh.remainSeconds = durationSeconds;
    }

    if (this.congThanh.interval) clearInterval(this.congThanh.interval);
    this.congThanh.interval = setInterval(() => {
      this.congThanh.remainSeconds--;
      if (this.congThanh.remainSeconds <= 0) {
        this.congThanh.state = "ENDED";
        clearInterval(this.congThanh.interval);
        this.congThanh.interval = null;
      }
    }, 1000);

    return { ok: true, state: this.getCongThanhSummary() };
  }

  getCongThanhSummary() {
    if (!this.congThanh) {
      this.congThanh = {
        state: "RUNNING",
        remainSeconds: 3600,
        pillarHp: 1000000,
        maxPillarHp: 1000000,
        controllingGuildId: null,
        controllingGuildName: "Khai Phong Phủ - Triều Đình",
        guildDamages: {},
        interval: null
      };
    }
    const damageRanks = Object.entries(this.congThanh.guildDamages)
      .map(([id, g]) => ({ id, name: g.name, damage: g.damage }))
      .sort((a, b) => b.damage - a.damage);

    return {
      state: this.congThanh.state,
      remainSeconds: this.congThanh.remainSeconds,
      pillarHp: this.congThanh.pillarHp,
      maxPillarHp: this.congThanh.maxPillarHp,
      controllingGuildId: this.congThanh.controllingGuildId,
      controllingGuildName: this.congThanh.controllingGuildName,
      leaderboard: damageRanks.slice(0, 5)
    };
  }

  attackPillar(userId, username, guildId, guildName, damage) {
    if (!this.congThanh) this.getCongThanhSummary();
    if (this.congThanh.state !== "RUNNING") return { ok: false, error: "Công Thành Chiến chưa bắt đầu" };

    const effectiveDmg = Math.max(1, damage | 0);
    this.congThanh.pillarHp = Math.max(0, this.congThanh.pillarHp - effectiveDmg);

    if (guildId) {
      if (!this.congThanh.guildDamages[guildId]) {
        this.congThanh.guildDamages[guildId] = { name: guildName || "Bang Hội", damage: 0 };
      }
      this.congThanh.guildDamages[guildId].damage += effectiveDmg;
    }

    let conquered = false;
    let newMasterGuild = null;

    if (this.congThanh.pillarHp <= 0) {
      conquered = true;
      // Tìm bang hội có sát thương cao nhất
      let topGuildId = null;
      let maxDmg = -1;
      for (const [gId, g] of Object.entries(this.congThanh.guildDamages)) {
        if (g.damage > maxDmg) {
          maxDmg = g.damage;
          topGuildId = gId;
        }
      }

      if (topGuildId && this.congThanh.guildDamages[topGuildId]) {
        newMasterGuild = this.congThanh.guildDamages[topGuildId].name;
        this.congThanh.controllingGuildId = topGuildId;
        this.congThanh.controllingGuildName = newMasterGuild;
      } else {
        newMasterGuild = guildName || username;
        this.congThanh.controllingGuildName = newMasterGuild;
      }

      // Hồi sinh Long Trụ cho hiệp tiếp theo
      this.congThanh.pillarHp = this.congThanh.maxPillarHp;
      this.congThanh.guildDamages = {};
    }

    return {
      ok: true,
      damage: effectiveDmg,
      pillarHp: this.congThanh.pillarHp,
      maxPillarHp: this.congThanh.maxPillarHp,
      conquered,
      newMasterGuild
    };
  }
}

module.exports = new BattlegroundManager();
