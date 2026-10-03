const path = require("path");

// Nạp dữ liệu thế giới và quái vật từ world.js & data.js
global.window = global.window || {};
try {
  require(path.join(__dirname, "..", "data.js"));
  require(path.join(__dirname, "..", "world.js"));
} catch (e) {
  console.error("Lỗi nạp world.js / data.js:", e.message);
}

const ZONES = (global.window.JW && global.window.JW.zones) || [];
const MON = (global.window.JW && global.window.JW.mon) || {};

class MapInstance {
  constructor(zoneId) {
    this.zoneId = zoneId;
    this.zone = ZONES.find(z => z.id === zoneId) || ZONES[0] || { id: zoneId, n: "Bản đồ " + zoneId, lo: 1, hi: 10, m: [] };
    this.players = new Map(); // id -> playerData
    this.monsters = new Map(); // id -> monsterData
    this.lootItems = []; // { id, x, y, name, rar, val, expiresAt }
    this.nextMonsterId = 1;
    this.initMonsters();
  }

  initMonsters() {
    const monList = this.zone.m || [];
    if (!monList.length) {
      // Fallback nếu map không có list quái
      monList.push(Object.keys(MON)[0] || "ani001");
    }

    // Spawn một bãi quái gồm 8 quái vật trong khu vực
    const count = 8;
    for (let i = 0; i < count; i++) {
      const tid = monList[i % monList.length];
      const mInfo = MON[tid] || { n: "Sơn Tặc", hp: 100, dmg: 10 };
      const level = Math.round(this.zone.lo + Math.random() * (this.zone.hi - this.zone.lo));
      const maxHp = Math.round(50 + level * 25 + level * level * 1.2);

      // Tọa độ quanh trung tâm bản đồ
      const spawnX = Math.round(600 + (i % 4) * 120 + Math.random() * 40);
      const spawnY = Math.round(600 + Math.floor(i / 4) * 140 + Math.random() * 40);

      const mon = {
        id: "m_" + this.zoneId + "_" + (this.nextMonsterId++),
        tid,
        n: mInfo.n,
        sz: mInfo.sz,
        L: level,
        cls: (i === 0 && Math.random() < 0.4) ? "elite" : "normal",
        series: Math.floor(Math.random() * 5),
        x: spawnX,
        y: spawnY,
        spawnX,
        spawnY,
        hp: maxHp,
        maxHp: maxHp,
        dmg: Math.round(5 + level * 2),
        def: Math.round(3 + level * 1.5),
        targetId: null,
        isDead: false,
        respawnTimer: 0,
        act: "st",
        dir: 0
      };
      this.monsters.set(mon.id, mon);
    }
  }

  tick(dt, broadcastFn) {
    const now = Date.now();

    // 1. Cập nhật AI quái vật
    for (const mon of this.monsters.values()) {
      if (mon.isDead) {
        if (mon.respawnTimer > 0) {
          mon.respawnTimer -= dt;
          if (mon.respawnTimer <= 0) {
            // Hồi sinh quái
            mon.isDead = false;
            mon.hp = mon.maxHp;
            mon.x = mon.spawnX + (Math.random() * 40 - 20);
            mon.y = mon.spawnY + (Math.random() * 40 - 20);
            mon.targetId = null;
            mon.act = "st";
            broadcastFn(this.zoneId, {
              type: "MONSTER_SPAWN",
              monster: this.getMonsterSummary(mon)
            });
          }
        }
        continue;
      }

      // Tìm người chơi gần nhất trong tầm aggro (250px)
      if (!mon.targetId || !this.players.has(mon.targetId)) {
        let nearestDist = 250;
        let foundId = null;
        for (const p of this.players.values()) {
          const d = Math.hypot(p.x - mon.x, p.y - mon.y);
          if (d < nearestDist) {
            nearestDist = d;
            foundId = p.id;
          }
        }
        mon.targetId = foundId;
      }

      // Quái di chuyển về phía người chơi mục tiêu
      if (mon.targetId && this.players.has(mon.targetId)) {
        const target = this.players.get(mon.targetId);
        const dx = target.x - mon.x;
        const dy = target.y - mon.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 50) {
          // Đi lại gần
          const speed = 40 * dt;
          mon.x += (dx / dist) * speed;
          mon.y += (dy / dist) * speed;
          mon.act = "run";
        } else {
          // Tấn công người chơi
          mon.act = "at";
        }
      } else {
        mon.act = "st";
      }
    }

