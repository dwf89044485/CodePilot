/**
 * CodeBuddy Model Definitions
 *
 * Canonical list of models available through the CodeBuddy SDK runtime.
 * Extracted from `codebuddy --help` output.
 *
 * To refresh: run `codebuddy --help` and look for "Currently supported:" list.
 */

export interface CodeBuddyModelEntry {
  value: string;
  label: string;
}

/**
 * Default models available via CodeBuddy SDK (IOA environment).
 * Covers Claude, GPT, Gemini, GLM, MiniMax, Kimi, DeepSeek, and Hunyuan families.
 *
 * Last synced: 2026-04-14 from codebuddy v2.86.0
 */
export const CODEBUDDY_DEFAULT_MODELS: CodeBuddyModelEntry[] = [
  // Claude models
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-4.6-1m', label: 'Claude Sonnet 4.6 (1M)' },
  { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { value: 'claude-opus-4.6-1m', label: 'Claude Opus 4.6 (1M)' },
  { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { value: 'claude-4.5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus-4.5', label: 'Claude Opus 4.5' },
  // GPT models
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2-Codex' },
  { value: 'gpt-5.1', label: 'GPT-5.1' },
  { value: 'gpt-5.1-codex', label: 'GPT-5.1-Codex' },
  { value: 'gpt-5.1-codex-max', label: 'GPT-5.1-Codex-Max' },
  { value: 'gpt-5.1-codex-mini', label: 'GPT-5.1-Codex-Mini' },
  // Gemini models
  { value: 'gemini-3.1-pro', label: 'Gemini-3.1-Pro' },
  { value: 'gemini-3.0-flash', label: 'Gemini-3.0-Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini-2.5-Pro' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini-3.1-Flash-Lite' },
  // GLM models (IOA)
  { value: 'glm-5.1-ioa', label: 'GLM-5.1' },
  { value: 'glm-5.0-turbo-ioa', label: 'GLM-5.0-Turbo' },
  { value: 'glm-5v-turbo-ioa', label: 'GLM-5V-Turbo' },
  { value: 'glm-5.0-ioa', label: 'GLM-5.0' },
  { value: 'glm-4.7-ioa', label: 'GLM-4.7' },
  // MiniMax models (IOA)
  { value: 'minimax-m2.7-ioa', label: 'MiniMax-M2.7' },
  { value: 'minimax-m2.5-ioa', label: 'MiniMax-M2.5' },
  // Kimi (IOA)
  { value: 'kimi-k2.5-ioa', label: 'Kimi-K2.5' },
  // DeepSeek (IOA)
  { value: 'deepseek-v3-2-volc-ioa', label: 'DeepSeek-V3.2' },
  // Hunyuan (IOA)
  { value: 'hunyuan-2.0-thinking-ioa', label: 'Hunyuan-2.0-Thinking' },
];
