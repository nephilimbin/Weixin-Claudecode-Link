/**
 * SDK 消息分类与终端展示 — 将 @anthropic-ai/claude-agent-sdk 的 24 种消息类型
 * 归纳为 5 个 ClaudeEvent category，用于终端日志输出和未来 adapter 推送。
 *
 * 职责边界：
 * - classifyMessage(): 纯分类逻辑，无副作用
 * - displayEvent():    终端/日志输出
 * - result 类事件不在此处理，由 handler.ts 直接消费
 */
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKToolProgressMessage,
  SDKToolUseSummaryMessage,
  SDKAuthStatusMessage,
  SDKRateLimitEvent,
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../utils/logger.js";

// --- 事件类型定义 ---

/** 工具调用事件 */
export type ToolEvent =
  | {
    kind: "tool_use";
    category: "tool";
    toolName: string;
    toolUseId: string;
    inputPreview: string;
  }
  | {
    kind: "progress";
    category: "tool";
    toolName: string;
    toolUseId: string;
    parentToolUseId: string | null;
    elapsedSeconds: number;
  }
  | {
    kind: "summary";
    category: "tool";
    summary: string;
  };

/** 任务生命周期事件 */
export type TaskEvent =
  | {
    kind: "started";
    category: "task";
    taskId: string;
    description: string;
    taskType?: string;
  }
  | {
    kind: "progress";
    category: "task";
    taskId: string;
    description: string;
    lastToolName?: string;
    summary?: string;
  }
  | {
    kind: "notification";
    category: "task";
    taskId: string;
    status: "completed" | "failed" | "stopped";
    summary: string;
  };

/** 会话状态事件 */
export type SessionEvent =
  | {
    kind: "init";
    category: "session";
    model: string;
    sessionId: string;
    cwd: string;
  }
  | {
    kind: "status";
    category: "session";
    status: string;
  }
  | {
    kind: "compact_boundary";
    category: "session";
    trigger: "manual" | "auto";
    preTokens: number;
  }
  | {
    kind: "state_changed";
    category: "session";
    state: "idle" | "running" | "requires_action";
  };

/** 系统事件 */
export type SystemEvent =
  | {
    kind: "api_retry";
    category: "system";
    attempt: number;
    maxRetries: number;
    errorStatus: number | null;
  }
  | {
    kind: "auth_status";
    category: "system";
    isAuthenticating: boolean;
  }
  | {
    kind: "rate_limit";
    category: "system";
    status: string;
  }
  | {
    kind: "files_persisted";
    category: "system";
    fileCount: number;
    failedCount: number;
  }
  | {
    kind: "hook_started";
    category: "system";
    hookName: string;
    hookEvent: string;
  }
  | {
    kind: "hook_progress";
    category: "system";
    hookName: string;
    output: string;
  }
  | {
    kind: "hook_response";
    category: "system";
    hookName: string;
    outcome: string;
  }
  | {
    kind: "local_command_output";
    category: "system";
    content: string;
  }
  | {
    kind: "elicitation_complete";
    category: "system";
    serverName: string;
  };

/** 回合最终结果 */
export type ResultEvent =
  | {
    kind: "success";
    category: "result";
    text: string;
    durationMs: number;
    costUsd?: number;
    numTurns?: number;
  }
  | {
    kind: "error";
    category: "result";
    subtype: string;
    errors: string[];
    durationMs: number;
    costUsd?: number;
  };

/** 所有事件联合类型 */
export type ClaudeEvent =
  | ToolEvent
  | TaskEvent
  | SessionEvent
  | SystemEvent
  | ResultEvent;

// --- 分类函数 ---

const INPUT_PREVIEW_MAX = 200;

/**
 * 将 SDK 原始消息分类为 ClaudeEvent。
 * stream_event / user / user_replay 等返回 null（不关心或由 SDK 内部处理）。
 */
