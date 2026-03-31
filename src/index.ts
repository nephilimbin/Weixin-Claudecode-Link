/**
 * weixin-claudecode-link — 多协议适配器主入口。
 * Flow: 适配器 → InboundMessage → 命令路由 / ClaudeManager → OutboundReply → 适配器
 *
 * 启动参数:
 *   --link <adapterId>  指定适配器协议（默认: ilink）
 */
import { ClaudeManager } from "./claude/manager.js";
import { loadAdaptersConfig } from "./config/adapters.js";
import { createAdapter, getAdapterAuth } from "./adapters/registry.js";
import type { TransportAdapter, InboundMessage } from "./adapters/types.js";
import { register as registerILink } from "./adapters/ilink.js";
import { selectCredentialsOrLogin } from "./login/menu.js";
import { logger } from "./utils/logger.js";

// --- 注册内置适配器（各适配器自行封装注册逻辑） ---

registerILink();

// --- 命令行参数解析 ---

interface StartOptions {
  adapterId: string;
}

function parseArgs(): StartOptions {
  const args = process.argv.slice(2);
  const linkIdx = args.indexOf("--link");
  const adapterId = linkIdx >= 0 && args[linkIdx + 1] ? args[linkIdx + 1] : "ilink";
  return { adapterId };
}

// --- 主入口 ---

export async function main() {
  const { adapterId } = parseArgs();
  const adaptersConfig = loadAdaptersConfig();

  // 检查适配器是否注册
  const auth = getAdapterAuth(adapterId);
  if (!auth) {
    logger.error(`适配器 "${adapterId}" 不存在或未注册`);
    process.exit(1);
  }

  // 交互式登录菜单
  let credentialIndex = -2;
  while (credentialIndex === -2) {
    credentialIndex = await selectCredentialsOrLogin(adapterId);
    if (credentialIndex === -1) {
      logger.info("用户取消登录");
      process.exit(0);
    }
  }

  logger.info({ adapterId, credentialIndex }, "已选择凭证");

  // 加载指定适配器配置
  const adapterConfig = adaptersConfig.adapters.find((a) => a.type === adapterId);
  if (!adapterConfig) {
    logger.error(`未找到 "${adapterId}" 适配器配置`);
    process.exit(1);
  }

  // 将选择的凭证索引传递到适配器配置
  const finalAdapterConfig = {
    ...adapterConfig,
    options: {
      ...adapterConfig.options,
      credentialIndex,
    },
  };
  // 创建 Claude管理器
  const manager = new ClaudeManager({ cwd: process.cwd() });
  // 创建协议适配器
  const adapter = createAdapter(finalAdapterConfig);
  await adapter.init();

  logger.info(
    { cwd: process.cwd(), adapter: adapter.id },
    "Claude Client 已启动",
  );

  // 关闭操作
  const stopAll = async () => {
    logger.info("正在关闭所有会话和适配器");
    await manager.closeAll();
    await adapter.stop();
    process.exit(0);
  };
  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);

  /** 根据 adapterId 路由回复到对应的适配器 */
  const sendReply = async (msg: InboundMessage, text: string) => {
    await adapter.sendReply({ userId: msg.userId, text, raw: msg.raw });
  };

  /** 统一消息处理 — 全部委托给 claude 层 */
  const handleInbound = async (msg: InboundMessage) => {
    const text = msg.text.trim();

    logger.info(
      { adapterId: msg.adapterId, userId: msg.userId.slice(0, 12), text: text.substring(0, 80) },
      "收到消息",
    );

    try {
      const result = await manager.handleInput(msg.userId, text);
      if (result.text) {
        await sendReply(msg, result.text);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger.error({ error: errorMsg, stack: errorStack }, "处理消息失败");

      // 尝试发送错误回复，失败不影响 Bot 继续运行
      try {
        await sendReply(msg, `处理消息时出错: ${errorMsg}`);
      } catch (sendErr) {
        logger.error({ error: sendErr instanceof Error ? sendErr.message : String(sendErr) }, "发送错误回复失败");
      }
    }
  };

  await adapter.start(handleInbound);
}

// 仅在直接运行时执行（不在被导入时执行）
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch((err) => {
    logger.fatal({ error: err instanceof Error ? err.message : String(err) }, "启动失败");
    process.exit(1);
  });
}
