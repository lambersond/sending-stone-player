// V2 mapper: import graph + exports + named types for src/ (read-only analysis).
// usage: node graph.cjs <repoRoot> <outJson>
const fs = require('fs')
const path = require('path')
const ts = require(path.join(process.argv[2], 'node_modules/typescript'))
const root = process.argv[2]
const src = path.join(root, 'src')
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p)
  }
})(src)
const exts = ['', '.ts', '.tsx', '.json', '/index.ts', '/index.tsx']
function resolve(from, spec) {
  let base
  if (spec === '@test-utils') base = path.join(src, 'utils/test-utils')
  else if (spec.startsWith('@/prisma/')) base = path.join(root, 'prisma', spec.slice(9))
  else if (spec.startsWith('@/')) base = path.join(src, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const x of exts) {
    const c = base + x
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(root, c)
  }
  return 'UNRESOLVED:' + spec
}
const out = {}
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const rel = path.relative(root, f)
  const rec = { lines: text.split('\n').length, imports: [], exports: [], types: [], mocks: [], disables: [], client: /^\s*['"]use client['"]/.test(text) }
  const line = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const isExp = n => (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) !== 0
  const hasJsx = n => { let r = false; (function v(m) { if (r) return; if (ts.isJsxElement(m) || ts.isJsxSelfClosingElement(m) || ts.isJsxFragment(m)) { r = true; return } ts.forEachChild(m, v) })(n); return r }
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s)) {
      const spec = s.moduleSpecifier.text
      const typeOnly = !!(s.importClause && (s.importClause.isTypeOnly || (s.importClause.namedBindings && ts.isNamedImports(s.importClause.namedBindings) && !s.importClause.name && s.importClause.namedBindings.elements.length && s.importClause.namedBindings.elements.every(e => e.isTypeOnly))))
      const names = []
      if (s.importClause) {
        if (s.importClause.name) names.push('default')
        const nb = s.importClause.namedBindings
        if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) names.push((e.propertyName || e.name).text)
        if (nb && ts.isNamespaceImport(nb)) names.push('*')
      }
      rec.imports.push({ spec, to: resolve(f, spec), typeOnly, names, line: line(s) })
    } else if (ts.isExportDeclaration(s)) {
      if (s.moduleSpecifier) {
        const spec = s.moduleSpecifier.text
        const names = s.exportClause && ts.isNamedExports(s.exportClause) ? s.exportClause.elements.map(e => e.name.text) : ['*']
        rec.imports.push({ spec, to: resolve(f, spec), typeOnly: s.isTypeOnly, names, reexport: true, line: line(s) })
        for (const n of names) rec.exports.push({ name: n, kind: 're-export', line: line(s) })
      } else if (s.exportClause && ts.isNamedExports(s.exportClause)) {
        for (const e of s.exportClause.elements) rec.exports.push({ name: e.name.text, kind: 'named', line: line(s) })
      }
    } else if (ts.isExportAssignment(s)) {
      rec.exports.push({ name: 'default', kind: 'default-expr', line: line(s) })
    } else if (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) {
      rec.types.push({ name: s.name.text, exported: isExp(s), line: line(s) })
      if (isExp(s)) rec.exports.push({ name: s.name.text, kind: 'type', line: line(s) })
    } else if (ts.isEnumDeclaration(s)) {
      if (isExp(s)) rec.exports.push({ name: s.name.text, kind: 'enum', line: line(s) })
    } else if (ts.isFunctionDeclaration(s) && s.name) {
      if (isExp(s)) {
        const isDefault = (ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Default) !== 0
        const n = s.name.text
        const kind = /^use[A-Z]/.test(n) ? 'hook' : (/^[A-Z]/.test(n) && hasJsx(s) ? 'component' : 'function')
        rec.exports.push({ name: isDefault ? 'default(' + n + ')' : n, kind, line: line(s) })
      }
    } else if (ts.isVariableStatement(s) && isExp(s)) {
      for (const d of s.declarationList.declarations) {
        const n = d.name.getText(sf)
        const init = d.initializer
        let kind = 'const'
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) kind = /^use[A-Z]/.test(n) ? 'hook' : (/^[A-Z]/.test(n) && hasJsx(init) ? 'component' : 'function')
        else if (init && ts.isCallExpression(init) && /createContext/.test(init.expression.getText(sf))) kind = 'context'
        else if (init && ts.isCallExpression(init) && /forwardRef|memo/.test(init.expression.getText(sf))) kind = 'component'
        rec.exports.push({ name: n, kind, line: line(s) })
      }
    } else if (ts.isClassDeclaration(s) && s.name && isExp(s)) {
      rec.exports.push({ name: s.name.text, kind: 'class', line: line(s) })
    }
  }
  // nested named types (inside functions) also count for .tsx
  ;(function v(m, depth) {
    if (depth > 0 && (ts.isTypeAliasDeclaration(m) || ts.isInterfaceDeclaration(m))) rec.types.push({ name: m.name.text, exported: false, nested: true, line: line(m) })
    ts.forEachChild(m, c => v(c, ts.isSourceFile(m) ? 0 : depth + 1))
  })(sf, 0)
  // jest.mock / requireActual / dynamic import
  const re = /(jest\.(?:mock|requireActual|requireMock|doMock)|import)\(\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(text))) {
    const ln = text.slice(0, m.index).split('\n').length
    if (m[1] === 'import') rec.imports.push({ spec: m[2], to: resolve(f, m[2]), typeOnly: false, names: ['dynamic'], line: ln })
    else rec.mocks.push({ fn: m[1], spec: m[2], to: resolve(f, m[2]), line: ln })
  }
  text.split('\n').forEach((l, i) => { const d = l.match(/eslint-disable(-next-line|-line)?\s+([^*]*?)(\s--\s*(.*?))?\s*(\*\/)?\s*$/); if (d) rec.disables.push({ line: i + 1, scope: d[1] ? d[1].slice(1) : 'file', rules: d[2].trim(), reason: d[4] || '' }) })
  out[rel] = rec
}
fs.writeFileSync(process.argv[3], JSON.stringify(out))
console.log(Object.keys(out).length + ' files')
