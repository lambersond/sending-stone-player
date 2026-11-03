// Items: every R-item defined in §1/§3 is scheduled (§2.4's sequences or a commit named in its
// text); every owners.tsv row's Phase 3 items belong to the row's lane; §1.11 maps every map item.
import { owners, round } from './lib.mjs';

const md = round();
const sec = (from, to) => md.slice(md.indexOf(from), to ? md.indexOf(to) : undefined);
const s1 = sec('## §1 Target shape', '## §2 Order of work');
const s24 = sec('### §2.4 Workstream steps', '### §2.5 Commits');
const s3 = sec('## §3 Test policy', '## §4 The bug log');

// Items defined: a bold id at the start of a paragraph or a table row's first cell.
const defined = new Set([
  ...[...s1.matchAll(/\*\*(R1\.\d+\.\d+)/g)].map((m) => m[1]),
  ...[...s1.matchAll(/^\| (R1\.9\.\d+) \|/gm)].map((m) => m[1]),
  ...[...s3.matchAll(/\*\*(R3\.\d+)/g)].map((m) => m[1]),
  'R1.6',
]);

// §2.4's sequences: "**S:** R1.3.1 → .2 → .3 → .14 (9) → .4 …" expanded to full ids, per lane.
const lanes = {};
for (const m of s24.matchAll(/\*\*([A-Za-z0-9-]+)(?: \([A-Z0-9a-z-]+\))?:\*\*([^*]+)/g)) {
  const lane = m[1];
  let base;
  const ids = [];
  for (const t of m[2].matchAll(/(R\d+\.\d+\.\d+|R\d+\.\d+|(?<![\d.])\.\d+)/g)) {
    const tok = t[1];
    if (tok.startsWith('R')) {
      base = tok.replace(/\.\d+$/, '');
      ids.push(tok);
    } else if (base) ids.push(`${base}${tok}`);
  }
  (lanes[lane] ??= []).push(...ids);
}
const scheduled = new Map();
for (const [lane, ids] of Object.entries(lanes)) for (const id of ids) {
  if (!scheduled.has(id)) scheduled.set(id, new Set());
  scheduled.get(id).add(lane);
}

const out = [];
out.push('## §2.4 sequences (expanded)');
for (const [lane, ids] of Object.entries(lanes)) out.push(`- ${lane}: ${ids.join(' ')}`);

out.push('\n## items defined in §1/§3 that no §2.4 sequence names');
for (const id of [...defined].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  if (scheduled.has(id)) continue;
  const at = md.indexOf(`**${id}`) >= 0 ? md.indexOf(`**${id}`) : md.indexOf(`| ${id} |`);
  const text = md.slice(at, at + 400).replace(/\s+/g, ' ');
  const commit = text.match(/commit \d+/)?.[0] ?? 'no commit named in its first 400 chars';
  out.push(`- ${id}: ${commit} :: ${text.slice(0, 140)}`);
}

out.push('\n## ids named in §2.4 that no §1/§3 item defines');
for (const id of scheduled.keys()) if (!defined.has(id)) out.push(`- ${id} (${[...scheduled.get(id)].join(', ')})`);

// The lane each Phase 3 item runs in (from the sequences), checked against owners.tsv lanes.
const P3 = ['S', 'W-a', 'W-b', 'R-b', 'R-a', 'U1', 'U2', 'V1', 'V2'];
const itemLanes = new Map();
for (const [id, ls] of scheduled) {
  const p3 = [...ls].filter((l) => P3.includes(l));
  if (p3.length) itemLanes.set(id, p3);
}
out.push('\n## owners.tsv rows citing a Phase 3 item of another lane (the row\'s file edited by two lanes?)');
for (const r of owners()) {
  if (!P3.includes(r.lane)) continue;
  for (const id of r.items.match(/R\d+\.\d+\.\d+/g) ?? []) {
    const ls = itemLanes.get(id);
    if (ls && !ls.includes(r.lane)) out.push(`- owners.tsv:${r.n} ${r.path_at_base} -> ${r.after} [${r.lane}] cites ${id} (${ls.join('/')})`);
  }
}
console.log(out.join('\n'));
