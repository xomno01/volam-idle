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

  init() {
    this.token = localStorage.getItem('vlo_token');
    const savedUser = localStorage.getItem('vlo_user');
    if (savedUser) {
      try { this.user = JSON.parse(savedUser); } catch (e) {}
    }

    if (!window.R) window.R = {};
    if (!window.R.remotePlayers) window.R.remotePlayers = new Map();

    this.connect();
    this.initUI();
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
    const host = this.getServerHost();
    const protocol = (location.protocol === 'https:' || host.includes('trycloudflare.com')) ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}`;
    console.log('[NET] Đang kết nối tới máy chủ Online:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[NET] ✅ Kết nối WebSocket thành công!');
        this.connected = true;
        this.updateOnlineBadge();

        // Gửi thông tin định danh
        if (this.token) {
          this.send({
            type: 'AUTH',
            token: this.token,
            name: S.name || 'Hiệp Khách',
            fac: S.fac || 0,
            lvl: S.lvl || 1,
            hp: R.P ? R.P.life : 100,
            maxHp: R.P ? R.P.life : 100
          });
        } else {
          this.send({
            type: 'SET_PROFILE',
            name: S.name || 'Hiệp Khách',
            fac: S.fac || 0,
            lvl: S.lvl || 1,
            hp: R.P ? R.P.life : 100,
            maxHp: R.P ? R.P.life : 100
          });
        }

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
        setTimeout(() => this.connect(), 3000);
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
    const badge = document.getElementById('onlineStatusBadge');
    if (badge && this.user) {
      badge.title = `Tài khoản: ${this.user.username} (Nhấp để quản lý)`;
    }
  },

  showAuthModal() {
    if (this.user) {
      modal(`
        <h3>Tài Khoản Võ Lâm Online</h3>
        <div class="card">
          <p>Đang đăng nhập: <b style="color:#7fffc0">${esc(this.user.username)}</b></p>
          <p class="dim small">Tiến trình chơi và đồ đạc của bạn được bảo vệ trên đám mây.</p>
          <div class="btnrow">
            <button class="btn" id="bSaveCloud">☁ Lưu lên Cloud</button>
            <button class="btn" id="bLoadCloud">☁ Tải từ Cloud</button>
          </div>
          <div class="btnrow" style="margin-top:10px">
            <button class="btn red" id="bLogout">Đăng xuất</button>
          </div>
        </div>
      `, () => {
        $('#bSaveCloud').onclick = async () => {
          const res = await this.saveCloud(0);
          toast(res.ok ? 'Đã lưu lên Cloud an toàn!' : 'Lỗi: ' + res.error);
        };
        $('#bLoadCloud').onclick = async () => {
          const res = await this.loadCloud(0);
          if (res.ok && res.state) {
            window.S = res.state;
            save();
            toast('Đã nạp nhân vật từ Cloud thành công!');
            setTimeout(() => location.reload(), 800);
          } else {
            toast('Chưa có bản lưu nào trên Cloud');
          }
        };
        $('#bLogout').onclick = () => {
          localStorage.removeItem('vlo_token');
          localStorage.removeItem('vlo_user');
          this.token = null;
          this.user = null;
          closeModal(true);
          toast('Đã đăng xuất');
          this.updateAuthButton();
        };
      });
      return;
    }

    // Modal Đăng nhập / Đăng ký
    modal(`
      <h3>Đăng Nhập / Đăng Ký Online</h3>
      <div class="card">
        <p class="dim small">Đăng ký tài khoản để lưu trữ nhân vật lên máy chủ, chat thế giới và tham gia bãi quái chung.</p>
        <div class="row">Tài khoản: <input id="uName" maxlength="20" style="flex:1"></div>
        <div class="row">Mật khẩu: <input id="uPass" type="password" style="flex:1"></div>
        <div class="btnrow" style="margin-top:12px">
          <button class="btn" id="bDoLogin">Đăng nhập</button>
          <button class="btn" id="bDoReg">Đăng ký mới</button>
        </div>
      </div>
    `, () => {
      $('#bDoLogin').onclick = async () => {
        const u = $('#uName').value, p = $('#uPass').value;
        const res = await this.login(u, p);
        if (res.ok) {
          toast('Đăng nhập thành công! Chào ' + res.user.username);
          closeModal(true);
        } else {
          toast('Lỗi: ' + res.error);
        }
      };
      $('#bDoReg').onclick = async () => {
        const u = $('#uName').value, p = $('#uPass').value;
        const res = await this.register(u, p);
        if (res.ok) {
          toast('Đăng ký tài khoản thành công!');
          closeModal(true);
        } else {
          toast('Lỗi: ' + res.error);
        }
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