export function classifyMessage(message: SDKMessage): ClaudeEvent | null {
  switch (message.type) {
    // --- 工具调用 ---
    case "assistant": {
      const msg = message as SDKAssistantMessage;
      const toolEvents: ToolEvent[] = [];
      for (const block of (msg.message?.content ?? [])) {
        if (block.type === "tool_use" && block.name) {
          const inputStr = JSON.stringify(block.input);
          toolEvents.push({
            category: "tool",
            kind: "tool_use",
            toolName: block.name,
            toolUseId: block.id,
            inputPreview: inputStr.slice(0, INPUT_PREVIEW_MAX),
          });
        }
      }
      // assistant 消息可能同时包含多个 tool_use，只返回第一个
      // 如果需要全部，后续改为返回数组
      return toolEvents[0] ?? null;
    }

    case "tool_progress": {
      const msg = message as SDKToolProgressMessage;
      return {
        category: "tool",
        kind: "progress",
        toolName: msg.tool_name,
        toolUseId: msg.tool_use_id,
        parentToolUseId: msg.parent_tool_use_id,
        elapsedSeconds: msg.elapsed_time_seconds,
      };
    }

    case "tool_use_summary": {
      const msg = message as SDKToolUseSummaryMessage;
      return {
        category: "tool",
        kind: "summary",
        summary: msg.summary,
      };
    }

    // --- 任务生命周期 ---
    case "system": {
      const sys = message as Record<string, unknown>;
      const subtype = sys.subtype as string;

      switch (subtype) {
        case "task_started":
          return {
            category: "task" as const,
            kind: "started" as const,
            taskId: sys.task_id as string,
            description: sys.description as string,
            taskType: sys.task_type as string | undefined,
          };

        case "task_progress":
          return {
            category: "task" as const,
            kind: "progress" as const,
            taskId: sys.task_id as string,
            description: sys.description as string,
            lastToolName: sys.last_tool_name as string | undefined,
            summary: sys.summary as string | undefined,
          };

        case "task_notification":
          return {
            category: "task" as const,
            kind: "notification" as const,
            taskId: sys.task_id as string,
            status: sys.status as "completed" | "failed" | "stopped",
            summary: sys.summary as string,
          };

        case "init":
          return {
            category: "session" as const,
            kind: "init" as const,
            model: sys.model as string,
            sessionId: sys.session_id as string,
            cwd: sys.cwd as string,
          };

        case "status":
          return {
            category: "session" as const,
            kind: "status" as const,
            status: (sys.status as string) ?? "unknown",
          };

        case "compact_boundary": {
          const meta = sys.compact_metadata as { trigger: "manual" | "auto"; pre_tokens: number };
          return {
            category: "session" as const,
            kind: "compact_boundary" as const,
            trigger: meta.trigger,
            preTokens: meta.pre_tokens,
          };
        }

        case "session_state_changed":
          return {
            category: "session" as const,
            kind: "state_changed" as const,
            state: sys.state as "idle" | "running" | "requires_action",
          };

        case "api_retry":
          return {
            category: "system" as const,
            kind: "api_retry" as const,
            attempt: sys.attempt as number,
            maxRetries: sys.max_retries as number,
            errorStatus: sys.error_status as number | null,
          };

        case "files_persisted": {
          const files = sys.files as Array<unknown> | undefined;
          const failed = sys.failed as Array<unknown> | undefined;
          return {
            category: "system" as const,
            kind: "files_persisted" as const,
            fileCount: files?.length ?? 0,
            failedCount: failed?.length ?? 0,
          };
        }

        case "hook_started":
          return {
            category: "system" as const,
            kind: "hook_started" as const,
            hookName: sys.hook_name as string,
            hookEvent: sys.hook_event as string,
          };

        case "hook_progress":
          return {
            category: "system" as const,
            kind: "hook_progress" as const,
            hookName: sys.hook_name as string,
            output: sys.output as string,
          };

        case "hook_response":
          return {
            category: "system" as const,
            kind: "hook_response" as const,
            hookName: sys.hook_name as string,
            outcome: sys.outcome as string,
          };

        case "local_command_output":
          return {
            category: "system" as const,
            kind: "local_command_output" as const,
            content: sys.content as string,
          };

        case "elicitation_complete":
          return {
            category: "system" as const,
            kind: "elicitation_complete" as const,
            serverName: sys.mcp_server_name as string,
          };

        default:
          logger.debug({ subtype }, "未处理的 system subtype");
          return null;
      }
    }

    // --- 认证状态 ---
    case "auth_status": {
      const msg = message as SDKAuthStatusMessage;
      return {
        category: "system",
        kind: "auth_status",
        isAuthenticating: msg.isAuthenticating,
      };
    }

    // --- 限流事件 ---
    case "rate_limit_event": {
      const msg = message as SDKRateLimitEvent;
      return {
        category: "system",
        kind: "rate_limit",
        status: msg.rate_limit_info?.status ?? "unknown",
      };
    }

    // --- 最终结果 ---
    case "result": {
      const res = message as SDKResultSuccess | SDKResultError;
      if (res.subtype === "success") {
        const s = res as SDKResultSuccess;
        return {
          category: "result",
          kind: "success",
          text: s.result || "(Claude 没有返回文本内容)",
          durationMs: s.duration_ms,
          costUsd: s.total_cost_usd,
          numTurns: s.num_turns,
        };
      }
      const e = res as SDKResultError;
      return {
        category: "result",
        kind: "error",
        subtype: e.subtype,
        errors: e.errors,
        durationMs: e.duration_ms,
        costUsd: e.total_cost_usd,
      };
    }

    // --- 不处理 ---
    case "stream_event":
    case "user":
    case "prompt_suggestion":
      return null;

    default:
      logger.warn({ type: (message as { type: string }).type }, "未知 SDK 消息类型");
      return null;
  }
}

