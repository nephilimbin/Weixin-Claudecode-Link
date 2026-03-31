/**
 * iLink 协议适配器 — 将微信 iLink 逻辑封装为 TransportAdapter。
 * 内部管理 context_token 缓存、sync buffer、typing ticket 等协议状态，
 * 对主循环完全不暴露这些协议细节。
 */
import crypto from "node:crypto";
import {
  getUpdates,
  sendMessage,
  sendTyping,
  getConfig,
  type ApiOptions,
} from "../ilink/api.js";
import {
  MessageType,
  MessageItemType,
  MessageState,
  TypingStatus,
  type WeixinMessage,
} from "../ilink/types.js";
import type { TransportAdapter, InboundMessage, OutboundReply, AdapterConfig, AdapterAuth, CredentialInfo } from "./types.js";
import { loadSyncBuf, saveSyncBuf, loadContextTokens, saveContextTokens } from "../ilink/state.js";
import { loadAdapterCredentials, saveAdapterCredentials as storeCredentials, deleteAdapterCredentials } from "../login/credentials.js";
import { registerAdapter } from "./registry.js";
import { logger } from "../utils/logger.js";
import { ProcessLock } from "../utils/lock.js";

const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_PAUSE_MS = 60 * 60 * 1000; // 1 hour
const MAX_MSG_LEN = 4000; // 微信 ~4096 限制，留余量

/** iLink 适配器初始化参数 */
export interface ILinkAdapterOptions {
  baseUrl: string;
  token: string;
  accountId: string;
  userId: string;
}

/** iLink 适配器内部状态（不暴露给主循环） */
interface ILinkState {
  syncBuf: string;
  contextTokens: Record<string, string>;
  consecutiveFailures: number;
}

export class ILinkAdapter implements TransportAdapter {
  readonly id = "ilink";
  private api: ApiOptions;
  private accountId: string;
  private userId: string;
  private state: ILinkState;
  private running = false;
  private abortController: AbortController | null = null;
  private lock: ProcessLock | null = null;

  constructor(options: ILinkAdapterOptions) {
    this.api = { baseUrl: options.baseUrl, token: options.token };
    this.accountId = options.accountId;
    this.userId = options.userId;
    this.state = {
      syncBuf: "",
      contextTokens: {},
      consecutiveFailures: 0,
    };
  }

  async init(): Promise<void> {
    // 检查进程锁
    this.lock = new ProcessLock(this.id, this.userId);
    const lockResult = this.lock.tryAcquire();

    if (!lockResult.success) {
      const ownerPid = lockResult.ownerPid || "unknown";
      throw new Error(
        `此账号正在被其他进程使用 (PID: ${ownerPid})。\n` +
        `请检查是否有其他终端正在运行此 bot，或先结束该进程。`
      );
    }

    // 注册自动释放锁
    this.lock.registerAutoRelease();

    // 加载状态（传入 userId）
    this.state.syncBuf = loadSyncBuf(this.userId);
    this.state.contextTokens = loadContextTokens(this.userId);

    logger.info({ accountId: this.accountId, userId: this.userId }, "适配器已初始化");
  }

  /**
   * 启动 iLink 长轮询循环，收到消息时通过 onMessage 回调推送到主循环。
   * 此方法通常不会返回（内部无限循环）。
   */
  async start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void> {
    this.running = true;
    this.abortController = new AbortController();

    while (this.running) {
      try {
        const resp = await getUpdates(this.api, { get_updates_buf: this.state.syncBuf }, this.abortController.signal);

        // 处理 iLink 协议错误
        if ((resp.ret && resp.ret !== 0) || (resp.errcode && resp.errcode !== 0)) {
          if (resp.errcode === SESSION_EXPIRED_ERRCODE || resp.ret === SESSION_EXPIRED_ERRCODE) {
            logger.warn("Session 过期，暂停 1 小时");
            await sleep(SESSION_PAUSE_MS);
            continue;
          }

          this.state.consecutiveFailures++;
          logger.error(
            { ret: resp.ret, errcode: resp.errcode, failures: this.state.consecutiveFailures },
            "getUpdates 错误",
          );
          if (this.state.consecutiveFailures >= 3) {
            logger.warn("连续失败 3 次，等待 30 秒");
            this.state.consecutiveFailures = 0;
            await sleep(30_000);
          } else {
            await sleep(2_000);
          }
          continue;
        }

        this.state.consecutiveFailures = 0;

        if (resp.get_updates_buf) {
          this.state.syncBuf = resp.get_updates_buf;
          saveSyncBuf(this.userId, this.state.syncBuf);
        }

        const msgs = resp.msgs ?? [];
        for (const msg of msgs) {
          const inbound = this.toInbound(msg);
          if (inbound) {
            // 确保 onMessage 中的错误不会中断轮询循环
            try {
              await onMessage(inbound);
            } catch (err) {
              logger.error({ error: err instanceof Error ? err.message : String(err) }, "onMessage 回调出错");
            }
          }
        }
      } catch (err) {
        this.state.consecutiveFailures++;
        logger.error(
          { error: err instanceof Error ? err.message : String(err), failures: this.state.consecutiveFailures },
          "Poll 异常",
        );
        if (this.state.consecutiveFailures >= 3) {
          this.state.consecutiveFailures = 0;
          await sleep(30_000);
        } else {
          await sleep(2_000);
        }
      }
    }
  }

