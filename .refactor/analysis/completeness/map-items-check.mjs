// Map items → contract: (1) §1.11 names every map item (T.1 … V2.12) and each target exists in
// round.md; (2) every file a map item names (a basename with an extension) has an owners.tsv row
// that cites one of the mapped contract items (or is the item's own new file).
import { owners, read, R, round } from './lib.mjs';

const md = round();
const maps = { T: 'T', S: 'S', W: 'W', R: 'R', U1: 'U1', U2: 'U2', V1: 'V1', V2: 'V2' };
const items = []; // {map, id, text}
for (const [map, file] of Object.entries(maps)) {
  const text = read(`${R}/maps/${file}.md`);
  const target = text.slice(text.search(/^## \(?4/m), text.search(/^## \(?5/m));
  const prefix = map === 'U2' ? 'S' : map;
  const re = new RegExp(`\\*\\*(${prefix.replace('.', '\\.')}\\.\\d+)\\b[^*]*\\*\\*`, 'g');
  const hits = [...target.matchAll(re)];
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : target.length;
    items.push({ map, id: `${map === 'U2' ? 'U2 ' : ''}${h[1]}`, text: target.slice(h.index, end) });
  });
}

// §1.11's index.
const idx = md.slice(md.indexOf('### §1.11'), md.indexOf('## §2 Order of work'));
const body = idx.slice(0, idx.indexOf('Seams the maps named'));
const index = new Map();
let u2 = false;
for (const part of body.replace(/\n/g, ' ').split(/ · |\. (?=[A-Z])/)) {
  const m = part.trim().match(/^(U2 )?((?:T|S|W|R|U1|V1|V2)\.\d+|S\.\d+) (.*)$/);
  if (!m) continue;
  if (m[1]) u2 = true;
  if (/^(T|W|R|U1|V1|V2)\./.test(m[2])) u2 = false;
  const key = (u2 && m[2].startsWith('S.') ? 'U2 ' : '') + m[2];
  index.set(key, m[3].match(/R\d+(\.\d+){1,2}|§1\.10|not done/g) ?? []);
}

const out = [];
out.push(`## map items found: ${items.length}; in §1.11: ${index.size}`);
for (const it of items) if (!index.has(it.id)) out.push(`- ${it.id} (map ${it.map}) **missing from §1.11**`);
for (const k of index.keys()) if (!items.find((i) => i.id === k)) out.push(`- §1.11 names ${k}, which no map defines`);
const ids = new Set(md.match(/R\d+\.\d+(\.\d+)?/g));
for (const [k, v] of index) for (const t of v) if (t.startsWith('R') && !ids.has(t)) out.push(`- ${k} → ${t}: not in round.md`);

// Files per map item vs owners.tsv rows citing the mapped contract items.
const rows = owners();
const base = (p) => p.replace(/^.*\//, '');
const rowsByBasename = new Map();
for (const r of rows) for (const p of [r.path_at_base, r.after]) {
  const b = base(p);
  if (!rowsByBasename.has(b)) rowsByBasename.set(b, new Set());
  rowsByBasename.get(b).add(r);
}
out.push('\n## files a map item names whose owners.tsv rows cite none of its contract items');
for (const it of items) {
  const targets = (index.get(it.id) ?? []).filter((t) => t.startsWith('R'));
  if (!targets.length) continue;
  const named = new Set([...it.text.matchAll(/([\w.-]+\.(?:tsx|ts|mjs|cjs))(?=[\s:,;)`]|$)/g)].map((m) => m[1]).filter((f) => !/^\d/.test(f)));
  const miss = [];
  for (const f of named) {
    const rs = rowsByBasename.get(f);
    if (!rs) { miss.push(`${f} (no row)`); continue; }
    if (![...rs].some((r) => targets.some((t) => new RegExp(`\\b${t.replaceAll('.', '\\.')}\\b`).test(r.items)))) miss.push(`${f} (rows: ${[...rs].map((r) => `${r.n}:${r.lane}:${r.items}`).join(' / ')})`);
  }
  if (miss.length) out.push(`- ${it.id} → ${targets.join(' + ')}: ${miss.join('; ')}`);
}
console.log(out.join('\n'));