    // 2. Dọn dẹp loot rơi trên sàn hết hạn (quá 60s)
    this.lootItems = this.lootItems.filter(item => item.expiresAt > now);
  }

  damageMonster(monsterId, attacker, damage, isCrit = false) {
    const mon = this.monsters.get(monsterId);
    if (!mon || mon.isDead) return null;

    mon.hp = Math.max(0, mon.hp - damage);
    mon.targetId = attacker.id; // Quái quay lại đánh người vừa đánh nó

    const res = {
      monsterId,
      attackerId: attacker.id,
      attackerName: attacker.name,
      damage,
      isCrit,
      remainingHp: mon.hp,
      maxHp: mon.maxHp,
      isDead: mon.hp <= 0
    };

    if (mon.hp <= 0) {
      mon.isDead = true;
      mon.respawnTimer = 6; // Hồi sinh sau 6 giây
      mon.act = "die";

      // Sinh thưởng (Loot & Exp)
      const expAwarded = Math.round(mon.L * 15 + mon.maxHp * 0.2);
      const goldAwarded = Math.round(mon.L * 8 + Math.random() * 20);

      res.exp = expAwarded;
      res.gold = goldAwarded;
    }

    return res;
  }

  spawnBoss(bossTid = null) {
    const tid = bossTid || (this.zone.boss || Object.keys(MON)[0]);
    const mInfo = MON[tid] || { n: "Trùm Hoàng Kim", sz: [40, 60, 20, 50] };
    const level = Math.round((this.zone.hi || 10) + 5);
    const maxHp = Math.round(5000 + level * 250);

    const boss = {
      id: "boss_" + this.zoneId + "_" + (this.nextMonsterId++),
      tid,
      n: "★ " + (mInfo.n || "Trùm Hoàng Kim"),
      sz: mInfo.sz,
      L: level,
      cls: "boss",
      series: Math.floor(Math.random() * 5),
      x: 750,
      y: 750,
      spawnX: 750,
      spawnY: 750,
      hp: maxHp,
      maxHp: maxHp,
      dmg: Math.round(40 + level * 5),
      def: Math.round(15 + level * 3),
      targetId: null,
      isDead: false,
      respawnTimer: 0,
      act: "st",
      dir: 0
    };
    this.monsters.set(boss.id, boss);
    return this.getMonsterSummary(boss);
  }

  getMonsterSummary(m) {
    return {
      id: m.id,
      tid: m.tid,
      n: m.n,
      L: m.L,
      cls: m.cls,
      series: m.series,
      x: Math.round(m.x),
      y: Math.round(m.y),
      hp: m.hp,
      maxHp: m.maxHp,
      isDead: m.isDead,
      act: m.act
    };
  }

  getMonstersList() {
    const list = [];
    for (const m of this.monsters.values()) {
      if (!m.isDead) list.push(this.getMonsterSummary(m));
    }
    return list;
  }
}

class RealtimeGameEngine {
  constructor() {
    this.maps = new Map(); // zoneId -> MapInstance
    this.TICK_RATE = 20; // 20 ticks per second = 50ms
    this.tickInterval = null;
    this.broadcastCallback = null;
  }

  setBroadcastCallback(fn) {
    this.broadcastCallback = fn;
  }

  start() {
    if (this.tickInterval) return;
    const dt = 1 / this.TICK_RATE;
    this.tickInterval = setInterval(() => {
      this.tick(dt);
    }, 1000 / this.TICK_RATE);
    console.log(`⚡ Real-time Game Engine running at ${this.TICK_RATE}Hz!`);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  getOrCreateMap(zoneId) {
    zoneId = Number(zoneId) || 2;
    if (!this.maps.has(zoneId)) {
      this.maps.set(zoneId, new MapInstance(zoneId));
    }
    return this.maps.get(zoneId);
  }

  addPlayerToMap(zoneId, player) {
    const map = this.getOrCreateMap(zoneId);
    map.players.set(player.id, player);
    return map.getMonstersList();
  }

  removePlayerFromMap(zoneId, playerId) {
    const map = this.maps.get(Number(zoneId));
    if (map) {
      map.players.delete(playerId);
    }
  }

  updatePlayerPosition(zoneId, playerId, x, y, dir, isAttacking, skillId) {
    const map = this.maps.get(Number(zoneId));
    if (!map) return;
    const p = map.players.get(playerId);
    if (p) {
      p.x = x;
      p.y = y;
      p.dir = dir;
      p.isAttacking = isAttacking;
      p.skillId = skillId;
    }
  }

  playerAttackMonster(zoneId, attacker, monsterId, skillDamage = 0) {
    const map = this.maps.get(Number(zoneId));
    if (!map) return null;

    // Tính sát thương cơ bản dựa trên cấp người chơi và chiêu thức
    const baseAtk = (attacker.lvl || 1) * 8 + 20;
    const dmg = Math.round((baseAtk + skillDamage) * (0.9 + Math.random() * 0.25));
    const isCrit = Math.random() < 0.2;
    const finalDmg = isCrit ? Math.round(dmg * 1.6) : dmg;

    return map.damageMonster(monsterId, attacker, finalDmg, isCrit);
  }

  spawnCustomBoss(zoneId, bossTid = null) {
    const map = this.getOrCreateMap(zoneId);
    const boss = map.spawnBoss(bossTid);
    if (this.broadcastCallback) {
      this.broadcastCallback(zoneId, {
        type: "MONSTER_SPAWN",
        monster: boss,
        isBoss: true
      });
    }
    return boss;
  }

  tick(dt) {
    if (!this.broadcastCallback) return;
    for (const map of this.maps.values()) {
      map.tick(dt, (zoneId, payload) => {
        this.broadcastCallback(zoneId, payload);
      });
    }
  }
}

module.exports = new RealtimeGameEngine();
