/**
 * CodeBuddy Session Management
 *
 * Manages per-runtime session ID isolation. Session IDs from different
 * runtimes (Claude vs CodeBuddy) are stored together as a JSON object
 * `{ claude?: string; codebuddy?: string }` in a single DB column.
 *
 * This allows a single chat_sessions.sdk_session_id column to hold
 * per-runtime session IDs without schema changes.
 *
 * Extracted from cli-runtime.ts — only the session isolation logic is
 * retained here. The global runtime switching (getCliRuntime/setCliRuntime)
 * is not part of this module; runtime selection is handled at a higher
 * architectural level.
 */

// ── Types ──────────────────────────────────────────────────────

export type CliRuntime = 'claude' | 'codebuddy';

export interface RuntimeSessionIds {
  claude?: string;
  codebuddy?: string;
}

// ── Parsing ───────────────────────────────────────────────────

/**
 * Parse a raw SDK session ID string into a per-runtime map.
 *
 * Handles three formats:
 * - `undefined`/`null`/`""` -> empty object
 * - Plain string (legacy) -> treated as a Claude session ID
 * - JSON object `{ claude?: string; codebuddy?: string }`
 */
export function parseRuntimeSessionIds(raw: string | undefined | null): RuntimeSessionIds {
  if (!raw) return {};
  // Legacy: plain string = Claude session ID
  if (!raw.startsWith('{')) return { claude: raw };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch { /* ignore */ }
  return { claude: raw };
}

// ── Accessors ─────────────────────────────────────────────────

/**
 * Extract the session ID for a specific runtime.
 */
export function getRuntimeSessionId(
  rawSdkSessionId: string | undefined | null,
  runtime: CliRuntime,
): string | undefined {
  const ids = parseRuntimeSessionIds(rawSdkSessionId);
  return ids[runtime] || undefined;
}

/**
 * Update the session ID for a specific runtime and return the
 * serialised value to store back in the DB.
 */
export function setRuntimeSessionId(
  rawSdkSessionId: string | undefined | null,
  runtime: CliRuntime,
  newId: string,
): string {
  const ids = parseRuntimeSessionIds(rawSdkSessionId);
  ids[runtime] = newId;
  return JSON.stringify(ids);
}
