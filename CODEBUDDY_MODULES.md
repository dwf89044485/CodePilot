# CodeBuddy Integration — Module Reference

Quick reference guide for CodeBuddy-related files in the fork.

## Core Integration Modules

### 1. Runtime Switching (`src/lib/cli-runtime.ts`)
**94 lines** — Manages dual-runtime (Claude Code / CodeBuddy SDK) switching

```typescript
// Main exports:
getCliRuntime(): CliRuntime                    // Get current runtime ('claude' | 'codebuddy')
setCliRuntime(runtime: CliRuntime): void       // Persist runtime to DB
getRuntimeLabel(runtime: CliRuntime): string   // Human-readable name

// Session ID isolation (no schema change):
getRuntimeSessionId(raw, runtime): string | undefined
setRuntimeSessionId(raw, runtime, newId): string
```

**Key Innovation:** Per-runtime session isolation using JSON:
```
{ claude?: "id1", codebuddy?: "id2" }
```

**Usage in Chat Route:**
```typescript
const cliRuntime = getCliRuntime();
const streamFn = cliRuntime === 'codebuddy' ? streamCodeBuddy : streamClaude;
const stream = streamFn(options);
```

---

### 2. CodeBuddy Client (`src/lib/codebuddy-client.ts`)
**1,051 lines** — Wrapper around Tencent AI Agent SDK

```typescript
// Main streaming function:
export async function streamCodeBuddy(options: ClaudeStreamOptions): Promise<ReadableStream<string>>

// Binary management:
function findCodeBuddyPath(): string | undefined
function resolveScriptFromCmd(cmdPath: string): string | undefined  // Windows

// MCP translation:
function toSdkMcpConfig(servers: Record<string, MCPServerConfig>): Record<string, McpServerConfig>

// Cache invalidation (call after reinstall):
export function invalidateCodeBuddyClientCache(): void
```

**Major Features:**
- CodeBuddy binary locating (cross-platform)
- Windows .cmd wrapper parsing
- MCP server configuration translation
- Permission request integration
- Error classification (CodeBuddy-specific)

**Windows Binary Resolution:**
```typescript
// npm wraps CLI as .cmd on Windows, can't spawn directly
// Solution: Parse .cmd → extract real .js path → resolve symlinks
const resolved = fs.realpathSync(found);
```

---

### 3. Provider Resolution (`src/lib/provider-resolver.ts`)
**57 lines** — Abstraction layer for runtime-specific provider config

```typescript
export function resolveForClaudeCode(provider: ApiProvider): ProviderConfig
export function toCodeBuddyEnv(provider: ApiProvider): Record<string, string>
```

**Flow:**
```
Database (api_providers)
    ↓
resolveForClaudeCode() → { protocol, baseUrl, apiKey, headers }
                    or
toCodeBuddyEnv() → { ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ... }
    ↓
streamClaude() or streamCodeBuddy()
```

---

### 4. Vendor Type Definitions (`src/types/vendor.d.ts`)
**82 lines** — TypeScript declarations for `@tencent-ai/agent-sdk`

```typescript
declare module '@tencent-ai/agent-sdk' {
  export interface McpStdioServerConfig { ... }
  export interface McpSSEServerConfig { ... }
  export interface McpHttpServerConfig { ... }
  export interface Options { ... }
  export type Query = AsyncIterable<any> & { ... }
  export function query(args: any): Query
}
```

Enables TypeScript compilation for CodeBuddy SDK calls.

---

## Provider Catalog

### `src/lib/provider-catalog.ts` (802 lines)
**No local changes**, but heavily referenced by CodeBuddy integration.

**Key Types:**
```typescript
export type Protocol = 'anthropic' | 'openai-compatible' | 'openrouter' 
                     | 'bedrock' | 'vertex' | 'google' | 'gemini-image'

export type AuthStyle = 'api_key' | 'auth_token' | 'env_only' | 'custom_header'

export interface VendorPreset {
  key: string
  name: string
  description: string
  descriptionZh: string
  protocol: Protocol
  authStyle: AuthStyle
  baseUrl: string
  defaultEnvOverrides: Record<string, string>
  defaultModels: CatalogModel[]
  defaultRoleModels?: RoleModels
  fields: string[]
  category?: 'chat' | 'media'
  iconKey: string
  sdkProxyOnly?: boolean  // CodeBuddy SDK-only
  meta?: { apiKeyUrl, docsUrl, billingModel, notes }
}
```

