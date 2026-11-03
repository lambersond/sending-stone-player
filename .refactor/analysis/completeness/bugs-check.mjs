// Every bugs-found.md entry is in round.md §4 (by its file:line tokens) and in §4.5's ROADMAP text.
import { read, R, round } from './lib.mjs';
const md = round();
const s4 = md.slice(md.indexOf('## §4 The bug log'), md.indexOf('### §4.5'));
const s45 = md.slice(md.indexOf('### §4.5'), md.indexOf('## §5 Risks'));
const entries = read(`${R}/bugs-found.md`).split('\n').filter((l) => /^- /.test(l));
const out = [`## bugs-found.md entries: ${entries.length}`];
for (const e of entries) {
  const refs = [...e.matchAll(/([\w.\[\]-]+\.(?:tsx|ts|mjs)):(\d+)/g)].map((m) => [m[1].replace(/^.*\//, ''), m[2]]);
  const first = refs[0];
  const inS4 = refs.filter(([f, l]) => s4.includes(`${f}:${l}`) || s4.includes(`${f.replace(/\.tsx?$/, '')}`) );
  const id = (s4.match(new RegExp(`\\| (B\\d+) \\[[^\\]]+\\] \\| [^|]*${first?.[0].replace(/[.[\]]/g, '\\$&')}`)) ?? [])[1];
  out.push(`- ${first?.join(':')} → ${id ?? (inS4.length ? 'named in §4 (no table id match)' : '**not in §4**')} | refs in §4: ${inS4.length}/${refs.length}`);
}
const ids = [...s4.matchAll(/\b(B\d+)\b/g)].map((m) => m[1]);
out.push(`\n§4 ids: ${[...new Set(ids)].join(' ')}`);
out.push(`§4.5 bullets: ${(s45.match(/^   - \*\*/gm) ?? []).length}; questions line: ${/Questions from it/.test(s45)}`);
console.log(out.join('\n'));
