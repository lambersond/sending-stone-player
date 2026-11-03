// New files the contract's items name (a path or basename with an extension, in §1 and §3) that no
// owners.tsv row covers, after brace expansion and `dir/*` globs. round.md:7 says every file the plan
// edits, moves or creates is a row.
import { owners, round, exists } from './lib.mjs';

const md = round();
const s1 = md.slice(md.indexOf('## §1 Target shape'), md.indexOf('## §2 Order of work'));
const expand = (p) => {
  const m = p.match(/^(.*?)\{([^{}]*)\}(.*)$/);
  return m ? m[2].split(',').flatMap((a) => expand(`${m[1]}${a}${m[3]}`)) : [p];
};
const rows = owners();
const paths = [], dirs = [];
for (const r of rows) for (const raw of [r.path_at_base, r.after]) for (const p of expand(raw)) {
  if (p.includes('*')) dirs.push({ dir: p.replace(/\/[^/]*\*.*$/, '/'), r });
  else paths.push({ p, r });
}
const basenames = new Set(paths.map(({ p }) => p.replace(/^.*\//, '')));
const covered = (name) => basenames.has(name.replace(/^.*\//, '')) || paths.some(({ p }) => p.endsWith(name));

// Items with their text.
const items = [...s1.matchAll(/\*\*(R1\.\d+\.\d+)[^]*?(?=\n\*\*R1\.|\n###|\n\| R1\.9\.2|$)/g)];
const out = [];
for (const m of items) {
  const id = m[1];
  const names = new Set([...m[0].matchAll(/((?:[\w-]+\/)*[\w-]+(?:\.[\w-]+)*\.(?:tsx|ts))(?=[\s:,;)`.]|$)/g)].map((x) => x[1]));
  const miss = [...names].filter((n) => !covered(n) && !exists(n) && !exists(`src/${n}`));
  // A name inside a folder some glob row owns counts as covered when the glob's folder name appears.
  const reallyMiss = miss.filter((n) => !dirs.some(({ dir }) => n.includes('/') && `src/${n}`.startsWith(dir)));
  if (reallyMiss.length) out.push(`- ${id}: ${reallyMiss.join(', ')}`);
}
console.log(`## new files named in §1 items with no owners.tsv row (after braces and globs)\n${out.join('\n')}`);
