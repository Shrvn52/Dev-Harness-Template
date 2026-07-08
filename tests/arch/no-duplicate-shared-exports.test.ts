/**
 * Architecture: forbid re-declaring a name already exported from `shared/`.
 *
 * Why: a name shared across the boundary must have ONE source. Two definitions
 * (e.g. a `STATUS_COLORS` in shared/ and another in frontend/) drift silently.
 * Re-exports (`export { X } from '@shared/...'`) are allowed — only fresh
 * declarations of the same identifier are flagged.
 *
 * Detection is AST-based (TS compiler API), not line-regex: it sees inline
 * exported declarations (incl. `async`/`abstract`/multi-line/destructured),
 * `export { localName }` lists, and `export default function Name`. Known,
 * accepted blind spots: `export * from` (unenumerable without module
 * resolution) and names introduced by module augmentation.
 *
 * Archetype: SSOT-boundary guard. Copy this and re-point the roots for any
 * "single source of truth" you want to enforce.
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { walkTs } from './_helpers/walk-ts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

/** All names bound by a (possibly destructured) binding pattern. */
function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  const out: string[] = [];
  for (const el of name.elements) {
    if (ts.isBindingElement(el)) out.push(...bindingNames(el.name));
  }
  return out;
}

/**
 * Names this file EXPORTS from a fresh local declaration. Deliberately
 * excludes `export ... from '...'` (re-exports — the sanctioned pattern) and
 * anonymous `export default` expressions (no name to collide with).
 */
function extractExports(file: string): Set<string> {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const names = new Set<string>();
  const exported = (stmt: ts.Statement): boolean =>
    ts.canHaveModifiers(stmt) &&
    (ts.getModifiers(stmt) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt) && exported(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        for (const n of bindingNames(d.name)) names.add(n);
      }
    } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && exported(stmt)) {
      // Covers `export default function Name` too — the name is a live local
      // binding regardless of the default modifier.
      if (stmt.name) names.add(stmt.name.text);
    } else if (
      (ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isEnumDeclaration(stmt)) &&
      exported(stmt)
    ) {
      names.add(stmt.name.text);
    } else if (
      ts.isExportDeclaration(stmt) &&
      !stmt.moduleSpecifier && // WITH a specifier = re-export = allowed
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      // `export { local }` / `export { local as Public }` — the name that
      // crosses the boundary is the EXPORTED one (el.name).
      for (const el of stmt.exportClause.elements) names.add(el.name.text);
    }
  }
  return names;
}

describe('Architecture — duplicate exports across the shared boundary', () => {
  const sharedFiles = walkTs(join(REPO_ROOT, 'shared'));
  const sharedNames = new Map<string, string>();
  for (const f of sharedFiles) {
    for (const n of extractExports(f)) sharedNames.set(n, f.replace(REPO_ROOT + '/', ''));
  }

  it('shared/ actually exports something (sanity floor — no vacuous pass)', () => {
    expect(sharedNames.size).toBeGreaterThan(0);
  });

  it('no name exported from shared/ is re-declared in backend/src or frontend/src', () => {
    const appFiles = [
      ...walkTs(join(REPO_ROOT, 'backend', 'src')),
      ...walkTs(join(REPO_ROOT, 'frontend', 'src')),
    ];

    const violations: string[] = [];
    for (const f of appFiles) {
      for (const name of extractExports(f)) {
        if (sharedNames.has(name)) {
          violations.push(
            `${f.replace(REPO_ROOT + '/', '')} re-declares '${name}' (already exported from ${sharedNames.get(name)})`,
          );
        }
      }
    }

    expect(
      violations,
      `Duplicate exports across the shared boundary:\n  ${violations.join('\n  ')}\n\nFix: import from shared/ instead of redeclaring.`,
    ).toEqual([]);
  });
});
