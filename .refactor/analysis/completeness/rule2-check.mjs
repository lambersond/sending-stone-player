// R1.9.1 rule (2): every exported named type of a module that stays in src/utils or src/constants
// moves to src/types in 2b. List exported types of such modules that no "moved/receives in 2b" note
// names with that source.
import { owners, read, APP } from './lib.mjs';
const rows = owners();
const notes = rows.map((r) => r.disables).join('\n');
const out = [];
for (const r of rows) {
  if (r.path_at_base === '-' || /\.test\.ts$/.test(r.path_at_base)) continue;
  if (!/^src\/(utils|constants)\/[^/]+\.ts$/.test(r.path_at_base) || !/^src\/(utils|constants)\//.test(r.after)) continue;
  const src = read(`${APP}/${r.path_at_base}`);
  const names = [...src.matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]);
  const srcKey = r.path_at_base.replace(/^src\//, '');
  const missing = names.filter((n) => !new RegExp(`\\b${n}\\b[^;\\n]*← ${srcKey.replaceAll('.', '\\.')}`).test(notes));
  if (missing.length) out.push(`- ${r.path_at_base} [${r.lane}] → ${r.after}: ${missing.join(', ')} (of ${names.length})`);
}
console.log(`## exported types of modules staying shared, not on the 2b list\n${out.join('\n') || '(none)'}`);
