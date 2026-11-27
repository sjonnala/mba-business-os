import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('strict typing', () => {
  it('uses no explicit any in src', () => {
    const offenders = files(join(process.cwd(), 'src'))
      .filter((f) => !f.endsWith('no-any.test.ts'))
      .filter((f) => /(:\s*any\b|\bas\s+any\b|<any>|any\[\])/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
