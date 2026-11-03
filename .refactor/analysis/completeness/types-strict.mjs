// Rule (b) strictly: a .tsx with named types needs a Phase 3 lane item (R1.9.1 moves only names
// another lane imports; local `Props` types stay unless the lane moves them). Lists files whose only
// type-moving item is R1.9.1 / R1.0.x, with their local (non-exported) types read from the source.
import { owners, read, APP } from './lib.mjs';
const LANE = /R1\.1\.(4|5|6|7|10|11|12|13|14|15|16|17|18|19|20)\b|R1\.2\.(1|8|9|10|11)\b|R1\.3\.(12)\b|R1\.4\.(8|9|10)\b|R1\.5\.(2|3|6|7|8|15|16|17|18|19|20|21|22|23)\b/;
const out = [];
for (const r of owners()) {
  if (!/\btypes:\d+/.test(r.breaks) || r.path_at_base === '-') continue;
  if (/\.test\.tsx?$/.test(r.path_at_base)) continue;
  if (LANE.test(r.items)) continue;
  let local = [];
  try {
    local = read(`${APP}/${r.path_at_base}`).split('\n').map((l, i) => [l, i + 1])
      .filter(([l]) => /^(type|interface) \w+/.test(l)).map(([l, i]) => `${l.match(/^(?:type|interface) (\w+)/)[1]}:${i}`);
  } catch {}
  out.push(`- owners.tsv:${r.n} ${r.path_at_base} [${r.lane}] items: ${r.items} | ${r.breaks} | local types: ${local.join(', ') || 'none'}`);
}
console.log(`## typed files with no Phase 3 lane item that moves types: ${out.length}\n${out.join('\n')}`);
