// Zone 4 (§1.7.4): src/{utils,schemas}/** may not import src/{features,components,hooks,app,db,lib}/**.
// For each product module that stays in src/utils or src/schemas after the moves, list today's imports
// from those layers and whether owners.tsv says the imported name moves to a shared layer in 2b.
import { owners, read, APP } from './lib.mjs';
const rows = owners();
const moved = rows.filter((r) => /moved in 2b/.test(r.disables)).map((r) => ({ to: r.after, text: r.disables }));
const out = [];
for (const r of rows) {
  if (!/^src\/(utils|schemas)\//.test(r.after) || /\.test\.ts$/.test(r.after) || r.path_at_base === '-') continue;
  let src;
  try { src = read(`${APP}/${r.path_at_base}`); } catch { continue; }
  for (const m of src.matchAll(/^import (type )?\{([^}]*)\} from '@\/(hooks|components|features|app|db|lib)\/([^']+)'/gm)) {
    const names = m[2].split(',').map((s) => s.trim().replace(/^type /, '').split(' as ')[0]).filter(Boolean);
    const fate = names.map((n) => {
      const dest = moved.find((x) => new RegExp(`(^|[ ;:])${n}( |$|[,;])[^←]*← ${m[3]}/${m[4]}`).test(x.text) || new RegExp(`\\b${n}\\b[^;]*← ${m[3]}/${m[4]}\\.tsx?`).test(x.text));
      return `${n}→${dest ? dest.to : '?'}`;
    });
    out.push(`- ${r.path_at_base} [${r.lane}] imports @/${m[3]}/${m[4]}: ${fate.join(', ')}`);
  }
}
console.log(`## shared utils/schemas importing hooks/components/db/lib today\n${out.join('\n')}`);
