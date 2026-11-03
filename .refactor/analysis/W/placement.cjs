// Map W: for each file in W's area, its non-test importers outside the area grouped by folder
// (src/components/<x>, src/hooks, src/db, …), to find the lowest common ancestor for placement.
// Usage: node .refactor/analysis/W/placement.cjs <edges.txt from edges.cjs>
const fs = require('fs');
const text = fs.readFileSync(process.argv[2], 'utf8');
let cur;
const by = {};
for (const line of text.split('\n')) {
  const h = line.match(/^## (\S+)/);
  if (h) { cur = h[1]; by[cur] = new Set(); continue; }
  const m = line.match(/^    \S+: \d+ (.*)$/);
  if (m && cur) for (const f of m[1].split(' ')) if (f && f !== '…') by[cur].add(f);
}
for (const [f, s] of Object.entries(by)) {
  if (/\.test\./.test(f)) continue;
  const prod = [...s].filter((x) => !/\.test\.|test-utils/.test(x));
  const tests = [...s].length - prod.length;
  const dirs = {};
  for (const x of prod) {
    const d = x.match(/^src\/(components\/[^/]+|app|[^/]+)/)[1];
    dirs[d] = (dirs[d] || 0) + 1;
  }
  console.log(`${f}\tprod ${prod.length} tests ${tests}\t${Object.entries(dirs).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}:${n}`).join(' ')}`);
}
