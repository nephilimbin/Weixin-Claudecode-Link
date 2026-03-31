SDK references
> 源地址：https://platform.claude.com/docs/en/agent-sdk/typescript#sdkuser-message

Complete API reference for the TypeScript Agent SDK, including all functions, types, and interfaces.

**Try the new V2 interface (preview):** A simplified interface with `send()` and `stream()` patterns is now available, making multi-turn conversations easier. [Learn more about the TypeScript V2 preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)

The primary function for interacting with Claude Code. Creates an async generator that streams messages as they arrive.

| Parameter | Type | Description |
| --- | --- | --- |
| `prompt` | `string | AsyncIterable<`[`SDKUserMessage`](https://platform.claude.com/docs/en/agent-sdk/typescript#sdkuser-message)`>` | The input prompt as a string or async iterable for streaming mode |
| `options` | [`Options`](https://platform.claude.com/docs/en/agent-sdk/typescript#options) | Optional configuration object (see Options type below) |

Returns a [`Query`](https://platform.claude.com/docs/en/agent-sdk/typescript#query-object) object that extends `AsyncGenerator<`[`SDKMessage`](https://platform.claude.com/docs/en/agent-sdk/typescript#sdk-message)`, void>` with additional methods.

Creates a type-safe MCP tool definition for use with SDK MCP servers.

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the tool |
| `description` | `string` | A description of what the tool does |
| `inputSchema` | `Schema extends AnyZodRawShape` | Zod schema defining the tool's input parameters (supports both Zod 3 and Zod 4) |
| `handler` | `(args, extra) => Promise<`[`CallToolResult`](https://platform.claude.com/docs/en/agent-sdk/typescript#call-tool-result)`>` | Async function that executes the tool logic |
| `extras` | `{ annotations?:` [`ToolAnnotations`](https://platform.claude.com/docs/en/agent-sdk/typescript#tool-annotations) `}` | Optional MCP tool annotations providing behavioral hints to clients |

Re-exported from `@modelcontextprotocol/sdk/types.js`. All fields are optional hints; clients should not rely on them for security decisions.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `undefined` | Human-readable title for the tool |
| `readOnlyHint` | `boolean` | `false` | If `true`, the tool does not modify its environment |
| `destructiveHint` | `boolean` | `true` | If `true`, the tool may perform destructive updates (only meaningful when `readOnlyHint` is `false`) |
| `idempotentHint` | `boolean` | `false` | If `true`, repeated calls with the same arguments have no additional effect (only meaningful when `readOnlyHint` is `false`) |
| `openWorldHint` | `boolean` | `true` | If `true`, the tool interacts with external entities (for example, web search). If `false`, the tool's domain is closed (for example, a memory tool) |

Creates an MCP server instance that runs in the same process as your application.

| Parameter | Type | Description |
| --- | --- | --- |
| `options.name` | `string` | The name of the MCP server |
| `options.version` | `string` | Optional version string |
| `options.tools` | `Array<SdkMcpToolDefinition>` | Array of tool definitions created with [`tool()`](https://platform.claude.com/docs/en/agent-sdk/typescript#tool) |

Discovers and lists past sessions with light metadata. Filter by project directory or list sessions across all projects.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `options.dir` | `string` | `undefined` | Directory to list sessions for. When omitted, returns sessions across all projects |
| `options.limit` | `number` | `undefined` | Maximum number of sessions to return |
| `options.includeWorktrees` | `boolean` | `true` | When `dir` is inside a git repository, include sessions from all worktree paths |

#### 

Return type: `SDKSessionInfo`

| Property | Type | Description |
| --- | --- | --- |
| `sessionId` | `string` | Unique session identifier (UUID) |
| `summary` | `string` | Display title: custom title, auto-generated summary, or first prompt |
| `lastModified` | `number` | Last modified time in milliseconds since epoch |
| `fileSize` | `number | undefined` | Session file size in bytes. Only populated for local JSONL storage |
| `customTitle` | `string | undefined` | User-set session title (via `/rename`) |
| `firstPrompt` | `string | undefined` | First meaningful user prompt in the session |
| `gitBranch` | `string | undefined` | Git branch at the end of the session |
| `cwd` | `string | undefined` | Working directory for the session |
| `tag` | `string | undefined` | User-set session tag (see [`tagSession()`](https://platform.claude.com/docs/en/agent-sdk/typescript#tag-session)) |
| `createdAt` | `number | undefined` | Creation time in milliseconds since epoch, from the first entry's timestamp |

Print the 10 most recent sessions for a project. Results are sorted by `lastModified` descending, so the first item is the newest. Omit `dir` to search across all projects.

Reads user and assistant messages from a past session transcript.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | `string` | required | Session UUID to read (see `listSessions()`) |
| `options.dir` | `string` | `undefined` | Project directory to find the session in. When omitted, searches all projects |
| `options.limit` | `number` | `undefined` | Maximum number of messages to return |
| `options.offset` | `number` | `undefined` | Number of messages to skip from the start |

#### 

Return type: `SessionMessage`

| Property | Type | Description |
| --- | --- | --- |
| `type` | `"user" | "assistant"` | Message role |
| `uuid` | `string` | Unique message identifier |
| `session_id` | `string` | Session this message belongs to |
| `message` | `unknown` | Raw message payload from the transcript |
| `parent_tool_use_id` | `null` | Reserved |

Reads metadata for a single session by ID without scanning the full project directory.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | `string` | required | UUID of the session to look up |
| `options.dir` | `string` | `undefined` | Project directory path. When omitted, searches all project directories |

Returns [`SDKSessionInfo`](https://platform.claude.com/docs/en/agent-sdk/typescript#return-type-sdk-session-info), or `undefined` if the session is not found.

Renames a session by appending a custom-title entry. Repeated calls are safe; the most recent title wins.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | `string` | required | UUID of the session to rename |
| `title` | `string` | required | New title. Must be non-empty after trimming whitespace |
| `options.dir` | `string` | `undefined` | Project directory path. When omitted, searches all project directories |

Tags a session. Pass `null` to clear the tag. Repeated calls are safe; the most recent tag wins.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | `string` | required | UUID of the session to tag |
| `tag` | `string | null` | required | Tag string, or `null` to clear |
| `options.dir` | `string` | `undefined` | Project directory path. When omitted, searches all project directories |

Configuration object for the `query()` function.

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `abortController` | `AbortController` | `new AbortController()` | Controller for cancelling operations |
| `additionalDirectories` | `string[]` | `[]` | Additional directories Claude can access |
| `agent` | `string` | `undefined` | Agent name for the main thread. The agent must be defined in the `agents` option or in settings |
| `agents` | `Record<string, [`AgentDefinition`](#agent-definition)>` | `undefined` | Programmatically define subagents |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | Enable bypassing permissions. Required when using `permissionMode: 'bypassPermissions'` |
| `allowedTools` | `string[]` | `[]` | Tools to auto-approve without prompting. This does not restrict Claude to only these tools; unlisted tools fall through to `permissionMode` and `canUseTool`. Use `disallowedTools` to block tools. See [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions#allow-and-deny-rules) |
| `betas` | [`SdkBeta`](https://platform.claude.com/docs/en/agent-sdk/typescript#sdk-beta)`[]` | `[]` | Enable beta features (e.g., `['context-1m-2025-08-07']`) |
| `canUseTool` | [`CanUseTool`](https://platform.claude.com/docs/en/agent-sdk/typescript#can-use-tool) | `undefined` | Custom permission function for tool usage |
| `continue` | `boolean` | `false` | Continue the most recent conversation |
| `cwd` | `string` | `process.cwd()` | Current working directory |
| `debug` | `boolean` | `false` | Enable debug mode for the Claude Code process |
| `debugFile` | `string` | `undefined` | Write debug logs to a specific file path. Implicitly enables debug mode |
| `disallowedTools` | `string[]` | `[]` | Tools to always deny. Deny rules are checked first and override `allowedTools` and `permissionMode` (including `bypassPermissions`) |
| `effort` | `'low' | 'medium' | 'high' | 'max'` | `'high'` | Controls how much effort Claude puts into its response. Works with adaptive thinking to guide thinking depth |
| `enableFileCheckpointing` | `boolean` | `false` | Enable file change tracking for rewinding. See [File checkpointing](https://platform.claude.com/docs/en/agent-sdk/file-checkpointing) |
| `env` | `Record<string, string | undefined>` | `process.env` | Environment variables. Set `CLAUDE_AGENT_SDK_CLIENT_APP` to identify your app in the User-Agent header |
| `executable` | `'bun' | 'deno' | 'node'` | Auto-detected | JavaScript runtime to use |
| `executableArgs` | `string[]` | `[]` | Arguments to pass to the executable |
| `extraArgs` | `Record<string, string | null>` | `{}` | Additional arguments |
| `fallbackModel` | `string` | `undefined` | Model to use if primary fails |
| `forkSession` | `boolean` | `false` | When resuming with `resume`, fork to a new session ID instead of continuing the original session |
| `hooks` | `Partial<Record<`[`HookEvent`](https://platform.claude.com/docs/en/agent-sdk/typescript#hook-event)`,` [`HookCallbackMatcher`](https://platform.claude.com/docs/en/agent-sdk/typescript#hook-callback-matcher)`[]>>` | `{}` | Hook callbacks for events |
| `includePartialMessages` | `boolean` | `false` | Include partial message events |
| `maxBudgetUsd` | `number` | `undefined` | Maximum budget in USD for the query |
| `maxThinkingTokens` | `number` | `undefined` | _Deprecated:_ Use `thinking` instead. Maximum tokens for thinking process |
| `maxTurns` | `number` | `undefined` | Maximum agentic turns (tool-use round trips) |
| `mcpServers` | `Record<string, [`McpServerConfig`](#mcp-server-config)>` | `{}` | MCP server configurations |
| `model` | `string` | Default from CLI | Claude model to use |
| `outputFormat` | `{ type: 'json_schema', schema: JSONSchema }` | `undefined` | Define output format for agent results. See [Structured outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) for details |
| `pathToClaudeCodeExecutable` | `string` | Uses built-in executable | Path to Claude Code executable |
| `permissionMode` | [`PermissionMode`](https://platform.claude.com/docs/en/agent-sdk/typescript#permission-mode) | `'default'` | Permission mode for the session |
| `permissionPromptToolName` | `string` | `undefined` | MCP tool name for permission prompts |
| `persistSession` | `boolean` | `true` | When `false`, disables session persistence to disk. Sessions cannot be resumed later |
| `plugins` | [`SdkPluginConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#sdk-plugin-config)`[]` | `[]` | Load custom plugins from local paths. See [Plugins](https://platform.claude.com/docs/en/agent-sdk/plugins) for details |
| `promptSuggestions` | `boolean` | `false` | Enable prompt suggestions. Emits a `prompt_suggestion` message after each turn with a predicted next user prompt |
| `resume` | `string` | `undefined` | Session ID to resume |
| `resumeSessionAt` | `string` | `undefined` | Resume session at a specific message UUID |
| `sandbox` | [`SandboxSettings`](https://platform.claude.com/docs/en/agent-sdk/typescript#sandbox-settings) | `undefined` | Configure sandbox behavior programmatically. See [Sandbox settings](https://platform.claude.com/docs/en/agent-sdk/typescript#sandbox-settings) for details |
| `sessionId` | `string` | Auto-generated | Use a specific UUID for the session instead of auto-generating one |
| `settingSources` | [`SettingSource`](https://platform.claude.com/docs/en/agent-sdk/typescript#setting-source)`[]` | `[]` (no settings) | Control which filesystem settings to load. When omitted, no settings are loaded. **Note:** Must include `'project'` to load CLAUDE.md files |
| `spawnClaudeCodeProcess` | `(options: SpawnOptions) => SpawnedProcess` | `undefined` | Custom function to spawn the Claude Code process. Use to run Claude Code in VMs, containers, or remote environments |
| `stderr` | `(data: string) => void` | `undefined` | Callback for stderr output |
| `strictMcpConfig` | `boolean` | `false` | Enforce strict MCP validation |
| `systemPrompt` | `string | { type: 'preset'; preset: 'claude_code'; append?: string }` | `undefined` (minimal prompt) | System prompt configuration. Pass a string for custom prompt, or `{ type: 'preset', preset: 'claude_code' }` to use Claude Code's system prompt. When using the preset object form, add `append` to extend the system prompt with additional instructions |
| `thinking` | [`ThinkingConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#thinking-config) | `{ type: 'adaptive' }` for supported models | Controls Claude's thinking/reasoning behavior. See [`ThinkingConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#thinking-config) for options |
| `toolConfig` | [`ToolConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#tool-config) | `undefined` | Configuration for built-in tool behavior. See [`ToolConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#tool-config) for details |
| `tools` | `string[] | { type: 'preset'; preset: 'claude_code' }` | `undefined` | Tool configuration. Pass an array of tool names or use the preset to get Claude Code's default tools |

Interface returned by the `query()` function.

| Method | Description |
| --- | --- |
| `interrupt()` | Interrupts the query (only available in streaming input mode) |
| `rewindFiles(userMessageId, options?)` | Restores files to their state at the specified user message. Pass `{ dryRun: true }` to preview changes. Requires `enableFileCheckpointing: true`. See [File checkpointing](https://platform.claude.com/docs/en/agent-sdk/file-checkpointing) |
| `setPermissionMode()` | Changes the permission mode (only available in streaming input mode) |
| `setModel()` | Changes the model (only available in streaming input mode) |
| `setMaxThinkingTokens()` | _Deprecated:_ Use the `thinking` option instead. Changes the maximum thinking tokens |
| `initializationResult()` | Returns the full initialization result including supported commands, models, account info, and output style configuration |
| `supportedCommands()` | Returns available slash commands |
| `supportedModels()` | Returns available models with display info |
| `supportedAgents()` | Returns available subagents as [`AgentInfo`](https://platform.claude.com/docs/en/agent-sdk/typescript#agent-info)`[]` |
| `mcpServerStatus()` | Returns status of connected MCP servers |
| `accountInfo()` | Returns account information |
| `reconnectMcpServer(serverName)` | Reconnect an MCP server by name |
| `toggleMcpServer(serverName, enabled)` | Enable or disable an MCP server by name |
| `setMcpServers(servers)` | Dynamically replace the set of MCP servers for this session. Returns info about which servers were added, removed, and any errors |
| `streamInput(stream)` | Stream input messages to the query for multi-turn conversations |
| `stopTask(taskId)` | Stop a running background task by ID |
| `close()` | Close the query and terminate the underlying process. Forcefully ends the query and cleans up all resources |

### 

`SDKControlInitializeResponse`

Return type of `initializationResult()`. Contains session initialization data.

Configuration for a subagent defined programmatically.

| Field | Required | Description |
| --- | --- | --- |
| `description` | Yes | Natural language description of when to use this agent |
| `tools` | No | Array of allowed tool names. If omitted, inherits all tools from parent |
| `disallowedTools` | No | Array of tool names to explicitly disallow for this agent |
| `prompt` | Yes | The agent's system prompt |
| `model` | No | Model override for this agent. If omitted or `'inherit'`, uses the main model |
| `mcpServers` | No | MCP server specifications for this agent |
| `skills` | No | Array of skill names to preload into the agent context |
| `maxTurns` | No | Maximum number of agentic turns (API round-trips) before stopping |
| `criticalSystemReminder_EXPERIMENTAL` | No | Experimental: Critical reminder added to the system prompt |

Specifies MCP servers available to a subagent. Can be a server name (string referencing a server from the parent's `mcpServers` config) or an inline server configuration record mapping server names to configs.

Where `McpServerConfigForProcessTransport` is `McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig | McpSdkServerConfig`.

Controls which filesystem-based configuration sources the SDK loads settings from.

| Value | Description | Location |
| --- | --- | --- |
| `'user'` | Global user settings | `~/.claude/settings.json` |
| `'project'` | Shared project settings (version controlled) | `.claude/settings.json` |
| `'local'` | Local project settings (gitignored) | `.claude/settings.local.json` |

When `settingSources` is **omitted** or **undefined**, the SDK does **not** load any filesystem settings. This provides isolation for SDK applications.

**Load all filesystem settings (legacy behavior):**

**Load only specific setting sources:**

**Testing and CI environments:**

**SDK-only applications:**

**Loading CLAUDE.md project instructions:**

When multiple sources are loaded, settings are merged with this precedence (highest to lowest):

1.  Local settings (`.claude/settings.local.json`)
2.  Project settings (`.claude/settings.json`)
3.  User settings (`~/.claude/settings.json`)

Programmatic options (like `agents`, `allowedTools`) always override filesystem settings.

Custom permission function type for controlling tool usage.

| Option | Type | Description |
| --- | --- | --- |
| `signal` | `AbortSignal` | Signaled if the operation should be aborted |
| `suggestions` | [`PermissionUpdate`](https://platform.claude.com/docs/en/agent-sdk/typescript#permission-update)`[]` | Suggested permission updates so the user is not prompted again for this tool |
| `blockedPath` | `string` | The file path that triggered the permission request, if applicable |
| `decisionReason` | `string` | Explains why this permission request was triggered |
| `toolUseID` | `string` | Unique identifier for this specific tool call within the assistant message |
| `agentID` | `string` | If running within a sub-agent, the sub-agent's ID |

Result of a permission check.

Configuration for built-in tool behavior.

| Field | Type | Description |
| --- | --- | --- |
| `askUserQuestion.previewFormat` | `'markdown' | 'html'` | Opts into the `preview` field on [`AskUserQuestion`](https://platform.claude.com/docs/en/agent-sdk/user-input#question-format) options and sets its content format. When unset, Claude does not emit previews |

Configuration for MCP servers.

#### 

`McpSdkServerConfigWithInstance`

#### 

`McpClaudeAIProxyServerConfig`

Configuration for loading plugins in the SDK.

| Field | Type | Description |
| --- | --- | --- |
| `type` | `'local'` | Must be `'local'` (only local plugins currently supported) |
| `path` | `string` | Absolute or relative path to the plugin directory |

**Example:**

For complete information on creating and using plugins, see [Plugins](https://platform.claude.com/docs/en/agent-sdk/plugins).

Union type of all possible messages returned by the query.

Assistant response message.

The `message` field is a [`BetaMessage`](https://platform.claude.com/docs/en/api/messages) from the Anthropic SDK. It includes fields like `id`, `content`, `model`, `stop_reason`, and `usage`.

`SDKAssistantMessageError` is one of: `'authentication_failed'`, `'billing_error'`, `'rate_limit'`, `'invalid_request'`, `'server_error'`, `'max_output_tokens'`, or `'unknown'`.

User input message.

Replayed user message with required UUID.

Final result message.

System initialization message.

### 

`SDKPartialAssistantMessage`

Streaming partial message (only when `includePartialMessages` is true).

### 

`SDKCompactBoundaryMessage`

Message indicating a conversation compaction boundary.

Information about a denied tool use.

For a comprehensive guide on using hooks with examples and common patterns, see the [Hooks guide](https://platform.claude.com/docs/en/agent-sdk/hooks).

Available hook events.

Hook callback function type.

Hook configuration with optional matcher.

Union type of all hook input types.

Base interface that all hook input types extend.

#### 

`PostToolUseFailureHookInput`

#### 

`UserPromptSubmitHookInput`

#### 

`PermissionRequestHookInput`

Hook return value.

Documentation of input schemas for all built-in Claude Code tools. These types are exported from `@anthropic-ai/claude-agent-sdk` and can be used for type-safe tool interactions.

Union of all tool input types, exported from `@anthropic-ai/claude-agent-sdk`.

**Tool name:** `Agent` (previously `Task`, which is still accepted as an alias)

Launches a new agent to handle complex, multi-step tasks autonomously.

**Tool name:** `AskUserQuestion`

Asks the user clarifying questions during execution. See [Handle approvals and user input](https://platform.claude.com/docs/en/agent-sdk/user-input#handle-clarifying-questions) for usage details.

**Tool name:** `Bash`

Executes bash commands in a persistent shell session with optional timeout and background execution.

**Tool name:** `TaskOutput`

Retrieves output from a running or completed background task.

**Tool name:** `Edit`

Performs exact string replacements in files.

**Tool name:** `Read`

Reads files from the local filesystem, including text, images, PDFs, and Jupyter notebooks. Use `pages` for PDF page ranges (for example, `"1-5"`).

**Tool name:** `Write`

Writes a file to the local filesystem, overwriting if it exists.

**Tool name:** `Glob`

Fast file pattern matching that works with any codebase size.

**Tool name:** `Grep`

Powerful search tool built on ripgrep with regex support.

**Tool name:** `TaskStop`

Stops a running background task or shell by ID.

**Tool name:** `NotebookEdit`

Edits cells in Jupyter notebook files.

**Tool name:** `WebFetch`

Fetches content from a URL and processes it with an AI model.

**Tool name:** `WebSearch`

Searches the web and returns formatted results.

**Tool name:** `TodoWrite`

Creates and manages a structured task list for tracking progress.

**Tool name:** `ExitPlanMode`

Exits planning mode. Optionally specifies prompt-based permissions needed to implement the plan.

**Tool name:** `ListMcpResources`

Lists available MCP resources from connected servers.

**Tool name:** `ReadMcpResource`

Reads a specific MCP resource from a server.

**Tool name:** `Config`

Gets or sets a configuration value.

**Tool name:** `EnterWorktree`

Creates and enters a temporary git worktree for isolated work.

Documentation of output schemas for all built-in Claude Code tools. These types are exported from `@anthropic-ai/claude-agent-sdk` and represent the actual response data returned by each tool.

Union of all tool output types.

**Tool name:** `Agent` (previously `Task`, which is still accepted as an alias)

Returns the result from the subagent. Discriminated on the `status` field: `"completed"` for finished tasks, `"async_launched"` for background tasks, and `"sub_agent_entered"` for interactive subagents.

**Tool name:** `AskUserQuestion`

Returns the questions asked and the user's answers.

**Tool name:** `Bash`

Returns command output with stdout/stderr split. Background commands include a `backgroundTaskId`.

**Tool name:** `Edit`

Returns the structured diff of the edit operation.

**Tool name:** `Read`

Returns file contents in a format appropriate to the file type. Discriminated on the `type` field.

**Tool name:** `Write`

Returns the write result with structured diff information.

**Tool name:** `Glob`

Returns file paths matching the glob pattern, sorted by modification time.

**Tool name:** `Grep`

Returns search results. The shape varies by `mode`: file list, content with matches, or match counts.

**Tool name:** `TaskStop`

Returns confirmation after stopping the background task.

**Tool name:** `NotebookEdit`

Returns the result of the notebook edit with original and updated file contents.

**Tool name:** `WebFetch`

Returns the fetched content with HTTP status and metadata.

**Tool name:** `WebSearch`

Returns search results from the web.

**Tool name:** `TodoWrite`

Returns the previous and updated task lists.

**Tool name:** `ExitPlanMode`

Returns the plan state after exiting plan mode.

**Tool name:** `ListMcpResources`

Returns an array of available MCP resources.

**Tool name:** `ReadMcpResource`

Returns the contents of the requested MCP resource.

**Tool name:** `Config`

Returns the result of a configuration get or set operation.

**Tool name:** `EnterWorktree`

Returns information about the created git worktree.

Operations for updating permissions.

### 

`PermissionUpdateDestination`

Available beta features that can be enabled via the `betas` option. See [Beta headers](https://platform.claude.com/docs/en/api/beta-headers) for more information.

| Value | Description | Compatible Models |
| --- | --- | --- |
| `'context-1m-2025-08-07'` | Enables the 1 million token [context window](https://platform.claude.com/docs/en/build-with-claude/context-windows). | Claude Sonnet 4.5, Claude Sonnet 4 |

Claude Opus 4.6 and Sonnet 4.6 have a 1M token context window. Including `context-1m-2025-08-07` has no effect on those models.

Information about an available slash command.

Information about an available model.

Information about an available subagent that can be invoked via the Agent tool.

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Agent type identifier (e.g., `"Explore"`, `"general-purpose"`) |
| `description` | `string` | Description of when to use this agent |
| `model` | `string | undefined` | Model alias this agent uses. If omitted, inherits the parent's model |

Status of a connected MCP server.

The configuration of an MCP server as reported by `mcpServerStatus()`. This is the union of all MCP server transport types.

See [`McpServerConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#mcp-server-config) for details on each transport type.

Account information for the authenticated user.

Per-model usage statistics returned in result messages.

A version of [`Usage`](https://platform.claude.com/docs/en/agent-sdk/typescript#usage) with all nullable fields made non-nullable.

Token usage statistics (from `@anthropic-ai/sdk`).

MCP tool result type (from `@modelcontextprotocol/sdk/types.js`).

Controls Claude's thinking/reasoning behavior. Takes precedence over the deprecated `maxThinkingTokens`.

Interface for custom process spawning (used with `spawnClaudeCodeProcess` option). `ChildProcess` already satisfies this interface.

Options passed to the custom spawn function.

Result of a `setMcpServers()` operation.

Result of a `rewindFiles()` operation.

Status update message (e.g., compacting).

### 

`SDKTaskNotificationMessage`

Notification when a background task completes, fails, or is stopped.

Summary of tool usage in a conversation.

Emitted when a hook begins executing.

Emitted while a hook is running, with stdout/stderr output.

Emitted when a hook finishes executing.

Emitted periodically while a tool is executing to indicate progress.

Emitted during authentication flows.

Emitted when a background task begins.

Emitted periodically while a background task is running.

Emitted when file checkpoints are persisted to disk.

Emitted when the session encounters a rate limit.

### 

`SDKLocalCommandOutputMessage`

Output from a local slash command (for example, `/voice` or `/cost`). Displayed as assistant-style text in the transcript.

### 

`SDKPromptSuggestionMessage`

Emitted after each turn when `promptSuggestions` is enabled. Contains a predicted next user prompt.

Custom error class for abort operations.

Configuration for sandbox behavior. Use this to enable command sandboxing and configure network restrictions programmatically.

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable sandbox mode for command execution |
| `autoAllowBashIfSandboxed` | `boolean` | `true` | Auto-approve bash commands when sandbox is enabled |
| `excludedCommands` | `string[]` | `[]` | Commands that always bypass sandbox restrictions (e.g., `['docker']`). These run unsandboxed automatically without model involvement |
| `allowUnsandboxedCommands` | `boolean` | `true` | Allow the model to request running commands outside the sandbox. When `true`, the model can set `dangerouslyDisableSandbox` in tool input, which falls back to the [permissions system](https://platform.claude.com/docs/en/agent-sdk/typescript#permissions-fallback-for-unsandboxed-commands) |
| `network` | [`SandboxNetworkConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#sandbox-network-config) | `undefined` | Network-specific sandbox configuration |
| `filesystem` | [`SandboxFilesystemConfig`](https://platform.claude.com/docs/en/agent-sdk/typescript#sandbox-filesystem-config) | `undefined` | Filesystem-specific sandbox configuration for read/write restrictions |
| `ignoreViolations` | `Record<string, string[]>` | `undefined` | Map of violation categories to patterns to ignore (e.g., `{ file: ['/tmp/*'], network: ['localhost'] }`) |
| `enableWeakerNestedSandbox` | `boolean` | `false` | Enable a weaker nested sandbox for compatibility |
| `ripgrep` | `{ command: string; args?: string[] }` | `undefined` | Custom ripgrep binary configuration for sandbox environments |

**Unix socket security:** The `allowUnixSockets` option can grant access to powerful system services. For example, allowing `/var/run/docker.sock` effectively grants full host system access through the Docker API, bypassing sandbox isolation. Only allow Unix sockets that are strictly necessary and understand the security implications of each.

Network-specific configuration for sandbox mode.

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `allowedDomains` | `string[]` | `[]` | Domain names that sandboxed processes can access |
| `allowManagedDomainsOnly` | `boolean` | `false` | Restrict network access to only the domains in `allowedDomains` |
| `allowLocalBinding` | `boolean` | `false` | Allow processes to bind to local ports (e.g., for dev servers) |
| `allowUnixSockets` | `string[]` | `[]` | Unix socket paths that processes can access (e.g., Docker socket) |
| `allowAllUnixSockets` | `boolean` | `false` | Allow access to all Unix sockets |
| `httpProxyPort` | `number` | `undefined` | HTTP proxy port for network requests |
| `socksProxyPort` | `number` | `undefined` | SOCKS proxy port for network requests |

Filesystem-specific configuration for sandbox mode.

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `allowWrite` | `string[]` | `[]` | File path patterns to allow write access to |
| `denyWrite` | `string[]` | `[]` | File path patterns to deny write access to |
| `denyRead` | `string[]` | `[]` | File path patterns to deny read access to |

### 

Permissions Fallback for Unsandboxed Commands

When `allowUnsandboxedCommands` is enabled, the model can request to run commands outside the sandbox by setting `dangerouslyDisableSandbox: true` in the tool input. These requests fall back to the existing permissions system, meaning your `canUseTool` handler is invoked, allowing you to implement custom authorization logic.

**`excludedCommands` vs `allowUnsandboxedCommands`:**

-   `excludedCommands`: A static list of commands that always bypass the sandbox automatically (e.g., `['docker']`). The model has no control over this.
-   `allowUnsandboxedCommands`: Lets the model decide at runtime whether to request unsandboxed execution by setting `dangerouslyDisableSandbox: true` in the tool input.

This pattern enables you to:

-   **Audit model requests:** Log when the model requests unsandboxed execution
-   **Implement allowlists:** Only permit specific commands to run unsandboxed
-   **Add approval workflows:** Require explicit authorization for privileged operations

Commands running with `dangerouslyDisableSandbox: true` have full system access. Ensure your `canUseTool` handler validates these requests carefully.

If `permissionMode` is set to `bypassPermissions` and `allowUnsandboxedCommands` is enabled, the model can autonomously execute commands outside the sandbox without any approval prompts. This combination effectively allows the model to escape sandbox isolation silently.

-   [SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) - General SDK concepts
-   [Python SDK reference](https://platform.claude.com/docs/en/agent-sdk/python) - Python SDK documentation
-   [CLI reference](https://code.claude.com/docs/en/cli-reference) - Command-line interface
-   [Common workflows](https://code.claude.com/docs/en/common-workflows) - Step-by-step guides