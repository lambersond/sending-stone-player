// U2 inventory: exports, named types, importers (outside the area) for the U2 files.
// Usage: node .refactor/analysis/U2/inventory.cjs > .refactor/analysis/U2/inventory.txt
const ts = require('typescript')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const SRC = path.join(ROOT, 'src')
const CS = 'src/components/character-sheet/'
const AREA_TSX = [
  'action-entry.tsx', 'action-info.tsx', 'actions-layout.tsx', 'actions-tab.tsx', 'biography-tab.tsx',
  'description-html.tsx', 'description-link.tsx', 'effects-tab.tsx', 'features-tab.tsx', 'hit-dice.tsx',
  'hit-dice-menu.tsx', 'hit-die-icon.tsx', 'inventory-tab.tsx', 'item-menu.tsx', 'press-menu.ts',
  'prompt-banner.tsx', 'recharge-chip.tsx', 'sheet-entry.tsx', 'sheet-fact.tsx', 'sheet-heading.tsx',
  'sheet-text.tsx', 'sheet-tiles.tsx', 'spell-slots.tsx', 'spells-tab.tsx', 'use-picker.tsx',
  'uses-button.tsx', 'uses-left.tsx', 'uses-menu.tsx',
].map((f) => CS + f)
const AREA_UTILS = [
  'sheet-actions', 'action-groups', 'casts', 'favorites', 'description-links', 'slot-words', 'uses',
  'enchantments', 'prepare-words', 'favorite-words', 'sheet-texts', 'effect-words', 'wild-shape-words',
].map((f) => 'src/utils/' + f + '.ts')
const AREA = new Set([...AREA_TSX, ...AREA_UTILS])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(path.relative(ROOT, p))
  }
  return out
}
const files = walk(SRC)
const fileSet = new Set(files)

function resolve(from, spec) {
  let base
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2)
  else if (spec === '@test-utils') base = 'src/utils/test-utils'
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
  else return null
  for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'])
    if (fileSet.has(c)) return c
  return base + '?'
}

const info = {}
for (const f of files) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const imports = [] // {target, names, typeOnly, mock}
  const exports = [] // {name, kind, line}
  const localTypes = [] // {name, line, exported}
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const isExported = (n) => (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) !== 0
  function kindOfInit(init, name) {
    if (!init) return 'const'
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return /^[A-Z]/.test(name) ? 'component?' : (/^use[A-Z]/.test(name) ? 'hook' : 'function')
    if (ts.isCallExpression(init) && /memo|forwardRef/.test(init.expression.getText())) return 'component'
    return 'const'
  }
  sf.forEachChild(function visit(n) {
    if (ts.isImportDeclaration(n) || (ts.isExportDeclaration(n) && n.moduleSpecifier)) {
      const spec = n.moduleSpecifier.text
      const t = resolve(f, spec)
      if (t) {
        const names = []
        let typeOnly = false
        if (ts.isImportDeclaration(n)) {
          const ic = n.importClause
          typeOnly = !!ic?.isTypeOnly
          if (ic?.name) names.push('default')
          if (ic?.namedBindings && ts.isNamedImports(ic.namedBindings))
            for (const el of ic.namedBindings.elements) names.push((el.propertyName || el.name).text + (el.isTypeOnly ? ':t' : ''))
          if (ic?.namedBindings && ts.isNamespaceImport(ic.namedBindings)) names.push('*')
        } else {
          typeOnly = n.isTypeOnly
          if (n.exportClause && ts.isNamedExports(n.exportClause)) for (const el of n.exportClause.elements) { names.push((el.propertyName || el.name).text); exports.push({ name: el.name.text, kind: 're-export', line: line(n) }) }
        }
        imports.push({ target: t, names, typeOnly })
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name) {
      const nm = n.name.text
      const k = /^[A-Z]/.test(nm) ? 'component' : /^use[A-Z]/.test(nm) ? 'hook' : 'function'
      if (isExported(n)) exports.push({ name: nm, kind: k, line: line(n) })
    }
    if (ts.isVariableStatement(n) && isExported(n)) {
      for (const d of n.declarationList.declarations) exports.push({ name: d.name.getText(), kind: kindOfInit(d.initializer, d.name.getText()), line: line(n) })
    }
    if (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isEnumDeclaration(n)) {
      localTypes.push({ name: n.name.text, line: line(n), exported: isExported(n) })
      if (isExported(n)) exports.push({ name: n.name.text, kind: 'type', line: line(n) })
    }
    if (ts.isClassDeclaration(n) && n.name && isExported(n)) exports.push({ name: n.name.text, kind: 'class', line: line(n) })
  })
  // jest.mock paths
  const mocks = []
  const re = /jest\.(?:mock|requireActual|requireMock|doMock)\(\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(text))) { const t = resolve(f, m[1]); if (t) mocks.push(t) }
  info[f] = { lines: text.split('\n').length, imports, exports, localTypes, mocks }
}

const importersOf = {}
for (const [f, i] of Object.entries(info)) {
  for (const im of i.imports) (importersOf[im.target] ||= []).push({ from: f, names: im.names, typeOnly: im.typeOnly })
  for (const t of i.mocks) (importersOf[t] ||= []).push({ from: f, names: ['jest.mock'], typeOnly: false })
}

const out = []
for (const f of [...AREA_TSX, ...AREA_UTILS]) {
  const i = info[f]
  if (!i) { out.push(`## ${f}  MISSING`); continue }
  out.push(`## ${f}  lines=${i.lines}`)
  out.push('  exports: ' + i.exports.map((e) => `${e.name}(${e.kind}@${e.line})`).join(', '))
  const lt = i.localTypes.filter(() => f.endsWith('.tsx') || !f.endsWith('types.ts'))
  if (lt.length) out.push('  types: ' + lt.map((t) => `${t.name}${t.exported ? '*' : ''}@${t.line}`).join(', '))
  const imp = (importersOf[f] || [])
  const outside = imp.filter((x) => !AREA.has(x.from))
  const inside = imp.filter((x) => AREA.has(x.from))
  const fmt = (x) => `${x.from.replace(CS, 'cs/').replace('src/', '')}[${x.names.join(',')}]${x.typeOnly ? 'T' : ''}`
  out.push('  importers-in-area: ' + inside.map(fmt).join('; '))
  out.push('  importers-OUTSIDE: ' + outside.map(fmt).join('; '))
  out.push('  imports: ' + i.imports.filter((x) => x.target.startsWith('src/')).map((x) => x.target.replace(CS, 'cs/').replace('src/', '') + (x.typeOnly ? 'T' : '')).join(', '))
}
console.log(out.join('\n'))
fs.writeFileSync('/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043/U2/info.json', JSON.stringify({ info, importersOf }, null, 1))
