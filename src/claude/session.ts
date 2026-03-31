/**
 * Claude Code SDK 交互引擎 — 每用户消息队列 + query 生命周期管理。
 *
 * UserSession 桥接 SDK 的 pull 模式（async generator）和 adapter 的 push 模式（请求-响应），
 * 对外仅暴露 pushMessage（推入消息阻塞等待响应）和 close（关闭会话）。
 */
import { query, type Query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { classifyMessage, displayEvent, type ResultEvent } from "./events.js";
import { logger } from "../utils/logger.js";

// --- 公开类型定义 ---

export type ClaudeResponse = {
  text: string;
  durationMs: number;
  costUsd?: number;
};

export type SessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;
};

export type SessionOptions = {
  cwd: string;
};

// --- 内部类型 ---

type QueueItem = {
  text: string;
  resolve: (response: ClaudeResponse) => void;
  reject: (err: Error) => void;
};

// --- UserSession: 每用户消息队列 + query 生命周期 ---

export class UserSession {
  readonly userId: string;
  private opts: SessionOptions;
  private resumeId?: string;

  private queue: QueueItem[] = [];
  // SDK 在 yield 后会立即请求下一条消息，generator 必须在 yield 前 shift
  // 并用 currentItem 保存 resolve/reject，供 result handler 使用
  private currentItem: QueueItem | null = null;
  private waitResolver: (() => void) | null = null;
  private query: Query | null = null;
  private closed = false;
  private alive = true;

  constructor(userId: string, opts: SessionOptions, resumeId?: string) {
    this.userId = userId;
    this.opts = opts;
    this.resumeId = resumeId;
    // 启动后台 query 循环（不阻塞构造）
    this.runLoop().catch(() => { this.alive = false; });
  }

  /** 推入消息，阻塞直到 Claude 完成整个 turn */
  pushMessage(text: string): Promise<ClaudeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.alive || this.closed) {
        reject(new Error("Session 已关闭"));
        return;
      }
      this.queue.push({ text, resolve, reject });
      // 唤醒等待中的 generator
      if (this.waitResolver) {
        this.waitResolver();
        this.waitResolver = null;
      }
    });
  }

  close(): void {
    this.closed = true;
    this.alive = false;
    if (this.query) {
      this.query.close();
      this.query = null;
    }
    // 拒绝所有排队中的消息
    for (const item of this.queue) {
      item.reject(new Error("Session 已关闭"));
    }
    this.queue = [];
    if (this.currentItem) {
      this.currentItem.reject(new Error("Session 已关闭"));
      this.currentItem = null;
    }
    if (this.waitResolver) {
      this.waitResolver();
      this.waitResolver = null;
    }
  }

  get isAlive(): boolean {
    return this.alive && !this.closed;
  }

  /**
   * async generator — SDK 通过 next() 拉取消息，队列空时等待唤醒。
   * yield 前 shift 防止 SDK 立即再次拉取时重复消费同一条消息。
   */
  private async *messageGenerator(): AsyncGenerator<SDKUserMessage> {
    while (!this.closed) {
      if (this.queue.length === 0) {
        // 等待新消息到达
        await new Promise<void>((resolve) => {
          this.waitResolver = resolve;
        });
      }
      if (this.queue.length === 0 || this.closed) continue;

      const item = this.queue.shift()!;
      this.currentItem = item;

      yield {
        type: "user" as const,
        session_id: "",
        message: {
          role: "user" as const,
          content: [{ type: "text" as const, text: item.text }],
        },
        parent_tool_use_id: null,
      };
    }
  }

  /**
   * 后台循环 — 运行 query() 并消费 SDK 返回的消息流。
   * query 异常退出后自动重建（进程级异常除外），保证 session 可恢复。
   */
  private async runLoop(): Promise<void> {
    while (!this.closed) {
      const q = query({
        prompt: this.messageGenerator(),
        options: this.buildOptions(),
      });
      this.query = q;
      this.resumeId = undefined;

      let turnStart = Date.now();

      try {
        for await (const message of q) {
          const event = classifyMessage(message);
          if (!event) continue;

          // result 类事件 — resolve Promise（handler 核心职责）
          if (event.category === "result") {
            this.handleResult(event, turnStart);
            turnStart = Date.now();
            continue;
          }

          // 其他事件 — 终端日志展示
          displayEvent(event);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ error: msg }, "query 异常");

        // 拒绝当前正在处理的消息
        if (this.currentItem) {
          this.currentItem.reject(new Error(msg));
          this.currentItem = null;
        }
        // 拒绝排队中的消息
        for (const item of this.queue) {
          item.reject(new Error(msg));
        }
        this.queue = [];

        // 进程异常退出，session 不可恢复
        if (msg.includes("exited with code")) {
          this.alive = false;
          break;
        }
      }

      // query 结束（generator 耗尽或异常后继续）
      this.query = null;
    }
  }

  private buildOptions(): Record<string, unknown> {
    return {
      settingSources: ["user", "project", "local"],
      cwd: this.opts.cwd,
      thinking: { type: "disabled" },
      tools: { type: "preset", preset: "claude_code" },
      systemPrompt: { type: "preset", preset: "claude_code" },
      ...(this.resumeId ? { resume: this.resumeId } : {}),
    };
  }

  /** 处理 turn 最终结果 — resolve 对应的 pushMessage Promise */
  private handleResult(event: ResultEvent, turnStart: number): void {
    if (event.kind === "success") {
      logger.info(
        { turns: event.numTurns, duration_ms: event.durationMs, cost_usd: event.costUsd },
        "turn done",
      );
      logger.info({ reply: event.text.slice(0, 200) }, "Claude reply");

      if (this.currentItem) {
        const item = this.currentItem;
        this.currentItem = null;
        logger.debug("resolve pushMessage → adapter");
        item.resolve({
          text: event.text,
          durationMs: Date.now() - turnStart,
          costUsd: event.costUsd,
        });
      }
    } else {
      logger.error({ subtype: event.subtype, errors: event.errors }, "turn error");
      if (this.currentItem) {
        const item = this.currentItem;
        this.currentItem = null;
        const errorMsg = event.errors.join(", ") || event.subtype;
        item.resolve({
          text: `处理出错: ${errorMsg}`,
          durationMs: Date.now() - turnStart,
        });
      }
    }
  }
}
