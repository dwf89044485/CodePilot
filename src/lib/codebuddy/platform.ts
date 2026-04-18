/**
 * CodeBuddy CLI binary discovery and platform utilities.
 *
 * Handles locating, classifying, and caching CodeBuddy CLI binaries
 * (`codebuddy` or `cbc`) across macOS, Linux, and Windows.
 * Mirrors the Claude CLI discovery patterns from the parent platform module.
 */

import { execFileSync, execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

import { isWindows, getExpandedPath } from '../platform';

const execFileAsync = promisify(execFile);

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Whether the given binary path requires shell execution.
 * On Windows, .cmd/.bat files cannot be executed directly by execFileSync.
 */
function needsShell(binPath: string): boolean {
  return isWindows && /\.(cmd|bat)$/i.test(binPath);
}

// ── Types ───────────────────────────────────────────────────────────

export type CodeBuddyInstallType = 'native' | 'npm' | 'bun' | 'unknown';

export interface CodeBuddyInstallInfo {
  path: string;
  version: string | null;
  type: CodeBuddyInstallType;
}

// ── Path classification ─────────────────────────────────────────────

export function classifyCodeBuddyPath(binPath: string): CodeBuddyInstallType {
  const normalized = binPath.replace(/\\/g, '/');
  if (normalized.includes('/.local/bin/') || normalized.includes('/.codebuddy/bin/')) return 'native';
  if (normalized.includes('/.bun/bin/') || normalized.includes('/.bun/install/')) return 'bun';
  if (normalized.includes('/npm') || normalized.includes('npm-global') || normalized.includes('node_modules')) return 'npm';
  return 'unknown';
}

// ── Candidate paths ─────────────────────────────────────────────────

/**
 * Candidate paths where CodeBuddy CLI (`codebuddy` or `cbc`) might be installed.
 */
export function getCodeBuddyCandidatePaths(): string[] {
  const home = os.homedir();
  const names = ['codebuddy', 'cbc'];
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const exts = ['.cmd', '.exe', '.bat', ''];
    const baseDirs = [
      path.join(home, '.local', 'bin'),
      path.join(home, '.codebuddy', 'bin'),
      path.join(home, '.bun', 'bin'),
      path.join(appData, 'npm'),
      path.join(localAppData, 'npm'),
      path.join(home, '.npm-global', 'bin'),
    ];
    const candidates: string[] = [];
    for (const dir of baseDirs) {
      for (const name of names) {
        for (const ext of exts) {
          candidates.push(path.join(dir, name + ext));
        }
      }
    }
    return candidates;
  }
  const candidates: string[] = [];
  const dirs = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.codebuddy', 'bin'),
    path.join(home, '.bun', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.npm-global', 'bin'),
  ];
  for (const dir of dirs) {
    for (const name of names) {
      candidates.push(path.join(dir, name));
    }
  }
  return candidates;
}

// ── TTL cache ───────────────────────────────────────────────────────

const BINARY_CACHE_TTL = 60_000; // 60 seconds

let _cachedCodeBuddyPath: string | undefined | null = null;
let _cachedCodeBuddyTimestamp = 0;

/**
 * Invalidate the cached CodeBuddy binary path.
 * Must be called after a new installation so that subsequent calls
 * pick up the freshly-installed binary.
 */
export function invalidateCodeBuddyPathCache(): void {
  _cachedCodeBuddyPath = null;
  _cachedCodeBuddyTimestamp = 0;
}

// ── Binary discovery ────────────────────────────────────────────────

/**
 * Find and validate the CodeBuddy CLI binary.
 * Both positive and negative results are cached for 60s to avoid repeated
 * slow scans on machines without CodeBuddy installed.
 */
