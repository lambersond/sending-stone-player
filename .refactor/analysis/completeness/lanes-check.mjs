// No file with two Phase 3 lanes: expand each row's path_after (braces, `dir/*.ts(x)` globs) and
// find (a) one path claimed by rows of different lanes, (b) a glob directory owned by one lane that
// holds another lane's file, (c) a new file inside a folder whose other files belong to another lane.
import { owners } from './lib.mjs';

const rows = owners();
const phase3 = (r) => /\b3\b/.test(r.phases) || r.phases === '-' || r.phases === '';

function expand(p) {
  const m = p.match(/^(.*?)\{([^{}]*)\}(.*)$/);
  if (!m) return [p];
  return m[2].split(',').flatMap((alt) => expand(`${m[1]}${alt}${m[3]}`));
}

const claims = []; // {path, glob, row}
for (const r of rows) {
  if (r.after.startsWith('(') || r.after === '-') continue;
  for (const p of expand(r.after.trim())) {
    const glob = /\*/.test(p);
    claims.push({ path: glob ? p.replace(/\/\*.*$/, '/') : p, glob, row: r });
  }
}

const out = [];
const byPath = new Map();
for (const c of claims.filter((c) => !c.glob)) {
  if (!byPath.has(c.path)) byPath.set(c.path, []);
  byPath.get(c.path).push(c.row);
}
out.push('## (a) one path, several rows');
for (const [p, rs] of byPath) {
  if (rs.length < 2) continue;
  const lanes = new Set(rs.map((r) => r.lane));
  out.push(`- ${p}: ${rs.map((r) => `owners.tsv:${r.n} ${r.path_at_base} [${r.lane}; ${r.phases}]`).join(' | ')}${lanes.size > 1 ? ' **two lanes**' : ''}`);
}

out.push('\n## (b) a glob directory of one lane holding another lane\'s file (Phase 3 rows)');
for (const g of claims.filter((c) => c.glob)) {
  for (const c of claims.filter((x) => !x.glob && x.path.startsWith(g.path))) {
    if (c.row.lane !== g.row.lane && phase3(c.row))
      out.push(`- ${g.path}* (owners.tsv:${g.row.n}, ${g.row.lane}) holds ${c.path} (owners.tsv:${c.row.n}, ${c.row.lane}, from ${c.row.path_at_base})`);
  }
}

// (c) folders whose files after the moves have several lanes (a folder-per-component split by lanes).
const byDir = new Map();
for (const c of claims.filter((c) => !c.glob && phase3(c.row))) {
  if (!c.path.startsWith('src/features/') && !c.path.startsWith('src/components/')) continue;
  const dir = c.path.replace(/\/[^/]*$/, '');
  if (!byDir.has(dir)) byDir.set(dir, new Map());
  const lanes = byDir.get(dir);
  if (!lanes.has(c.row.lane)) lanes.set(c.row.lane, []);
  lanes.get(c.row.lane).push(c.path.replace(/^.*\//, ''));
}
out.push('\n## (c) component folders whose Phase 3 files have several lanes');
for (const [d, lanes] of [...byDir].sort()) {
  if (lanes.size < 2) continue;
  out.push(`- ${d}: ${[...lanes].map(([l, fs]) => `${l} {${fs.join(', ')}}`).join(' ; ')}`);
}
console.log(out.join('\n'));
