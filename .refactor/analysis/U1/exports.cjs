// U1 analysis: exports per file (name, kind) and importers outside a given area.
// Usage: node exports.cjs <repoRoot> <areaFile>... ; prints a TSV-ish report.
const fs = require('node:fs')
const path = require('node:path')
const ts = require(path.join(process.argv[2], 'node_modules/typescript'))

const root = process.argv[2]
const area = process.argv.slice(3).map(f => path.resolve(root, f))

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts)$/.test(e.name)) out.push(p)
  }
  return out
}

function resolveSpec(from, spec) {
  let base
  if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2))
  else if (spec === '@test-utils') base = path.join(root, 'src/utils/test-utils')
  else if (/^(components|hooks|utils|types|schemas|constants|db|lib|mocks)\//.test(spec))
    base = path.join(root, 'src', spec)
  else return undefined
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx'])
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
  return undefined
}

function exportsOf(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const out = []
  const isExported = n => (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) !== 0
  for (const st of src.statements) {
    const line = src.getLineAndCharacterOfPosition(st.getStart()).line + 1
    if (ts.isExportDeclaration(st)) {
      if (st.exportClause && ts.isNamedExports(st.exportClause))
        for (const el of st.exportClause.elements)
          out.push({ name: el.name.text, kind: st.isTypeOnly || el.isTypeOnly ? 're-type' : 're-export', line })
      continue
    }
    if (!isExported(st)) continue
    if (ts.isFunctionDeclaration(st)) {
      const n = st.name ? st.name.text : 'default'
      out.push({ name: n, kind: /^use[A-Z]/.test(n) ? 'hook' : /^[A-Z]/.test(n) ? 'component?' : 'function', line })
    } else if (ts.isTypeAliasDeclaration(st)) out.push({ name: st.name.text, kind: 'type', line })
    else if (ts.isInterfaceDeclaration(st)) out.push({ name: st.name.text, kind: 'interface', line })
    else if (ts.isClassDeclaration(st)) out.push({ name: st.name?.text ?? 'default', kind: 'class', line })
    else if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) {
        const n = d.name.getText(src)
        const init = d.initializer
        const fn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        out.push({ name: n, kind: fn ? (/^use[A-Z]/.test(n) ? 'hook' : /^[A-Z]/.test(n) ? 'component?' : 'function') : 'const', line })
      }
  }
  return out
}

const all = walk(path.join(root, 'src')).concat(walk(path.join(root, 'e2e')).filter(f => !f.includes('/.out/')))
const importRe = /(?:import|export)\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|jest\.(?:mock|requireActual|requireMock|doMock)\(\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\)/g
const importers = new Map()
for (const f of all) {
  const text = fs.readFileSync(f, 'utf8')
  for (const m of text.matchAll(importRe)) {
    const spec = m[2] || m[3] || m[4]
    const r = resolveSpec(f, spec)
    if (!r) continue
    const kind = m[3] ? 'jest.mock' : m[1] ? 'type' : 'value'
    // which names
    let names = ''
    const stmt = m[0]
    const brace = stmt.match(/\{([\s\S]*?)\}/)
    if (brace) names = brace[1].replace(/\s+/g, ' ').trim()
    if (!importers.has(r)) importers.set(r, [])
    importers.get(r).push({ from: path.relative(root, f), kind, names })
  }
}

const areaSet = new Set(area)
for (const f of area) {
  const rel = path.relative(root, f)
  const lines = fs.readFileSync(f, 'utf8').split('\n').length
  const ex = exportsOf(f)
  console.log(`## ${rel} (${lines} lines, ${ex.length} exports)`)
  for (const e of ex) console.log(`  export ${e.kind} ${e.name} :${e.line}`)
  const imp = importers.get(f) || []
  for (const i of imp) {
    const abs = path.join(root, i.from)
    const tag = areaSet.has(abs) ? 'in' : /\.test\.tsx?$/.test(i.from) ? 'test' : 'OUT'
    console.log(`  <- [${tag}] ${i.from} (${i.kind}) {${i.names}}`)
  }
}