export function findCodeBuddyBinary(): string | undefined {
  const now = Date.now();
  if (_cachedCodeBuddyPath !== null && now - _cachedCodeBuddyTimestamp < BINARY_CACHE_TTL) {
    return _cachedCodeBuddyPath || undefined;
  }

  const found = _findCodeBuddyBinaryUncached();
  _cachedCodeBuddyPath = found ?? '';  // empty string = negative cache
  _cachedCodeBuddyTimestamp = now;
  return found;
}

function _findCodeBuddyBinaryUncached(): string | undefined {
  // Fast path: use `which` first (single subprocess, fast failure)
  for (const name of ['codebuddy', 'cbc']) {
    try {
      const cmd = isWindows ? 'where' : '/usr/bin/which';
      const result = execFileSync(cmd, [name], {
        timeout: 2000,
        stdio: 'pipe',
        env: { ...process.env, PATH: getExpandedPath() },
        shell: isWindows,
      });
      const candidate = result.toString().trim().split(/\r?\n/)[0]?.trim();
      if (candidate && fs.existsSync(candidate)) {
        try {
          execFileSync(candidate, ['--version'], {
            timeout: 3000,
            stdio: 'pipe',
            shell: needsShell(candidate),
          });
          return candidate;
        } catch {
          // found but --version failed, continue
        }
      }
    } catch {
      // which/where failed, continue
    }
  }

  // Slow path: check known candidate paths (only if file exists on disk)
  for (const p of getCodeBuddyCandidatePaths()) {
    try {
      if (!fs.existsSync(p)) continue;  // Skip missing files — avoids 3s timeout
      execFileSync(p, ['--version'], {
        timeout: 3000,
        stdio: 'pipe',
        shell: needsShell(p),
      });
      return p;
    } catch {
      // not found, try next
    }
  }

  return undefined;
}

// ── Version query ───────────────────────────────────────────────────

/**
 * Execute codebuddy --version and return the version string.
 */
export async function getCodeBuddyVersion(binPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(binPath, ['--version'], {
      timeout: 5000,
      env: { ...process.env, PATH: getExpandedPath() },
      shell: needsShell(binPath),
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// ── Multi-binary scan ───────────────────────────────────────────────

/**
 * Detect ALL CodeBuddy CLI installations on the system.
 */
export function findAllCodeBuddyBinaries(): CodeBuddyInstallInfo[] {
  const results: CodeBuddyInstallInfo[] = [];
  const seenReal = new Set<string>();

  function tryAdd(p: string) {
    try {
      let realPath: string;
      try { realPath = fs.realpathSync(p); } catch { realPath = p; }
      if (seenReal.has(realPath)) return;

      let winDirKey: string | undefined;
      if (isWindows) {
        winDirKey = path.join(path.dirname(realPath), path.basename(realPath).replace(/\.(exe|cmd|bat)$/i, '')).toLowerCase();
        if (seenReal.has(winDirKey)) return;
      }

      const out = execFileSync(p, ['--version'], {
        timeout: 3000,
        stdio: 'pipe',
        shell: needsShell(p),
        encoding: 'utf-8',
      });
      seenReal.add(realPath);
      if (winDirKey) seenReal.add(winDirKey);
      results.push({ path: p, version: out.trim() || null, type: classifyCodeBuddyPath(p) });
    } catch {
      // not found at this path
    }
  }

  for (const p of getCodeBuddyCandidatePaths()) {
    tryAdd(p);
  }

  // Scan PATH for codebuddy / cbc
  for (const name of ['codebuddy', 'cbc']) {
    try {
      const cmd = isWindows ? 'where' : '/usr/bin/which';
      const args = isWindows ? [name] : ['-a', name];
      const result = execFileSync(cmd, args, {
        timeout: 3000,
        stdio: 'pipe',
        env: { ...process.env, PATH: getExpandedPath() },
        shell: isWindows,
        encoding: 'utf-8',
      });
      for (const line of result.trim().split(/\r?\n/)) {
        const candidate = line.trim();
        if (candidate) tryAdd(candidate);
      }
    } catch {
      // which/where failed
    }
  }

  return results;
}
