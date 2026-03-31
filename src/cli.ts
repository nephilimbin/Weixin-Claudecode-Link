#!/usr/bin/env node
/**
 * wxcc CLI 入口 — 在当前工作目录启动 Bot
 * 使用方式: wxcc
 */
import { main } from "./index.js";

// 使用当前工作目录作为 Claude 的工作目录
const cwd = process.cwd();

// 设置 --link 参数默认为 ilink（如果未指定）
if (!process.argv.includes("--link")) {
  process.argv.push("--link", "ilink");
}

main().catch((err: unknown) => {
  console.error("启动失败:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
