// Quản lý gửi tin nhắn Zalo + tự động refresh Access Token
// Lưu ý: token lưu trong RAM. Khi app restart sẽ dùng lại token từ env.
// Production nên lưu token vào database (Redis/Postgres).

let cachedToken = process.env.ZALO_OA_ACCESS_TOKEN || null;
let cachedRefreshToken = process.env.ZALO_OA_REFRESH_TOKEN || null;
let tokenExpiry = 0; // timestamp (ms) token hết hạn

// ---- Lấy token mới bằng refresh token ----
async function refreshAccessToken() {
  if (!cachedRefreshToken) {
    console.warn("⚠️ Không có refresh token, dùng access token cố định.");
    return cachedToken;
  }

  try {
    const res = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: process.env.ZALO_APP_SECRET,
      },
      body: new URLSearchParams({
        refresh_token: cachedRefreshToken,
        app_id: process.env.ZALO_APP_ID,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (data.access_token) {
      cachedToken = data.access_token;
      cachedRefreshToken = data.refresh_token || cachedRefreshToken;
      // Token thường sống ~1 giờ; refresh sớm 5 phút cho an toàn
      tokenExpiry = Date.now() + (Number(data.expires_in) - 300) * 1000;
      console.log("🔑 Đã refresh Zalo access token");
    } else {
      console.error("❌ Refresh token thất bại:", data);
    }
  } catch (err) {
    console.error("❌ Lỗi refresh token:", err);
  }

  return cachedToken;
}

// ---- Lấy token hợp lệ (tự refresh nếu sắp hết hạn) ----
async function getValidToken() {
  if (cachedRefreshToken && Date.now() >= tokenExpiry) {
    await refreshAccessToken();
  }
  return cachedToken;
}

// ---- Gửi tin nhắn CSKH tới khách hàng ----
export async function sendZaloMessage(userId, text) {
  const token = await getValidToken();

  const res = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: token,
    },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text },
    }),
  });

  const data = await res.json();
  if (data.error !== 0) {
    console.error("❌ Gửi tin Zalo lỗi:", data);
  }
  return data;
}