**Current Vendors (23 presets):**
- Official: Anthropic
- Compatible: OpenRouter, Anthropic Third-party
- Chinese: GLM (2), Kimi, Moonshot, MiniMax (2), Volcengine, Xiaomi (2), Bailian
- Cloud: Bedrock, Vertex
- Self-hosted: Ollama, LiteLLM
- Media: Gemini Image

**Key Functions:**
```typescript
getPreset(key: string): VendorPreset | undefined
getPresetsByCategory(category: 'chat' | 'media'): VendorPreset[]
getDefaultModelsForProvider(protocol, baseUrl): CatalogModel[]
findPresetForLegacy(baseUrl, providerType, protocol?): VendorPreset
```

---

## Chat Route Changes

### `src/app/api/chat/route.ts` (+63 lines)

**Runtime Selection (line ~378):**
```typescript
const cliRuntime = getCliRuntime();
const streamFn = cliRuntime === 'codebuddy' ? streamCodeBuddy : streamClaude;
const stream = streamFn({
  prompt: content,
  sessionId: session_id,
  sdkSessionId: session.sdk_session_id || undefined,
  // ... other options ...
  agents,
  agent,
});
```

**Session ID Persistence (line ~481):**
```typescript
function persistRuntimeSessionId(sessionId: string, newSdkSessionId: string): void {
  const currentSession = getSession(sessionId);
  const raw = currentSession?.sdk_session_id || '';
  const rt = getCliRuntime();
  const updated = setRuntimeSessionId(raw, rt, newSdkSessionId);
  updateSdkSessionId(sessionId, updated);
}

// Called at lines ~610 & ~642 to persist SDK session IDs
```

---

## Related Files

### Error Handling
- `src/lib/error-classifier.ts` — Runtime-aware error classification (avoids credential false positives)

### Platform Detection
- `src/lib/platform.ts` — Cross-platform utilities (binary detection, path resolution)

### Environment Setup
- `src/app/api/settings/app/route.ts` — Settings persistence (runtime choice)
- `src/app/api/setup/route.ts` — Initial setup

### Connection Status
- `src/components/layout/ConnectionStatus.tsx` — Shows active runtime badge

### Provider UI
- `src/components/settings/ProviderManager.tsx` — Provider configuration UI

---

## Database Schema

### `chat_sessions` table
```sql
sdk_session_id TEXT  -- Stores JSON: {"claude":"...", "codebuddy":"..."}
```

**Parsing Logic:**
```typescript
// Legacy: plain string → { claude: string_id }
// New: JSON object → { claude?, codebuddy? }
const ids = parseRuntimeSessionIds(raw);
const sessionId = ids[runtime];
```

---

## Key Architectural Decisions

### ✅ Session Isolation Without Schema Change
**Problem:** Need separate session IDs for two runtimes
**Solution:** JSON object encoding (no migration)
```
Legacy:  "abc123" → { claude: "abc123" }
New:     '{"claude":"abc123","codebuddy":"xyz789"}'
```

### ✅ Windows Binary Compatibility
**Problem:** npm .cmd wrappers can't be spawned directly
**Solution:** Parse .cmd → extract .js → resolve symlinks
```typescript
function resolveScriptFromCmd(cmdPath: string): string | undefined
// Matches patterns like: "%~dp0\...\codebuddy.js"
```

### ✅ Provider Abstraction
**Problem:** Different runtimes need different config format
**Solution:** Separate resolvers
```
Claude Code: URL + headers + auth token
CodeBuddy:   Environment variables
```

### ⚠️  Limitations
- VendorPreset has NO `customRuntime` field (may be added in future)
- CodeBuddy binary path is process-global (caching issue on reinstall, hence `invalidateCodeBuddyClientCache()`)
- No automatic upstream conflict resolution (manual merge required)

---

## Testing

```bash
# Type check
npm run test

# Smoke tests (need running dev server)
npm run dev       # In one terminal
npm run test:smoke  # In another

# Full E2E
npm run test:e2e
```

**Key test files:**
- Tests for runtime switching logic
- Session ID persistence tests
- Provider resolution tests

---

## Upstream Comparison

**Your Version (divergence):** v0.38.1
**Upstream HEAD:** v0.48.0

**Major Upstream Features:**
- Native Agent Runtime (independent from Claude Code)
- OpenAI support integration
- Unified runtime selection UI
- Better error monitoring (Sentry)
- Announcement/migration dialogs

**Recommendation:** Consider syncing upstream to get Native Runtime feature, then carefully merge CodeBuddy additions.

---

## Documentation

- `CLAUDE.md` — Development guidelines
- `docs/research/codebuddy-integration-analysis.md` — Deep analysis
- `GIT_ANALYSIS_REPORT.md` — Complete fork analysis

