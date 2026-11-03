// For each Phase 3 item, the files its text names before "Pins:" (the files it edits), and those
// whose owners.tsv lane is not the item's lane. References to a Phase 4 item (R1.9.2x) or to 2b
// ("moved in 2b") in the same sentence are reported too, for reading by hand.
import { owners, round } from './lib.mjs';

const md = round();
const LANE = {
  S: /^R1\.3\./, 'W-a': /^R1\.4\.(1|2|3|7|8|9)$/, 'W-b': /^R1\.4\.(5|6|10)$/, 'R-a': /^R1\.2\.([1-7]|13)$/,
  'R-b': /^R1\.2\.(8|9|10|11|12)$/, U1: /^R1\.1\.([1-9]|10)$/, U2: /^R1\.1\.(1[1-9]|20)$/,
  V1: /^R1\.5\.([2-9]|1[01])$/, V2: /^R1\.5\.(1[3-9]|2[0-3])$/,
};
const laneOf = (id) => Object.entries(LANE).find(([, re]) => re.test(id))?.[0];
const rows = owners();
const byBase = new Map();
for (const r of rows) for (const p of [r.path_at_base, r.after]) {
  const b = p.replace(/^.*\//, '');
  if (/^(types|constants|utils|index|route|page)\.tsx?$/.test(b)) continue;
  if (!byBase.has(b)) byBase.set(b, new Set());
  byBase.get(b).add(r.lane);
}
const out = [];
for (const m of md.matchAll(/\*\*(R1\.[1-5]\.\d+) [^]*?(?=\n\*\*R1\.|\n###|\n\nU1 ≈|\n\nR-a ≈|\n\nS ≈|\n\nW-a ≈|\n\nV1 ≈|\n\nV2 ≈|$)/g)) {
  const id = m[1];
  const lane = laneOf(id);
  if (!lane) continue;
  const body = m[0].split(/Pins?:/)[0];
  for (const f of new Set([...body.matchAll(/([\w-]+\.(?:tsx|ts))(?=[\s:,;)`.]|$)/g)].map((x) => x[1]))) {
    const lanes = byBase.get(f);
    if (lanes && !lanes.has(lane)) {
      const at = body.indexOf(f);
      out.push(`- ${id} [${lane}] names ${f} (owner ${[...lanes].join('/')}): …${body.slice(Math.max(0, at - 70), at + 50).replace(/\s+/g, ' ')}…`);
    }
  }
}
console.log(`## Phase 3 items naming another lane's file (before "Pins:")\n${out.join('\n')}`);
