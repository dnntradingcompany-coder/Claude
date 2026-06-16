// Gọi Claude Managed Agent qua REST API trực tiếp (fetch + beta header).
// Không dùng SDK beta vì phiên bản SDK hiện tại chưa hỗ trợ environments/sessions.
//
// Biến môi trường cần:
//   ANTHROPIC_API_KEY  - API key
//   CLAUDE_AGENT_ID    - id agent (vd: agent_011CaMkbGaRnpnJQULp1fX1B)
//   CLAUDE_ENV_ID      - (tùy chọn) id environment. Nếu không có, code tự tạo 1 lần.

const API_BASE = "https://api.anthropic.com/v1";
const BETA_HEADER = "managed-agents-2026-04-01";

function headers() {
  return {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": BETA_HEADER,
  };
}

const AGENT_ID = process.env.CLAUDE_AGENT_ID;
let cachedEnvId = process.env.CLAUDE_ENV_ID || null;

// ---- Tạo environment nếu chưa có (chạy 1 lần) ----
async function getEnvironmentId() {
  if (cachedEnvId) return cachedEnvId;

  const res = await fetch(`${API_BASE}/environments`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: "zalo-bot-env",
      config: { type: "cloud", networking: { type: "unrestricted" } },
    }),
  });

  const data = await res.json();
  if (!data.id) {
    throw new Error("Không tạo được environment: " + JSON.stringify(data));
  }
  cachedEnvId = data.id;
  console.log("🌐 Đã tạo environment:", cachedEnvId);
  return cachedEnvId;
}

// ---- Hỏi Agent, trả về text trả lời ----
export async function askAgent(userText) {
  const environmentId = await getEnvironmentId();

  // 1. Tạo session
  const sRes = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      agent: AGENT_ID,
      environment_id: environmentId,
      title: "Zalo CSKH",
    }),
  });
  const session = await sRes.json();
  if (!session.id) {
    throw new Error("Không tạo được session: " + JSON.stringify(session));
  }

  // 2. Gửi tin nhắn user vào session
  await fetch(`${API_BASE}/sessions/${session.id}/events`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: userText }],
        },
      ],
    }),
  });

  // 3. Poll các event tới khi agent idle (tối đa ~60s)
  let answer = "";
  let cursor = null;
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    const url = new URL(`${API_BASE}/sessions/${session.id}/events`);
    if (cursor) url.searchParams.set("after", cursor);

    const eRes = await fetch(url, { headers: headers() });
    const eData = await eRes.json();
    const events = eData.data || eData.events || [];

    let idle = false;
    for (const ev of events) {
      cursor = ev.id || cursor;
      if (ev.type === "agent.message" && Array.isArray(ev.content)) {
        for (const block of ev.content) {
          if (block.type === "text" && block.text) answer += block.text;
        }
      }
      if (ev.type === "session.status_idle") idle = true;
    }

    if (idle) break;
    await new Promise((r) => setTimeout(r, 1500)); // chờ 1.5s rồi poll tiếp
  }

  return answer.trim();
}
