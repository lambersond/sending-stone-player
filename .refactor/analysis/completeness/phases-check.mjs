// The phases column agrees with the items a row cites: R1.0.x → 2a, R1.9.1-6 / "receives in 2b" → 2b,
// a lane item (R1.1-R1.5, R1.6 readers) → 3.
import { owners } from './lib.mjs';
const out = [];
for (const r of owners()) {
  const ph = new Set(r.phases.split(/\s+/));
  const need = [];
  if (/R1\.0\.\d/.test(r.items) && !ph.has('2a')) need.push('2a (cites R1.0.x)');
  if ((/R1\.9\.[1-6]\b/.test(r.items) || /receives in 2b|moved in 2b/.test(r.disables)) && !ph.has('2b')) need.push('2b (cites R1.9.1-6 or receives in 2b)');
  if (/R1\.[1-5]\.\d+/.test(r.items) && !ph.has('3') && !/^-\(/.test(r.lane)) need.push('3 (cites a lane item)');
  if (need.length) out.push(`- owners.tsv:${r.n} ${r.path_at_base === '-' ? r.after : r.path_at_base} [${r.lane}; phases "${r.phases}"]: missing ${need.join(', ')} | items ${r.items}`);
}
console.log(`## rows whose phases miss a phase their items need: ${out.length}\n${out.join('\n')}`);
