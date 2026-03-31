/**
 * 命令路由与多轮状态机 — 管理 /resume、/new 等交互式命令。
 *
 * CommandRouter 通过 SessionOps 接口访问 manager 的会话操作能力，
 * 自身管理所有多轮交互状态（如 /resume 的列表→选号），
 * 对外暴露 parseCommand 和 isMultiTurn。
 */
import type { SessionInfo } from "./session.js";
import { logger } from "../utils/logger.js";

// --- 公开类型定义 ---

/** 命令处理结果 */
export type HandleResult = { text: string | null };

/** commands 通过此接口访问 manager 的会话操作能力 */
export interface SessionOps {
  listResumableSessions(): Promise<SessionInfo[]>;
  createSessionWithResume(userId: string, resumeId: string): Promise<void>;
  closeSession(userId: string): Promise<void>;
}

// --- 内部类型 ---

type CommandHandler = (userId: string) => Promise<HandleResult>;

// --- CommandRouter ---

export class CommandRouter {
  private commands = new Map<string, CommandHandler>();
  private resumeStates = new Map<string, { sessions: SessionInfo[] }>();
  private sessionOps: SessionOps;

  constructor(sessionOps: SessionOps) {
    this.sessionOps = sessionOps;
    this.register("/resume", this.handleResume);
    this.register("/new", this.handleNew);
  }

  /** 用户是否处于多轮交互状态（如 /resume 等待序号输入） */
  isMultiTurn(userId: string): boolean {
    return this.resumeStates.has(userId);
  }

  /**
   * 解析并执行命令。由 manager 在确认是命令或多轮交互时调用。
   * 不返回 null — 命令不匹配时返回未知命令提示。
   */
  async parseCommand(userId: string, text: string): Promise<HandleResult> {
    // 多轮交互优先
    if (this.resumeStates.has(userId)) {
      return this.handleResumeSelect(userId, text);
    }

    const handler = this.commands.get(text);
    if (handler) {
      return handler(userId);
    }

    return { text: `未知命令: ${text}` };
  }

  /** 清理指定用户的多轮状态 */
  clearUserState(userId: string): void {
    this.resumeStates.delete(userId);
  }

  // --- 命令注册 ---

  private register(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler.bind(this));
  }

  // --- 命令实现 ---

  private async handleResume(userId: string): Promise<HandleResult> {
    const sessions = await this.sessionOps.listResumableSessions();
    if (sessions.length === 0) {
      return { text: "无历史会话可恢复。" };
    }
    this.resumeStates.set(userId, { sessions });
    const lines = ["=== 历史会话 ==="];
    sessions.forEach((s, i) => {
      const time = new Date(s.lastModified).toLocaleString("zh-CN");
      lines.push(`${i + 1}. [${s.sessionId.slice(0, 8)}] ${s.summary}  (${time})`);
    });
    lines.push("\n输入序号恢复，输入 0 取消。");
    return { text: lines.join("\n") };
  }

  private async handleResumeSelect(userId: string, text: string): Promise<HandleResult> {
    const state = this.resumeStates.get(userId)!;
    const choice = parseInt(text, 10);
    if (isNaN(choice)) {
      return { text: "请输入会话序号，或输入 0 取消。" };
    }
    if (choice === 0) {
      this.resumeStates.delete(userId);
      return { text: "已取消会话恢复。" };
    }
    if (choice < 1 || choice > state.sessions.length) {
      return { text: "无效的序号。" };
    }
    const selected = state.sessions[choice - 1];
    this.resumeStates.delete(userId);
    await this.sessionOps.createSessionWithResume(userId, selected.sessionId);
    logger.info({ sessionId: selected.sessionId }, "会话已恢复");
    return { text: `已恢复会话: ${selected.sessionId.slice(0, 8)}。` };
  }

  private async handleNew(userId: string): Promise<HandleResult> {
    await this.sessionOps.closeSession(userId);
    logger.info({ userId }, "新会话");
    return { text: "已创建新会话。" };
  }
}
