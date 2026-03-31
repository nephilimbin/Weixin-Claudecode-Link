# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指引。

## 项目概述

多协议 AI Bot，将不同消息终端桥接到 Claude Code，支持通过聊天远程操控代码。当前内置 iLink 适配器（微信），可扩展其他协议（Telegram、钉钉等）。

## 常用命令

```bash
npm run build          # 编译 TypeScript（tsc → dist/）
npm start              # 启动 Bot（内置交互式登录菜单）
```

## 目录及架构说明

### 目录结构

```
src/
├── index.ts              # 入口：调用各适配器 register()、初始化 ClaudeManager、消息路由
├── config/               # 配置持久化层
│   └── adapters.ts       # 适配器列表配置（adapters.json）
├── login/                # 登录模块
│   ├── credentials.ts    # 凭证持久化（credentials.json）
│   └── menu.ts           # 交互式登录菜单
├── adapters/             # 传输适配器层（可扩展多协议）
│   ├── types.ts          # TransportAdapter 接口、InboundMessage / OutboundReply 类型
│   ├── registry.ts       # 适配器注册表（工厂模式）
│   └── ilink.ts          # 微信 iLink 适配器（含自注册 register() 函数）
├── claude/               # Claude Code 集成层
│   ├── manager.ts        # 会话池管理、命令路由
│   ├── session.ts        # 用户会话：消息队列 + SDK 生命周期
│   ├── commands.ts       # 命令路由（/resume、/new 等多轮交互状态机）
│   └── events.ts         # 事件处理（回复、工具调用、完成等）
├── ilink/                # 微信 iLink 协议实现
│   ├── api.ts            # HTTP API 封装（getUpdates / sendMessage / sendTyping）
│   ├── auth.ts           # 二维码认证流程
│   ├── types.ts          # 协议类型定义
│   └── state.ts          # 协议状态持久化（sync-buf / context-tokens）
└── utils/
    └── logger.ts         # Pino 日志（含调用者自动注入）
```

### 架构概要

**数据流：** 微信消息 → iLinkAdapter → InboundMessage → ClaudeManager → UserSession → Claude SDK → 文本响应 → OutboundReply → iLinkAdapter → 微信

**核心模块职责：**

- **adapters/** — 定义 `TransportAdapter` 接口，所有协议适配器必须实现；通过 registry 注册和实例化
- **claude/** — 管理 Claude Code 会话生命周期：Manager 持有会话池，Session 封装单用户 SDK 交互，Commands 处理 / 命令
- **ilink/** — 微信协议底层实现，与 `@tencent-weixin/openclaw-weixin` 包配合；API 地址硬编码在 auth.ts
- **config/** — Bot 配置持久化（适配器列表）
- **login/** — 登录与凭证管理（凭证持久化、交互菜单）


## 关键文档目录

### `~/.weixin-claudecode-link/` — Bot 运行时状态

```
~/.weixin-claudecode-link/
├── credentials.json                 # 统一凭证存储（权限 0o600，按 adapterId 分组）
│                                   # 结构: { "ilink": [{ accountId, baseUrl, token, userId, alias }] }
├── ilink/                          # iLink 协议状态目录
│   └── <userId>/                   # 按 userId 隔离的用户状态
│       ├── sync-buf.txt            # 消息拉取游标（防止重复消费）
│       └── context-tokens.json     # context token 缓存（{ senderUserId: token }）
└── locks/                          # 进程锁目录
    └── ilink-<userId>.pid          # 进程 ID 文件（防止重复启动）
```


### `~/.claude/` — Claude Code 全局配置

- `settings.json` — Claude Code 全局设置（模型、权限等），按 本地 → 项目 → 全局 优先级递进。Bot 启动的 Claude 进程使用此配置。

## 开发准则及注意事项

### 完成代码任务后的自检流程

每次完成代码修改后，必须执行以下步骤再告知用户任务完成：

1. **编译检查** — 运行 `npm run build` 确认 TypeScript 编译无错误
2. **类型检查** — 如果 IDE 报出 diagnostic 错误，必须在提交前修复
3. **功能验证** — 如果修改了核心逻辑（适配器层、Claude 层、Config/Login 层），编写临时测试脚本并运行，确认基本行为正确
4. **清理临时文件** — 自检过程中创建的临时测试脚本、调试文件，完成任务后删除

### 回复行为原则

- 优先使用中文回复
- 如果用户进行问题询问，请先理解用户意图，再进行回答，不要直接进行修改
- 事实优先: 基于事实、数据和第一性原理进行推理
- 模块优先: 所有需求或代码的实现，必须先查阅项目整体架构，并根据单一模块原则设计方案，如果有模块职责冲突需要与用户沟通确认
- 调用工具: 回答需要最新或专业信息时，优先调用搜索工具，并体现来源可靠性。优先使用项目中已有的代码规范和编码标准，以已安装库的版本为优先级

### 禁止行为

- 禁止闲聊: 不进行无关对话
- 禁止道歉: 不为模型身份或局限性道歉
- 禁止重复: 不在摘要和正文中重复相同的信息

## 注释规范

### 行注释

- 解释代码**为什么**这样做，而不是做什么（代码本身应能说明做什么）
- 避免显而易见的注释（如 `i = i + 1  // 加 1`）
- 保持简洁，过长逻辑使用块注释

```typescript
// 使用游标模式拉取，避免消息重复消费
const updates = await getUpdates({ cursor });
```

### 块注释 / JSDoc

- 用于文件头、函数、类的整体说明
- 说明功能、参数含义、返回值、注意事项
- 不需要重复列出 TypeScript 类型系统已表达的信息

```typescript
/**
 * 发送提示到 Claude Code 子进程并收集文本响应。
 * Claude Code 以子进程运行，拥有本地文件系统访问权限。
 * @param prompt - 用户输入的提示文本
 * @param opts   - 模型、权限、工作目录等配置
 */
export async function askClaude(prompt: string, opts: ClaudeOptions): Promise<ClaudeResponse> {
```

### 关键原则

- 注释内容应对使用者有实际价值，避免废话
- 接口变化时必须同步更新注释
- 保持项目中英文注释风格一致（当前项目以中文注释为主）
