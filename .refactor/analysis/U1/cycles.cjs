// U1 analysis: import cycles (Tarjan SCCs) over src, runtime imports and all imports apart; also
// folder-level cycles between src/components/<folder> and src/hooks, src/utils. Prints SCCs that
// touch the files given (or all with --all).
// Usage: node cycles.cjs <repoRoot> [--all] <file>...
const fs = require('node:fs')
const path = require('node:path')
const root = process.argv[2]
const all = process.argv.includes('--all')
const focus = new Set(process.argv.slice(3).filter(a => a !== '--all').map(f => path.resolve(root, f)))

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}
function resolveSpec(from, spec) {
  let base
  if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2))
  else return undefined
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx'])
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
  return undefined
}
const files = walk(path.join(root, 'src'))
const re = /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm
function graph(runtimeOnly) {
  const g = new Map()
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    const edges = new Set()
    for (const m of text.matchAll(re)) {
      if (runtimeOnly && m[2]) continue
      if (runtimeOnly && /^\{[^}]*\}$/.test(m[3].trim())) {
        const names = m[3].trim().slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
        if (names.length > 0 && names.every(n => n.startsWith('type '))) continue
      }
      const r = resolveSpec(f, m[4])
      if (r) edges.add(r)
    }
    g.set(f, edges)
  }
  return g
}
function sccs(g) {
  let index = 0
  const stack = [], on = new Set(), idx = new Map(), low = new Map(), out = []
  function strong(v) {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v)
    for (const w of g.get(v) || []) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))) }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)))
    }
    if (low.get(v) === idx.get(v)) {
      const c = []; let w
      do { w = stack.pop(); on.delete(w); c.push(w) } while (w !== v)
      if (c.length > 1) out.push(c)
    }
  }
  for (const v of g.keys()) if (!idx.has(v)) strong(v)
  return out
}
const rel = f => path.relative(root, f)
for (const [label, runtime] of [['runtime', true], ['all (with types)', false]]) {
  const g = graph(runtime)
  const found = sccs(g).filter(c => all || c.some(f => focus.has(f)))
  console.log(`# file cycles, ${label}: ${found.length}`)
  for (const c of found) console.log('  ' + c.map(rel).join(' <-> '))
  // folder level
  const folderOf = f => {
    const r = rel(f)
    const m = r.match(/^src\/(components\/[^/]+|[^/]+)/)
    return m ? m[1] : r
  }
  const fg = new Map()
  for (const [f, es] of g) {
    const a = folderOf(f)
    if (!fg.has(a)) fg.set(a, new Set())
    for (const e of es) { const b = folderOf(e); if (b !== a) fg.get(a).add(b) }
  }
  const fc = sccs(fg)
  console.log(`# folder cycles, ${label}: ${fc.length}`)
  for (const c of fc) console.log('  ' + c.join(' <-> '))
  // which edges make the sheet <-> other-folder cycles
  for (const c of fc) {
    if (!c.includes('components/character-sheet')) continue
    for (const [f, es] of g) for (const e of es) {
      const a = folderOf(f), b = folderOf(e)
      if (a !== b && c.includes(a) && c.includes(b) && (a === 'components/character-sheet' || b === 'components/character-sheet'))
        console.log(`    edge ${rel(f)} -> ${rel(e)}`)
    }
  }
}
