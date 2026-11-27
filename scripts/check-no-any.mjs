// Zero-any guard: fails if any .ts or .tsx file under src uses an explicit `any` type.
// Mirrors src/test/no-any.test.ts so CI and local runs can check it without Vitest.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PATTERN = /(:\s*any\b|\bas\s+any\b|<any>|any\[\])/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

const checked = files(join(process.cwd(), 'src')).filter((f) => !f.endsWith('no-any.test.ts'));
const offenders = checked.filter((f) => PATTERN.test(readFileSync(f, 'utf8')));

if (offenders.length > 0) {
  console.error(`Explicit any found in ${offenders.length} file(s):\n${offenders.join('\n')}`);
  process.exit(1);
}
console.log(`Zero-any check passed: ${checked.length} .ts/.tsx files in src, 0 explicit any.`);
