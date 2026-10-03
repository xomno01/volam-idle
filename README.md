# Võ Lâm Idle (JX Offline) - Bản Clone Hoàn Chỉnh

Dự án clone 100% nguyên bản từ web game **Võ Lâm Idle** (`https://jxoffline.khoa-vnd92.workers.dev/`).
Toàn bộ mã nguồn, logic gameplay, cơ chế chiến đấu, bảng tính chỉ số, hệ thống âm thanh, đồ họa và dữ liệu quái vật/vật phẩm đã được bóc tách và lưu trữ cục bộ. Game chạy **100% Client-side (Offline)**, không phụ thuộc vào bất kỳ server hay database bên ngoài nào.

---

## 📁 Cấu trúc thư mục

```
jxoffline-clone/
├── index.html           # Khung HTML5 Canvas giao diện chính
├── style.css            # Toàn bộ CSS phong cách kiếm hiệp cổ trang
├── manifest.json        # PWA Web App Manifest
├── sw.js                # Service Worker cache offline
├── server.js            # Node.js static HTTP server chạy local
│
├── fonts/               # 4 font chữ kiếm hiệp (Noto Sans & Grenze)
│   ├── font.css
│   ├── NotoSans-*.ttf
│   └── Grenze-*.ttf
│
├── img/                 # 1048 files hình ảnh và animation
│   ├── i/               # Icon vật phẩm, trang bị, vũ khí, áo, mũ, nhẫn
│   ├── m/               # Sprite hình ảnh quái vật, boss
│   ├── pl/              # Sprite nhân vật các môn phái
│   ├── s/               # Icon chiêu thức, võ công môn phái
│   └── z/               # Hình nền các bản đồ, khu vực luyện công
│
├── snd/                 # 175 files âm thanh (.mp3)
│   ├── sound_a*.mp3     # Âm thanh tung chiêu, tiếng đánh quái
│   ├── sound_k*.mp3     # Âm thanh võ công đặc biệt
│   ├── sound_e*.mp3     # Âm thanh boss & quái
│   └── sound_i*.mp3     # Âm thanh giao diện, nhặt đồ, rớt đồ, mở rương
│
├── ui/                  # 14 files frame, button, thanh HP/MP/XP, icon tab
│
├── data.js              # Database chính (~3.5 MB): Môn phái, kỹ năng, trang bị, quái
├── world.js             # Dữ liệu các ải, bản đồ, toạ độ di chuyển
├── jmo.js               # Bản đồ va chạm và vật cản (Collision & Obstacles)
├── sound.js             # Bảng ánh xạ âm thanh cho từng hành động
├── fx.js                # Hiệu ứng đồ họa / Particle / Canvas FX
├── rdata.js             # Dữ liệu công thức chế tạo / phần thưởng
│
└── js/                  # 21 modules mã nguồn Javascript (chưa bị nén/obfuscate)
    ├── core.js          # Khởi tạo game loop, timer, helpers
    ├── combat.js        # Cơ chế chiến đấu, tính damage, ngũ hành tương khắc
    ├── stats.js         # Bảng thuộc tính nhân vật, tiềm năng, trang bị
    ├── loot.js          # Tỷ lệ rơi đồ, định danh phẩm chất đồ (Trắng, Xanh, Vàng, HKMP)
    ├── sets.js          # Kích hoạt thuộc tính set đồ Hoàng Kim
    ├── recipes.js       # Công thức ghép đồ, ép đồ
    ├── save.js          # Lưu/Load game vào localStorage trình duyệt
    ├── render.js        # Vẽ nhân vật, quái, chiêu thức lên canvas
    ├── audio.js         # Web Audio API controller
    ├── ui.js            # Điều khiển giao diện, popup, tooltip
    ├── control.js       # Phím bấm, điều khiển nhân vật, auto
    ├── shop.js          # Tiệm tạp hóa, dược điếm, mua bán
    ├── rewards.js       # Quà đăng nhập, rương, tháp thử thách, tài xỉu
    ├── forge.js         # Cường hóa, khảm nạm Huyền Tinh
    ├── auto.js          # Hệ thống auto đánh, tự nhặt đồ theo bộ lọc
    ├── admin.js         # Bảng thử nghiệm (Cheat / Test Panel)
    ├── guide.js         # Hướng dẫn tân thủ
    ├── stash.js         # Kho chung chuyển đồ giữa các nhân vật
    ├── survival.js      # Chế độ sinh tồn / Luyện công dã ngoại
    └── main.js          # Entrypoint kết nối toàn bộ hệ thống
```

---

## 🚀 Cách chạy Game trên máy tính

### Cách 1: Chạy bằng Node.js (Khuyến nghị)
Mở PowerShell hoặc Command Prompt tại thư mục này và gõ:
```bash
node server.js
```
Sau đó mở trình duyệt và truy cập: **`http://localhost:3000`**

### Cách 2: Dùng Python
```bash
python -m http.server 3000
```
Truy cập: **`http://localhost:3000`**

### Cách 3: Mở bằng VS Code Live Server
* Cài extension **Live Server** trong VS Code.
* Nhấp chuột phải vào file `index.html` và chọn **Open with Live Server**.

---

## 🛠 Hướng dẫn Mod & Tùy chỉnh (Cheat / Tăng tốc)

Do toàn bộ logic nằm ở Client, bạn có thể tự do chỉnh sửa:

### 1. Dùng bảng thử nghiệm (Admin Panel) không giới hạn:
Trong file `js/admin.js`, hàm `adminDaDung()` giới hạn mỗi ngày chỉ được dùng 1 lần. Bạn có thể sửa thành:
```javascript
const adminDaDung = () => false; // Luôn cho phép mở admin panel
```
Khi chơi, bấm vào menu **Khác -> Thử nghiệm** để chọn:
* Lên thẳng cấp trần
* Thêm 10.000.000 lượng
* Nhận đủ Huyền Tinh 1-5, Thủy Tinh, Tinh Hồng Bảo Thạch
* Mở toàn bộ ải bản đồ
* Cường hóa +10 toàn bộ trang bị
* Phát ngay 1 bộ Hoàng Kim Môn Phái

### 2. Tùy chỉnh tỷ lệ rơi đồ:
* Mở `js/loot.js` để chỉnh tỷ lệ rớt đồ tím, đồ hoàng kim hoặc tiền vàng từ quái vật.

### 3. Tùy chỉnh tốc độ đánh / di chuyển:
* Mở `js/stats.js` hoặc `js/combat.js` để tinh chỉnh chỉ số nhân vật (Tốc độ đánh, Hút máu, Hút nội lực, Kháng tất cả).

---

## 🌐 Deploy lên Web cá nhân miễn phí
Vì toàn bộ là web tĩnh, bạn có thể đưa toàn bộ thư mục này lên:
* **GitHub Pages** (Tạo repo và push lên branch `gh-pages` hoặc `main`)
* **Vercel** (`npx vercel`)
* **Cloudflare Pages** (Kéo thả cả folder lên dashboard Cloudflare Pages)
* **Netlify** (Kéo thả folder vào `app.netlify.com/drop`)
