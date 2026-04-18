/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@tencent-ai/agent-sdk' {
  export type AssistantMessage = any;
  export type UserMessage = any;
  export type ResultMessage = any;
  export type PartialAssistantMessage = any;
  export type ToolProgressMessage = any;
  export type ErrorMessage = any;

  export interface McpStdioServerConfig {
    type?: 'stdio';
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }

  export interface McpSSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
  }

  export interface McpHttpServerConfig {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
  }

  export type McpServerConfig =
    | McpStdioServerConfig
    | McpSSEServerConfig
    | McpHttpServerConfig
    | Record<string, any>;

  export interface Options {
    cwd?: string;
    abortController?: AbortController;
    includePartialMessages?: boolean;
    permissionMode?: string;
    env?: Record<string, string>;
    settingSources?: unknown;
    pathToCodebuddyCode?: string;
    model?: string;
    systemPrompt?: unknown;
    mcpServers?: Record<string, McpServerConfig>;
    thinking?: unknown;
    effort?: unknown;
    outputFormat?: unknown;
    agents?: unknown;
    enableFileCheckpointing?: boolean;
    stderr?: (data: string) => void;
    resume?: string;
    canUseTool?: (
      toolName: string,
      input: Record<string, unknown>,
      opts: {
        suggestions?: unknown;
        decisionReason?: string;
        blockedPath?: string;
        toolUseID: string;
        signal?: AbortSignal;
      }
    ) => Promise<any>;
    [key: string]: any;
  }

  export type Query = AsyncIterable<any> & {
    interrupt: (...args: any[]) => any;
    setPermissionMode: (...args: any[]) => any;
    setModel: (...args: any[]) => any;
    setMaxThinkingTokens: (...args: any[]) => any;
    supportedCommands: (...args: any[]) => any;
    supportedModels: (...args: any[]) => any;
    mcpServerStatus: (...args: any[]) => any;
    accountInfo: (...args: any[]) => any;
    streamInput: (...args: any[]) => any;
    return: (...args: any[]) => any;
    throw: (...args: any[]) => any;
  };

  export function query(args: any): Query;
}
