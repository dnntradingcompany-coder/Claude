import express from "express";
import crypto from "crypto";
import { sendZaloMessage } from "./zalo.js";
import { askAgent } from "./agent.js";

const app = express();

// Giữ raw body để verify chữ ký webhook của Zalo
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---- Health check + thẻ meta xác thực domain Zalo ----
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="zalo-platform-site-verification" content="Mzsm1jkYEo86ePz_uBGKLnB4eW_-j7bKDZa" />
</head>
<body>
  Zalo-Claude bot is running ✅
</body>
</html>`);
});

// ---- Verify chữ ký từ Zalo ----
function verifyZaloSignature(req) {
  const secret = process.env.ZALO_OA_SECRET_KEY;
  if (!secret) return true; // bỏ qua nếu chưa cấu hình (dev)

  const mac = req.headers["x-zevent-signature"];
  if (!mac) return false;

  // Zalo ký theo dạng: appId + rawBody + timestamp + OASecretKey
  const timestamp = req.body?.timestamp || "";
  const appId = process.env.ZALO_APP_ID || "";
  const data = appId + req.rawBody.toString() + timestamp + secret;
  const expected =
    "mac=" + crypto.createHash("sha256").update(data).digest("hex");

  return mac === expected;
}

// ---- Webhook nhận tin nhắn từ Zalo ----
app.post("/webhook", async (req, res) => {
  // Trả 200 ngay để Zalo không gửi lại (retry)
  res.sendStatus(200);

  try {
    if (!verifyZaloSignature(req)) {
      console.warn("⚠️ Sai chữ ký webhook - bỏ qua request");
      return;
    }

    const event = req.body;

    // Chỉ xử lý tin nhắn text từ khách hàng
    if (event.event_name !== "user_send_text") return;

    const userId = event.sender?.id;
    const userText = event.message?.text;
    if (!userId || !userText) return;

    console.log(`📩 [${userId}]: ${userText}`);

    // Gọi Agent (agent tự đọc Google Sheets qua tool bash/curl)
    const reply = await askAgent(userText);

    if (!reply) return;

    // Gửi trả lời về Zalo
    await sendZaloMessage(userId, reply);
    console.log(`🤖 [${userId}]: ${reply}`);
  } catch (err) {
    console.error("❌ Lỗi xử lý webhook:", err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy ở cổng ${PORT}`));
