const { WebSocketServer } = require("ws");
const { verifyToken } = require("./auth");
const engine = require("./engine");

class GameSocketServer {
  constructor(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer });
    this.clients = new Map(); // ws -> clientData
    this.mapRooms = new Map(); // zoneId -> Set of ws
    this.init();

    // Kết nối callback từ game engine để broadcast quái vật
    engine.setBroadcastCallback((zoneId, payload) => {
      this.broadcastMap(zoneId, payload);
    });
    engine.start();
  }

  init() {
    this.wss.on("connection", (ws) => {
      const clientData = {
        id: "p_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1000),
        user: null,
        name: "Hiệp Khách",
        fac: 0,
        lvl: 1,
        hp: 100,
        maxHp: 100,
        zoneId: 2, // Mặc định Hoa Sơn (id 2)
        x: 768,
        y: 768,
        dir: 0,
        isAttacking: false,
        lastMove: 0
      };
      this.clients.set(ws, clientData);

      // Gửi thông tin định danh ban đầu
      this.send(ws, {
        type: "INIT",
        id: clientData.id,
        onlineCount: this.clients.size
      });

      this.broadcastOnlineCount();

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString("utf8"));
          this.handleMessage(ws, msg);
        } catch (e) {
          // Bỏ qua gói tin không đúng định dạng
        }
      });

      ws.on("close", () => {
        this.leaveMap(ws);
        this.clients.delete(ws);
        this.broadcastOnlineCount();
      });
    });
  }

  handleMessage(ws, msg) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case "AUTH": {
        const user = verifyToken(msg.token);
        if (user) {
          client.user = user;
          client.name = msg.name || user.username;
          client.fac = msg.fac || 0;
          client.lvl = msg.lvl || 1;
          client.hp = msg.hp || 100;
          client.maxHp = msg.maxHp || 100;
          this.send(ws, { type: "AUTH_OK", user });
          this.broadcastMap(client.zoneId, {
            type: "PLAYER_UPDATE",
            player: this.getPlayerSummary(client)
          }, ws);
        }
        break;
      }

      case "SET_PROFILE": {
        if (msg.name) client.name = String(msg.name).slice(0, 16);
        if (msg.fac !== undefined) client.fac = msg.fac | 0;
        if (msg.lvl !== undefined) client.lvl = msg.lvl | 0;
        if (msg.hp !== undefined) client.hp = msg.hp | 0;
        if (msg.maxHp !== undefined) client.maxHp = msg.maxHp | 0;
        this.broadcastMap(client.zoneId, {
          type: "PLAYER_UPDATE",
          player: this.getPlayerSummary(client)
        }, ws);
        break;
      }

      case "JOIN_MAP": {
        const zoneId = Number(msg.zoneId) || 2;
        this.leaveMap(ws);
        client.zoneId = zoneId;
        client.x = msg.x || 768;
        client.y = msg.y || 768;

        if (!this.mapRooms.has(zoneId)) {
          this.mapRooms.set(zoneId, new Set());
        }
        this.mapRooms.get(zoneId).add(ws);

        // Đăng ký vào Engine và lấy danh sách quái chung của bãi này
        const sharedMonsters = engine.addPlayerToMap(zoneId, client);

        // Lấy danh sách người chơi khác trong cùng bản đồ
        const otherPlayers = [];
        for (const otherWs of this.mapRooms.get(zoneId)) {
          if (otherWs !== ws) {
            const oc = this.clients.get(otherWs);
            if (oc) otherPlayers.push(this.getPlayerSummary(oc));
          }
        }

        // Gửi toàn bộ trạng thái đồng bộ ban đầu cho người chơi này
        this.send(ws, {
          type: "ZONE_INIT",
          zoneId,
          monsters: sharedMonsters,
          players: otherPlayers
        });

        // Báo cho các người chơi khác là có người mới xuất hiện
        this.broadcastMap(zoneId, {
          type: "PLAYER_JOIN",
          player: this.getPlayerSummary(client)
        }, ws);
        break;
      }

      case "MOVE": {
        client.x = msg.x;
        client.y = msg.y;
        client.dir = msg.dir || 0;
        client.isAttacking = !!msg.isAttacking;

        engine.updatePlayerPosition(client.zoneId, client.id, client.x, client.y, client.dir, client.isAttacking, msg.skillId);

        // Broadcast vị trí mới và hành động cho người chơi khác cùng map
        this.broadcastMap(client.zoneId, {
          type: "REMOTE_PLAYER_MOVE",
          id: client.id,
          x: client.x,
          y: client.y,
          dir: client.dir,
          isAttacking: client.isAttacking,
          skillId: msg.skillId
        }, ws);
        break;
      }

      case "ATTACK_MONSTER": {
        const monsterId = msg.monsterId;
        const skillDamage = msg.skillDamage || 0;
        const result = engine.playerAttackMonster(client.zoneId, client, monsterId, skillDamage);
        if (result) {
          // Broadcast đòn đánh và lượng sát thương cho TẤT CẢ người chơi trong map cùng thấy
          this.broadcastMap(client.zoneId, {
            type: "MONSTER_DAMAGE",
            result
          });

          // Nếu quái chết, thưởng điểm kinh nghiệm và ngân lượng cho người chơi
          if (result.isDead) {
            this.send(ws, {
              type: "LOOT_AWARD",
              exp: result.exp,
              gold: result.gold
            });
          }
        }
        break;
      }

      case "CHAT": {
        const rawText = (msg.text || "").trim();
        if (!rawText) return;
        const text = rawText.slice(0, 150).replace(/[<>]/g, ""); // XSS sanitize
        const channel = msg.channel || "world";

        const chatPayload = {
          type: "CHAT",
          id: "m_" + Date.now(),
          channel,
          sender: {
            id: client.id,
            name: client.name,
            fac: client.fac,
            lvl: client.lvl
          },
          text,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        };

        if (channel === "sect") {
          for (const [targetWs, targetClient] of this.clients.entries()) {
            if (targetClient.fac === client.fac) {
              this.send(targetWs, chatPayload);
            }
          }
        } else {
          this.broadcastAll(chatPayload);
        }
        break;
      }
    }
  }

  leaveMap(ws) {
    const client = this.clients.get(ws);
    if (!client) return;
    const room = this.mapRooms.get(client.zoneId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) this.mapRooms.delete(client.zoneId);
    }
    engine.removePlayerFromMap(client.zoneId, client.id);

    this.broadcastMap(client.zoneId, {
      type: "PLAYER_LEAVE",
      id: client.id
    }, ws);
  }

  getPlayerSummary(c) {
    return {
      id: c.id,
      name: c.name,
      fac: c.fac,
      lvl: c.lvl,
      hp: c.hp,
      maxHp: c.maxHp,
      x: Math.round(c.x),
      y: Math.round(c.y),
      dir: c.dir,
      isAttacking: c.isAttacking
    };
  }

  send(ws, data) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(data));
    }
  }

  broadcastMap(zoneId, data, excludeWs = null) {
    const room = this.mapRooms.get(zoneId);
    if (!room) return;
    const json = JSON.stringify(data);
    for (const ws of room) {
      if (ws !== excludeWs && ws.readyState === 1) {
        ws.send(json);
      }
    }
  }

  broadcastAll(data) {
    const json = JSON.stringify(data);
    for (const ws of this.clients.keys()) {
      if (ws.readyState === 1) {
        ws.send(json);
      }
    }
  }

  broadcastOnlineCount() {
    this.broadcastAll({
      type: "ONLINE_COUNT",
      count: this.clients.size
    });
  }
}

module.exports = GameSocketServer;
