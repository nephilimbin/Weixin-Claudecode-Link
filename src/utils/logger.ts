/**
 * 全局日志模块 — 基于 pino，开发环境使用 pino-pretty 格式化输出。
 * 每条日志自动注入 caller 信息（模块:函数:行号），便于快速定位日志来源。
 */
import pino from "pino";

/**
 * 从 Error.stack 中提取调用者信息（模块:函数）。
 * 跳过 Error 自身、mixin 函数、pino 内部帧。
 */
function getCaller(): string {
  const stack = new Error().stack;
  if (!stack) return "";
  const lines = stack.split("\n");
  for (const line of lines.slice(1)) {
    // 跳过 logger.ts 和 pino 内部
    if (line.includes("logger.ts") || line.includes("node_modules/pino")) continue;
    // 格式: "    at functionName (/path/to/module.ts:line:col)" 或 "    at /path/to/module.ts:line:col"
    const match = line.match(/at\s+(?:(\S+)\s+\()?(.+):(\d+):\d+\)?/);
    if (match) {
      const fn = match[1] || "<anonymous>";
      const file = (match[2] as string).split("/").pop()?.replace(/\.js$/, "") || "";
      const line = match[3];
      return `${file}:${fn}:${line}`;
    }
  }
  return "";
}

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  mixin() {
    return { caller: getCaller() };
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
});
