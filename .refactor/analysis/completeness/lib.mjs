// Shared loaders for the completeness checks (not product code; deleted with .refactor/).
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

export const APP = '/home/user/sending-stone-player';
export const R = `${APP}/.refactor`;

export const read = (path) => readFileSync(path, 'utf8');

export function owners() {
  const lines = read(`${R}/owners.tsv`).split('\n').filter(Boolean);
  const head = lines[0].split('\t');
  return lines.slice(1).map((line, i) => {
    const cells = line.split('\t');
    const row = Object.fromEntries(head.map((h, j) => [h, cells[j] ?? '']));
    row.n = i + 2;
    row.after = row.path_after === '=' ? row.path_at_base : row.path_after;
    return row;
  });
}

// Files tracked at HEAD (src at HEAD equals 24f808b's: round.md line 6).
export function tracked() {
  return new Set(execSync('git ls-files', { cwd: APP, encoding: 'utf8' }).split('\n').filter(Boolean));
}

export const exists = (p) => existsSync(`${APP}/${p}`);

export function round() {
  return read(`${R}/round.md`);
}

// The text of one round.md item (from its bold id to the next bold id or heading).
export function itemText(md, id) {
  const re = new RegExp(`\\*\\*${id.replaceAll('.', '\\.')}[ (]`);
  const at = md.search(re);
  if (at < 0) return undefined;
  const rest = md.slice(at + 2);
  const end = rest.search(/\n\*\*R\d|\n#/);
  return md.slice(at, at + 2 + (end < 0 ? rest.length : end));
}
