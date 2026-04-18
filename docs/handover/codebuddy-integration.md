# CodeBuddy Integration - Technical Handover

> Product thinking and strategy: [docs/insights/codebuddy-integration.md](../insights/codebuddy-integration.md)

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Architecture** | Dual-runtime dispatch (Claude CLI vs CodeBuddy SDK) |
| **Trigger Point** | `getCliRuntime()` setting in src/lib/cli-runtime.ts |
| **File Count** | 20 files (1 NEW, 19 modified) |
| **Code Volume** | 262 lines of CodeBuddy-specific code |
| **Key Files** | codebuddy-client.ts, cli-runtime.ts, platform.ts, provider-resolver.ts |
| **Provider Integration** | Uses SAME resolver, different env vars (CODEBUDDY_* vs ANTHROPIC_*) |

## Core Files

### Entry Point: src/lib/cli-runtime.ts (95 lines, NEW)
```typescript
type CliRuntime = 'claude' | 'codebuddy';
function getCliRuntime(): CliRuntime { /* read from db */ }
function setCliRuntime(runtime: CliRuntime): void { /* write to db */ }
```

**Responsibilities:**
- Store runtime preference in settings table
- Extract per-runtime session IDs from JSON blob
- Provide human-readable labels

### Stream Implementation: src/lib/codebuddy-client.ts (66 lines, NEW)
```typescript
export async function* streamCodeBuddy(options: ClaudeStreamOptions): AsyncGenerator<SSEEvent>
```

**Responsibilities:**
- Find CodeBuddy binary (Windows .cmd → .js translation)
- Build CODEBUDDY_* environment variables
- Register MCP servers
- Spawn CodeBuddy SDK subprocess via `@tencent-ai/agent-sdk`
- Stream events from subprocess

### Dispatch Point: src/app/api/chat/route.ts (line ~515)
```typescript
const cliRuntime = getCliRuntime();
const streamFn = cliRuntime === 'codebuddy' ? streamCodeBuddy : streamClaude;
```

### Provider Support: src/lib/provider-resolver.ts
**Function:** `toCodeBuddyEnv()` (18 lines)
```typescript
export function toCodeBuddyEnv(baseEnv: Record<string, string>, resolved: ResolvedProvider) {
  const env = { ...baseEnv };
  // Remove ANTHROPIC_* vars
  for (const key of Object.keys(env)) {
    if (key.startsWith('ANTHROPIC_')) delete env[key];
  }
  // Set CODEBUDDY_* vars
  env.CODEBUDDY_MODEL = resolved.roleModels.default;
  env.CODEBUDDY_SMALL_FAST_MODEL = resolved.roleModels.small;
  env.CODEBUDDY_BIG_SLOW_MODEL = resolved.roleModels.reasoning;
  return env;
}
```

### Binary Discovery: src/lib/platform.ts
**Function:** `findCodeBuddyBinary()` (37 lines)
```typescript
// Searches for 'codebuddy' or 'cbc' command
// On Windows, resolves .cmd wrapper to actual .js file
// Caches result for 60 seconds
```

## Architecture Pattern

```
Request
  ↓
api/chat/route.ts
  ↓ getCliRuntime() == 'codebuddy' ?
  ├─→ streamCodeBuddy() ←── codebuddy-client.ts
  │     ├─ findCodeBuddyBinary()
  │     ├─ toCodeBuddyEnv()
  │     ├─ Register MCP servers
  │     └─ query() from @tencent-ai/agent-sdk
  │
  └─→ streamClaude() ←── claude-client.ts (default)
        ├─ toClaudeCodeEnv() [with auth injection]
        ├─ Register MCP servers
        └─ query() from @anthropic-ai/claude-agent-sdk
```

## Session ID Isolation

**Problem:** Both runtimes need separate session IDs without schema changes.

**Solution:** Store in `chat_sessions.sdk_session_id` as JSON.

```typescript
// Storage format:
// Legacy: "session-id-123" → { claude: "session-id-123" }
// Current: '{"claude":"sid-1","codebuddy":"sid-2"}'

// Access:
getRuntimeSessionId(sdkSessionId, 'claude')    // → sid-1
getRuntimeSessionId(sdkSessionId, 'codebuddy') // → sid-2

// Update:
setRuntimeSessionId(sdkSessionId, 'codebuddy', 'new-sid')
// → '{"claude":"sid-1","codebuddy":"new-sid"}'
```

## Provider System Integration

### Same Provider Resolver

Both runtimes use `resolveProvider(providerId)` which:
1. Looks up provider record from `api_providers` table
2. Reads protocol (anthropic, openrouter, bedrock, etc.)
3. Reads role models (default, small, reasoning)
4. Returns `ResolvedProvider` object

### Different Environment Variables

| Context | Vars | Source |
|---------|------|--------|
| Claude Code | ANTHROPIC_API_KEY, ANTHROPIC_MODEL, etc. | toClaudeCodeEnv() + auth injection |
| CodeBuddy | CODEBUDDY_MODEL, CODEBUDDY_SMALL_FAST_MODEL, CODEBUDDY_BIG_SLOW_MODEL | toCodeBuddyEnv() + NO auth |

**Why no auth for CodeBuddy?**
- CodeBuddy uses local login mechanism (stored in ~/.codebuddy/config)
- Auth is NOT passed via environment variables
- Provider is identified by role model mappings only

