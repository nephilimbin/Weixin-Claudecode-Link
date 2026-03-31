/**
 * 凭证持久化层 — 管理适配器登录凭证的存储。
 * 数据存储在 ~/.weixin-claudecode-link/credentials.json
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STATE_DIR = path.join(os.homedir(), ".weixin-claudecode-link");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/** 统一凭证配置文件路径 */
function credentialsPath(): string {
  return path.join(STATE_DIR, "credentials.json");
}

/** 统一凭证配置结构 */
export type CredentialsConfig = Record<string, Record<string, unknown>[]>;

/** 适配器凭证列表 */
export type CredentialsList = Record<string, unknown>[];

/**
 * 加载所有凭证配置
 */
function loadAllCredentials(): CredentialsConfig {
  try {
    const p = credentialsPath();
    const content = fs.readFileSync(p, "utf-8");
    return JSON.parse(content) as CredentialsConfig;
  } catch {
    return {};
  }
}

/**
 * 保存所有凭证配置
 */
function saveAllCredentials(config: CredentialsConfig): void {
  ensureDir(STATE_DIR);
  const p = credentialsPath();
  fs.writeFileSync(p, JSON.stringify(config, null, 2));
  fs.chmodSync(p, 0o600);
}

/**
 * 加载指定协议的所有凭证
 */
export function loadAdapterCredentials(adapterId: string): CredentialsList {
  const all = loadAllCredentials();
  return (all[adapterId] as CredentialsList) || [];
}

/**
 * 保存指定协议的凭证列表
 * - 纯粹的存储操作，不处理业务逻辑
 * - 唯一性检查由各适配器自己实现
 */
export function saveAdapterCredentials(adapterId: string, credentialsList: CredentialsList): void {
  const all = loadAllCredentials();
  all[adapterId] = credentialsList;
  saveAllCredentials(all);
}

/**
 * 列出指定协议的凭证
 */
export function listAdapterCredentials(adapterId: string): CredentialsList {
  return loadAdapterCredentials(adapterId);
}

/**
 * 删除指定协议的指定索引凭证
 */
export function deleteAdapterCredentials(adapterId: string, index: number): boolean {
  const all = loadAllCredentials();
  const list = (all[adapterId] as CredentialsList) || [];

  if (index < 0 || index >= list.length) {
    return false;
  }

  list.splice(index, 1);

  if (list.length === 0) {
    delete all[adapterId];
  } else {
    all[adapterId] = list;
  }

  saveAllCredentials(all);
  return true;
}
