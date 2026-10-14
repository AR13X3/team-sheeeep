// Checks the docs the team edits by hand (runs in CI on every pull request).
//   npm run check:docs
// 1. The tracker data in docs/tracker.html is valid JSON with the expected shape.
// 2. Relative links in the markdown docs point to files that exist.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const problems = [];

// ---------- tracker ----------
const html = readFileSync(join(root, 'docs/tracker.html'), 'utf8');
const m = html.match(/<script type="application\/json" id="tracker-data">\n([\s\S]*?)\n<\/script>/);
if (!m) problems.push('docs/tracker.html: <script id="tracker-data"> not found');
else {
  let d;
  try {
    d = JSON.parse(m[1]);
  } catch (e) {
    problems.push(`docs/tracker.html: tracker JSON is not valid: ${e.message}`);
  }
  if (d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.updated)) problems.push('docs/tracker.html: "updated" must be a date like 2026-10-14');
    for (const key of ['next', 'discuss', 'milestones', 'decisions', 'issues', 'files', 'checks', 'sessions']) {
      if (!Array.isArray(d[key])) problems.push(`docs/tracker.html: "${key}" must be a list`);
    }
    const statuses = ['todo', 'doing', 'blocked', 'done', 'idea'];
    (d.next || []).forEach((n, i) => {
      if (!n.title) problems.push(`docs/tracker.html: next[${i}] has no title`);
      if (!statuses.includes(n.status)) problems.push(`docs/tracker.html: next[${i}] "${n.title}" has status "${n.status}" (use ${statuses.join(', ')})`);
      if (!Array.isArray(n.where)) problems.push(`docs/tracker.html: next[${i}] "${n.title}" needs a "where" list (can be empty)`);
    });
    (d.discuss || []).forEach((q, i) => q.q || problems.push(`docs/tracker.html: discuss[${i}] has no question ("q")`));
    (d.decisions || []).forEach((x, i) => (x.what && x.why) || problems.push(`docs/tracker.html: decisions[${i}] needs "what" and "why"`));
  }
}

// ---------- links in markdown ----------
const docs = ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md', 'docs/how-it-works.md', '.github/pull_request_template.md'];
for (const doc of docs) {
  const text = readFileSync(join(root, doc), 'utf8').replace(/```[\s\S]*?```/g, ''); // skip code blocks
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURI(target.split('#')[0]);
    if (!existsSync(join(root, dirname(doc), path))) problems.push(`${doc}: link to "${target}" points to a missing file`);
  }
}

if (problems.length) {
  for (const p of problems) console.log(`✗ ${p}`);
  process.exit(1);
}
console.log(`✓ tracker JSON valid; links in ${docs.length} docs all resolve`);
