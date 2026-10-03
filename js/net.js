/* ======================= VÕ LÂM ONLINE: MẠNG & ĐỒNG BỘ THỜI GIAN THỰC ======================= */
'use strict';

const NET = {
  ws: null,
  connected: false,
  myId: null,
  user: null,
  token: null,
  currentZoneId: null,
  lastMoveSent: 0,
  chatLog: [],
  onlineCount: 1,

  async init() {
    this.token = localStorage.getItem('vlo_token');
    const savedUser = localStorage.getItem('vlo_user');
    if (savedUser) {
      try { this.user = JSON.parse(savedUser); } catch (e) {}
    }

    if (!window.R) window.R = {};
    if (!window.R.remotePlayers) window.R.remotePlayers = new Map();

    this.initUI();

    // Kiểm tra token có hợp lệ trên máy chủ không
    if (this.token) {
      console.log('[NET] Đang kiểm tra phiên đăng nhập của:', this.user ? this.user.username : 'khách');
      const cloud = await this.loadCloud(0);
      if (cloud && cloud.ok) {
        console.log('[NET] Phiên đăng nhập hợp lệ!');
        if (cloud.state && cloud.state.fac) {
          window.S = cloud.state;
          if (typeof save === 'function') save();
          if (typeof recalc === 'function') recalc();
          if (typeof refresh === 'function') refresh();
        }
        this.hideAuthGate();
        this.connect();
      } else {
        console.warn('[NET] Token hết hạn hoặc máy chủ đã reset, yêu cầu đăng nhập lại.');
        localStorage.removeItem('vlo_token');
        localStorage.removeItem('vlo_user');
        this.token = null;
        this.user = null;
        this.updateAuthButton();
        this.showAuthGate();
      }
    } else {
      console.log('[NET] Chưa đăng nhập, hiển thị màn hình Auth Gate bắt buộc.');
      this.showAuthGate();
    }
  },

  getServerHost() {
    const custom = localStorage.getItem('vlo_server_host');
    if (custom) return custom.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/$/, '');
    return location.host;
  },

  getHttpBase() {
    const host = this.getServerHost();
    if (host === location.host) return '';
    const protocol = (location.protocol === 'https:' || host.includes('trycloudflare.com')) ? 'https:' : 'http:';
    return `${protocol}//${host}`;
  },

  connect() {
    if (!this.token) {
      console.warn('[NET] Chưa đăng nhập, hoãn kết nối WebSocket.');
      return;
    }
    const host = this.getServerHost();
    const protocol = (location.protocol === 'https:' || host.includes('trycloudflare.com')) ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}`;
    console.log('[NET] Đang kết nối tới máy chủ Online:', wsUrl);

    try {
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
      }
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[NET] ✅ Kết nối WebSocket thành công!');
        this.connected = true;
        this.updateOnlineBadge();

        // Gửi thông tin định danh người chơi
        this.send({
          type: 'AUTH',
          token: this.token,
          name: (typeof S !== 'undefined' && S.name) ? S.name : (this.user ? this.user.username : 'Hiệp Khách'),
          fac: (typeof S !== 'undefined' && S.fac) ? S.fac : 0,
          lvl: (typeof S !== 'undefined' && S.lvl) ? S.lvl : 1,
          hp: (window.R && R.P) ? R.P.life : 100,
          maxHp: (window.R && R.P) ? R.P.life : 100
        });

        // Vào map hiện tại
        const zoneId = (typeof zoneOf === 'function' && typeof S !== 'undefined') ? zoneOf(S.stage).id : 2;
        this.joinMap(zoneId);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[NET] Lỗi gói tin:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.warn('[NET] Mất kết nối tới máy chủ, tự kết nối lại sau 3s...');
        this.updateOnlineBadge();
        if (this.token) {
          setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[NET] Lỗi mạng:', err);
      };
    } catch (e) {
      console.error('[NET] Không thể mở kết nối WebSocket:', e);
    }
  },

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  },

  handleMessage(msg) {
    switch (msg.type) {
      case 'INIT':
        this.myId = msg.id;
        this.onlineCount = msg.onlineCount || 1;
        this.updateOnlineBadge();
        break;

      case 'ONLINE_COUNT':
        this.onlineCount = msg.count || 1;
        this.updateOnlineBadge();
        break;

      case 'AUTH_OK':
        console.log('[NET] Đăng nhập tài khoản thành công:', msg.user.username);
        this.user = msg.user;
        localStorage.setItem('vlo_user', JSON.stringify(this.user));
        this.updateAuthButton();
        break;

      case 'ZONE_INIT':
        this.currentZoneId = msg.zoneId;
        // Cập nhật danh sách người chơi khác
        if (R.remotePlayers) {
          R.remotePlayers.clear();
          if (Array.isArray(msg.players)) {
            for (const p of msg.players) {
              if (p.id !== this.myId) {
                R.remotePlayers.set(p.id, { ...p, targetX: p.x, targetY: p.y, chatBubble: null, chatT: 0 });
              }
            }
          }
        }
        // Đồng bộ bãi quái chung từ server
        if (Array.isArray(msg.monsters) && msg.monsters.length > 0) {
          this.syncMonstersFromServer(msg.monsters);
        }
        break;

      case 'PLAYER_JOIN': {
        const p = msg.player;
        if (p && p.id !== this.myId && R.remotePlayers) {
          R.remotePlayers.set(p.id, { ...p, targetX: p.x, targetY: p.y, chatBubble: null, chatT: 0 });
          this.appendChat({
            channel: 'sys',
            sender: { name: 'Hệ thống' },
            text: `Hiệp khách [${p.name}] vừa bước vào bản đồ!`,
            time: ''
          });
        }
        break;
      }

      case 'PLAYER_UPDATE': {
        const p = msg.player;
        if (p && R.remotePlayers && R.remotePlayers.has(p.id)) {
          const cur = R.remotePlayers.get(p.id);
          Object.assign(cur, p);
        }
        break;
      }

      case 'REMOTE_PLAYER_MOVE': {
        if (msg.id !== this.myId && R.remotePlayers && R.remotePlayers.has(msg.id)) {
          const p = R.remotePlayers.get(msg.id);
          p.targetX = msg.x;
          p.targetY = msg.y;
          p.dir = msg.dir;
          p.isAttacking = !!msg.isAttacking;
        }
        break;
      }

      case 'PLAYER_LEAVE': {
        if (R.remotePlayers && R.remotePlayers.has(msg.id)) {
          R.remotePlayers.delete(msg.id);
        }
        break;
      }

      case 'MONSTER_DAMAGE': {
        const r = msg.result;
        if (!r) return;
        // Tìm quái trong R.enemies
        const mon = R.enemies ? R.enemies.find(e => e.id === r.monsterId) : null;
        if (mon) {
          mon.hp = r.remainingHp;
          mon.hitT = 0.15;
          if (r.remainingHp <= 0) mon.dead = true;
          // Hiển thị số sát thương bay lên trên đầu quái
          if (typeof addText === 'function') {
            const col = r.isCrit ? '#ffdd4a' : '#ff5533';
            const txt = (r.isCrit ? 'Bạo! -' : '-') + fmt(r.damage);
            addText(mon.x + (Math.random() * 20 - 10), mon.y - mon.r - 10, txt, col, r.isCrit ? 15 : 12);
          }
        }
        break;
      }

      case 'MONSTER_SPAWN': {
        const m = msg.monster;
        if (m && R.enemies) {
          const existing = R.enemies.find(e => e.id === m.id);
          if (existing) {
            Object.assign(existing, m, { dead: false });
          } else {
            R.enemies.push(this.formatServerMonster(m));
          }
        }
        break;
      }

      case 'LOOT_AWARD': {
        if (msg.exp && typeof addExp === 'function') addExp(msg.exp);
        if (msg.gold && typeof addGold === 'function') addGold(msg.gold);
        if (typeof toast === 'function') toast(`⚔ Diệt quái nhận +${fmt(msg.exp)} kinh nghiệm, +${fmt(msg.gold)} lượng!`);
        break;
      }

      case 'CHAT': {
        this.appendChat(msg);
        // Hiển thị bóng chat trên đầu nhân vật nếu người đó đang ở gần
        if (msg.sender && R.remotePlayers && R.remotePlayers.has(msg.sender.id)) {
          const p = R.remotePlayers.get(msg.sender.id);
          p.chatBubble = msg.text;
          p.chatT = 4.5; // Hiện trong 4.5 giây
        } else if (msg.sender && msg.sender.id === this.myId) {
          if (typeof H !== 'undefined') {
            H.chatBubble = msg.text;
            H.chatT = 4.5;
          }
        }
        break;
      }

      case 'SYSTEM_NOTICE': {
        console.log('[NET] Nhận thông báo toàn server:', msg.text);
        this.showSystemNotice(msg.text, msg.color || '#ffdd4a');
        this.appendChat({
          channel: 'sys',
          sender: { name: '📢 QUẢN TRỊ VIÊN' },
          text: msg.text,
          time: new Date(msg.time || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        });
        break;
      }

      case 'ADMIN_UPDATE_STATE': {
        console.log('[NET] Cập nhật dữ liệu từ Admin:', msg);
        if (msg.state) {
          window.S = msg.state;
          if (typeof save === 'function') save();
          if (typeof recalc === 'function') recalc();
          if (typeof refresh === 'function') refresh();
        }
        if (msg.notice) {
          if (typeof toast === 'function') toast(`🎁 ${msg.notice}`);
          if (typeof uiSfx === 'function') {
            try { uiSfx('levelup'); } catch (e) {}
          }
          this.appendChat({
            channel: 'sys',
            sender: { name: 'HỆ THỐNG' },
            text: msg.notice,
            time: ''
          });
        }
        break;
      }

      case 'KICKED': {
        console.warn('[NET] Bị ngắt kết nối bởi Quản trị viên:', msg.reason);
        this.showKickedNotice(msg.reason || 'Bạn đã bị ngắt kết nối bởi Quản trị viên');
        if (this.ws) {
          this.ws.onclose = null; // Không tự reconnect
          this.ws.close();
        }
        break;
      }
    }
  },

  syncMonstersFromServer(serverMonsters) {
    if (!window.R) return;
    R.enemies = serverMonsters.map(m => this.formatServerMonster(m));
  },

  formatServerMonster(m) {
    const tid = m.tid || Object.keys(MON)[0];
    const mInfo = MON[tid] || { n: m.n || 'Quái vật', sz: [32, 48, 16, 40] };
    const imSrc = mInfo.img;
    return {
      id: m.id,
      tid,
      n: m.n || mInfo.n,
      img: imSrc ? (typeof img === 'function' ? img(imSrc) : null) : null,
      sz: mInfo.sz,
      L: m.L || 1,
      cls: m.cls || 'normal',
      series: m.series || 0,
      res: {},
      hp: m.hp,
      max: m.maxHp,
      dmg: 10,
      ar: 50,
      def: 20,
      x: m.x,
      y: m.y,
      r: m.cls === 'boss' ? 30 : m.cls === 'elite' ? 21 : 17,
      spd: 35,
      atkCd: 1,
      cd: 1.5,
      ranged: false,
      stun: 0,
      poison: 0,
      poisonDmg: 0,
      hitT: 0,
      face: 1,
      act: m.act || 'st',
      dead: !!m.isDead
    };
  },

  joinMap(zoneId) {
    if (!zoneId) return;
    const hx = (typeof H !== 'undefined' && H.x) ? Math.round(H.x) : 768;
    const hy = (typeof H !== 'undefined' && H.y) ? Math.round(H.y) : 768;
    this.send({
      type: 'JOIN_MAP',
      zoneId,
      x: hx,
      y: hy
    });
  },

  syncMove(x, y, dir, isAttacking = false, skillId = 0) {
    const now = Date.now();
    // Giới hạn gửi tọa độ (throttling 50ms)
    if (now - this.lastMoveSent < 45 && !isAttacking) return;
    this.lastMoveSent = now;

    this.send({
      type: 'MOVE',
      x: Math.round(x),
      y: Math.round(y),
      dir: dir || 0,
      isAttacking,
      skillId
    });
  },

  attackMonster(monsterId, skillDamage = 0) {
    this.send({
      type: 'ATTACK_MONSTER',
      monsterId,
      skillDamage
    });
  },

  sendChat(text, channel = 'world') {
    if (!text || !text.trim()) return;
    this.send({
      type: 'CHAT',
      channel,
      text: text.trim()
    });
  },

  // --- API GỌI REST ---
  async apiPost(url, data) {
    try {
      const fullUrl = (url.startsWith('http://') || url.startsWith('https://')) ? url : (this.getHttpBase() + url);
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: 'Không thể kết nối máy chủ' };
    }
  },

  async register(username, password) {
    const res = await this.apiPost('/api/register', { username, password });
    if (res.ok) {
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('vlo_token', this.token);
      localStorage.setItem('vlo_user', JSON.stringify(this.user));
      this.updateAuthButton();
      // Báo danh lại qua WebSocket
      this.send({
        type: 'AUTH',
        token: this.token,
        name: S.name || this.user.username,
        fac: S.fac,
        lvl: S.lvl
      });
    }
    return res;
  },

  async login(username, password) {
    const res = await this.apiPost('/api/login', { username, password });
    if (res.ok) {
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('vlo_token', this.token);
      localStorage.setItem('vlo_user', JSON.stringify(this.user));
      this.updateAuthButton();
      this.send({
        type: 'AUTH',
        token: this.token,
        name: S.name || this.user.username,
        fac: S.fac,
        lvl: S.lvl
      });
    }
    return res;
  },

  _lastCloudSave: 0,
  saveCloudThrottled() {
    const now = Date.now();
    if (now - this._lastCloudSave < 15000) return; // Giới hạn tối thiểu 15s một lần
    this._lastCloudSave = now;
    if (this.token && typeof S !== 'undefined' && S.fac) {
      this.saveCloud(0);
    }
  },

  async saveCloud(slot = 0) {
    if (!this.token) return { ok: false, error: 'Chưa đăng nhập' };
    return await this.apiPost('/api/save', { token: this.token, slot, state: S });
  },

  async loadCloud(slot = 0) {
    if (!this.token) return { ok: false, error: 'Chưa đăng nhập' };
    try {
      const fullUrl = this.getHttpBase() + `/api/load?token=${this.token}&slot=${slot}`;
      const res = await fetch(fullUrl);
      return await res.json();
    } catch (e) {
      return { ok: false, error: 'Lỗi nạp dữ liệu đám mây' };
    }
  },

  // --- GIAO DIỆN CHAT & ONLINE HUD ---
  initUI() {
    this.injectOnlineStyles();
    this.createChatWidget();
    this.updateOnlineBadge();
    this.updateAuthButton();
  },

  injectOnlineStyles() {
    const css = `
      #onlineStatusBadge {
        display: inline-flex; align-items: center; gap: 5px;
        background: #111e18; border: 1px solid #2f5c44;
        color: #7fffc0; padding: 2px 8px; border-radius: 12px;
        font-size: 11px; cursor: pointer; margin-right: 4px;
      }
      #onlineStatusBadge .dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #00ff88; box-shadow: 0 0 6px #00ff88;
      }
      #onlineStatusBadge.off .dot { background: #ff4444; box-shadow: none; }

      #chatBoxWrap {
        position: fixed; bottom: 58px; left: 0; right: 0;
        max-width: 520px; margin: 0 auto;
        background: rgba(14, 20, 18, 0.88);
        border-top: 1px solid #364d41;
        display: flex; flex-direction: column;
        z-index: 100; transition: max-height 0.3s ease;
        backdrop-filter: blur(4px);
      }
      #chatMessages {
        height: 80px; overflow-y: auto; padding: 6px 10px;
        font-size: 12px; line-height: 1.4; color: #e6ede8;
        display: flex; flex-direction: column; gap: 3px;
      }
      .chat-line { word-break: break-word; }
      .chat-time { color: #888; font-size: 10px; margin-right: 4px; }
      .chat-chan { font-weight: bold; padding: 1px 4px; border-radius: 3px; font-size: 10px; margin-right: 4px; }
      .chat-chan.world { background: #5f4215; color: #ffdb8a; }
      .chat-chan.sect { background: #19405a; color: #8ad2ff; }
      .chat-chan.sys { background: #5a1919; color: #ff8a8a; }
      .chat-sender { color: #a3e635; font-weight: bold; margin-right: 4px; }

      #chatInputBar {
        display: flex; gap: 4px; padding: 4px 8px;
        background: rgba(8, 12, 11, 0.95); border-top: 1px solid #23332b;
      }
      #chatChannelSel {
        background: #1a2622; color: #ffdb8a; border: 1px solid #3d5449;
        border-radius: 4px; font-size: 11px; padding: 2px 4px;
      }
      #chatInputText {
        flex: 1; background: #121c18; border: 1px solid #3d5449;
        border-radius: 4px; color: #fff; padding: 4px 8px; font-size: 12px;
      }
      #chatSendBtn {
        background: #2b543f; border: 1px solid #4a8a68; color: #fff;
        border-radius: 4px; padding: 2px 10px; font-size: 12px; cursor: pointer;
      }
      #chatSendBtn:hover { background: #3d785a; }

      /* ================= THÔNG BÁO QUẢN TRỊ VIÊN TOÀN SERVER (BANNER) ================= */
      #serverNoticeBanner {
        position: fixed; top: 16px; left: 50%; transform: translate(-50%, -24px) scale(0.92);
        z-index: 99999;
        background: rgba(13, 22, 17, 0.96); border: 2px solid #ffdd4a; border-radius: 12px;
        box-shadow: 0 0 35px rgba(251, 191, 36, 0.55), inset 0 0 15px rgba(0, 0, 0, 0.7);
        padding: 12px 24px; display: flex; align-items: center; gap: 14px;
        max-width: 92vw; width: 560px; backdrop-filter: blur(12px);
        opacity: 0; pointer-events: none; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #serverNoticeBanner.visible {
        opacity: 1; pointer-events: auto; transform: translate(-50%, 0) scale(1);
      }
      #serverNoticeBanner .notice-icon { font-size: 28px; animation: noticePulse 1.2s infinite alternate ease-in-out; }
      @keyframes noticePulse { from { transform: scale(1); } to { transform: scale(1.15); } }
      #serverNoticeBanner .notice-body { flex: 1; text-align: left; }
      #serverNoticeBanner .notice-tag { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px; }
      #serverNoticeBanner .notice-text { font-size: 15px; font-weight: 700; color: #ffffff; line-height: 1.4; word-break: break-word; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

      /* ================= AUTH GATE OVERLAY (BẮT BUỘC ĐĂNG NHẬP / ĐĂNG KÝ) ================= */
      #authGateOverlay {
        position: fixed; inset: 0; background: radial-gradient(circle at center, #14221b 0%, #060a08 100%);
        z-index: 100000; display: none; justify-content: center; align-items: center; padding: 16px;
        backdrop-filter: blur(10px);
      }
      .auth-box {
        background: #0f1914; border: 1px solid #1f3d2b;
        box-shadow: 0 0 40px rgba(16, 185, 129, 0.2), 0 25px 50px rgba(0,0,0,0.85);
        border-radius: 16px; max-width: 410px; width: 100%; padding: 28px 24px;
        color: #e2e8f0; text-align: center; animation: authFadeIn 0.3s ease;
      }
      @keyframes authFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      .auth-tabs { display: flex; border-bottom: 2px solid #1a2e22; margin-bottom: 18px; }
      .auth-tab-btn {
        flex: 1; padding: 10px; font-size: 13px; font-weight: 700; background: transparent;
        border: none; color: #94a3b8; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent;
      }
      .auth-tab-btn.active { color: #fbbf24; border-bottom-color: #fbbf24; }
      .auth-field { display: flex; flex-direction: column; gap: 5px; text-align: left; margin-bottom: 12px; }
      .auth-field label { font-size: 12px; font-weight: 600; color: #cbd5e1; }
      .auth-field input {
        background: #070c09; border: 1px solid #1f3d2b; border-radius: 6px;
        padding: 9px 12px; font-size: 13px; color: #fff; outline: none; transition: border-color 0.2s;
      }
      .auth-field input:focus { border-color: #10b981; }

      /* ================= KICKED NOTIFICATION OVERLAY ================= */
      #kickedNoticeOverlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.92);
        z-index: 100001; display: none; justify-content: center; align-items: center; padding: 20px;
        backdrop-filter: blur(10px);
      }
      .kicked-box {
        background: #181111; border: 1px solid #7f1d1d; border-radius: 16px;
        max-width: 420px; width: 100%; padding: 32px 24px; text-align: center; color: #f87171;
        box-shadow: 0 0 40px rgba(239, 68, 68, 0.25);
      }
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  },

  createChatWidget() {
    if (document.getElementById('chatBoxWrap')) return;

    // 1. Gắn nút Online & Auth vào Header
    const topEl = document.querySelector('#top .topmid');
    if (topEl) {
      const badge = document.createElement('div');
      badge.id = 'onlineStatusBadge';
      badge.innerHTML = `<span class="dot"></span> <b><span id="onCnt">1</span></b> online`;
      badge.onclick = () => this.showAuthModal();
      topEl.prepend(badge);
    }

    // 2. Gắn Chat Box
    const chatWrap = document.createElement('div');
    chatWrap.id = 'chatBoxWrap';
    chatWrap.innerHTML = `
      <div id="chatMessages">
        <div class="chat-line"><span class="chat-chan sys">HỆ THỐNG</span> Chào mừng đại hiệp gia nhập Võ Lâm Online! Bạn có thể chat trực tiếp với bằng hữu ở đây.</div>
      </div>
      <div id="chatInputBar">
        <select id="chatChannelSel">
          <option value="world">Thế giới</option>
          <option value="sect">Môn phái</option>
        </select>
        <input id="chatInputText" placeholder="Gõ tin nhắn giang hồ..." maxlength="120">
        <button id="chatSendBtn">Gửi</button>
      </div>
    `;
    document.body.appendChild(chatWrap);

    // Xử lý gửi tin nhắn
    const send = () => {
      const inp = document.getElementById('chatInputText');
      const sel = document.getElementById('chatChannelSel');
      if (inp && inp.value.trim()) {
        this.sendChat(inp.value, sel.value);
        inp.value = '';
      }
    };

    document.getElementById('chatSendBtn').onclick = send;
    document.getElementById('chatInputText').onkeydown = (e) => {
      if (e.key === 'Enter') send();
    };
  },

  appendChat(msg) {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'chat-line';

    const chanClass = msg.channel === 'sect' ? 'sect' : msg.channel === 'sys' ? 'sys' : 'world';
    const chanName = msg.channel === 'sect' ? 'MÔN PHÁI' : msg.channel === 'sys' ? 'HỆ THỐNG' : 'THẾ GIỚI';

    div.innerHTML = `
      <span class="chat-time">${msg.time || ''}</span>
      <span class="chat-chan ${chanClass}">${chanName}</span>
      ${msg.sender ? `<span class="chat-sender">[${msg.sender.name}]:</span>` : ''}
      <span class="chat-text">${esc(msg.text)}</span>
    `;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },

  updateOnlineBadge() {
    const el = document.getElementById('onCnt');
    const badge = document.getElementById('onlineStatusBadge');
    if (el) el.textContent = this.onlineCount;
    if (badge) {
      if (this.connected) badge.classList.remove('off');
      else badge.classList.add('off');
    }
  },

  updateAuthButton() {
    const txt = document.getElementById('accountUserTxt');
    if (txt) {
      txt.textContent = this.user ? this.user.username : 'Tài khoản';
    }
    const badge = document.getElementById('onlineStatusBadge');
    if (badge && this.user) {
      badge.title = `Tài khoản: ${this.user.username} (Nhấp để quản lý)`;
    }
  },

  showAuthModal() {
    this.showAccountModal();
  },

  showAccountModal() {
    if (!this.user) {
      this.showAuthGate();
      return;
    }
    const host = this.getServerHost();
    const wsStatus = (this.ws && this.ws.readyState === WebSocket.OPEN) 
      ? '<span style="color:#4ade80;">🟢 Đang kết nối Online</span>' 
      : '<span style="color:#f87171;">🔴 Ngoại tuyến / Mất kết nối</span>';

    const charInfo = (typeof S !== 'undefined' && S.fac) 
      ? `${S.name || 'Hiệp khách'} · Lv${S.lvl || 1} (${(FAC && FAC[S.fac] && FAC[S.fac].n) || 'Chưa phái'})`
      : 'Chưa khởi tạo nhân vật';

    modal(`
      <h3 style="color:#38bdf8;">👤 Quản Lý Tài Khoản & Máy Chủ</h3>
      <div class="card" style="padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span>Tài khoản:</span>
          <b style="color:#38bdf8; font-size:15px;">${esc(this.user.username)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span>Nhân vật:</span>
          <b style="color:#fbbf24;">${esc(charInfo)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span>Máy chủ:</span>
          <code style="color:#94a3b8; font-size:11px;">${esc(host)}</code>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Trạng thái:</span>
          <b>${wsStatus}</b>
        </div>
      </div>

      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="bOpenServerModal" style="flex:1;">🌐 Đổi Máy Chủ</button>
        <button class="btn" id="bSaveCloud" style="flex:1;">☁️ Lưu Lên Mây</button>
        <button class="btn" id="bLoadCloud" style="flex:1;">☁️ Tải Từ Mây</button>
      </div>

      <div class="btnrow" style="margin-top:14px;">
        <button class="btn red" id="bLogoutTrigger" style="width:100%; justify-content:center; padding:11px; font-weight:700; border-radius:8px;">
          🚪 Đăng Xuất Đổi Tài Khoản
        </button>
      </div>
    `, () => {
      $('#bOpenServerModal').onclick = () => {
        closeModal(true);
        this.showServerModal();
      };
      $('#bSaveCloud').onclick = async () => {
        const res = await this.saveCloud(0);
        toast(res.ok ? '✅ Đã lưu nhân vật lên máy chủ an toàn!' : '⚠️ Lỗi: ' + res.error);
      };
      $('#bLoadCloud').onclick = async () => {
        const res = await this.loadCloud(0);
        if (res.ok && res.state) {
          window.S = res.state;
          save();
          toast('✅ Đã nạp nhân vật từ đám mây thành công!');
          setTimeout(() => location.reload(), 600);
        } else {
          toast('⚠️ Chưa có bản lưu nào trên máy chủ');
        }
      };
      $('#bLogoutTrigger').onclick = () => {
        this.logout();
      };
    });
  },

  logout() {
    modal(`
      <h3 style="color:#ef4444;">🚪 Đăng Xuất Tài Khoản?</h3>
      <p class="desc">Bạn có muốn đăng xuất khỏi tài khoản <b>${esc(this.user ? this.user.username : '')}</b> để đổi sang tài khoản khác không?</p>
      <div class="card" style="margin:10px 0; font-size:12px; color:#94a3b8;">
        Tiến trình nhân vật của bạn sẽ được tự động lưu lên đám mây máy chủ trước khi đăng xuất.
      </div>
      <div class="btnrow">
        <button class="btn" onclick="closeModal()">Hủy</button>
        <button class="btn red" id="bConfirmLogout" style="font-weight:700;">Đăng Xuất Ngay</button>
      </div>
    `, () => {
      $('#bConfirmLogout').onclick = async () => {
        try { await this.saveCloud(0); } catch (e) {}
        localStorage.removeItem('vlo_token');
        localStorage.removeItem('vlo_user');
        this.token = null;
        this.user = null;
        if (this.ws) {
          this.ws.onclose = null;
          try { this.ws.close(); } catch (e) {}
          this.ws = null;
        }
        closeModal(true);
        this.updateAuthButton();
        if (typeof toast === 'function') toast('Đã đăng xuất tài khoản.');
        this.showAuthGate();
      };
    });
  },

  /* ================= THÔNG BÁO QUẢN TRỊ TOÀN SERVER (BANNER) ================= */
  _noticeTimer: null,
  showSystemNotice(text, color = '#ffdd4a') {
    let el = document.getElementById('serverNoticeBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'serverNoticeBanner';
      document.body.appendChild(el);
    }

    el.style.borderColor = color;
    el.style.boxShadow = `0 0 35px ${color}88, inset 0 0 15px rgba(0,0,0,0.7)`;
    el.innerHTML = `
      <div class="notice-icon">📢</div>
      <div class="notice-body">
        <div class="notice-tag" style="color: ${color}">THÔNG BÁO TỪ QUẢN TRỊ VIÊN</div>
        <div class="notice-text">${esc(text)}</div>
      </div>
    `;

    el.classList.remove('hidden');
    el.classList.add('visible');

    if (typeof uiSfx === 'function') {
      try { uiSfx('levelup'); } catch (e) {}
    }

    clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, 7500);
  },

  /* ================= HỘP THOẠI KICK / BAN ================= */
  showKickedNotice(reason) {
    let el = document.getElementById('kickedNoticeOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kickedNoticeOverlay';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="kicked-box">
        <div style="font-size: 48px; margin-bottom: 12px">⚠️</div>
        <h2 style="color: #ef4444; margin-bottom: 10px">MẤT KẾT NỐI MÁY CHỦ</h2>
        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px; line-height: 1.5;">${esc(reason)}</p>
        <button class="btn" style="background: #3b82f6; padding: 10px 24px; font-size: 14px; border-radius: 8px;" onclick="location.reload()">
          Tải Lại & Đăng Nhập
        </button>
      </div>
    `;
    el.style.display = 'flex';
  },

  /* ================= AUTH GATE OVERLAY (BẮT BUỘC ĐĂNG NHẬP / ĐĂNG KÝ) ================= */
  currentAuthTab: 'login',

  showAuthGate() {
    let overlay = document.getElementById('authGateOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'authGateOverlay';
      overlay.innerHTML = `
        <div class="auth-box">
          <div class="auth-header" style="margin-bottom: 16px;">
            <div style="font-size: 38px; margin-bottom: 6px;">⚔️</div>
            <h2 style="color: #fbbf24; font-size: 20px; font-weight: 800; letter-spacing: 1px;">VÕ LÂM TRUYỀN KỲ ONLINE</h2>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Đăng nhập để vào thế giới giang hồ trực tuyến</p>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab-btn active" id="tabBtnLogin" onclick="NET.switchAuthTab('login')">ĐĂNG NHẬP</button>
            <button class="auth-tab-btn" id="tabBtnReg" onclick="NET.switchAuthTab('reg')">ĐĂNG KÝ MỚI</button>
          </div>

          <div id="authFormArea">
            <div class="auth-field">
              <label>Tài Khoản:</label>
              <input type="text" id="authUsername" placeholder="Tên tài khoản (3 - 20 ký tự)" maxlength="20" autofocus autocomplete="username">
            </div>

            <div class="auth-field">
              <label>Mật Khẩu:</label>
              <input type="password" id="authPassword" placeholder="Mật khẩu (từ 4 ký tự)" maxlength="32" autocomplete="current-password">
            </div>

            <div class="auth-field" id="authConfirmField" style="display: none;">
              <label>Xác Nhận Mật Khẩu:</label>
              <input type="password" id="authPasswordConfirm" placeholder="Nhập lại mật khẩu" maxlength="32" autocomplete="new-password">
            </div>

            <div id="authErrorMsg" style="color: #f87171; font-size: 12px; margin-bottom: 12px; min-height: 18px; text-align: left; display: none;"></div>

            <button class="btn" id="authSubmitBtn" onclick="NET.handleAuthSubmit()" style="width: 100%; justify-content: center; padding: 11px; font-size: 14px; font-weight: 700; background: #059669; border-radius: 8px;">
              Vào Game
            </button>
          </div>

          <div class="auth-footer" style="margin-top: 18px; border-top: 1px solid #1a2e22; padding-top: 12px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
            <span>Máy chủ: <b style="color: #38bdf8;" id="authServerDisplay">${esc(NET.getServerHost())}</b></span>
            <button class="btn sm" onclick="NET.showServerModal()" style="color: #38bdf8; background: #0f172a; border: 1px solid #1e293b; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">⚙️ Đổi Máy Chủ</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const handleKey = (e) => {
        if (e.key === 'Enter') NET.handleAuthSubmit();
      };
      document.getElementById('authUsername').addEventListener('keydown', handleKey);
      document.getElementById('authPassword').addEventListener('keydown', handleKey);
      document.getElementById('authPasswordConfirm').addEventListener('keydown', handleKey);
    } else {
      const d = document.getElementById('authServerDisplay');
      if (d) d.textContent = this.getServerHost();
    }

    overlay.style.display = 'flex';
  },

  hideAuthGate() {
    const overlay = document.getElementById('authGateOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  switchAuthTab(tab) {
    this.currentAuthTab = tab;
    const tabLogin = document.getElementById('tabBtnLogin');
    const tabReg = document.getElementById('tabBtnReg');
    const confirmField = document.getElementById('authConfirmField');
    const submitBtn = document.getElementById('authSubmitBtn');
    const errorEl = document.getElementById('authErrorMsg');
    if (errorEl) errorEl.style.display = 'none';

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
      confirmField.style.display = 'none';
      submitBtn.textContent = 'Vào Game';
      submitBtn.style.background = '#059669';
    } else {
      tabReg.classList.add('active');
      tabLogin.classList.remove('active');
      confirmField.style.display = 'block';
      submitBtn.textContent = 'Tạo Tài Khoản & Bắt Đầu';
      submitBtn.style.background = '#b45309';
    }
  },

  async handleAuthSubmit() {
    const u = (document.getElementById('authUsername').value || '').trim();
    const p = (document.getElementById('authPassword').value || '').trim();
    const errorEl = document.getElementById('authErrorMsg');

    const showError = (msg) => {
      errorEl.textContent = '⚠️ ' + msg;
      errorEl.style.display = 'block';
    };

    if (!u || u.length < 3) return showError('Tên tài khoản phải từ 3 đến 20 ký tự');
    if (!p || p.length < 4) return showError('Mật khẩu phải từ 4 ký tự trở lên');

    if (this.currentAuthTab === 'reg') {
      const p2 = (document.getElementById('authPasswordConfirm').value || '').trim();
      if (p !== p2) return showError('Mật khẩu xác nhận không trùng khớp!');

      const res = await this.register(u, p);
      if (!res.ok) return showError(res.error || 'Đăng ký thất bại');

      this.hideAuthGate();
      this.afterAuthSuccess(true);
    } else {
      const res = await this.login(u, p);
      if (!res.ok) return showError(res.error || 'Đăng nhập thất bại');

      this.hideAuthGate();
      this.afterAuthSuccess(false);
    }
  },

  async afterAuthSuccess(isNewAccount) {
    if (typeof toast === 'function') toast(`⚔️ Chào mừng đại hiệp [${this.user.username}] gia nhập Võ Lâm!`);
    
    // Nạp dữ liệu đám mây của nhân vật
    const cloud = await this.loadCloud(0);
    if (cloud && cloud.ok && cloud.state && cloud.state.fac) {
      window.S = cloud.state;
      if (typeof save === 'function') save();
      if (typeof recalc === 'function') recalc();
      if (typeof refresh === 'function') refresh();
    } else {
      // Tài khoản mới hoặc chưa có bản lưu: khởi tạo mới cho tài khoản này
      if (typeof newSave === 'function') {
        window.S = newSave();
        S.name = this.user.username;
        if (typeof save === 'function') save();
      }
      if (typeof pickFaction === 'function') {
        pickFaction();
      }
    }

    // Kết nối WebSocket & bắt đầu thế giới online
    this.connect();
    this.updateAuthButton();
  },

  promptServerHost() {
    this.showServerModal();
  },

  showServerModal() {
    const cur = this.getServerHost();
    modal(`
      <h3 style="color:#38bdf8;">🌐 Chọn & Cấu Hình Máy Chủ</h3>
      <div class="card" style="margin-bottom:12px;">
        <p class="desc">Chọn máy chủ kết nối để chơi cùng bạn bè qua Cloudflare Tunnel hoặc máy chủ VPS:</p>
        
        <div style="margin:10px 0; display:flex; flex-direction:column; gap:8px;">
          <button class="btn" id="pLocalhost" style="justify-content:flex-start; text-align:left; padding:8px 12px;">
            🏠 <b>Máy Cục Bộ / VPS (localhost:3000)</b>
          </button>
          <button class="btn" id="pCloudflare" style="justify-content:flex-start; text-align:left; padding:8px 12px;">
            ☁️ <b>Cloudflare Tunnel / Pages (.pages.dev / .trycloudflare.com)</b>
          </button>
        </div>

        <div style="margin-top:10px;">
          <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Địa chỉ IP / Domain máy chủ:</label>
          <input id="customServerInput" value="${cur === location.host ? '' : esc(cur)}" placeholder="Ví dụ: my-tunnel.trycloudflare.com hoặc 103.x.x.x:3000" style="width:100%; padding:8px 10px; background:#0b131e; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
          <small class="dim" style="display:block; margin-top:4px;">Để trống nếu kết nối cùng host với trang web đang mở.</small>
        </div>
      </div>

      <div class="btnrow">
        <button class="btn" id="bResetServer" style="background:#334155;">Mặc Định</button>
        <button class="btn" id="bSaveServer" style="background:#059669; font-weight:700;">Lưu & Kết Nối Lại</button>
      </div>
    `, () => {
      $('#pLocalhost').onclick = () => {
        $('#customServerInput').value = 'localhost:3000';
      };
      $('#pCloudflare').onclick = () => {
        const val = prompt('Dán đường dẫn Cloudflare Tunnel hoặc Cloudflare Pages của bạn:\n(Ví dụ: https://xxx.trycloudflare.com hoặc https://xxx.pages.dev)', $('#customServerInput').value || '');
        if (val) {
          const cleaned = val.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/$/, '');
          $('#customServerInput').value = cleaned;
        }
      };
      $('#bResetServer').onclick = () => {
        localStorage.removeItem('vlo_server_host');
        closeModal(true);
        toast('Đã đặt lại máy chủ mặc định!');
        setTimeout(() => location.reload(), 400);
      };
      $('#bSaveServer').onclick = () => {
        const val = ($('#customServerInput').value || '').trim();
        const cleaned = val.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/$/, '');
        if (cleaned) {
          localStorage.setItem('vlo_server_host', cleaned);
          closeModal(true);
          toast(`Đã đổi máy chủ: ${cleaned}`);
        } else {
          localStorage.removeItem('vlo_server_host');
          closeModal(true);
          toast('Đã chuyển về máy chủ mặc định!');
        }
        setTimeout(() => location.reload(), 500);
      };
    });
  }
};

window.NET = NET;

// Khởi chạy khi DOM sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NET.init());
} else {
  NET.init();
}
