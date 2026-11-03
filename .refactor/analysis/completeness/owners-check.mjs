// owners.tsv integrity: base paths exist, every tracked src file has a row, no file has two lanes in
// Phase 3 (by base path or by path_after), every `-` row is named by an item.
import { owners, tracked, exists, round } from './lib.mjs';

const rows = owners();
const files = tracked();
const md = round();
const out = [];
const say = (s) => out.push(s);

// 1. path_at_base rows that are real paths (not '-', not globs) must exist at HEAD.
const missing = rows.filter(
  (r) => r.path_at_base !== '-' && !r.path_at_base.includes('*') && !files.has(r.path_at_base) && !exists(r.path_at_base),
);
say(`## base paths that do not exist at HEAD: ${missing.length}`);
for (const r of missing) say(`- owners.tsv:${r.n} ${r.path_at_base} (lane ${r.lane})`);

// 2. tracked src/ files (and root config files the plan edits) with no row.
const byBase = new Map();
for (const r of rows) {
  if (!byBase.has(r.path_at_base)) byBase.set(r.path_at_base, []);
  byBase.get(r.path_at_base).push(r);
}
const srcFiles = [...files].filter((f) => f.startsWith('src/'));
const noRow = srcFiles.filter((f) => !byBase.has(f));
say(`\n## tracked src files with no owners.tsv row: ${noRow.length} of ${srcFiles.length}`);
for (const f of noRow) say(`- ${f}`);

// 3. duplicate base rows, and base rows with more than one Phase 3 lane.
const dupBase = [...byBase].filter(([p, rs]) => p !== '-' && rs.length > 1);
say(`\n## base paths with more than one row: ${dupBase.length}`);
for (const [p, rs] of dupBase) say(`- ${p}: ${rs.map((r) => `${r.n}:${r.lane}`).join(', ')}`);

// 4. path_after collisions (two rows ending at one file) with different lanes.
const byAfter = new Map();
for (const r of rows) {
  if (r.after === '-' || r.after.startsWith('(') || r.after.startsWith('-')) continue;
  for (const p of r.after.split(/\s*[,;]\s*/)) {
    if (!byAfter.has(p)) byAfter.set(p, []);
    byAfter.get(p).push(r);
  }
}
const collide = [...byAfter].filter(([, rs]) => rs.length > 1);
say(`\n## path_after shared by several rows: ${collide.length}`);
for (const [p, rs] of collide) {
  const lanes = new Set(rs.map((r) => r.lane));
  say(`- ${p}: ${rs.map((r) => `${r.n}:${r.path_at_base}:${r.lane}:ph ${r.phases}`).join(' | ')}${lanes.size > 1 ? '  **LANES DIFFER**' : ''}`);
}

// 5. '-' rows (new files): every item they cite exists in round.md.
const ids = new Set(md.match(/R\d+\.\d+(\.\d+)?/g));
const newRows = rows.filter((r) => r.path_at_base === '-');
const badItem = [];
for (const r of rows) {
  for (const id of r.items.match(/R\d+\.\d+(\.\d+)?/g) ?? []) if (!ids.has(id)) badItem.push(`${r.n}:${r.after}:${id}`);
}
say(`\n## '-' rows: ${newRows.length}; item ids cited by any row but absent from round.md: ${badItem.length}`);
for (const b of badItem) say(`- ${b}`);

// 6. lanes used.
const lanes = new Map();
for (const r of rows) lanes.set(r.lane, (lanes.get(r.lane) ?? 0) + 1);
say(`\n## rows per lane`);
for (const [l, n] of [...lanes].sort()) say(`- ${l}: ${n}`);

console.log(out.join('\n'));
