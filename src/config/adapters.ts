/**
 * 适配器配置持久化层 — 管理 Bot 的适配器列表配置。
 * 数据存储在 ~/.weixin-claudecode-link/adapters.json
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STATE_DIR = path.join(os.homedir(), ".weixin-claudecode-link");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

import type { AdapterConfig } from "../adapters/types.js";

export type AdaptersConfig = {
  adapters: AdapterConfig[];
};

function adaptersConfigPath(): string {
  return path.join(STATE_DIR, "adapters.json");
}

const DEFAULT_ADAPTERS_CONFIG: AdaptersConfig = {
  adapters: [{ type: "ilink", enabled: true }],
};

export function loadAdaptersConfig(): AdaptersConfig {
  try {
    const raw = fs.readFileSync(adaptersConfigPath(), "utf-8");
    return JSON.parse(raw) as AdaptersConfig;
  } catch {
    return { ...DEFAULT_ADAPTERS_CONFIG };
  }
}

export function saveAdaptersConfig(config: AdaptersConfig): void {
  ensureDir(STATE_DIR);
  fs.writeFileSync(adaptersConfigPath(), JSON.stringify(config, null, 2));
}
