// Strongly connected components of src/ imports (value-only and all), printed if any member is in V2's area.
// usage: node cycles.cjs <graph.json> <inventory.tsv>
const fs = require('fs'); const g = require(process.argv[2])
const mine = new Set(fs.readFileSync(process.argv[3], 'utf8').split('\n').slice(1).map(l => l.split('\t')[0]).filter(Boolean))
for (const mode of ['value', 'all']) {
  const adj = {}; for (const [f, r] of Object.entries(g)) adj[f] = r.imports.filter(i => i.to && i.to.startsWith('src/') && (mode === 'all' || !i.typeOnly)).map(i => i.to)
  let idx = 0; const st = [], on = new Set(), ix = {}, low = {}, out = []
  const sc = v => { ix[v] = low[v] = idx++; st.push(v); on.add(v); for (const w of adj[v] || []) { if (!(w in ix)) { sc(w); low[v] = Math.min(low[v], low[w]) } else if (on.has(w)) low[v] = Math.min(low[v], ix[w]) } if (low[v] === ix[v]) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w) } while (w !== v); if (c.length > 1) out.push(c) } }
  for (const v of Object.keys(adj)) if (!(v in ix)) sc(v)
  for (const c of out) if (c.some(f => mine.has(f))) console.log(mode, c.length, c.join(' '))
}
