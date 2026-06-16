// Lưu lịch sử hội thoại theo từng user_id (trong RAM).
// ⚠️ Khi app restart, lịch sử sẽ mất. Production nên dùng Redis/Postgres.

const sessions = new Map();

const MAX_TURNS = 20; // giữ tối đa 20 tin gần nhất (10 lượt qua lại)
const SESSION_TTL = 60 * 60 * 1000; // 1 giờ không hoạt động thì xóa

export function pushMessage(userId, message) {
  const entry = sessions.get(userId) || { messages: [], lastActive: 0 };
  entry.messages.push(message);

  // Cắt bớt nếu quá dài
  if (entry.messages.length > MAX_TURNS) {
    entry.messages = entry.messages.slice(-MAX_TURNS);
  }

  entry.lastActive = Date.now();
  sessions.set(userId, entry);
}

export function getHistory(userId) {
  const entry = sessions.get(userId);
  return entry ? entry.messages : [];
}

export function clearHistory(userId) {
  sessions.delete(userId);
}

// Dọn các session cũ định kỳ để tránh đầy RAM
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of sessions.entries()) {
    if (now - entry.lastActive > SESSION_TTL) {
      sessions.delete(userId);
    }
  }
}, 10 * 60 * 1000); // chạy mỗi 10 phút
