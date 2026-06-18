// Recursive .ts/.tsx file walker for architecture tests.
// Skips node_modules, dist, __tests__, *.test.{ts,tsx}, *.d.ts.

import * as fs from 'node:fs';
import * as path from 'node:path';

export function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '__tests__') continue;
      walkTs(full, out);
    } else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx'))) {
      if (ent.name.endsWith('.test.ts') || ent.name.endsWith('.test.tsx')) continue;
      if (ent.name.endsWith('.d.ts')) continue;
      out.push(full);
    }
  }
  return out;
}
