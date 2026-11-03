// Every file metrics-base.md lists as breaking rule (a), rule (b) (types in .tsx; exported types in a
// .ts outside types.ts and src/types) and every function over 15 has an owners.tsv row whose items
// include one that fixes it; cc tokens point at an item whose text names the function.
import { owners, read, R, round, itemText } from './lib.mjs';

const metrics = read(`${R}/analysis/metrics-base.md`);
const md = round();
const rows = owners();
const byBase = new Map(rows.map((r) => [r.path_at_base, r]));
const part = (from, to) => metrics.slice(metrics.indexOf(from), metrics.indexOf(to));
const tableFiles = (text) => [...text.matchAll(/^\| (src\/[^ |]+|[a-z][^ |]*\.(?:ts|tsx|mjs)) \|/gm)].map((m) => m[1]);

// Items that move exports, types or components (the fixes of rules (a) and (b)).
const ONE_EXPORT = /R1\.9\.1\b|R1\.1\.(6|7|10|12|13|14|15|17|18)\b|R1\.2\.(1|8|9|10|11)\b|R1\.5\.(2|3|6|7|8|15|16|17|18|19|20|21|22)\b|R1\.3\.12\b|R1\.4\.(9|10)\b|R1\.1\.(4|5)\b/;
const TYPES = /R1\.9\.1\b|R1\.1\.(4|5|6|7|11|12|13|15|17|18)\b|R1\.2\.(1|8|11)\b|R1\.3\.12\b|R1\.4\.(8|9|10)\b|R1\.5\.(2|15|16|17|18|19|20|21|22)\b|R1\.1\.10\b/;

const out = [];
const check = (title, files, re, token) => {
  const bad = [];
  for (const f of files) {
    const r = byBase.get(f);
    if (!r) { bad.push(`- ${f}: **no owners.tsv row**`); continue; }
    const tok = token && !new RegExp(`\\b${token}:`).test(r.breaks) ? ` (no \`${token}:\` in breaks)` : '';
    if (!re.test(r.items) || tok) bad.push(`- owners.tsv:${r.n} ${f} [${r.lane}] items: ${r.items}${tok}`);
  }
  out.push(`## ${title}: ${files.length} files; without a fixing item: ${bad.length}`, ...bad, '');
};

const aFiles = tableFiles(part('## 2. .tsx files breaking rule (a)', '## 3. Named types'));
check('rule (a) files (metrics §2)', aFiles, ONE_EXPORT, 'a');

const tsxTypes = tableFiles(part('### Named types in .tsx files', '### Exported named types in .ts'))
  .filter((f) => !/\.test\.tsx$/.test(f));
check('named types in product .tsx (metrics §3)', tsxTypes, TYPES, 'types');

const tsTypes = [...part('### Exported named types in .ts files outside types.ts', '## 4. Functions')
  .matchAll(/^\| ([^ |]+) \| \d+ \|  \|$/gm)].map((m) => m[1]);
check('exported types in .ts outside types.ts and src/types (metrics §3)', tsTypes, TYPES, 'types');

// Complexity: each metrics row has a cc:<line>=<score>→<item> token on its file's row, and the item's
// text names the function (or the row says held).
const cc = [...part('## 4. Functions over cognitive complexity 15', '## 5. Import cycles')
  .matchAll(/^\| (\d+) \| ([^:]+):(\d+) \| (.+) \|$/gm)].map((m) => ({ score: m[1], file: m[2], line: m[3], fn: m[4] }));
const ccBad = [];
const perLane = {};
for (const c of cc) {
  const r = byBase.get(c.file);
  const tok = r?.breaks.match(new RegExp(`cc:${c.line}=${c.score}→([^ ]+)`));
  if (!tok) { ccBad.push(`- ${c.file}:${c.line} ${c.fn} (${c.score}): no cc token`); continue; }
  perLane[r.lane] = (perLane[r.lane] ?? 0) + 1;
  const item = tok[1];
  if (item === 'held') continue;
  const text = itemText(md, item) ?? '';
  const name = c.fn.replace(/ callback.*| in .*|^\(anonymous\) in /g, '').replace(/^\./, '');
  const mentions = text.includes(name) || text.includes(`:${c.line}`) || (name === 'useCallback' && text.includes(`:${c.line}`));
  if (!text) ccBad.push(`- ${c.file}:${c.line} ${c.fn}: item ${item} not found in round.md`);
  else if (!mentions) ccBad.push(`- ${c.file}:${c.line} ${c.fn} (${c.score}) → ${item} [${r.lane}]: the item's text names neither \`${name}\` nor :${c.line}`);
}
out.push(`## complexity > 15 (metrics §4): ${cc.length}; problems: ${ccBad.length}`, ...ccBad, '');
out.push(`per lane: ${JSON.stringify(perLane)}`);
console.log(out.join('\n'));
