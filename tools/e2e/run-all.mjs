// Runs every browser check in this folder against the dev server (npm run dev must be running).
//   npm run test:e2e            all checks
//   npm run test:e2e -- nasa    only files whose name contains "nasa"
//   E2E_H=665 npm run test:e2e  run everything in a laptop-sized window (the app zooms to fit)
// A check fails when it prints a line starting with ✗ or reports page/console errors.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const only = process.argv[2];
const files = readdirSync(here)
  .filter((f) => /\.(mjs|cjs)$/.test(f) && f !== 'run-all.mjs' && !f.startsWith('_')) // _name = helper, not a check
  .filter((f) => !only || f.includes(only));
const res = await fetch('http://localhost:5173/').catch(() => null);
if (!res?.ok) {
  console.error('Start the dev server first: npm run dev');
  process.exit(1);
}
const failed = [];
for (const f of files) {
  console.log(`\n=== ${f}`);
  const r = spawnSync(process.execPath, [f], { cwd: here, encoding: 'utf8', timeout: 6 * 60_000 });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  if (r.status !== 0 || /^✗/m.test(out) || /^errors?:|\[error\]/m.test(out)) failed.push(f);
}
console.log(failed.length ? `\n✗ failed: ${failed.join(', ')}` : `\n✓ all ${files.length} checks passed`);
process.exit(failed.length ? 1 : 0);
