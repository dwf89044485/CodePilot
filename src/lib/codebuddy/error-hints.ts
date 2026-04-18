/**
 * CodeBuddy Error Hints
 *
 * CodeBuddy-specific error detection and user-facing hints, extracted from
 * the main error-classifier so provider-specific logic lives in its own module.
 */

import type { ErrorContext } from '@/lib/error-classifier';

// ── Provider detection ─────────────────────────────────────────

/**
 * Returns true when the error context belongs to the CodeBuddy SDK provider.
 */
export function isCodeBuddyProvider(ctx: ErrorContext): boolean {
  return ctx.providerName === 'CodeBuddy SDK';
}

// ── Process-crash hints ────────────────────────────────────────

/**
 * Build the list of likely-cause hints shown when the CodeBuddy runtime
 * crashes (PROCESS_CRASH). The main error-classifier calls this instead
 * of hard-coding CodeBuddy knowledge.
 */
export function getCodeBuddyCrashHints(ctx: ErrorContext): string[] {
  const hints: string[] = [
    'CodeBuddy login/session may be invalid or expired',
    'CodeBuddy runtime or network may be unavailable',
  ];
  if (ctx.hasImages) hints.push('Provider may not support image/vision input');
  if (ctx.thinkingEnabled) hints.push('Thinking mode may not be supported');
  if (ctx.context1mEnabled) hints.push('1M context may not be supported');
  return hints;
}

/**
 * Action hint shown alongside a PROCESS_CRASH for CodeBuddy.
 */
export const CODEBUDDY_CRASH_ACTION_HINT =
  'Check CodeBuddy login/session and runtime logs, then retry. If it persists, restart CodePilot and re-login CodeBuddy.';

// ── Unknown-error fallback ─────────────────────────────────────

/**
 * Action hint for the UNKNOWN fallback category when the provider is CodeBuddy.
 */
export const CODEBUDDY_UNKNOWN_ACTION_HINT =
  'Check the error details below and verify CodeBuddy runtime/login state, then retry.';

// ── Credential skip rule ───────────────────────────────────────

/**
 * CodeBuddy SDK has its own auth mechanism; standard NO_CREDENTIALS hints
 * (ANTHROPIC_API_KEY / provider-settings) do not apply. The main classifier
 * should call this to decide whether to skip the NO_CREDENTIALS pattern.
 */
export function shouldSkipNoCredentials(ctx: ErrorContext): boolean {
  return ctx.providerName === 'CodeBuddy SDK';
}

// ── Runtime label ──────────────────────────────────────────────

/**
 * Human-readable runtime label used in error messages.
 */
export function getRuntimeLabel(ctx: ErrorContext): string {
  return isCodeBuddyProvider(ctx) ? 'CodeBuddy runtime' : 'Claude Code process';
}
