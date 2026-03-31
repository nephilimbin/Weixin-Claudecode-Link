/**
 * iLink 协议状态持久化 — sync buffer 和 context tokens。
 * 状态存储在 ~/.weixin-claudecode-link/ilink/<userId>/ 目录下。
 * 按 userId 隔离，确保不同用户的状态互不干扰。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE_DIR = path.join(os.homedir(), ".weixin-claudecode-link", "ilink");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 获取用户状态目录
 * @param userId - iLink 用户 ID（扫码用户）
 */
function userStateDir(userId: string): string {
  // userId 格式: o9cq80-xxx@im.wechat，使用 URL 编码处理特殊字符
  const safeUserId = encodeURIComponent(userId);
  return path.join(BASE_DIR, safeUserId);
}

// --- 同步游标 (getUpdates cursor) ---

function syncBufPath(userId: string): string {
  return path.join(userStateDir(userId), "sync-buf.txt");
}

export function loadSyncBuf(userId: string): string {
  try {
    return fs.readFileSync(syncBufPath(userId), "utf-8");
  } catch {
    return "";
  }
}

export function saveSyncBuf(userId: string, buf: string): void {
  const dir = userStateDir(userId);
  ensureDir(dir);
  fs.writeFileSync(syncBufPath(userId), buf);
}

// --- Context tokens（每用户独立缓存） ---
// 注意：这里存储的是该 bot 收到的不同对话用户的 context_token
// 文件已按 bot ownerId 隔离，所以内部存储的是 { senderUserId: contextToken }

function contextTokensPath(userId: string): string {
  return path.join(userStateDir(userId), "context-tokens.json");
}

export function loadContextTokens(userId: string): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(contextTokensPath(userId), "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveContextTokens(userId: string, tokens: Record<string, string>): void {
  const dir = userStateDir(userId);
  ensureDir(dir);
  fs.writeFileSync(contextTokensPath(userId), JSON.stringify(tokens));
}
