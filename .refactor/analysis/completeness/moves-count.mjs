// Fact 21 / R1.9.1: 218 names in 66 source modules move in 2b; owners.tsv's "moved in 2b" and
// "receives in 2b" notes are the list. Count distinct (name, source) pairs and destinations.
import { owners } from './lib.mjs';
const pairs = new Map(); // `${src}#${name}` -> Set(dest)
for (const r of owners()) {
  for (const m of r.disables.matchAll(/(?:moved|receives) in 2b: ([^]*)$/g)) {
    for (const seg of m[1].split(';')) {
      const mm = seg.match(/^\s*(.+?)\s*←\s*([\w./[\]-]+)/);
      if (!mm) continue;
      for (const name of mm[1].split(/[\s,]+/).filter((n) => /^[A-Za-z_]\w*$/.test(n)))
        (pairs.get(`${mm[2]}#${name}`) ?? pairs.set(`${mm[2]}#${name}`, new Set()).get(`${mm[2]}#${name}`)).add(r.after);
    }
  }
}
const sources = new Set([...pairs.keys()].map((k) => k.split('#')[0]));
const dests = new Set([...pairs.values()].flatMap((s) => [...s]));
const two = [...pairs].filter(([, d]) => d.size > 1);
console.log(`distinct (source, name) pairs: ${pairs.size}; source modules: ${sources.size}; destinations: ${dests.size}`);
console.log(`names with two destinations: ${two.length}`);
for (const [k, d] of two) console.log(`- ${k}: ${[...d].join(' | ')}`);
