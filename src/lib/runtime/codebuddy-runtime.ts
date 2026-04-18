/**
 * runtime/codebuddy-runtime.ts — CodeBuddy SDK Agent Runtime.
 *
 * Wraps the CodeBuddy SDK (from @tencent-ai/agent-sdk) behind the AgentRuntime
 * interface. Delegates to streamCodeBuddy() which contains the full SDK query() logic.
 *
 * This follows the same thin-adapter pattern as sdk-runtime.ts:
 * - All heavy lifting lives in codebuddy/client.ts
 * - This file only converts RuntimeStreamOptions → ClaudeStreamOptions and dispatches
 *
 * CodeBuddy uses its own SDK subprocess (@tencent-ai/codebuddy-code binary),
 * its own auth (local login, not API key), and supports multiple model vendors
 * (Claude, GPT, Gemini, GLM, DeepSeek, Hunyuan via IOA).
 */

import type { AgentRuntime, RuntimeStreamOptions } from './types';
import type { ClaudeStreamOptions } from '@/types';
import { findCodeBuddyBinary } from '../codebuddy/platform';
import { getConversation } from '../conversation-registry';

export const codebuddyRuntime: AgentRuntime = {
  id: 'codebuddy',
  displayName: 'CodeBuddy SDK',
  description: 'Tencent CodeBuddy CLI agent with multi-model support.',

  stream(options: RuntimeStreamOptions): ReadableStream<string> {
    // Lazy import to avoid loading CodeBuddy SDK when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { streamCodeBuddy } = require('../codebuddy/client') as {
      streamCodeBuddy: (options: ClaudeStreamOptions) => ReadableStream<string>;
    };

    // Convert RuntimeStreamOptions → ClaudeStreamOptions
    // (CodeBuddy's streamCodeBuddy accepts the same option shape as streamClaudeSdk)
    const ro = options.runtimeOptions || {};
    const cbOptions: ClaudeStreamOptions = {
      prompt: options.prompt,
      sessionId: options.sessionId,
      model: options.model,
      systemPrompt: options.systemPrompt,
      workingDirectory: options.workingDirectory,
      abortController: options.abortController,
      permissionMode: options.permissionMode,
      mcpServers: options.mcpServers,
      thinking: options.thinking,
      effort: options.effort,
      context1m: options.context1m,
      autoTrigger: options.autoTrigger,
      bypassPermissions: options.bypassPermissions,
      onRuntimeStatusChange: options.onRuntimeStatusChange,
      providerId: options.providerId,
      sessionProviderId: options.sessionProviderId,

      // Runtime-specific fields from runtimeOptions
      sdkSessionId: ro.sdkSessionId as string | undefined,
      files: ro.files as ClaudeStreamOptions['files'],
      conversationHistory: ro.conversationHistory as ClaudeStreamOptions['conversationHistory'],
      sessionSummary: ro.sessionSummary as string | undefined,
      fallbackTokenBudget: ro.fallbackTokenBudget as number | undefined,
      imageAgentMode: ro.imageAgentMode as boolean | undefined,
      toolTimeoutSeconds: ro.toolTimeoutSeconds as number | undefined,
      outputFormat: ro.outputFormat as ClaudeStreamOptions['outputFormat'],
      agents: ro.agents as ClaudeStreamOptions['agents'],
      agent: ro.agent as string | undefined,
      enableFileCheckpointing: ro.enableFileCheckpointing as boolean | undefined,
      generativeUI: ro.generativeUI as boolean | undefined,
      provider: ro.provider as ClaudeStreamOptions['provider'],
    };

    return streamCodeBuddy(cbOptions);
  },

  interrupt(sessionId: string): void {
    // CodeBuddy conversations are registered in the same conversation-registry
    // (duck typing — CodeBuddy's Query type is structurally compatible with Claude's)
    const conversation = getConversation(sessionId);
    if (conversation) {
      conversation.interrupt();
    }
  },

  isAvailable(): boolean {
    return !!findCodeBuddyBinary();
  },

  dispose(): void {
    // CodeBuddy SDK manages its own subprocess lifecycle
  },
};
