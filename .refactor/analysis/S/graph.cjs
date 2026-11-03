// Import graph of src/ (static, dynamic import(), require, jest.mock string args).
// Usage: node .refactor/analysis/S/graph.cjs <outdir>
// Writes <outdir>/edges.tsv: from \t to \t kind (value|type|mock) and prints nothing else.
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = process.cwd()
const out = process.argv[2] || '.'
const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(path.relative(root, p))
  }
}
walk(path.join(root, 'src'))
const exts = ['.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', '.json']
function resolve(from, spec) {
  let base
  if (spec.startsWith('@/prisma/')) base = path.join(root, 'prisma', spec.slice(9))
  else if (spec === '@test-utils') base = path.join(root, 'src/utils/test-utils')
  else if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(path.join(root, from)), spec)
  else return undefined
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return path.relative(root, base)
  for (const x of exts) if (fs.existsSync(base + x)) return path.relative(root, base + x)
  return 'UNRESOLVED:' + spec
}
const rows = []
for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)
  const visit = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) {
      let kind = 'value'
      if (ts.isImportDeclaration(n)) {
        const c = n.importClause
        if (c && c.isTypeOnly) kind = 'type'
        else if (c && !c.name && c.namedBindings && ts.isNamedImports(c.namedBindings)
          && c.namedBindings.elements.length > 0
          && c.namedBindings.elements.every((e) => e.isTypeOnly)) kind = 'type'
      } else if (n.isTypeOnly) kind = 'type'
      const r = resolve(f, n.moduleSpecifier.text)
      if (r) rows.push([f, r, kind])
    } else if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0])) {
      const e = n.expression
      const name = e.kind === ts.SyntaxKind.ImportKeyword ? 'import'
        : ts.isIdentifier(e) ? e.text
          : ts.isPropertyAccessExpression(e) ? e.getText() : ''
      let kind
      if (name === 'import' || name === 'require') kind = 'value'
      else if (/^jest\.(mock|requireActual|requireMock|doMock|unmock)$/.test(name)) kind = 'mock'
      if (kind) {
        const r = resolve(f, n.arguments[0].text)
        if (r) rows.push([f, r, kind])
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(src)
}
fs.writeFileSync(path.join(out, 'edges.tsv'), rows.map((r) => r.join('\t')).join('\n') + '\n')
