// Lists exports with no importer outside their own module (R1.9.27), over src/ and jest.setup.ts.
// Usage: node unused-exports.mjs <checkout>. Prints `file\tname\tkind\tusedInFile`.
import path from 'node:path'
import ts from '/home/user/sending-stone-player/node_modules/typescript/lib/typescript.js'
import { Checkout } from '/home/user/sending-stone-player/.refactor/tools/gate-lib.mjs'

const root = path.resolve(process.argv[2])
const co = new Checkout(root, '/tmp')
const files = co.files.filter(f => (f.startsWith('src/') || f === 'jest.setup.ts') && /\.(ts|tsx|mjs|js)$/.test(f) && !f.endsWith('.d.ts'))
const literal = n => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined)
const used = new Map() // file -> Set(names) ; '*' = all
const mark = (file, name) => {
  if (!file) return
  if (!used.has(file)) used.set(file, new Set())
  used.get(file).add(name)
}
const resolve = (spec, from) => (spec ? co.resolver.resolve(spec, from).file : undefined)
for (const file of files) {
  const sf = co.parse(file)
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      const target = resolve(literal(node.moduleSpecifier), file)
      const clause = node.importClause
      if (clause?.name) mark(target, 'default')
      const b = clause?.namedBindings
      if (b && ts.isNamespaceImport(b)) mark(target, '*')
      else if (b) for (const e of b.elements) mark(target, (e.propertyName ?? e.name).text)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const target = resolve(literal(node.moduleSpecifier), file)
      const c = node.exportClause
      if (!c || ts.isNamespaceExport(c)) mark(target, '*')
      else for (const e of c.elements) mark(target, (e.propertyName ?? e.name).text)
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument
      const spec = ts.isLiteralTypeNode(arg) ? literal(arg.literal) : undefined
      const target = resolve(spec, file)
      if (node.qualifier) {
        let q = node.qualifier
        while (ts.isQualifiedName(q)) q = q.left
        mark(target, q.text)
      } else mark(target, '*')
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression
      const spec = literal(node.arguments[0])
      const isImport = callee.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
      const jestMethod = ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'jest' ? callee.name.text : undefined
      if (spec !== undefined && (isImport || isRequire || jestMethod === 'requireActual' || jestMethod === 'requireMock')) {
        const target = resolve(spec, file)
        const parent = node.parent
        if (ts.isPropertyAccessExpression(parent) && parent.expression === node) mark(target, parent.name.text)
        else if (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name)) {
          for (const el of parent.name.elements) mark(target, (el.propertyName ?? el.name).getText(sf))
        } else if (ts.isSpreadAssignment(parent)) {
          // a mock factory's spread of the real module: names it keeps are imported elsewhere
        } else mark(target, '*')
      }
      if (spec !== undefined && (jestMethod === 'mock' || jestMethod === 'doMock')) {
        const target = resolve(spec, file)
        const factory = node.arguments[1]
        if (factory && (ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))) {
          let body = factory.body
          if (ts.isBlock(body)) body = body.statements.findLast(s => ts.isReturnStatement(s))?.expression
          while (body && ts.isParenthesizedExpression(body)) body = body.expression
          if (body && ts.isObjectLiteralExpression(body)) {
            for (const p of body.properties) if (p.name) mark(target, ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : '*')
          } else mark(target, '*')
        } else mark(target, '*') // automock
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}
const SPECIAL = /^src\/app\/(.+\/)?(page|layout|not-found|route|template|loading|error|default|global-error|opengraph-image|twitter-image|icon|apple-icon|manifest|sitemap|robots)\.(ts|tsx)$/
const FROZEN = f => f === 'src/utils/test-utils.ts' || f === 'src/utils/test-utils-node.ts' || f === 'src/mocks/dice-renderer.ts' || f.startsWith('src/mocks/sheet-providers/') || f.startsWith('src/__tests__/')
const isTest = f => /\.test\.(ts|tsx)$/.test(f)
for (const file of files) {
  if (SPECIAL.test(file) || FROZEN(file) || isTest(file)) continue
  const sf = co.parse(file)
  const directive = sf.statements[0] && ts.isExpressionStatement(sf.statements[0]) && literal(sf.statements[0].expression)
  if (directive === 'use server') continue
  const u = used.get(file) ?? new Set()
  if (u.has('*')) continue
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined
    if (!mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const e of st.exportClause.elements) if (!u.has(e.name.text)) console.log(`${file}\t${e.name.text}\tspecifier`)
      }
      continue
    }
    const isDefault = mods.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
    const names = isDefault ? ['default'] : ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap(d => ts.isIdentifier(d.name) ? [d.name.text] : []) : st.name ? [st.name.text] : []
    const kind = ts.SyntaxKind[st.kind]
    for (const name of names) {
      if (u.has(name)) continue
      // used inside its own file?
      const occurrences = sf.text.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0
      console.log(`${file}\t${name}\t${kind}\t${occurrences > 1 ? 'in-file' : 'nowhere'}`)
    }
  }
}