## Adding New Provider to CodeBuddy

1. **Create or update preset** in `src/lib/provider-catalog.ts`:
   ```typescript
   {
     key: 'provider-name',
     protocol: 'anthropic',
     authStyle: 'api_key',
     baseUrl: 'https://...',
     defaultModels: [...],
     defaultRoleModels: {
       default: 'model-1',
       small: 'model-2',
       reasoning: 'model-3',
     },
     // ... other config
   }
   ```

2. **Verify models work in CodeBuddy**:
   - Test `CODEBUDDY_MODEL=model-1 codebuddy` manually
   - Ensure model names match CodeBuddy's provider catalog

3. **Test with both runtimes**:
   - Switch `cli_runtime` setting to 'claude' → test
   - Switch `cli_runtime` setting to 'codebuddy' → test

4. **Add error patterns** if new errors emerge:
   - Update `src/lib/error-classifier.ts` with CodeBuddy error strings

## 20 Files Modified (by extractability)

### HIGH (Easily isolated)
- src/lib/codebuddy-client.ts (66) - NEW, self-contained
- src/lib/platform.ts (37) - findCodeBuddyBinary() function
- src/lib/provider-resolver.ts (18) - toCodeBuddyEnv() function
- src/lib/cli-runtime.ts (95) - NEW, runtime management
- src/app/api/providers/models/route.ts (13) - conditional routes
- src/lib/db.ts (5) - settings persistence
- src/app/api/claude-status/invalidate/route.ts (4) - cache invalidation
- src/app/api/settings/app/route.ts (4) - settings handling
- src/lib/conversation-registry.ts (3) - registry updates
- src/lib/provider-doctor.ts (11) - health checks

### MEDIUM (Conditional logic, scattered)
- src/components/settings/ProviderManager.tsx (16) - UI runtime selector
- src/lib/error-classifier.ts (12) - error patterns
- src/components/layout/ConnectionStatus.tsx (10) - status UI
- src/app/api/setup/route.ts (5) - setup logic

### LOW (Single statements, keep inline)
- src/app/api/chat/route.ts (6) - dispatch point
- src/app/api/claude-status/route.ts (10) - status checks
- src/lib/claude-client.ts (3) - session ID extraction
- src/app/chat/page.tsx (1) - runtime variable
- src/i18n/en.ts (5) - translation keys
- src/i18n/zh.ts (5) - translation keys

## Key Implementation Details

### Windows Binary Resolution
```typescript
// On Windows, npm installs as .cmd wrappers:
// C:\Users\...\node_modules\.bin\codebuddy.cmd

// resolveScriptFromCmd() extracts actual JS:
// C:\Users\...\node_modules\@tencent-ai\codebuddy\dist\codebuddy-headless.js

// This is needed because SDK can't spawn .cmd wrappers directly
```

### MCP Server Registration
Both runtimes register same MCP servers:
- memory-search
- notification-center
- widget-guidelines
- media-handler
- cli-tools
- dashboard

### Error Handling
CodeBuddy-specific error messages are classified in `error-classifier.ts`:
- Network errors
- Authentication errors
- Model errors
- Process errors

## Merging Considerations

When pulling upstream changes:

1. **Watch these files for conflicts:**
   - src/app/api/chat/route.ts (dispatch point)
   - src/lib/provider-resolver.ts (toClaudeCodeEnv changes)
   - src/lib/platform.ts (binary search logic)

2. **Merge strategy:**
   - Upstream changes to Claude path: keep both
   - Upstream changes to providers: update toCodeBuddyEnv() if roles change
   - Conflict in dispatch: use ternary (both paths needed)

3. **Testing after merge:**
   - `npm run test` for types
   - `npm run test:smoke` for basic chat flow
   - Test both `cli_runtime` settings

## Debugging

### Runtime Selection
```typescript
import { getCliRuntime, setCliRuntime } from '@/lib/cli-runtime';
const runtime = getCliRuntime();
console.log('Current runtime:', runtime);
setCliRuntime('codebuddy'); // Switch to CodeBuddy
```

### Session ID Extraction
```typescript
import { getRuntimeSessionId, setRuntimeSessionId } from '@/lib/cli-runtime';
const ids = getRuntimeSessionId(sdkSessionId, 'codebuddy');
console.log('CodeBuddy session:', ids);
```

### Binary Location
```typescript
import { findCodeBuddyBinary } from '@/lib/platform';
const path = findCodeBuddyBinary();
console.log('CodeBuddy binary at:', path);
```

### Provider Env Vars
```typescript
import { toCodeBuddyEnv } from '@/lib/provider-resolver';
const env = toCodeBuddyEnv(process.env, resolved);
console.log('CodeBuddy env:', {
  CODEBUDDY_MODEL: env.CODEBUDDY_MODEL,
  CODEBUDDY_SMALL_FAST_MODEL: env.CODEBUDDY_SMALL_FAST_MODEL,
});
```

## Related Files

- **Provider System**: src/lib/provider-resolver.ts, src/lib/provider-catalog.ts
- **Database**: src/lib/db.ts (settings table)
- **Error Handling**: src/lib/error-classifier.ts
- **MCP Servers**: src/lib/mcp-loader.ts
- **Session Management**: src/lib/conversation-registry.ts

---

**Last Updated**: 2026-04-10  
**Integration Status**: Stable, tested  
**Maintenance Owner**: CodeBuddy integration team
