// Gọi Claude Managed Agent (agent có sẵn tool bash/curl đọc Google Sheets).
// Quy trình: tạo session -> gửi message -> stream event -> gom câu trả lời.
//
// Cần các biến môi trường:
//   ANTHROPIC_API_KEY   - API key
//   CLAUDE_AGENT_ID     - id của agent (vd: agent_011CaMkbGaRnpnJQULp1fX1B)
//   CLAUDE_ENV_ID       - id của environment (sandbox). Nếu chưa có, code tự tạo 1 lần.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AGENT_ID = process.env.CLAUDE_AGENT_ID;

// Cache environment id trong RAM (tạo 1 lần rồi dùng lại)
let cachedEnvId = process.env.CLAUDE_ENV_ID || null;

// ---- Tạo environment nếu chưa có ----
async function getEnvironmentId() {
  if (cachedEnvId) return cachedEnvId;

  const env = await anthropic.beta.environments.create({
    name: "zalo-bot-env",
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  cachedEnvId = env.id;
  console.log("🌐 Đã tạo environment:", cachedEnvId);
  return cachedEnvId;
}

// ---- Hỏi Agent một câu, trả về text trả lời ----
export async function askAgent(userText) {
  const environmentId = await getEnvironmentId();

  // 1. Tạo session mới cho lượt hỏi này
  const session = await anthropic.beta.sessions.create({
    agent: AGENT_ID,
    environment_id: environmentId,
    title: "Zalo CSKH",
  });

  let answer = "";

  // 2. Mở stream, gửi câu hỏi, gom kết quả
  const stream = anthropic.beta.sessions.events.stream(session.id);

  await anthropic.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: userText }],
      },
    ],
  });

  // 3. Xử lý từng event tới khi agent idle
  for await (const event of stream) {
    if (event.type === "agent.message") {
      for (const block of event.content) {
        if (block.type === "text") answer += block.text;
      }
    } else if (event.type === "session.status_idle") {
      break;
    }
  }

  return answer.trim();
}
