// Inventory of S's area: lines, exports (name:kind), importers outside the area.
// Usage: node .refactor/analysis/S/inventory.cjs <edges.tsv> > inventory.tsv
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const SERVER_UTILS = new Set(['table-view', 'transfers', 'removals', 'favorite-commands',
  'effect-commands', 'wild-shape', 'prompts', 'companions', 'slim-sheet', 'literal-pattern'])
const inArea = (p) => /^src\/(app\/api|lib|db|clients)\//.test(p)
  || p === 'src/auth.ts' || p === 'src/auth-providers.ts'
  || /^src\/app\/.*actions\.ts$/.test(p)
  || (p.startsWith('src/utils/') && SERVER_UTILS.has(path.basename(p).replace(/\.ts$/, '')))
const edges = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => l.split('\t'))
const files = [...new Set(edges.flatMap((e) => [e[0], e[1]]))].filter((f) => inArea(f) && !/\.test\.tsx?$/.test(f)).sort()

function exportsOf(f) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)
  const out = []
  for (const s of sf.statements) {
    const mods = ts.canHaveModifiers(s) ? ts.getModifiers(s) || [] : []
    const exp = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (ts.isExportDeclaration(s)) {
      const names = s.exportClause && ts.isNamedExports(s.exportClause) ? s.exportClause.elements.map((e) => e.name.text).join(',') : '*'
      out.push(`re:${names}${s.moduleSpecifier ? '<' + s.moduleSpecifier.text : ''}`)
      continue
    }
    if (!exp) continue
    if (ts.isFunctionDeclaration(s)) out.push(`${s.name ? s.name.text : 'default'}:fn`)
    else if (ts.isClassDeclaration(s)) out.push(`${s.name.text}:class`)
    else if (ts.isTypeAliasDeclaration(s)) out.push(`${s.name.text}:type`)
    else if (ts.isInterfaceDeclaration(s)) out.push(`${s.name.text}:iface`)
    else if (ts.isEnumDeclaration(s)) out.push(`${s.name.text}:enum`)
    else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const init = d.initializer
        const k = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? 'fn' : 'const'
        out.push(`${d.name.getText()}:${k}`)
      }
    }
  }
  return out
}
const rows = []
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').length
  const ex = exportsOf(f)
  const importers = [...new Set(edges.filter((e) => e[1] === f && e[2] !== 'mock').map((e) => e[0]))]
  const outside = importers.filter((i) => !inArea(i) && !/\.test\.tsx?$/.test(i))
  const outsideTests = importers.filter((i) => !inArea(i) && /\.test\.tsx?$/.test(i))
  const mocks = [...new Set(edges.filter((e) => e[1] === f && e[2] === 'mock').map((e) => e[0]))]
  rows.push([f, lines, ex.length, ex.join(' '), outside.join(' '), outsideTests.length, mocks.length].join('\t'))
}
process.stdout.write('file\tlines\tnexports\texports\toutside_importers\toutside_test_importers\tmocked_by\n' + rows.join('\n') + '\n')
