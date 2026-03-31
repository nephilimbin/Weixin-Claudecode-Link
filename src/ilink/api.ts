/**
 * iLink HTTP API 封装 — 覆盖微信 Bot 消息收发所需的 5 个接口。
 * 所有接口通过 POST 调用，附带 Bearer token 认证和 channel_version。
 */
import crypto from "node:crypto";
import type {
  GetUpdatesReq,
  GetUpdatesResp,
  SendMessageReq,
  SendTypingReq,
  GetConfigResp,
} from "./types.js";

const CHANNEL_VERSION = "weixin-claudecode-link/0.1.0";
const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
const DEFAULT_API_TIMEOUT_MS = 15_000;

export type ApiOptions = {
  baseUrl: string;
  token: string;
};

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(token: string, body: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf-8")),
    "X-WECHAT-UIN": randomWechatUin(),
  };
}

async function post<T>(
  opts: ApiOptions,
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const url = new URL(endpoint, opts.baseUrl.endsWith("/") ? opts.baseUrl : opts.baseUrl + "/");
  const body = JSON.stringify({ ...payload, base_info: { channel_version: CHANNEL_VERSION } });
  const headers = buildHeaders(opts.token, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // 如果传入了外部 signal，当它 abort 时也中止当前请求
  const onExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`iLink API ${endpoint} 返回错误 ${res.status}: ${text}`);
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
    if (err instanceof Error && err.name === "AbortError") {
      // 长轮询超时或外部取消都是预期行为
      throw err;
    }
    // 增强错误信息，添加 URL 和端点上下文
    if (err instanceof Error) {
      err.message = `iLink API 请求失败 [${endpoint}]: ${err.message}`;
    }
    throw err;
  }
}

/**
 * 长轮询拉取新消息。
 * 客户端超时时返回空消息列表（AbortError 被静默处理）。
 * 支持通过 AbortSignal 取消正在进行的请求（用于优雅退出）。
 */
export async function getUpdates(
  opts: ApiOptions,
  params: GetUpdatesReq,
  signal?: AbortSignal,
): Promise<GetUpdatesResp> {
  try {
    return await post<GetUpdatesResp>(
      opts,
      "ilink/bot/getupdates",
      { get_updates_buf: params.get_updates_buf ?? "" },
      DEFAULT_LONG_POLL_TIMEOUT_MS,
      signal,
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ret: 0, msgs: [], get_updates_buf: params.get_updates_buf };
    }
    throw err;
  }
}

export async function sendMessage(opts: ApiOptions, body: SendMessageReq): Promise<void> {
  await post(opts, "ilink/bot/sendmessage", body as unknown as Record<string, unknown>, DEFAULT_API_TIMEOUT_MS);
}

export async function sendTyping(opts: ApiOptions, body: SendTypingReq): Promise<void> {
  await post(opts, "ilink/bot/sendtyping", body as unknown as Record<string, unknown>, DEFAULT_API_TIMEOUT_MS);
}

/**
 * 获取 Bot 配置，主要返回 typing_ticket 用于发送"正在输入"状态。
 */
export async function getConfig(
  opts: ApiOptions,
  ilinkUserId: string,
  contextToken?: string,
): Promise<GetConfigResp> {
  return post<GetConfigResp>(
    opts,
    "ilink/bot/getconfig",
    { ilink_user_id: ilinkUserId, context_token: contextToken },
    DEFAULT_API_TIMEOUT_MS,
  );
}
