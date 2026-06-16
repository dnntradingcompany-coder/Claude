import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { sendZaloMessage } from "./zalo.js";
import { getHistory, pushMessage } from "./sessions.js";
import { SYSTEM_PROMPT } from "./config.js";

const app = express();

// Giữ raw body để verify chữ ký webhook của Zalo
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    // Lấy lịch sử + thêm tin mới
    pushMessage(userId, { role: "user", content: userText });
    const history = getHistory(userId);

    // Gọi Claude
    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!reply) return;

    pushMessage(userId, { role: "assistant", content: reply });

    // Gửi trả lời về Zalo
    await sendZaloMessage(userId, reply);
    console.log(`🤖 [${userId}]: ${reply}`);
  } catch (err) {
    console.error("❌ Lỗi xử lý webhook:", err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy ở cổng ${PORT}`));