  /**
   * 发送回复到 iLink 协议层。
   * 自行处理消息拆分和 context_token 关联。
   * 包含重试机制，网络错误时自动重试。
   */
  async sendReply(reply: OutboundReply): Promise<void> {
    const raw = reply.raw as WeixinMessage;
    const contextToken = this.resolveContextToken(raw, reply.userId);

    const chunks =
      reply.text.length <= MAX_MSG_LEN
        ? [reply.text]
        : reply.text.match(new RegExp(`.{1,${MAX_MSG_LEN}}`, "gs")) || [reply.text];

    for (const chunk of chunks) {
      const msg: WeixinMessage = {
        to_user_id: reply.userId,
        from_user_id: "",                // iLink 服务端自动填充
        client_id: makeClientId(),   // 每条消息唯一 ID，防止去重
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: contextToken,
        item_list: [
          {
            type: MessageItemType.TEXT,
            text_item: { text: chunk },
          },
        ],
      };

      // 重试机制：网络错误时自动重试
      let lastError: Error | undefined;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendMessage(this.api, { msg });
          lastError = undefined;
          break; // 发送成功，跳出重试循环
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          logger.warn({ error: lastError.message, attempt }, "发送消息失败，重试中");

          if (attempt < 3) {
            // 等待后重试（指数退避：1s、2s）
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }

      if (lastError) {
        // 重试 3 次后仍然失败，记录错误但不抛出（避免 Bot 崩溃）
        logger.error({ error: lastError.message, chunk: chunk.substring(0, 50) }, "发送消息失败，已放弃");
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // --- 私有方法（适配器内部实现，不暴露协议细节） ---

  /** 将 iLink 原始消息转换为标准入站消息，过滤非用户消息和非文本消息 */
  private toInbound(msg: WeixinMessage): InboundMessage | null {
    if (msg.message_type !== MessageType.USER) return null;
    const fromUser = msg.from_user_id;
    if (!fromUser) return null;

    const text = this.extractText(msg);
    if (!text) return null;

    // 新消息携带的 context_token 需缓存，回复时复用
    if (msg.context_token) {
      this.state.contextTokens[fromUser] = msg.context_token;
      saveContextTokens(this.userId, this.state.contextTokens);
    }

    return {
      adapterId: this.id,
      userId: fromUser,
      text,
      raw: msg,
    };
  }

  /** 从 iLink 消息中提取文本（支持文本和语音 ASR） */
  private extractText(msg: WeixinMessage): string {
    if (!msg.item_list?.length) return "";
    for (const item of msg.item_list) {
      if (item.type === MessageItemType.TEXT && item.text_item?.text) {
        const ref = item.ref_msg;
        if (ref?.title) {
          return `[引用: ${ref.title}]\n${item.text_item.text}`;
        }
        return item.text_item.text;
      }
      // 语音 ASR 文本
      if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
        return item.voice_item.text;
      }
    }
    return "";
  }

  /** 获取用户对应的 context_token，优先从原始消息取，其次从缓存取 */
  private resolveContextToken(raw: WeixinMessage, userId: string): string {
    return raw.context_token || this.state.contextTokens[userId] || "";
  }

  private async showTyping(userId: string, contextToken: string): Promise<void> {
    try {
      const config = await getConfig(this.api, userId, contextToken);
      if (config.typing_ticket) {
        await sendTyping(this.api, {
          ilink_user_id: userId,
          typing_ticket: config.typing_ticket,
          status: TypingStatus.TYPING,
        });
      }
    } catch {
      // 非关键操作，忽略错误
    }
  }

}

// --- 模块级工具函数 ---

/** 生成唯一 client_id，防止 iLink 消息去重 */
function makeClientId(): string {
  return `wcb-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- iLink 认证实现 ---

/** iLink 适配器认证 — 实现 AdapterAuth 接口 */
class ILinkAuth implements AdapterAuth {
  listCredentials(): CredentialInfo[] {
    const credsList = loadAdapterCredentials("ilink");
    return credsList.map((cred) => {
      const alias = (cred as Record<string, unknown>).alias as string | undefined;
      const userId = cred.userId as string | undefined;
      const accountId = cred.accountId as string;
      // 如果有别名则显示别名，否则显示 userId
      const displayId = alias || userId || accountId;
      return {
        accountId: displayId,
        userId: alias ? `${userId || accountId} (别名: ${alias})` : userId,
      };
    });
  }

  async login(): Promise<boolean> {
    const { loginWithQR } = await import("../ilink/auth.js");
    const result = await loginWithQR();

    // iLink 唯一性逻辑：userId 相同则覆盖
    const current = loadAdapterCredentials("ilink");
    const updated = [...current];

    const idx = updated.findIndex((c) => (c.userId as string) === result.userId);
    if (idx >= 0) {
      // 保留原别名
      (result as Record<string, unknown>).alias = (updated[idx] as Record<string, unknown>).alias;
      updated[idx] = result; // 同一用户，覆盖
      logger.info({ userId: result.userId }, "更新已存在的凭证");
    } else {
      updated.push(result); // 新用户，追加
      logger.info({ userId: result.userId }, "添加新凭证");
    }

    storeCredentials("ilink", updated);

    // 提示设置别名
    await this.promptSetAlias(result.userId as string);

    return true;
  }

  deleteCredential(index: number): void {
    const success = deleteAdapterCredentials("ilink", index);
    if (!success) {
      throw new Error(`删除凭证失败: 无效索引 ${index}`);
    }
  }

  /**
   * 提示用户设置别名
   */
  private async promptSetAlias(userId: string): Promise<void> {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    const alias = await question("\n是否设置别名以便识别？(直接回车跳过): ");
    rl.close();

    if (alias.trim()) {
      const credsList = loadAdapterCredentials("ilink");
      const idx = credsList.findIndex((c) => (c.userId as string) === userId);
      if (idx >= 0) {
        (credsList[idx] as Record<string, unknown>).alias = alias.trim();
        storeCredentials("ilink", credsList);
        console.log(`✅ 别名已设置为: ${alias.trim()}`);
      }
    }
  }
}

/**
 * 修改指定账号的别名
 */
export async function updateAlias(userId: string): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  const alias = await question("请输入新别名 (直接回车保持原值): ");
  rl.close();

  const credsList = loadAdapterCredentials("ilink");
  const idx = credsList.findIndex((c) => (c.userId as string) === userId);

  if (idx >= 0) {
    if (alias.trim()) {
      (credsList[idx] as Record<string, unknown>).alias = alias.trim();
      console.log(`✅ 别名已更新为: ${alias.trim()}`);
    } else {
      delete (credsList[idx] as Record<string, unknown>).alias;
      console.log("✅ 已删除别名");
    }
    storeCredentials("ilink", credsList);
  } else {
    console.log("❌ 未找到对应的账号");
  }
}

// --- 自注册 ---

/** 将 iLink 适配器注册到全局注册表，供启动时调用 */
export function register(): void {
  const auth = new ILinkAuth();

  registerAdapter("ilink", (config: AdapterConfig) => {
    const credsList = loadAdapterCredentials("ilink");
    if (credsList.length === 0) {
      throw new Error("ilink 适配器需要凭证，请先登录");
    }

    // 从 config.options 中获取凭证索引，默认使用第一个
    const credentialIndex = (config.options?.credentialIndex as number) || 0;
    const creds = credsList[credentialIndex];

    if (!creds) {
      throw new Error(`凭证索引 ${credentialIndex} 不存在`);
    }

    const userId = creds.userId as string;
    if (!userId) {
      throw new Error(`凭证缺少 userId 字段`);
    }

    const options: ILinkAdapterOptions = {
      baseUrl: (config.options?.baseUrl as string) || (creds.baseUrl as string),
      token: creds.botToken as string,
      accountId: (config.options?.accountId as string) || (creds.accountId as string),
      userId,
    };
    return new ILinkAdapter(options);
  }, auth);
}
