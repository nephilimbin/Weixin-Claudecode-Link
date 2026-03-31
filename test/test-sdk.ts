/**
 * @anthropic-ai/claude-agent-sdk 多轮对话测试
 *
 * 运行: npx tsx test-sdk.ts
 *
 * - thinking:               关闭思考模式
 * - includePartialMessages: 开启流式中间内容
 * - 多轮:                   控制台输入
 * - /stop                   中断当前正在执行的回合（子进程保留，可继续对话）
 * - /resume                 恢复历史会话（关闭当前会话，选择历史记录后重新启动）
 * - /exit                   终止子进程并退出
 */
import * as readline from "node:readline";
import { query, listSessions, type Query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let activeQuery: Query | null = null;

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

// 用户输入生成器，通过 resumeRef 回传恢复请求
async function* userInput(resumeRef: { value?: string }) {
  while (true) {
    const input = await ask("\n你> ");
    if (!input.trim()) continue;

    if (input.trim() === "/exit") {
      return;
    }

    if (input.trim() === "/stop") {
      if (activeQuery) {
        console.log("[中断] 正在停止当前回合...");
        await activeQuery.interrupt();
      }
      continue;
    }

    if (input.trim() === "/resume") {
      // 列出历史会话供选择
      const sessions = await listSessions({ dir: process.cwd(), limit: 10 });
      if (sessions.length === 0) {
        console.log("[resume] 无历史会话");
        continue;
      }
      console.log("\n=== 历史会话 ===");
      sessions.forEach((s, i) => {
        const time = new Date(s.lastModified).toLocaleString("zh-CN");
        console.log(`  ${i + 1}. [${s.sessionId.slice(0, 8)}] ${s.summary}  (${time})`);
      });
      const choice = await ask("输入序号恢复，回车取消: ");
      const idx = parseInt(choice.trim(), 10);
      if (idx >= 1 && idx <= sessions.length) {
        resumeRef.value = sessions[idx - 1].sessionId;
        console.log(`[resume] 将恢复 ${resumeRef.value.slice(0, 8)}...`);
        return; // 结束生成器，主循环检测到 resumeRef 后重新启动
      }
      console.log("[resume] 已取消");
      continue;
    }

    yield {
      type: "user" as const,
      session_id: "",
      message: { role: "user" as const, content: [{ type: "text" as const, text: input.trim() }] },
      parent_tool_use_id: null,
    };
  }
}

function handleMessage(message: SDKMessage) {
  if (message.type === "system" && message.subtype === "init") {
    console.log(`[init] model=${message.model} session=${message.session_id.slice(0, 8)}`);
    console.log(`[init] tools=[${message.tools.join(", ")}]`);
  }

  // 流式文本（打字机效果）
  if (message.type === "stream_event") {
    const event = message.event;
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }

  // 工具调用
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "tool_use") {
        const input = JSON.stringify(block.input).slice(0, 200);
        console.log(`\n[工具] ${block.name}(${input}${JSON.stringify(block.input).length > 200 ? "..." : ""})`);
      }
    }
  }

  // 工具结果
  if (message.type === "user" && message.isSynthetic && message.tool_use_result) {
    const result = JSON.stringify(message.tool_use_result);
    console.log(`[结果] ${result.slice(0, 300)}${result.length > 300 ? "..." : ""}\n`);
  }

  // 最终结果
  if (message.type === "result") {
    if (message.subtype === "success") {
      console.log(`\n--- 轮次结束 | ${message.num_turns}轮 | ${message.duration_ms}ms | $${message.total_cost_usd} ---`);
    } else {
      console.log(`\n--- 结束 (${message.subtype}) ---`);
      if ("errors" in message) {
        for (const err of message.errors) console.log(`  错误: ${err}`);
      }
    }
  }
}

console.log("=== 多轮对话（/resume 恢复会话，/stop 中断回合，/exit 终止退出） ===\n");

// 主循环：支持 /resume 重新启动 query
let resumeId: string | undefined;
while (true) {
  const resumeRef: { value?: string } = {};
  const q = query({
    prompt: userInput(resumeRef),
    options: {
      settingSources: ["user", "project", "local"],
      cwd: process.cwd(),
      maxTurns: 10,
      thinking: { type: "disabled" },
      includePartialMessages: true,
      tools: { type: "preset", preset: "claude_code" },
      systemPrompt: { type: "preset", preset: "claude_code" },
      ...(resumeId ? { resume: resumeId } : {}),
    },
  });

  activeQuery = q;
  resumeId = undefined;

  for await (const message of q) {
    handleMessage(message);
  }

  // 生成器结束后的三种情况
  if (resumeRef.value) {
    // /resume：携带 sessionId 进入下一轮循环
    resumeId = resumeRef.value;
    console.log("[切换] 正在恢复历史会话...\n");
    continue;
  }
  break; // /exit 或生成器自然结束，退出主循环
}

// 退出后列出会话
console.log("\n=== 历史会话 ===");
const sessions = await listSessions({ dir: process.cwd(), limit: 5 });
for (const s of sessions) {
  console.log(`[${s.sessionId.slice(0, 8)}] ${s.summary}`);
}

rl.close();
