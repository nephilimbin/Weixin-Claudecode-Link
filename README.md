# weixin-claudecode-link

多协议 AI Bot，将不同消息终端桥接到 Claude Code，支持通过聊天远程操控代码。

```
微信用户 ──► iLink 协议 ──► weixin-claudecode-link ──► Claude Agent SDK ──► 本地文件系统
   ◄────────────────────────────────────────────────────────────────────┘
```

## 特性

- **多协议支持** — 当前内置微信 iLink 适配器，架构支持扩展 Telegram、钉钉等
- **多账号管理** — 支持同时登录多个微信账号，设置别名便于识别
- **Claude Agent SDK** — 使用最新的 `@anthropic-ai/claude-agent-sdk` 实现完整对话能力
- **命令系统** — 内置 `/new`、`/resume` 等命令，支持多轮会话管理
- **本地数据** — 所有凭证和状态存储在本地，不上传到任何服务器

## 前置条件

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| **Node.js** | 18+ | 运行环境 |
| **Claude Code** | — | 需配置有效的账户 |
| **微信** | 手机端 | 扫码登录用 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 Bot

```bash
npm start
```

首次运行会进入交互式登录菜单：

```
=== ilink 适配器登录 ===

暂无已保存的账号
  1. 新用户登录（扫码）
  2. 退出

请选择 (输入数字): 1
```

使用微信扫码登录后，凭证保存在 `~/.weixin-claudecode-link/credentials.json`。

### 3. 开始对话

登录成功后，Bot 即可接收微信消息。直接发送消息即可与 Claude 对话。

**内置命令**：

| 命令 | 功能 |
|------|------|
| `/new` | 创建新会话 |
| `/resume` | 恢复上一次会话 |
| `/sessions` | 列出所有会话 |

## CLI 命令使用

项目提供了 `wxcc` 命令，可在任何目录下启动 Bot，Bot 将使用当前目录作为工作目录：

```bash
# 开发时使用（npm link）
npm run link          # 首次配置，创建全局链接
wxcc                  # 任何目录下启动，使用当前目录作为工作目录

# 部署到其他机器
npm run install-global    # 全局安装
wxcc                      # 启动
```

**示例**：

```bash
cd ~/my-project    # 切换到你的项目目录
wxcc               # 在此目录启动 Bot，Claude 可以操作该项目的文件
```

## 使用场景

```
# 在地铁上通过微信改代码
你: 帮我把 src/utils/logger.ts 的日志格式改成 JSON
Bot: 已修改，将日志格式从 text 改为 json...

# 远程查看日志
你: 看下 error.log 里最近的错误
Bot: 最近 10 条错误如下...

# 跑测试
你: 运行测试并告诉我结果
Bot: 测试运行完成，3 个通过，1 个失败...
```

## 项目结构

```
src/
├── index.ts              # 入口：适配器注册、ClaudeManager 初始化、消息路由
├── config/               # 配置持久化层
│   └── adapters.ts       # 适配器列表配置
├── login/                # 登录模块
│   ├── credentials.ts    # 凭证持久化
│   └── menu.ts           # 交互式登录菜单
├── adapters/             # 传输适配器层（可扩展多协议）
│   ├── types.ts          # TransportAdapter 接口定义
│   ├── registry.ts       # 适配器注册表（工厂模式）
│   └── ilink.ts          # 微信 iLink 适配器
├── claude/               # Claude Agent SDK 集成层
│   ├── manager.ts        # 会话池管理、命令路由
│   ├── session.ts        # 用户会话：消息队列 + SDK 生命周期
│   ├── commands.ts       # 命令路由（/new、/resume 等）
│   └── events.ts         # 事件处理（回复、工具调用、完成等）
├── ilink/                # 微信 iLink 协议实现
│   ├── api.ts            # HTTP API 封装
│   ├── auth.ts           # 二维码认证流程
│   ├── types.ts          # 协议类型定义
│   └── state.ts          # 协议状态持久化
└── utils/
    ├── logger.ts         # Pino 日志
    └── lock.ts           # 进程锁
```

## 数据存储

所有数据存储在 `~/.weixin-claudecode-link/`，不会上传到任何服务器：

```
~/.weixin-claudecode-link/
├── credentials.json         # 统一凭证存储（权限 0o600）
├── adapters.json            # 适配器配置（可选，使用默认值时不存在）
├── ilink/                   # iLink 协议状态
│   └── <userId>/
│       ├── sync-buf.txt     # 消息拉取游标
│       └── context-tokens.json  # context token 缓存
└── locks/                   # 进程锁
    └── ilink-<userId>.pid   # 防止重复启动
```

删除该目录即可完全清除所有数据。

## 常用命令

```bash
npm run build          # 编译 TypeScript（tsc → dist/）
npm start              # 启动 Bot（内置交互式登录菜单）
npm run link           # 创建全局链接（开发调试用）
npm run unlink         # 移除全局链接
npm run install-global # 全局安装（部署用）
wxcc                   # 在当前目录启动 Bot（需先 link 或 install-global）
```

## 架构概览

**数据流**：微信消息 → iLinkAdapter → InboundMessage → ClaudeManager → UserSession → Claude SDK → 文本响应 → OutboundReply → iLinkAdapter → 微信

**核心模块**：

- **adapters/** — 定义 `TransportAdapter` 接口，所有协议适配器必须实现
- **claude/** — 管理 Claude SDK 会话生命周期
- **ilink/** — 微信协议底层实现
- **config/** — Bot 配置持久化
- **login/** — 登录与凭证管理

## 扩展新协议

添加新协议只需三步：

1. **实现接口** — 在 `adapters/` 下创建新适配器，实现 `TransportAdapter` 接口
2. **注册适配器** — 调用 `registerAdapter()` 注册工厂函数和认证方法
3. **配置启用** — 在 `adapters.json` 中添加配置

详见 `src/adapters/types.ts` 中的接口定义。

## 注意事项

- **iLink 协议是实验性的** — 腾讯未正式公开文档，API 可能随时变更
- **Token 会过期** — 出现 session 过期提示时重新运行 `npm start` 选择账号登录
- **多账号隔离** — 每个 userId 有独立的协议状态目录，互不干扰。**建议不要使用常用账户，以免被错误封禁**

## 相关文档

- [CLAUDE.md](./CLAUDE.md) — Claude Code 工作指引
- [docs/](./docs/) — 详细的技术文档

## License

MIT