// --- 终端展示 ---

/**
 * 将事件格式化输出到终端和日志（不含 result 类事件）。
 * Phase 1: 仅终端日志；Phase 2: 可推送到 adapter 层。
 */
export function displayEvent(event: ClaudeEvent): void {
  // result 类事件由 handler 处理，不在此展示
  if (event.category === "result") return;

  switch (event.category) {
    case "tool":
      displayToolEvent(event);
      break;
    case "task":
      displayTaskEvent(event);
      break;
    case "session":
      displaySessionEvent(event);
      break;
    case "system":
      displaySystemEvent(event);
      break;
  }
}

function displayToolEvent(event: ToolEvent): void {
  switch (event.kind) {
    case "tool_use":
      logger.info({ tool: event.toolName, input: event.inputPreview }, "tool call");
      break;
    case "progress":
      logger.info(
        { tool: event.toolName, elapsed: `${event.elapsedSeconds}s` },
        "tool progress",
      );
      break;
    case "summary":
      logger.info({ summary: event.summary }, "tool summary");
      break;
  }
}

function displayTaskEvent(event: TaskEvent): void {
  switch (event.kind) {
    case "started":
      logger.info({ taskId: event.taskId, type: event.taskType, desc: event.description }, "task started");
      break;
    case "progress":
      logger.info(
        { taskId: event.taskId, lastTool: event.lastToolName, summary: event.summary },
        "task progress",
      );
      break;
    case "notification":
      logger.info(
        { taskId: event.taskId, status: event.status, summary: event.summary },
        "task notification",
      );
      break;
  }
}

function displaySessionEvent(event: SessionEvent): void {
  switch (event.kind) {
    case "init":
      logger.info(
        { model: event.model, session: event.sessionId.slice(0, 8), cwd: event.cwd },
        "session init",
      );
      break;
    case "status":
      logger.debug({ status: event.status }, "session status");
      break;
    case "compact_boundary":
      logger.info({ trigger: event.trigger, preTokens: event.preTokens }, "compact boundary");
      break;
    case "state_changed":
      logger.info({ state: event.state }, "session state changed");
      break;
  }
}

function displaySystemEvent(event: SystemEvent): void {
  switch (event.kind) {
    case "api_retry":
      logger.warn(
        { attempt: event.attempt, max: event.maxRetries, status: event.errorStatus },
        "API retry",
      );
      break;
    case "auth_status":
      if (event.isAuthenticating) {
        logger.warn("authenticating...");
      }
      break;
    case "rate_limit":
      logger.warn({ status: event.status }, "rate limit");
      break;
    case "files_persisted":
      logger.debug({ files: event.fileCount, failed: event.failedCount }, "files persisted");
      break;
    case "hook_started":
      logger.debug({ hook: event.hookName, event: event.hookEvent }, "hook started");
      break;
    case "hook_progress":
      logger.debug({ hook: event.hookName }, "hook progress");
      break;
    case "hook_response":
      logger.debug({ hook: event.hookName, outcome: event.outcome }, "hook response");
      break;
    case "local_command_output":
      logger.debug({ content: event.content.slice(0, 200) }, "local command output");
      break;
    case "elicitation_complete":
      logger.debug({ server: event.serverName }, "elicitation complete");
      break;
  }
}
