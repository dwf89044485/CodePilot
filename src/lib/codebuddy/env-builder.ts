/**
 * CodeBuddy SDK Environment Builder
 *
 * Builds environment variables for a CodeBuddy SDK subprocess.
 * Extracted from provider-resolver.ts to isolate CodeBuddy-specific logic.
 *
 * Key differences from toClaudeCodeEnv():
 *
 * 1. **No auth injection**: CodeBuddy authenticates via its own local login
 *    mechanism (similar to `codebuddy login`). There is no API key, auth token,
 *    or base_url to inject from the provider system.
 *
 * 2. **ANTHROPIC_* cleanup**: All Claude-specific env vars are removed to prevent
 *    the CodeBuddy subprocess from accidentally picking them up.
 *
 * 3. **Role models -> CODEBUDDY_* env vars**: The CodeBuddy CLI reads these env vars
 *    (confirmed from cli/dist/codebuddy-headless.js):
 *      - CODEBUDDY_MODEL           -- primary model (like ANTHROPIC_MODEL)
 *      - CODEBUDDY_SMALL_FAST_MODEL -- small/fast model (like ANTHROPIC_SMALL_FAST_MODEL)
 *      - CODEBUDDY_BIG_SLOW_MODEL   -- large/slow model for reasoning tasks
 *    It does NOT have haiku/sonnet/opus role slots (those are Anthropic model-tier
 *    aliases). CodeBuddy's model catalog spans multiple vendors (GPT, Gemini, GLM, etc.),
 *    so per-tier aliases don't apply.
 *
 * 4. **No envOverrides/headers**: Provider DB overrides are not forwarded because
 *    CodeBuddy does not use the provider system's credential chain.
 */

import type { ResolvedProvider } from '../provider-resolver';

/**
 * Build environment variables for a CodeBuddy SDK subprocess.
 *
 * @param baseEnv - Process environment (usually { ...process.env })
 * @param resolved - Output from resolveProvider/resolveForClaudeCode
 * @returns Clean env suitable for the CodeBuddy SDK subprocess
 */
export function toCodeBuddyEnv(
  baseEnv: Record<string, string>,
  resolved: ResolvedProvider,
): Record<string, string> {
  const env = { ...baseEnv };

  // Remove ANTHROPIC / Claude-specific env vars to avoid confusion
  for (const key of Object.keys(env)) {
    if (key.startsWith('ANTHROPIC_')) delete env[key];
  }
  delete env.CLAUDE_CODE_USE_BEDROCK;
  delete env.CLAUDE_CODE_USE_VERTEX;

  // Map role models to CodeBuddy env vars (CODEBUDDY_* prefix, not CTI_*)
  if (resolved.roleModels.default) {
    env.CODEBUDDY_MODEL = resolved.roleModels.default;
  }
  if (resolved.roleModels.small) {
    env.CODEBUDDY_SMALL_FAST_MODEL = resolved.roleModels.small;
  }
  if (resolved.roleModels.reasoning) {
    env.CODEBUDDY_BIG_SLOW_MODEL = resolved.roleModels.reasoning;
  }

  return env;
}
