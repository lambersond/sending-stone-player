// Gate 6, framework exports (round.md §3.4, SA F11): per route.ts, page.tsx, layout.tsx,
// not-found.tsx and manifest.ts the exported value names equal the base's (framework-exports.txt,
// made from 24f808b: `node gate-6.mjs --baseline <checkout at the base>`), with metadata, viewport
// and generateMetadata; no framework file appears or goes; the two 'use server' modules export the
// same 15 names, each an async function, and no other 'use server' file appears.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import {
  Checkout,
  FRAMEWORK_FILE,
  TOOLS,
  directiveOf,
  gate,
  isSource,
  isTestFile,
  readTsv,
  verdict,
} from './gate-lib.mjs'

const BASELINE = path.join(TOOLS, 'framework-exports.txt')

const hasModifier = (node, kind) => ts.getModifiers?.(node)?.some(m => m.kind === kind) ?? false

// A module's exported value names (types left out); for each, whether it is an async function.
function valueExports(sf) {
  const names = new Map()
  for (const statement of sf.statements) {
    if (ts.isExportAssignment(statement)) names.set('default', false)
    else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly || !statement.exportClause || ts.isNamespaceExport(statement.exportClause)) continue
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) names.set(element.name.text, false)
      }
    } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) continue
      const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
      if (ts.isFunctionDeclaration(statement)) {
        names.set(isDefault ? 'default' : statement.name.text, hasModifier(statement, ts.SyntaxKind.AsyncKeyword))
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer
          const async =
            init !== undefined &&
            (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) &&
            hasModifier(init, ts.SyntaxKind.AsyncKeyword)
          if (ts.isIdentifier(declaration.name)) names.set(declaration.name.text, async)
        }
      } else if (statement.name) names.set(isDefault ? 'default' : statement.name.text, false)
    }
  }
  return names
}

const frameworkFiles = checkout =>
  checkout.files.filter(
    file =>
      file.startsWith('src/app/') &&
      isSource(file) &&
      !isTestFile(file) &&
      (FRAMEWORK_FILE.test(file) || directiveOf(checkout.parse(file)) === 'use server'),
  )

if (process.argv[2] === '--baseline') {
  const checkout = new Checkout(path.resolve(process.argv[3]), '/tmp')
  const rows = frameworkFiles(checkout).map(file => {
    const sf = checkout.parse(file)
    const directive = directiveOf(sf) === 'use server' ? 'use server' : '-'
    return [file, directive, [...valueExports(sf).keys()].sort().join(',')].join('\t')
  })
  fs.writeFileSync(
    BASELINE,
    '# Gate 6\'s baseline: the framework files of 24f808b (pages, layouts, not-found, manifest, routes, the\n' +
      "# 'use server' actions), each with its directive and its exported value names (W-a, Phase 1).\n" +
      rows.join('\n') +
      '\n',
  )
  process.stdout.write(`${rows.length} framework files\n`)
  process.exit(0)
}

gate('6', checkout => {
  const problems = []
  const baseline = readTsv(BASELINE)
  if (baseline.length === 0) throw new Error(`no ${BASELINE}`)
  const seen = new Set()
  let actions = 0
  for (const [baseFile, directive, list] of baseline) {
    const file = checkout.head(baseFile)
    if (!file) {
      problems.push(`${baseFile}: gone`)
      continue
    }
    seen.add(file)
    const sf = checkout.parse(file)
    const names = valueExports(sf)
    const now = [...names.keys()].sort().join(',')
    if (now !== list) problems.push(`${file}: exports ${now || '(none)'}, the base ${list || '(none)'}`)
    const isServer = directiveOf(sf) === 'use server'
    if (isServer !== (directive === 'use server')) problems.push(`${file}: 'use server' ${isServer ? 'gained' : 'lost'}`)
    if (directive === 'use server') {
      for (const [name, async] of names) {
        actions += 1
        if (!async) problems.push(`${file}: ${name} is not an async function`)
      }
    }
  }
  for (const file of frameworkFiles(checkout)) {
    if (!seen.has(file)) problems.push(`${file}: a framework or 'use server' file the base did not have`)
  }
  return verdict(problems, `${baseline.length} framework files, ${actions} actions`)
})
