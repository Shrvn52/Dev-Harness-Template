/**
 * Architecture: the env-var surface has one SSOT (backend/src/config.ts) and
 * two deliberate mirrors — the CLAUDE.md "Environment variables" table and
 * .env.example. Mirrors drift; this test makes that drift a CI failure instead
 * of a docs-audit finding. Every `process.env.X` read in config.ts must appear
 * in both mirrors, and neither mirror may list a variable config.ts no longer
 * reads.
 *
 * Archetype: doc-mirror equality. The general rule is "docs point, they don't
 * mirror" — but when a mirror genuinely earns its keep (an env table an
 * operator scans, a copyable .env), pin it to code with a test like this one.
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { stripComments } from './_helpers/strip-comments.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

function configVars(): Set<string> {
  const src = stripComments(readFileSync(join(REPO_ROOT, 'backend/src/config.ts'), 'utf8'));
  return new Set([...src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]));
}

function envExampleVars(): Set<string> {
  const src = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
  // Uncommented assignments only — commented lines are prose/alternatives.
  return new Set(
    src
      .split('\n')
      .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
      .filter((v): v is string => v !== undefined),
  );
}

function claudeMdTableVars(): Set<string> {
  const src = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  // Env-table rows look like: | `PORT` | `8137` | … |
  return new Set(
    src
      .split('\n')
      .map((l) => /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/.exec(l)?.[1])
      .filter((v): v is string => v !== undefined),
  );
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

describe('Architecture — env-var mirrors match config.ts', () => {
  const fromConfig = configVars();

  it('config.ts reads at least one env var (sanity floor — no vacuous pass)', () => {
    expect(fromConfig.size).toBeGreaterThan(0);
  });

  it('.env.example mirrors config.ts exactly', () => {
    const mirror = envExampleVars();
    expect(
      diff(fromConfig, mirror),
      'config.ts reads vars missing from .env.example — add them with defaults + a comment',
    ).toEqual([]);
    expect(
      diff(mirror, fromConfig),
      '.env.example lists vars config.ts never reads — delete the dead rows',
    ).toEqual([]);
  });

  it("CLAUDE.md's env table mirrors config.ts exactly", () => {
    const mirror = claudeMdTableVars();
    expect(
      diff(fromConfig, mirror),
      'config.ts reads vars missing from the CLAUDE.md env table — add rows',
    ).toEqual([]);
    expect(
      diff(mirror, fromConfig),
      'the CLAUDE.md env table lists vars config.ts never reads — delete the dead rows',
    ).toEqual([]);
  });
});
