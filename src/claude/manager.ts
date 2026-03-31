/**
 * Claude 会话管理器 — claude 层对外唯一入口。
 *
 * 职责：session 池管理、命令路由。
 * 内部持有 CommandRouter 处理命令，UserSession 处理 SDK 交互。
 * index.ts 只依赖此模块。
 */
import { listSessions } from "@anthropic-ai/claude-agent-sdk";
import {
  UserSession,
  type ClaudeResponse,
  type SessionInfo,
  type SessionOptions,
} from "./session.js";
import { CommandRouter, type HandleResult, type SessionOps } from "./commands.js";
import { logger } from "../utils/logger.js";

// --- 公开类型 re-export ---

export type { HandleResult } from "./commands.js";

type ManagerOptions = {
  cwd: string;
};

// --- ClaudeManager: 对外唯一入口 ---

export class ClaudeManager implements SessionOps {
  private sessions = new Map<string, UserSession>();
  private opts: SessionOptions;
  private commandRouter: CommandRouter;

  constructor(opts: ManagerOptions) {
    this.opts = { cwd: opts.cwd };
    this.commandRouter = new CommandRouter(this);
  }

  /** 统一入口 — 命令路由或普通消息处理 */
  async handleInput(userId: string, text: string): Promise<HandleResult> {
    // 多轮交互中 或 以 / 开头 → 命令处理
    if (this.commandRouter.isMultiTurn(userId) || text.startsWith("/")) {
      return this.commandRouter.parseCommand(userId, text);
    }

    // 普通消息 → Claude 处理
    const response = await this.handleMessage(userId, text);
    return { text: response.text };
  }

  // --- SessionOps 实现（供 CommandRouter 调用） ---

  async listResumableSessions(): Promise<SessionInfo[]> {
    const sessions = await listSessions({ dir: this.opts.cwd, limit: 10 });
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      summary: s.summary,
      lastModified: new Date(s.lastModified).getTime(),
    }));
  }

  async createSessionWithResume(userId: string, resumeId: string): Promise<void> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.close();
      this.sessions.delete(userId);
    }
    const session = new UserSession(userId, this.opts, resumeId);
    this.sessions.set(userId, session);
    logger.info({ userId, resumeId }, "恢复会话");
  }

  async closeSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      session.close();
      this.sessions.delete(userId);
    }
    this.commandRouter.clearUserState(userId);
  }

  // --- 生命周期 ---

  async closeAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
  }

  // --- 内部方法 ---

  private async handleMessage(userId: string, text: string): Promise<ClaudeResponse> {
    let session = this.sessions.get(userId);

    // session 死亡时自动重建
    if (session && !session.isAlive) {
      logger.warn({ userId }, "session 已死亡，重建");
      session.close();
      this.sessions.delete(userId);
      session = undefined;
    }

    if (!session) {
      session = new UserSession(userId, this.opts);
      this.sessions.set(userId, session);
    }

    return session.pushMessage(text);
  }

}
