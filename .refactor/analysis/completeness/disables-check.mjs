// Every eslint-disable directive in the tree (src/** and root files) has an owners.tsv row whose
// disables column counts it under its rule with an item or `stays`/`reason`; counts agree.
import { execSync } from 'node:child_process';
import { owners, read, APP } from './lib.mjs';

const files = execSync("git grep -l -E 'eslint-disable' -- . ':!.refactor' ':!CLAUDE.md' ':!AGENTS.md' ':!*.md'", { cwd: APP, encoding: 'utf8' })
  .split('\n').filter(Boolean);

const actual = new Map(); // file -> Map(rule -> [{line, scope, reason}])
let total = 0;
for (const f of files) {
  const lines = read(`${APP}/${f}`).split('\n');
  lines.forEach((text, i) => {
    const m = text.match(/(?:\/\/|\/\*)\s*eslint-disable(-next-line|-line)?\s+([^*]*?)(?:\s*\*\/|$)/);
    if (!m) return;
    const [rules, reason] = m[2].split(/\s+--\s+/);
    const scope = m[1] ? 'line' : /^\s*\/\*/.test(text) && !text.includes('*/') ? 'file?' : 'file/range';
    for (const rule of rules.split(',').map((s) => s.trim()).filter(Boolean)) {
      total++;
      if (!actual.has(f)) actual.set(f, new Map());
      const byRule = actual.get(f);
      if (!byRule.has(rule)) byRule.set(rule, []);
      byRule.get(rule).push({ line: i + 1, scope, reason: reason?.trim() });
    }
  });
}

const short = (rule) => rule.replace(/^unicorn\//, '').replace(/^@typescript-eslint\//, '');
const rows = new Map(owners().map((r) => [r.path_at_base, r]));
const out = [];
let rowsMissing = 0, countOff = 0, noItem = 0;
const stays = [];
for (const [f, byRule] of [...actual].sort()) {
  const r = rows.get(f);
  if (!r) { rowsMissing++; out.push(`- ${f}: **no owners.tsv row** (${[...byRule].map(([k, v]) => `${k}×${v.length}`).join(', ')})`); continue; }
  const tokens = new Map([...r.disables.matchAll(/([@\w/.-]+)\(([^)]*)\):(\d+)/g)].map((m) => [m[1], { item: m[2], n: Number(m[3]) }]));
  for (const [rule, hits] of byRule) {
    const t = tokens.get(short(rule)) ?? tokens.get(rule);
    if (!t) { noItem++; out.push(`- owners.tsv:${r.n} ${f}: ${rule} ×${hits.length} (lines ${hits.map((h) => h.line).join(', ')}) **not in the disables column** [${r.disables || 'empty'}]`); continue; }
    if (t.n !== hits.length) { countOff++; out.push(`- owners.tsv:${r.n} ${f}: ${rule} column says ${t.n}, source has ${hits.length} (lines ${hits.map((h) => h.line).join(', ')})`); }
    if (/stays|reason|line-level/.test(t.item)) stays.push(`${f}: ${rule} ×${hits.length} (${t.item}) lines ${hits.map((h) => `${h.line}${h.reason ? '' : ' NO REASON'}`).join(', ')}`);
  }
}
console.log([
  `## directives in the tree: ${total} entries in ${actual.size} files`,
  `## files with no row: ${rowsMissing}; rules missing from a row's column: ${noItem}; counts that differ: ${countOff}`,
  ...out,
  '',
  `## kept (stays / reason / line-level): ${stays.length} file-rule pairs`,
  ...stays.map((s) => `- ${s}`),
].join('\n'));
