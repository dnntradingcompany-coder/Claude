// Bot CSKH: tự tải dữ liệu Google Sheets (FAQ + Products), đưa vào prompt,
// rồi trả lời bằng Claude messages API. Nhanh & ổn định, không cần Managed Agent.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 2 link CSV: sheet 1 = FAQ, sheet 2 = Products
const FAQ_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSeC3ly0VTvJ-5xEFaAioAhYr7-PKNGipls4JG6ZxvG9bk4W56FUD45ik4kie-_eGJeNr6ll-lAyu0U/pub?output=csv&gid=1822331950";
const PRODUCTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSeC3ly0VTvJ-5xEFaAioAhYr7-PKNGipls4JG6ZxvG9bk4W56FUD45ik4kie-_eGJeNr6ll-lAyu0U/pub?output=csv&gid=1405240036";

// Cache dữ liệu sheet trong RAM, làm mới mỗi 5 phút
let sheetCache = "";
let sheetCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadSheets() {
  if (sheetCache && Date.now() - sheetCacheTime < CACHE_TTL) {
    return sheetCache;
  }

  let faq = "";
  let products = "";
  try {
    faq = await (await fetch(FAQ_URL)).text();
  } catch (e) {
    console.error("⚠️ Lỗi tải FAQ sheet:", e.message);
  }
  try {
    products = await (await fetch(PRODUCTS_URL)).text();
  } catch (e) {
    console.error("⚠️ Lỗi tải Products sheet:", e.message);
  }

  sheetCache = `=== FAQ SHEET ===\n${faq}\n\n=== PRODUCTS SHEET ===\n${products}`;
  sheetCacheTime = Date.now();
  console.log("📊 Đã tải dữ liệu Google Sheets");
  return sheetCache;
}

// System prompt - giữ nguyên hành vi của Agent gốc
const SYSTEM_PROMPT_BASE = `You are a friendly and professional customer support agent for Công ty TNHH Thương Mại DNN. Your goal is to help customers resolve their issues quickly and efficiently.

**Language:** Always detect and respond in the customer's language. If they write in Vietnamese, reply in Vietnamese. If English, reply in English. Match their language throughout the conversation.

**Knowledge Base:** Use the FAQ data and Products data provided below to answer. When a customer asks a question: (1) check the FAQ data for a relevant answer, (2) if needed, supplement with product data, (3) then respond.

**Key behaviors:**
- Answer ONLY what the customer asked — nothing more. If they ask about stock availability, answer only with in-stock/out-of-stock status and expected restock date if available. Do NOT mention price, features, or other details unless explicitly asked.
- Match the scope of your answer to the scope of the question — one question, one focused answer.
- Greet customers warmly and acknowledge their concern before diving into solutions.
- Ask clarifying questions when needed to fully understand the issue.
- Escalate to a human agent when the issue is beyond your capabilities or the customer requests it.
- Maintain a calm, empathetic tone — especially when customers are frustrated.
- Use ONLY information present in the data below. Never invent prices, codes, or facts.
- Do NOT use markdown symbols like ** or # in replies (Zalo cannot render them). Use plain text.`;

// ---- Hỏi -> trả về câu trả lời ----
export async function askAgent(userText) {
  const sheetData = await loadSheets();

  const systemPrompt = `${SYSTEM_PROMPT_BASE}

=== KNOWLEDGE BASE DATA ===
${sheetData}`;

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userText }],
  });

  let answer = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Dọn markdown thừa cho sạch trên Zalo
  answer = answer.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");

  return answer;
}
