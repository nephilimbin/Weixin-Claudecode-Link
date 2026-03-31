/**
 * 传输层适配器接口 — 所有消息协议（iLink、Telegram 等）必须实现此接口。
 * 每个适配器独立管理自己的协议状态（上下文令牌、同步游标、typing 等），
 * 主循环无需感知协议细节。
 */

/** 入站消息 — 适配器从协议层收到后转换为统一格式 */
export interface InboundMessage {
  /** 适配器唯一标识（如 "ilink"） */
  readonly adapterId: string;
  /** 协议层的原始用户 ID */
  readonly userId: string;
  /** 提取后的纯文本内容 */
  readonly text: string;
  /** 协议层的原始消息引用，适配器内部使用（用于回复时提取协议状态） */
  readonly raw: unknown;
}

/** 出站回复 — 主循环构造后传递给适配器发送 */
export interface OutboundReply {
  /** 协议层的原始用户 ID */
  readonly userId: string;
  /** 回复文本（可能很长，适配器负责拆分） */
  readonly text: string;
  /** 关联到原始入站消息，适配器用于提取 context_token 等协议状态 */
  readonly raw: unknown;
}

/** 适配器配置项（存储在 adapters.json 中） */
export interface AdapterConfig {
  /** 适配器类型标识（如 "ilink"、"telegram"） */
  type: string;
  /** 适配器专属配置（由各适配器定义结构） */
  options?: Record<string, unknown>;
  /** 是否启用 */
  enabled?: boolean;
}

/** 凭证信息（用于登录菜单显示） */
export interface CredentialInfo {
  /**
   * 账号标识示例
   * 各适配器映射关系（可根据实际情况调整）：
   * - iLink: ilink_bot_id
   * - Telegram: chat_id
   */
  accountId: string;
  /**
   * 用户标识（可选）
   * 各适配器映射关系（可根据实际情况调整）：
   * - iLink: ilink_user_id
   * - Telegram: username
   */
  userId?: string;
}

/**
 * 适配器认证接口 — 支持登录的适配器需要实现此接口
 * 实现后，启动时可提供交互式登录菜单
 */
export interface AdapterAuth {
  /** 列出已保存的凭证 */
  listCredentials(): CredentialInfo[];

  /** 执行登录流程，返回是否成功 */
  login(): Promise<boolean>;

  /** 删除指定索引的凭证 */
  deleteCredential(index: number): void;
}

/**
 * 传输层适配器生命周期:
 * 1. 主循环调用 init() 初始化适配器
 * 2. 主循环调用 start() 启动消息拉取（通常不返回，内部长轮询）
 * 3. 适配器通过 onMessage 回调推送消息到主循环
 * 4. 主循环通过 sendReply() 将 Claude 响应发回
 * 5. 主循环调用 stop() 停止适配器
 */
export interface TransportAdapter {
  /** 适配器唯一标识 */
  readonly id: string;

  /** 初始化适配器（加载凭证、恢复状态等） */
  init(): Promise<void>;

  /**
   * 启动消息拉取循环。此方法通常不会返回（内部长轮询）。
   * 收到消息时调用 onMessage 回调。
   */
  start(onMessage: (msg: InboundMessage) => Promise<void>): Promise<void>;

  /**
   * 发送回复到协议层。
   * 适配器自行处理消息拆分、typing 状态等协议细节。
   */
  sendReply(reply: OutboundReply): Promise<void>;

  /** 停止适配器（优雅退出） */
  stop(): Promise<void>;
}
