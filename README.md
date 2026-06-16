# Zalo OA × Claude — Bot CSKH

Chatbot chăm sóc khách hàng trên Zalo Official Account, xử lý bằng Claude.

## Cấu trúc

```
zalo-claude-bot/
├── src/
│   ├── index.js      # Server chính + webhook
│   ├── zalo.js       # Gửi tin + tự refresh token Zalo
│   ├── sessions.js   # Lưu lịch sử hội thoại theo user
│   └── config.js     # 👈 Dán System Prompt của Agent vào đây
├── .env.example      # Mẫu biến môi trường
├── railway.json      # Cấu hình deploy Railway
└── package.json
```

---

## Hướng dẫn deploy lên Railway

### Bước 1: Đưa code lên GitHub
1. Tạo repo mới trên GitHub.
2. Upload toàn bộ thư mục này lên (hoặc dùng `git push`).
3. ⚠️ KHÔNG upload file `.env` (đã có `.gitignore` chặn sẵn).

### Bước 2: Tạo project trên Railway
1. Vào https://railway.app → đăng nhập bằng GitHub.
2. Bấm **New Project** → **Deploy from GitHub repo**.
3. Chọn repo vừa tạo. Railway tự động build và chạy.

### Bước 3: Điền biến môi trường
1. Trong project Railway → tab **Variables**.
2. Thêm từng biến theo file `.env.example`:
   - `ANTHROPIC_API_KEY`
   - `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_SECRET_KEY`
   - `ZALO_OA_ACCESS_TOKEN`, `ZALO_OA_REFRESH_TOKEN`
3. Railway tự restart sau khi lưu.

### Bước 4: Lấy URL công khai
1. Tab **Settings** → mục **Networking** → bấm **Generate Domain**.
2. Bạn nhận được URL dạng `https://xxx.up.railway.app`.
3. Mở URL đó trên trình duyệt — thấy "Zalo-Claude bot is running ✅" là OK.

### Bước 5: Đăng ký webhook với Zalo
1. Vào https://developers.zalo.me → app của bạn → mục **Webhook**.
2. Nhập URL: `https://xxx.up.railway.app/webhook`
3. Tích chọn sự kiện **user_send_text** (và các sự kiện khác nếu cần).
4. Lưu lại.

### Bước 6: Test
Nhắn tin cho OA của bạn từ Zalo cá nhân → bot sẽ trả lời.
Xem log realtime trong tab **Deployments → View Logs** của Railway.

---

## Tùy chỉnh

- **Đổi câu trả lời của bot:** sửa `src/config.js`, dán System Prompt từ Agent của bạn.
- **Đổi model:** sửa biến `CLAUDE_MODEL` (mặc định `claude-sonnet-4-6`).

---

## Lưu ý production

1. **Token Zalo hết hạn ~1 giờ** — code đã tự refresh nếu bạn cấp `ZALO_OA_REFRESH_TOKEN`. Nhưng refresh token cũng có hạn dùng, cần lấy lại định kỳ.
2. **Lịch sử hội thoại lưu trong RAM** — mất khi app restart. Nếu cần bền vững, thay `sessions.js` bằng Redis/Postgres (Railway có sẵn add-on database).
3. **Quy tắc gửi tin Zalo:** chỉ nhắn tự do trong 48h kể từ tin cuối của khách. Kiểm tra chính sách hiện hành tại tài liệu Zalo.
4. **Handoff sang nhân viên:** nên thêm logic chuyển hội thoại cho người thật khi cần.
