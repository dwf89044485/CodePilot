import type { Query } from '@anthropic-ai/claude-agent-sdk';

const globalKey = '__activeConversations__' as const;

// [CodeBuddy] Store as `unknown` to accept both Claude and CodeBuddy Query objects.
// Consumers cast via `getConversation()` which returns the Claude Query type;
// CodeBuddy's Query has the same interface shape (duck typing).
function getMap(): Map<string, unknown> {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = new Map<string, unknown>();
  }
  return (globalThis as Record<string, unknown>)[globalKey] as Map<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerConversation(sessionId: string, conversation: any): void {
  getMap().set(sessionId, conversation);
}

export function unregisterConversation(sessionId: string): void {
  getMap().delete(sessionId);
}

/** Returns the conversation cast to Claude's Query type (works for CodeBuddy too via duck typing). */
export function getConversation(sessionId: string): Query | undefined {
  return getMap().get(sessionId) as Query | undefined;
}
