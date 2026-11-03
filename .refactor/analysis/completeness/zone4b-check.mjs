// Zone 4 again: a module staying in src/utils, src/schemas, src/constants or src/types that imports a
// module whose path_after is under src/features/ or src/components/ (it moved into a feature).
import { owners, read, APP } from './lib.mjs';
const rows = owners();
const after = new Map(rows.map((r) => [r.path_at_base.replace(/\.(tsx?)$/, ''), r.after]));
const out = [];
for (const r of rows) {
  if (!/^src\/(utils|schemas|constants|types)\//.test(r.after) || r.path_at_base === '-' || /\.test\.ts$/.test(r.after)) continue;
  let src; try { src = read(`${APP}/${r.path_at_base}`); } catch { continue; }
  for (const m of src.matchAll(/from '(@\/[^']+|\.\/[^']+)'/g)) {
    const spec = m[1].startsWith('@/') ? `src/${m[1].slice(2)}` : `${r.path_at_base.replace(/\/[^/]+$/, '')}/${m[1].slice(2)}`;
    const to = after.get(spec);
    if (to && /^src\/(features|components)\//.test(to)) {
      const line = src.slice(0, m.index).split('\n').length;
      const stmt = src.slice(src.lastIndexOf('import', m.index), m.index + m[0].length).replace(/\s+/g, ' ');
      out.push(`- ${r.path_at_base}:${line} [${r.lane}] → ${spec} (moves to ${to}) :: ${stmt.slice(0, 140)}`);
    }
  }
}
console.log(`## shared modules importing a module that moves into a feature or src/components\n${out.join('\n')}`);
