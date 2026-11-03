// owners.tsv against a tree (round.md §2.2.3: after commit 8, before the Phase 3 worktrees).
// Not product code; deleted with .refactor/ in commit 28.
//
//   node .refactor/analysis/owners-check/check.mjs [<checkout> [<rev>]]   (defaults: APP, HEAD)
//   OWNERS=<draft owners.tsv> node …/check.mjs                          (check a draft instead)
//
// Reads <checkout>/.refactor/{owners.tsv,round.md,tools/moves.tsv} and the tree of <rev> (git
// ls-tree, so the working tree's state does not matter). Checks:
//   A. every path_after Phase 2 (or an earlier phase) should have produced exists, a moved file's
//      base path is gone, a deleted file is gone, moves.tsv put each file where its row says, and a
//      new file (`-` row) whose phases start at 3 or later does not exist yet;
//   A2. every name owners.tsv's "moved in 2b" / "receives in 2b" notes move is at that home
//      (moves.tsv's `name` rows, or the whole file moved there);
//   B. every src file of the tree has a row (a concrete path_after, or a glob/brace row);
//   C. no src file, and no file a Phase 3 row will make, is claimed by rows of two lanes (concrete
//      rows and globs alike; two globs of different lanes that overlap are listed too);
//   D. every new file in a shared folder (src/{components,hooks,utils,constants,types}) that round.md
//      §1 names with its `src/` prefix has a row, so Phase 3 has its `-` row before the worktrees;
//      shorthand mentions (no `src/`) that match no row are listed for a reading by hand;
//   E. a file Phase 2 deleted keeps its Phase 3 work reachable: every file of its lane that took
//      its names in 2b (moves.tsv) is in Phase 3 for that lane through some row (a glob counts);
//   F. each file's eslint-disable directives (rule and count) equal its row's disables column
//      (the no-null tokens, removed in commit 6, ignored), so a directive that moved with a name in
//      2b is listed on the file that has it now.
// A file's phases are the union of its rows' (an explicit row and a glob row of one lane).
// Exit status: the number of checks with findings.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const APP = process.argv[2] ?? '/home/user/sending-stone-player';
const REV = process.argv[3] ?? 'HEAD';
const BASE = '24f808b';
const R = `${APP}/.refactor`;
const OWNERS = process.env.OWNERS ?? `${R}/owners.tsv`; // another matrix to check (a draft)

