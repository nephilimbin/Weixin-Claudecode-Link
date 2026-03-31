/**
 * iLink 扫码登录流程:
 * 1. GET get_bot_qrcode → 获取二维码字符串和图片 URL
 * 2. 长轮询 get_qrcode_status → 等待/已扫码/已确认/已过期
 * 3. 确认后 → 获得 bot_token + ilink_bot_id + baseurl
 */

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const QR_POLL_TIMEOUT_MS = 35_000;
const LOGIN_TIMEOUT_MS = 480_000; // 8 分钟，匹配 iLink 设计
const MAX_QR_REFRESH = 3;

export type LoginResult = {
  botToken: string;
  accountId: string; // ilink_bot_id
  baseUrl: string;
  userId?: string; // 扫码用户的 ilink_user_id
  alias?: string; // 用户设置的别名（可选）
};

interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface StatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

async function fetchQRCode(apiBaseUrl: string): Promise<QRCodeResponse> {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = `${base}ilink/bot/get_bot_qrcode?bot_type=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch QR code: ${res.status}`);
  return (await res.json()) as QRCodeResponse;
}

async function pollStatus(apiBaseUrl: string, qrcode: string): Promise<StatusResponse> {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = `${base}ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_POLL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "iLink-App-ClientVersion": "1" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`QR status poll failed: ${res.status}`);
    return (await res.json()) as StatusResponse;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "wait" };
    }
    throw err;
  }
}

/**
 * 交互式扫码登录 — 在终端打印二维码，等待用户扫码确认。
 * 返回登录凭证，登录失败时抛出异常。
 * 支持二维码过期自动刷新（最多 MAX_QR_REFRESH 次）。
 */
export async function loginWithQR(apiBaseUrl = DEFAULT_BASE_URL): Promise<LoginResult> {
  let qr = await fetchQRCode(apiBaseUrl);
  let refreshCount = 1;

  const qrterm = await import("qrcode-terminal");
  console.log("\n请使用微信扫描以下二维码：\n");
  qrterm.default.generate(qr.qrcode_img_content, { small: true });
  console.log(`\n如无法显示，请在浏览器打开: ${qr.qrcode_img_content}\n`);

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let scannedLogged = false;

  while (Date.now() < deadline) {
    const status = await pollStatus(apiBaseUrl, qr.qrcode);

    switch (status.status) {
      case "wait":
        process.stdout.write(".");
        break;

      case "scaned":
        if (!scannedLogged) {
          console.log("\n\n已扫码，请在微信上确认...");
          scannedLogged = true;
        }
        break;

      case "expired":
        refreshCount++;
        if (refreshCount > MAX_QR_REFRESH) {
          throw new Error("二维码多次过期，登录超时");
        }
        console.log(`\n二维码已过期，正在刷新... (${refreshCount}/${MAX_QR_REFRESH})`);
        qr = await fetchQRCode(apiBaseUrl);
        scannedLogged = false;
        qrterm.default.generate(qr.qrcode_img_content, { small: true });
        console.log(`如无法显示，请在浏览器打开: ${qr.qrcode_img_content}\n`);
        break;

      case "confirmed":
        if (!status.ilink_bot_id || !status.bot_token) {
          throw new Error("登录失败：服务器未返回必要信息");
        }
        console.log("\n\n✅ 微信连接成功！");
        return {
          botToken: status.bot_token,
          accountId: status.ilink_bot_id,
          baseUrl: status.baseurl || apiBaseUrl,
          userId: status.ilink_user_id,
        };
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("登录超时，请重试");
}
