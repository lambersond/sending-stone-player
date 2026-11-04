// Gate 10, goldens and the frozen kit (round.md §3.4, SA F5): every test under src/__tests__/golden/
// passed; jest.json's snapshot counts added, unchecked and updated are 0; and from the commit that
// added each (in the checkout's history since 24f808b), no change to src/__tests__/golden/**
// (snapshots byte for byte), the kit (src/utils/test-utils.ts, test-utils.test.ts,
// test-utils-node.ts, src/mocks/dice-renderer.ts, src/mocks/sheet-providers/**) but in import
// declarations and the path strings of jest.mock and its kin. A file that commit added and the
// checkout no longer has must be a counts.conf retirement (commit 26: C1, C3, C9 and their .snap).
// gate10.allow names the lines a frozen file may lose (amendment 2 (b): the node kit's no-null
// directive, with the config block that kept the rule on for it).
import ts from 'typescript'
import {
  GOLDEN_DIR,
  frozenFiles,
  gate,
  git,
  parse,
  readAllow,
  retired,
  verdict,
} from './gate-lib.mjs'

// gate10.allow's rows: `<file><TAB><a line it may lose, trimmed><TAB><reason>`.
const ALLOWED = readAllow('gate10.allow')

// The text as the commit that added it had it, less the lines gate10.allow lets it lose since.
function allowedText(file, text) {
  const gone = new Set(ALLOWED.filter(([path]) => path === file).map(([, line]) => line))
  if (gone.size === 0) return text
  return text
    .split('\n')
    .filter(line => !gone.has(line.trim()))
    .join('\n')
}

const PATH_CALLS = new Set(['mock', 'doMock', 'requireActual', 'requireMock', 'unmock'])

// The text with import declarations cut out and jest path strings replaced, as it is otherwise.
function frozenText(file, text) {
  if (!/\.[jt]sx?$/.test(file)) return text
  const sf = parse(file, text)
  const cuts = []
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) cuts.push([statement.getFullStart(), statement.getEnd(), ''])
  }
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'jest' &&
      PATH_CALLS.has(node.expression.name.text) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      cuts.push([node.arguments[0].getStart(sf), node.arguments[0].getEnd(), "'<path>'"])
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  let out = text
  for (const [start, end, put] of cuts.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + put + out.slice(end)
  return out.replace(/^\s+/, '')
}

gate('10', checkout => {
  const problems = []
  const { snapshot, suites } = checkout.jest
  for (const key of ['added', 'unchecked', 'updated']) {
    if ((snapshot?.[key] ?? 0) !== 0) problems.push(`jest.json snapshot.${key} = ${snapshot[key]}`)
  }
  let goldenTests = 0
  for (const suite of suites) {
    if (!suite.file.startsWith(GOLDEN_DIR)) continue
    if (suite.status !== 'passed') problems.push(`${suite.file}: ${suite.status} ${suite.message.slice(0, 200)}`)
    for (const test of suite.tests) {
      goldenTests += 1
      if (test.status !== 'passed') problems.push(`${suite.file}: "${test.fullName}" ${test.status}`)
    }
  }
  const ran = new Set(suites.map(suite => suite.file))
  const gone = retired()
  const frozen = frozenFiles(checkout)
  for (const { file, sha, gone: missing } of frozen) {
    if (missing) {
      if (!gone.has(file)) problems.push(`${file}: added in ${sha.slice(0, 7)}, gone, and not a counts.conf retirement`)
      continue
    }
    if (file.startsWith(GOLDEN_DIR) && /\.test\.[jt]sx?$/.test(file) && !ran.has(file)) problems.push(`${file}: not run`)
    const then = allowedText(file, git(checkout.root, ['show', `${sha}:${file}`]))
    const now = checkout.text(file)
    if (file.endsWith('.snap') ? then !== now : frozenText(file, then) !== frozenText(file, now)) {
      problems.push(`${file}: changed since ${sha.slice(0, 7)}, which added it`)
    }
  }
  const pending = checkout.files.filter(
    file => file.startsWith(GOLDEN_DIR) && !frozen.some(f => f.file === file),
  )
  const notes = pending.map(file => `not committed yet, held from the commit that adds it: ${file}`)
  return verdict(problems, `${goldenTests} golden tests, ${frozen.length} frozen files held`, notes)
})