const git = (...args) => execFileSync('git', ['-C', APP, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const listTree = (rev) => new Set(git('ls-tree', '-r', '--name-only', rev).split('\n').filter(Boolean));
const tree = listTree(REV);
const base = listTree(BASE);
const isSrc = (p) => p.startsWith('src/');
const show = (p) => git('show', `${REV}:${p}`);

// ---- owners.tsv ------------------------------------------------------------------------------
const rows = readFileSync(OWNERS, 'utf8')
  .split('\n')
  .slice(1)
  .map((line, i) => ({ n: i + 2, cells: line.split('\t') }))
  .filter((r) => r.cells.length > 1)
  .map(({ n, cells }) => {
    const [pathAtBase, pathAfter, lane, phases, items, breaks, disables = ''] = cells;
    const parsed = targets(pathAtBase, pathAfter);
    return { n, pathAtBase, pathAfter, lane, items, breaks, disables, phases: new Set(phases.split(/\s+/).filter((p) => p !== '-' && p)), ...parsed };
  });

/** Split on `sep` outside braces. */
function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth === 0 && s.startsWith(sep, i)) {
      out.push(cur);
      cur = '';
      i += sep.length - 1;
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function expandBraces(p) {
  const open = p.indexOf('{');
  if (open < 0) return [p];
  let depth = 0;
  for (let i = open; i < p.length; i++) {
    if (p[i] === '{') depth++;
    if (p[i] === '}' && --depth === 0) {
      const alts = splitTop(p.slice(open + 1, i), ',');
      return alts.flatMap((alt) => expandBraces(p.slice(0, open) + alt + p.slice(i + 1)));
    }
  }
  return [p];
}

/**
 * A row's path_after as concrete paths and glob patterns. `=` is the base path; `DELETED …` (a
 * barrel) and `<path> (deleted …)` (a file emptied in 2b) are files that are gone.
 */
function targets(pathAtBase, pathAfter) {
  if (pathAfter === '=') return { paths: [pathAtBase], globs: [], deleted: false };
  if (pathAfter.startsWith('DELETED')) return { paths: [], globs: [], deleted: true };
  const paths = [];
  const globs = [];
  let deleted = false;
  for (const part of splitTop(pathAfter, '; ')) {
    const m = part.match(/^(\S+) \((.*)\)$/);
    const spec = m && !m[1].includes('{') ? m[1] : part;
    if (spec !== part && /^deleted\b/i.test(m[2])) deleted = true;
    for (const p of expandBraces(spec)) (/[*<]|\.\./.test(p) ? globs : paths).push(p);
  }
  return { paths, globs, deleted };
}

function globRegex(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (g.startsWith('**', i)) {
      re += '.*';
      i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '<') {
      i = g.indexOf('>', i);
      re += '[^/]+';
    } else if (g.startsWith('(x)', i)) {
      re += 'x?';
      i += 2;
    } else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const globSample = (g) => g.replaceAll('**', 'zz/zz').replaceAll('*', 'zz').replace(/<[^>]*>/g, 'zz').replaceAll('(x)', 'x');

const isLane = (r) => !r.lane.startsWith('-');
const early = (r) => ['0', '1', '2a', '2b'].some((p) => r.phases.has(p));
const globRows = rows.flatMap((r) => r.globs.map((g) => ({ row: r, glob: g, re: globRegex(g) })));
const concrete = new Map(); // path → rows whose live path_after is it
for (const r of rows) {
  if (r.deleted) continue;
  for (const p of r.paths) {
    if (!concrete.has(p)) concrete.set(p, []);
    concrete.get(p).push(r);
  }
}
const claimsOf = (p) => [
  ...(concrete.get(p) ?? []).map((row) => ({ row, how: 'row' })),
  ...globRows.filter((g) => g.re.test(p)).map((g) => ({ row: g.row, how: `glob ${g.glob}` })),
];
const cite = (r) => `owners.tsv:${r.n} [${r.lane}; ${[...r.phases].join(' ') || '-'}]`;

// ---- moves.tsv: where the codemods put each base file and name ---------------------------------
const moved = new Map(); // base path → { to, deleted }
const names = []; // { from, to, name, basePath }
for (const line of readFileSync(`${R}/tools/moves.tsv`, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [kind, from, to, name, basePath] = line.split('\t');
  if (kind === 'file') moved.set(basePath, { ...moved.get(basePath), to });
  if (kind === 'delete') moved.set(basePath, { ...moved.get(basePath), deleted: from });
  if (kind === 'name') names.push({ from, to, name, basePath });
}

const out = [];
const say = (s = '') => out.push(s);
let failing = 0;
const section = (title, findings) => {
  say(`## ${title}: ${findings.length}`);
  for (const f of findings) say(`- ${f}`);
  say();
  if (findings.length) failing++;
};

say(`# owners.tsv against ${REV} (${git('rev-parse', '--short', REV).trim()}) of ${APP}`);
say(`rows ${rows.length} (${globRows.length} glob patterns); src files ${[...tree].filter(isSrc).length} (base ${[...base].filter(isSrc).length})`);
say();

// ---- A. Phase 2's outputs ----------------------------------------------------------------------
const a = [];
for (const r of rows) {
  const where = moved.get(r.pathAtBase);
  if (r.pathAtBase !== '-') {
    if (!base.has(r.pathAtBase)) a.push(`${cite(r)} ${r.pathAtBase}: not a file at ${BASE}`);
    if (where?.deleted && !r.deleted) a.push(`${cite(r)} ${r.pathAtBase}: moves.tsv deletes it (${where.deleted}); the row says ${r.pathAfter}`);
    const to = r.paths[0];
    if (where?.to && to && where.to !== to) a.push(`${cite(r)} ${r.pathAtBase}: moves.tsv moved it to ${where.to}; the row says ${to}`);
    if (r.deleted) {
      for (const p of [r.pathAtBase, ...r.paths]) if (tree.has(p)) a.push(`${cite(r)} ${p}: marked deleted, still in the tree`);
      continue;
    }
    if (!tree.has(to)) a.push(`${cite(r)} ${to}: missing (from ${r.pathAtBase})`);
    if (to !== r.pathAtBase && tree.has(r.pathAtBase)) a.push(`${cite(r)} ${r.pathAtBase}: moved to ${to}, yet still in the tree`);
    continue;
  }
  if (r.deleted) {
    for (const p of r.paths) if (tree.has(p)) a.push(`${cite(r)} ${p}: marked deleted, still in the tree`);
    continue;
  }
  for (const p of r.paths) {
    if (base.has(p)) {
      // a file outside src the plan edits (eslint.config.mjs, jest.setup.ts, ROADMAP.md …)
      if (!tree.has(p)) a.push(`${cite(r)} ${p}: an existing file the row edits, missing`);
    } else if (early(r) && !tree.has(p)) a.push(`${cite(r)} ${p}: new by phase ${[...r.phases].join(' ')}, missing`);
    else if (!early(r) && tree.has(p)) a.push(`${cite(r)} ${p}: new in phase ${[...r.phases].join(' ')}, already in the tree`);
  }
  for (const g of r.globs) {
    const re = globRegex(g);
    if (r.phases.has('2b') && isSrc(g) && ![...tree].some((p) => re.test(p))) a.push(`${cite(r)} ${g}: a 2b glob that matches nothing`);
  }
}
section('A. path_after that Phase 2 should have produced, and moves.tsv against the rows', a);

// ---- A2. the 2b notes' names at their homes ----------------------------------------------------
const { specFromOwners } = createRequire(import.meta.url)(`${R}/tools/export-move.cjs`);
const a2 = [];
let specNames = 0;
for (const [dest, source, list] of specFromOwners(OWNERS)) {
  for (const entry of list.split(/\s+/).filter((x) => x && x !== '*')) {
    specNames++;
    const name = entry.split('=')[0];
    const rec = names.filter((x) => x.basePath === source && x.name.split('=')[0] === name);
    if (rec.some((x) => x.to === dest)) continue;
    if (moved.get(source)?.to === dest) continue; // the whole file is the home (use-dice-entry)
    a2.push(
      rec.length
        ? `${name} ← ${source}: noted for ${dest}, moved to ${rec.map((x) => x.to).join(', ')}`
        : `${name} ← ${source}: noted for ${dest}, no moves.tsv record`,
    );
  }
}
say(`(A2 reads ${specNames} names from the notes and ${names.length} moves.tsv name rows)`);
section('A2. names the 2b notes move, not at their noted home', a2);

// ---- B. every src file has a row ---------------------------------------------------------------
const b = [];
const claims = new Map();
for (const p of [...tree].filter(isSrc).sort()) {
  const cs = claimsOf(p);
  claims.set(p, cs);
  if (cs.length === 0) b.push(`${p}${base.has(p) ? ' (a base file)' : ''}`);
}
section('B. src files with no row (a glob row counts)', b);

// ---- C. one lane per file ----------------------------------------------------------------------
const c = [];
const laneSet = (cs) => new Set(cs.filter((x) => isLane(x.row)).map((x) => x.row.lane));
const claimText = (cs) => cs.map((x) => `${cite(x.row)} (${x.how})`).join(' | ');
for (const [p, cs] of claims) if (laneSet(cs).size > 1) c.push(`${p}: ${claimText(cs)}`);
for (const r of rows.filter((x) => x.pathAtBase === '-' && !early(x) && isLane(x))) {
  for (const p of r.paths) {
    if (tree.has(p)) continue;
    const cs = claimsOf(p);
    if (laneSet(cs).size > 1) c.push(`${p} (not made yet): ${claimText(cs)}`);
  }
}
for (const g of globRows.filter((x) => isLane(x.row))) {
  for (const h of globRows.filter((x) => isLane(x.row) && x.row.lane !== g.row.lane && x.row.n > g.row.n)) {
    if (g.re.test(globSample(h.glob)) || h.re.test(globSample(g.glob))) c.push(`globs overlap: ${g.glob} ${cite(g.row)} and ${h.glob} ${cite(h.row)}`);
  }
}
section('C. files claimed by two lanes (existing, to be made, or two overlapping globs)', c);

// ---- D. `-` rows for new shared files that round.md §1 names -----------------------------------
const md = readFileSync(`${R}/round.md`, 'utf8');
const s1At = md.indexOf('\n## §1 ');
const s1 = md.slice(s1At, md.indexOf('\n## §2 '));
const firstLine = md.slice(0, s1At).split('\n').length;
const named = new Map(); // path → { at, prefixed }
s1.split('\n').forEach((line, i) => {
  // `src/utils/{roll-reasons, lifecycle, ask-words (askTitle with …), dice}` → each module named
  const re = /(?<![\w/.@-])(src\/)?((?:components|hooks|utils|constants|types)\/(?:[\w\-./]|\{[^}]*\})+)/g;
  for (const m of line.matchAll(re)) {
    const spec = m[2].replace(/\{[^}]*\}/g, (alts) => alts.replace(/\s*\([^)]*\)/g, '').replace(/,\s+/g, ','));
    for (const raw of expandBraces(spec)) {
      const p = `src/${raw.replace(/[.,/]+$/, '')}`;
      if (/[*<{}\s]/.test(p)) continue; // a pattern in prose: the rows' globs cover those
      const seen = named.get(p);
      if (!seen) named.set(p, { at: firstLine + i, prefixed: Boolean(m[1]) });
      else if (m[1]) seen.prefixed = true;
    }
  }
});
const d = [];
const shorthand = [];
/** A feature path written short: some row's path (or glob) ends with the tail, or holds it as a folder. */
const featureRowHas = (tail) => {
  const ends = /\.tsx?$/.test(tail) ? [tail] : [`${tail}.ts`, `${tail}.tsx`];
  const paths = [...concrete.keys(), ...globRows.map((g) => globSample(g.glob))];
  return paths.some((p) => p.includes(`/${tail}/`) || ends.some((e) => p.endsWith(`/${e}`)));
};
/** A named module (with or without its extension, or a folder) that exists, existed, or has a row. */
const known = (p) => {
  const forms = /\.tsx?$/.test(p) ? [p] : [`${p}.ts`, `${p}.tsx`];
  if (forms.some((x) => base.has(x) || tree.has(x) || claimsOf(x).length)) return true;
  if (/\.\w+$/.test(p)) return false;
  const dir = `${p}/`;
  return [...base, ...tree, ...concrete.keys()].some((x) => x.startsWith(dir)) || globRows.some((g) => g.glob.startsWith(dir));
};
for (const [p, { at, prefixed }] of [...named].sort()) {
  if (known(p)) continue; // a pre-move path, made already (B), or a row
  if (prefixed) d.push(`${p} (round.md:${at}) has no row`);
  else shorthand.push(`${p.slice(4)} (round.md:${at}): ${featureRowHas(p.slice(4)) ? 'a feature row has it (a feature path written short)' : 'no row has it'}`);
}
section('D. new shared files round.md §1 names (with src/), with no row', d);
say(`D'. shorthand mentions (no src/) with no shared row, for a reading by hand: ${shorthand.length}`);
for (const s of shorthand) say(`- ${s}`);
say();

// ---- E. Phase 3 work of the files Phase 2 deleted ----------------------------------------------
const e = [];
let homes = 0;
for (const r of rows.filter((x) => x.deleted && x.pathAtBase !== '-' && x.paths.length && isLane(x))) {
  const dests = new Set(names.filter((x) => x.basePath === r.pathAtBase).map((x) => x.to));
  if (dests.size === 0) e.push(`${cite(r)} ${r.pathAtBase}: deleted, and moves.tsv moved no name out of it`);
  for (const p of dests) {
    const cs = claimsOf(p);
    if (!tree.has(p)) e.push(`${p}: took names from ${r.pathAtBase}, not in the tree`);
    else if (!cs.some((x) => x.row.lane === r.lane)) continue; // a home in another lane (src/types …), planned in 2b
    else if (!cs.some((x) => x.row.lane === r.lane && x.row.phases.has('3'))) e.push(`${p}: no ${r.lane} row with phase 3 (it holds names of the deleted ${r.pathAtBase}, items ${r.items})`);
    else homes++;
  }
}
say(`(E: ${homes} same-lane homes of the deleted files' names are in Phase 3)`);
section('E. homes of a deleted file’s names that its lane cannot edit in Phase 3', e);

// ---- F. disables ------------------------------------------------------------------------------
const f = [];
const ruleOf = (r) => r.replace(/^(unicorn|react-hooks|sonarjs|@typescript-eslint|import|@next\/next|react)\//, '');
for (const [p, cs] of claims) {
  if (!/\.(m?[jt]sx?)$/.test(p)) continue;
  const actual = {};
  for (const m of show(p).matchAll(/eslint-disable(?:-next-line|-line)?[ \t]+([^\n*]*?)(?:[ \t]+--[^\n]*)?(?:\*\/|\n|$)/g)) {
    for (const rule of m[1].split(',').map((s) => s.trim()).filter(Boolean)) actual[ruleOf(rule)] = (actual[ruleOf(rule)] ?? 0) + 1;
  }
  const listed = {};
  for (const x of cs.filter((y) => y.how === 'row')) {
    for (const m of x.row.disables.matchAll(/(\S+?)\(([^)]*)\):(\d+)/g)) {
      if (m[1] === 'no-null' && !/amendment 2/.test(m[2])) continue; // commit 6 removed them
      listed[ruleOf(m[1])] = (listed[ruleOf(m[1])] ?? 0) + Number(m[3]);
    }
  }
  const rules = new Set([...Object.keys(actual), ...Object.keys(listed)]);
  const diff = [...rules].filter((k) => (actual[k] ?? 0) !== (listed[k] ?? 0));
  if (diff.length) f.push(`${p} ${cs.filter((y) => y.how === 'row').map((y) => `owners.tsv:${y.row.n}`).join(',') || '(glob only)'}: ${diff.map((k) => `${k} in the file ${actual[k] ?? 0}, in the row ${listed[k] ?? 0}`).join('; ')}`);
}
section('F. eslint-disable directives that differ from the row’s disables column', f);

console.log(out.join('\n'));
process.exitCode = failing;
