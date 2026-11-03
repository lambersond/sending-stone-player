// What the v0.43 gates (round.md §3.4) share: the checkout and the base, paths followed through the
// moves, test files' structure, imports and mocks, module resolution. Each gate is
// `node gate-<id>.mjs <outdir> <checkout>`; it writes <outdir>/gate-<id>.txt and prints one line,
// `gate <id> ok|FAIL|n/a (…)`, exiting 1 on FAIL. The scripts always run from APP's R/tools (so the
// L3 replay runs today's gates on old commits); everything else is read from the checkout.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

export const BASE = '24f808b'
export const APP = '/home/user/sending-stone-player'
export const X =
  '/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043'
export const TOOLS = import.meta.dirname
export const ANALYSIS = path.join(TOOLS, '..', 'analysis')
export const BASE_DIR = process.env.GATE_BASE_DIR ?? path.join(X, 'base')

export const isTestFile = file =>
  /\.test\.[jt]sx?$/.test(file) || /(^|\/)__tests__\/.+\.[jt]sx?$/.test(file)
export const isSource = file => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file) && !file.endsWith('.d.ts')
export const GOLDEN_DIR = 'src/__tests__/golden/'
export const KIT_FILES = [
  'src/utils/test-utils.ts',
  'src/utils/test-utils.test.ts',
  'src/utils/test-utils-node.ts',
  'src/mocks/dice-renderer.ts',
]
export const KIT_DIRS = ['src/mocks/sheet-providers/']
// The modules a test may import a replaced helper from (R3.3).
export const KIT_MODULES = new Set([
  'src/utils/test-utils.ts',
  'src/utils/test-utils-node.ts',
  'src/mocks/dice-renderer.ts',
])

// ---------------------------------------------------------------------------------------------
// Running a gate.

export function gate(id, check) {
  const [outdir, checkoutArg] = process.argv.slice(2)
  if (!outdir || !checkoutArg) {
    process.stderr.write(`usage: node gate-${id}.mjs <outdir> <checkout>\n`)
    process.exit(2)
  }
  const checkout = path.resolve(checkoutArg)
  fs.mkdirSync(outdir, { recursive: true })
  let result
  try {
    result = check(new Checkout(checkout, outdir))
  } catch (error) {
    result = { status: 'FAIL', summary: 'the gate crashed', lines: [String(error.stack ?? error)] }
  }
  const { status, summary = '', lines = [] } = result
  const head = `gate ${id} ${status}${summary ? ` (${summary})` : ''}`
  fs.writeFileSync(path.join(outdir, `gate-${id}.txt`), [head, ...lines].join('\n') + '\n')
  process.stdout.write(head + '\n')
  process.exit(status === 'FAIL' ? 1 : 0)
}

// A gate's verdict from its problems: FAIL with them, else ok; `notes` are written either way.
export function verdict(problems, summary, notes = []) {
  return {
    status: problems.length > 0 ? 'FAIL' : 'ok',
    summary: problems.length > 0 ? `${problems.length} problem(s); ${summary}` : summary,
    lines: [...problems.map(p => `FAIL ${p}`), ...notes],
  }
}

export const notApplicable = why => ({ status: 'n/a', summary: why, lines: [] })

// ---------------------------------------------------------------------------------------------
// git and files.

export function git(cwd, args, input) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 1 << 30,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// Each `<rev>:<path>` blob's text (undefined where missing), by one `git cat-file --batch`.
export function blobs(cwd, specs) {
  const out = new Map()
  if (specs.length === 0) return out
  const buffer = execFileSync('git', ['-C', cwd, 'cat-file', '--batch'], {
    input: specs.join('\n') + '\n',
    maxBuffer: 1 << 30,
  })
  let at = 0
  for (const spec of specs) {
    const end = buffer.indexOf(10, at)
    const header = buffer.toString('utf8', at, end)
    at = end + 1
    if (header.endsWith(' missing')) {
      out.set(spec, undefined)
      continue
    }
    const size = Number(header.split(' ')[2])
    out.set(spec, buffer.toString('utf8', at, at + size))
    at += size + 1
  }
  return out
}

// A TSV field: backslash, tab and line breaks escaped (a test's fullName may hold any of them).
export const escapeField = text =>
  String(text).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
export const unescapeField = text =>
  text.replace(/\\(.)/g, (_, c) => ({ t: '\t', n: '\n', r: '\r' })[c] ?? c)

export function readTsv(file) {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '' && !line.startsWith('#'))
    .map(line => line.split('\t'))
}

// R/tools/moves.tsv (the codemods' record; handoff/moves-format.txt): kind, from, to, name, base.
// APP's rows, plus the checkout's own rows not yet landed (the checkout is a gate's second argument):
// a builder's moves are facts about its tree, so its L1 need not wait for the orchestrator to copy them.
export function readMoves() {
  const own = process.argv[3] ? path.join(path.resolve(process.argv[3]), '.refactor/tools/moves.tsv') : ''
  const seen = new Set()
  const rows = [path.join(TOOLS, 'moves.tsv'), own]
    .filter(file => file && fs.existsSync(file))
    .flatMap(file => readTsv(file))
    .filter(row => {
      const key = row.join('\t')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  return rows.map(([kind, from, to, name, base]) => ({
    kind,
    from,
    to,
    name,
    base: base || from,
  }))
}

// The names an export move carried (both sides of an `Old=New` rename).
export function movedNames() {
  const names = new Set()
  for (const row of readMoves()) {
    if (row.kind !== 'name' || !row.name) continue
    for (const name of row.name.split('=')) names.add(name)
  }
  return names
}

// ---------------------------------------------------------------------------------------------
// The checkout, the base, and paths followed between them.

export class Checkout {
  constructor(root, outdir) {
    this.root = root
    this.outdir = outdir
    this.cache = new Map()
  }

  memo(key, make) {
    if (!this.cache.has(key)) this.cache.set(key, make())
    return this.cache.get(key)
  }

  // Every file in the checkout git knows or would add (tracked or untracked, not ignored).
  get files() {
    return this.memo('files', () =>
      git(this.root, ['ls-files', '-co', '--exclude-standard', '-z'])
        .split('\0')
        .filter(file => file && fs.existsSync(path.join(this.root, file)))
        .sort(),
    )
  }

  get fileSet() {
    return this.memo('fileSet', () => new Set(this.files))
  }

  has(file) {
    return this.fileSet.has(file)
  }

  exists(file) {
    return fs.existsSync(path.join(this.root, file))
  }

  text(file) {
    return this.memo(`text:${file}`, () => fs.readFileSync(path.join(this.root, file), 'utf8'))
  }

  get baseFiles() {
    return this.memo('baseFiles', () =>
      git(this.root, ['ls-tree', '-r', '--name-only', '-z', BASE]).split('\0').filter(Boolean),
    )
  }

  baseText(file) {
    return this.baseTexts([file]).get(file)
  }

  // The base's text of each file, read in one batch and kept.
  baseTexts(files) {
    const all = this.memo('baseTextMap', () => new Map())
    const missing = files.filter(file => !all.has(file))
    const found = blobs(
      this.root,
      missing.map(file => `${BASE}:${file}`),
    )
    for (const file of missing) all.set(file, found.get(`${BASE}:${file}`))
    return new Map(files.map(file => [file, all.get(file)]))
  }

  // Renames git finds from the base to the working tree (staged and unstaged, -M50%).
  get renames() {
    return this.memo('renames', () => {
      const map = new Map()
      const out = git(this.root, ['diff', '-M50%', '--name-status', '-z', BASE])
      const parts = out.split('\0')
      for (let i = 0; i < parts.length; ) {
        const status = parts[i]
        if (!status) {
          i += 1
          continue
        }
        if (status.startsWith('R') || status.startsWith('C')) {
          if (status.startsWith('R')) map.set(parts[i + 1], parts[i + 2])
          i += 3
        } else i += 2
      }
      return map
    })
  }

  // The checkout's own split records: .refactor/tools/moves.d/*.tsv, base path, describe prefix,
  // path; an entry applies only when its target exists here.
  get splits() {
    return this.memo('splits', () => {
      const dir = path.join(this.root, '.refactor/tools/moves.d')
      if (!fs.existsSync(dir)) return []
      return fs
        .readdirSync(dir)
        .filter(name => name.endsWith('.tsv'))
        .sort()
        .flatMap(name => readTsv(path.join(dir, name)))
        .map(([base, prefix, to]) => ({ base, prefix, to }))
        .filter(({ base, prefix, to }) => base && prefix && to && this.has(to))
    })
  }

  // A base file's path here: the codemods' record, else git's rename, else its own path.
  head(basePath) {
    const forward = this.memo('forward', () => {
      const map = new Map()
      for (const row of readMoves()) {
        if (row.kind === 'file' && row.to) map.set(row.base, row.to)
        // A `delete` record (move.cjs, export-move.cjs) means the base file is gone.
        if (row.kind === 'delete') map.set(row.base, null)
      }
      return map
    })
    if (forward.get(basePath) === null) return undefined
    for (const candidate of [forward.get(basePath), this.renames.get(basePath), basePath]) {
      if (candidate && this.has(candidate)) return candidate
    }
    return undefined
  }

  // Where a base test now is, by its title path: the longest split prefix that holds, else the
  // file's own path here.
  headOfTest(basePath, fullName) {
    let best
    for (const split of this.splits) {
      if (split.base !== basePath) continue
      const holds = fullName === split.prefix || fullName.startsWith(split.prefix + ' ')
      if (holds && (!best || split.prefix.length > best.prefix.length)) best = split
    }
    return best ? best.to : this.head(basePath)
  }

  splitsOf(basePath) {
    return this.splits.filter(split => split.base === basePath)
  }

  // A file here back to its base path (a split's target to the file it came from), or undefined
  // for a file new since the base.
  base(headPath) {
    const back = this.memo('backward', () => {
      const map = new Map()
      for (const file of this.baseFiles) {
        const now = this.head(file)
        if (now && !map.has(now)) map.set(now, file)
      }
      for (const split of this.splits) if (!map.has(split.to)) map.set(split.to, split.base)
      return map
    })
    return back.get(headPath)
  }

  get jest() {
    return this.memo('jest', () => readJest(path.join(this.outdir, 'jest.json'), this.root))
  }

  get resolver() {
    return this.memo('resolver', () => makeResolver(this.root))
  }

  parse(file) {
    return this.memo(`parse:${file}`, () => parse(file, this.text(file)))
  }
}

// A jest --json result: { suites: [{ file, status, message, tests: [{ fullName, status,
// numPassingAsserts, occurrence }] }], snapshot, totals }, files relative to the checkout.
export function readJest(file, root) {
  if (!fs.existsSync(file)) throw new Error(`no ${file}: run jest --json first (l1.sh)`)
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const relative = name => {
    if (root && name.startsWith(root + '/')) return name.slice(root.length + 1)
    const at = name.indexOf('/src/')
    return at === -1 ? name : name.slice(at + 1)
  }
  const suites = json.testResults.map(result => {
    const seen = new Map()
    return {
      file: relative(result.name),
      status: result.status,
      message: result.message ?? '',
      tests: result.assertionResults.map(test => {
        const occurrence = seen.get(test.fullName) ?? 0
        seen.set(test.fullName, occurrence + 1)
        return {
          fullName: test.fullName,
          status: test.status,
          numPassingAsserts: test.numPassingAsserts,
          occurrence,
        }
      }),
    }
  })
  return {
    suites,
    snapshot: json.snapshot,
    totals: {
      suites: json.numTotalTestSuites,
      failedSuites: json.numFailedTestSuites,
      runtimeErrorSuites: json.numRuntimeErrorTestSuites,
      tests: json.numTotalTests,
      failed: json.numFailedTests,
    },
  }
}

// X/base/jest-base.tsv: file, fullName, status, numPassingAsserts, occurrence.
export function readBaseTests() {
  const file = path.join(BASE_DIR, 'jest-base.tsv')
  if (!fs.existsSync(file)) throw new Error(`no ${file}: run R/tools/base.sh first`)
  return readTsv(file)
    .slice(1)
    .map(([suite, fullName, status, asserts, occurrence]) => ({
      file: suite,
      fullName: unescapeField(fullName),
      status,
      numPassingAsserts: Number(asserts),
      occurrence: Number(occurrence),
    }))
}

export function readBaseJson(name) {
  const file = path.join(BASE_DIR, name)
  if (!fs.existsSync(file)) throw new Error(`no ${file}: run R/tools/base.sh first`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// ---------------------------------------------------------------------------------------------
// Parsing and printing.

export function parse(file, text) {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })

export const print = (node, sf) => printer.printNode(ts.EmitHint.Unspecified, node, sf)
export const printFile = sf => printer.printFile(sf)

// Whitespace collapsed outside string and template literals, and a comma before a closing
// bracket dropped, so formatting alone never differs. A literal is copied as it is.
export function squeeze(text) {
  let out = ''
  let gap = false
  const put = piece => {
    if (/^[}\])]/.test(piece)) out = out.replace(/, ?$/, '')
    if (gap && out !== '' && !out.endsWith(' ')) out += ' '
    gap = false
    out += piece
  }
  for (let i = 0; i < text.length; ) {
    const c = text[i]
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1
      put(text.slice(i, j + 1))
      i = j + 1
    } else if (/\s/.test(c)) {
      gap = true
      i += 1
    } else {
      put(c)
      i += 1
    }
  }
  return out
}

// The file's leading docblock, where it is first and names a jest environment; else ''.
export function leadingDocblock(text) {
  const start = text.replace(/^﻿/, '').trimStart()
  if (!start.startsWith('/**')) return ''
  const block = start.slice(0, start.indexOf('*/') + 2)
  return block.includes('@jest-environment') ? block : ''
}

const literalText = node =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined

// The identifier a call chain starts from: `it` of it.each(…)(…), `jest` of jest.mock(…).
export function rootName(expression) {
  let node = expression
  for (;;) {
    if (ts.isCallExpression(node)) node = node.expression
    else if (ts.isPropertyAccessExpression(node)) node = node.expression
    else if (ts.isTaggedTemplateExpression(node)) node = node.tag
    else if (ts.isNonNullExpression(node) || ts.isParenthesizedExpression(node))
      node = node.expression
    else break
  }
  return ts.isIdentifier(node) ? node.text : undefined
}

const TESTS = new Set(['it', 'test', 'fit', 'xit', 'xtest'])
const DESCRIBES = new Set(['describe', 'fdescribe', 'xdescribe'])

// Is this call a describe or a test with its title (not `it.each(table)` itself)?
function testCall(node) {
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return undefined
  const callee = node.expression
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'each') return undefined
  const name = rootName(callee)
  if (TESTS.has(name)) return 'test'
  if (DESCRIBES.has(name)) return 'describe'
  return undefined
}

const titleOf = (node, sf) =>
  literalText(node.arguments[0]) ?? squeeze(node.arguments[0].getText(sf))

// Every describe and test of a file: { kind, titles, key, occurrence, node, statement }, in source
// order; `statement` is the expression statement that holds the call, where one does.
export function testsOf(sf) {
  const found = []
  const seen = new Map()
  const visit = (node, titles) => {
    const kind = testCall(node)
    if (kind) {
      const path = [...titles, titleOf(node, sf)]
      const key = path.join(' ')
      const occurrence = seen.get(`${kind}:${key}`) ?? 0
      seen.set(`${kind}:${key}`, occurrence + 1)
      const statement = ts.isExpressionStatement(node.parent) ? node.parent : undefined
      found.push({ kind, titles: path, key, occurrence, node, statement })
      ts.forEachChild(node.expression, child => visit(child, titles))
      for (const arg of node.arguments.slice(1)) visit(arg, kind === 'describe' ? path : titles)
      return
    }
    ts.forEachChild(node, child => visit(child, titles))
  }
  visit(sf, [])
  return found
}

const mentionsExpect = node => {
  let found = false
  const visit = child => {
    if (found) return
    if (
      ts.isIdentifier(child) &&
      child.text === 'expect' &&
      !(ts.isPropertyAccessExpression(child.parent) && child.parent.name === child)
    ) {
      found = true
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

// A test's expect statements in order: each statement of its callback that uses `expect`,
// printed with comments dropped and whitespace collapsed outside strings.
export function expectsOf(test, sf) {
  const callback = test.node.arguments.at(-1)
  if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return []
  const statements = ts.isBlock(callback.body) ? callback.body.statements : [callback.body]
  return statements.filter(mentionsExpect).map(statement => squeeze(print(statement, sf)))
}

// ---------------------------------------------------------------------------------------------
// Imports, mocks and exports.

const JEST_PATH_CALLS = new Set(['mock', 'doMock', 'requireActual', 'requireMock', 'unmock'])

// jest.mock(…) and its kin anywhere in a file: { method, spec, node, factory }.
export function jestCalls(sf) {
  const calls = []
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'jest' &&
      JEST_PATH_CALLS.has(node.expression.name.text)
    ) {
      const spec = literalText(node.arguments[0])
      if (spec !== undefined) {
        calls.push({ method: node.expression.name.text, spec, node, factory: node.arguments[1] })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return calls
}

const unwrap = node => {
  let at = node
  while (
    at &&
    (ts.isParenthesizedExpression(at) ||
      ts.isAsExpression(at) ||
      ts.isSatisfiesExpression(at) ||
      ts.isTypeAssertionExpression(at))
  ) {
    at = at.expression
  }
  return at
}

// The object a jest.mock factory returns, where it is a literal: { object, keys, spread }.
export function factoryObject(factory) {
  if (!factory || !(ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))) {
    return undefined
  }
  let returned
  if (ts.isBlock(factory.body)) {
    const last = factory.body.statements.findLast(s => ts.isReturnStatement(s))
    returned = last?.expression
  } else returned = factory.body
  const object = unwrap(returned)
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined
  const keys = []
  let spread = false
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) spread = true
    else if (property.name) {
      const name = ts.isIdentifier(property.name)
        ? property.name.text
        : (literalText(property.name) ?? property.name.getText())
      keys.push({ name, property })
    }
  }
  return { object, keys, spread }
}

export const propertyName = property =>
  ts.isIdentifier(property.name) ||
  ts.isStringLiteral(property.name) ||
  ts.isNumericLiteral(property.name)
    ? property.name.text
    : undefined

// A file's imports: { spec, names (value names, '*' for a namespace or unknown), typeOnly,
// node }, from import and export-from declarations, import(), require() and jest.requireActual().
export function importsOf(sf) {
  const found = []
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      const spec = literalText(statement.moduleSpecifier)
      const clause = statement.importClause
      if (!clause) {
        found.push({ spec, names: [], typeOnly: false, node: statement })
        continue
      }
      if (clause.isTypeOnly) {
        found.push({ spec, names: [], typeOnly: true, node: statement })
        continue
      }
      const names = []
      let typeOnly = true
      if (clause.name) {
        names.push({ imported: 'default', local: clause.name.text })
        typeOnly = false
      }
      const bindings = clause.namedBindings
      if (bindings && ts.isNamespaceImport(bindings)) {
        names.push({ imported: '*', local: bindings.name.text })
        typeOnly = false
      } else if (bindings) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue
          typeOnly = false
          names.push({
            imported: (element.propertyName ?? element.name).text,
            local: element.name.text,
          })
        }
        if (bindings.elements.length === 0) typeOnly = false
      }
      found.push({ spec, names, typeOnly, node: statement })
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const spec = literalText(statement.moduleSpecifier)
      if (statement.isTypeOnly) {
        found.push({ spec, names: [], typeOnly: true, node: statement, reexport: true })
        continue
      }
      const clause = statement.exportClause
      let names
      if (!clause) names = [{ imported: '*', local: '*' }]
      else if (ts.isNamespaceExport(clause)) names = [{ imported: '*', local: clause.name.text }]
      else {
        names = clause.elements
          .filter(element => !element.isTypeOnly)
          .map(element => ({
            imported: (element.propertyName ?? element.name).text,
            local: element.name.text,
          }))
      }
      found.push({
        spec,
        names,
        typeOnly: clause !== undefined && !ts.isNamespaceExport(clause) && names.length === 0,
        node: statement,
        reexport: true,
      })
    }
  }
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const spec = literalText(node.arguments[0])
      const callee = node.expression
      const dynamic =
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(callee) && callee.text === 'require') ||
        (ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === 'jest' &&
          callee.name.text === 'requireActual')
      if (dynamic && spec !== undefined) {
        found.push({ spec, names: [{ imported: '*', local: '*' }], typeOnly: false, node })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

// The names a module exports (`default` included); `export *` followed through repo modules.
export function exportsOf(checkout, file, seen = new Set()) {
  if (seen.has(file)) return new Set()
  seen.add(file)
  const sf = checkout.parse(file)
  const names = new Set()
  const exported = node =>
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
  const isDefault = node =>
    ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
  for (const statement of sf.statements) {
    if (ts.isExportAssignment(statement)) names.add('default')
    else if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause
      if (!clause) {
        const target = checkout.resolver.resolve(literalText(statement.moduleSpecifier), file)
        if (target.file) {
          for (const name of exportsOf(checkout, target.file, seen)) {
            if (name !== 'default') names.add(name)
          }
        }
      } else if (ts.isNamespaceExport(clause)) names.add(clause.name.text)
      else for (const element of clause.elements) names.add(element.name.text)
    } else if (exported(statement)) {
      if (isDefault(statement)) names.add('default')
      else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          for (const name of bindingNames(declaration.name)) names.add(name)
        }
      } else if (statement.name) names.add(statement.name.text)
    }
  }
  return names
}

export function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap(element =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  )
}

// The names a file declares at its top level (functions, classes, variables, enums).
export function topLevelNames(sf) {
  const names = new Set()
  for (const statement of sf.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const name of bindingNames(declaration.name)) names.add(name)
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      names.add(statement.name.text)
    }
  }
  return names
}

// The file's `'use client'` or `'use server'` directive, or ''.
export function directiveOf(sf) {
  for (const statement of sf.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    const text = statement.expression.text
    if (text === 'use client' || text === 'use server') return text
  }
  return ''
}

// ---------------------------------------------------------------------------------------------
// Module resolution: the checkout's tsconfig (paths), jest's `@/` mapper and src modulePaths,
// relative paths, then packages.

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']

// `files` (a Set of repo paths) and `read` stand in for the disk where the tree is the base's.
export function makeResolver(root, files, read) {
  const relative = file => {
    const rel = path.relative(root, file)
    return rel.startsWith('..') || rel.split(path.sep).includes('node_modules') ? undefined : rel
  }
  const dirs = new Set()
  if (files) {
    for (const file of files) {
      for (let dir = path.dirname(file); dir !== '.'; dir = path.dirname(dir)) dirs.add(dir)
    }
  }
  const host = files
    ? {
        fileExists: file => {
          const rel = relative(file)
          return rel === undefined ? fs.existsSync(file) : files.has(rel)
        },
        readFile: file => {
          const rel = relative(file)
          return rel === undefined ? fs.readFileSync(file, 'utf8') : read(rel)
        },
        directoryExists: dir => {
          const rel = relative(dir)
          return rel === undefined ? fs.existsSync(dir) : rel === '' || dirs.has(rel)
        },
        realpath: file => file,
        getCurrentDirectory: () => root,
        getDirectories: () => [],
      }
    : ts.sys
  const configText = host.readFile(path.join(root, 'tsconfig.json'))
  const config = ts.parseJsonConfigFileContent(
    ts.parseConfigFileTextToJson('tsconfig.json', configText).config,
    { ...ts.sys, ...host, readDirectory: () => [] },
    root,
  )
  const options = config.options
  const exists = rel => (files ? files.has(rel) : fs.existsSync(path.join(root, rel)))
  const isFile = rel =>
    files ? files.has(rel) : fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile()
  const tryFile = base => {
    for (const candidate of [base, ...EXTENSIONS.map(e => base + e), ...EXTENSIONS.map(e => `${base}/index${e}`)]) {
      if (isFile(candidate)) return candidate
    }
    return undefined
  }
  const require = createRequire(path.join(root, 'package.json'))
  const cache = new Map()
  const resolve = (spec, fromFile) => {
    if (spec === undefined) return {}
    const key = `${fromFile}\0${spec}`
    if (cache.has(key)) return cache.get(key)
    let result = {}
    if (spec.startsWith('.')) {
      const file = tryFile(path.normalize(path.join(path.dirname(fromFile), spec)))
      result = file ? { file } : {}
    } else {
      const { resolvedModule } = ts.resolveModuleName(
        spec,
        path.join(root, fromFile),
        options,
        host,
      )
      const rel = resolvedModule && relative(resolvedModule.resolvedFileName)
      if (rel && !resolvedModule.isExternalLibraryImport && !rel.endsWith('.d.ts')) {
        result = { file: rel }
      } else if (spec.startsWith('@/')) {
        const file = tryFile(`src/${spec.slice(2)}`)
        result = file ? { file } : {}
      } else {
        const fromSrc = tryFile(`src/${spec}`)
        if (fromSrc) result = { file: fromSrc }
        else if (resolvedModule?.isExternalLibraryImport) result = { external: spec }
        else {
          try {
            require.resolve(spec)
            result = { external: spec }
          } catch {
            const mapped = /^@lambersond\/3d-dice-(core|engine|react)$/.exec(spec)
            if (mapped && exists(`node_modules/@lambersond/3d-dice-${mapped[1]}/dist/index.js`)) {
              result = { external: spec }
            } else if (fs.existsSync(path.join(root, 'node_modules', spec))) {
              result = { external: spec }
            }
          }
        }
      }
    }
    cache.set(key, result)
    return result
  }
  return { resolve, options }
}

// Every repo module a file reaches through value imports (type-only ones erased), the file
// included; `stopAt(file)` true leaves that module's own imports out. Returns { files, packages }.
export function closure(checkout, roots, stopAt = () => false) {
  const files = new Set()
  const packages = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const file = queue.pop()
    if (files.has(file)) continue
    files.add(file)
    if (!isSource(file) || file.endsWith('.json') || stopAt(file)) continue
    for (const edge of importsOf(checkout.parse(file))) {
      if (edge.typeOnly) continue
      const target = checkout.resolver.resolve(edge.spec, file)
      if (target.file) queue.push(target.file)
      else if (target.external) packages.add(target.external)
    }
  }
  return { files, packages }
}

// ---------------------------------------------------------------------------------------------
// The import graph and its strongly connected groups (type-only imports included), as
// R/analysis/metrics/graph.mjs counts cycles: one edge per pair of modules.

export function graphEdges(files, parseOf, resolve) {
  const edges = new Map()
  for (const file of files) {
    for (const edge of importsOf(parseOf(file))) {
      if (edge.node && ts.isCallExpression(edge.node) && !isImportCall(edge.node)) continue
      const target = resolve(edge.spec, file).file
      if (!target) continue
      if (!edges.has(file)) edges.set(file, new Set())
      edges.get(file).add(target)
    }
  }
  return edges
}

const isImportCall = node => node.expression.kind === ts.SyntaxKind.ImportKeyword

export function stronglyConnected(edges) {
  const nodes = [...new Set([...edges.keys(), ...[...edges.values()].flatMap(set => [...set])])].sort()
  let index = 0
  const state = new Map()
  const stack = []
  const groups = []
  const next = node => [...(edges.get(node) ?? [])]
  const connect = node => {
    state.set(node, { index, low: index, onStack: true })
    index += 1
    stack.push(node)
    for (const to of next(node)) {
      if (!state.has(to)) {
        connect(to)
        state.get(node).low = Math.min(state.get(node).low, state.get(to).low)
      } else if (state.get(to).onStack) {
        state.get(node).low = Math.min(state.get(node).low, state.get(to).index)
      }
    }
    if (state.get(node).low === state.get(node).index) {
      const group = []
      let member
      do {
        member = stack.pop()
        state.get(member).onStack = false
        group.push(member)
      } while (member !== node)
      if (group.length > 1 || next(node).includes(node)) groups.push(group.sort())
    }
  }
  for (const node of nodes) if (!state.has(node)) connect(node)
  return groups
}

// The server graph from src/app's framework files (pages, layouts, not-found, manifest, routes,
// the 'use server' actions) through value imports, stopping at 'use client' modules:
// { server: [modules], boundaries: ['use client' modules reached] }.
export const FRAMEWORK_FILE = /^src\/app\/(.+\/)?(page|layout|not-found|route)\.tsx?$|^src\/app\/manifest\.ts$/

export function serverGraph(files, parseOf, resolve) {
  const roots = files.filter(
    file =>
      FRAMEWORK_FILE.test(file) ||
      (file.startsWith('src/app/') && isSource(file) && !isTestFile(file) && directiveOf(parseOf(file)) === 'use server'),
  )
  const server = new Set()
  const boundaries = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const file = queue.pop()
    if (server.has(file) || boundaries.has(file)) continue
    if (!/\.(ts|tsx)$/.test(file)) continue
    if (directiveOf(parseOf(file)) === 'use client') {
      boundaries.add(file)
      continue
    }
    server.add(file)
    for (const edge of importsOf(parseOf(file))) {
      if (edge.typeOnly) continue
      const target = resolve(edge.spec, file).file
      if (target) queue.push(target)
    }
  }
  return { server: [...server].sort(), boundaries: [...boundaries].sort() }
}

// A component module: a .tsx (or a .ts) that declares a function returning JSX at its top level.
export function hasComponent(file, sf) {
  if (!file.endsWith('.tsx')) return false
  let found = false
  const visit = node => {
    if (found) return
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

// ---------------------------------------------------------------------------------------------
// Frozen files (gate 10, and gate 1 for the goldens' tests): each golden and kit file committed
// since the base, with the commit that added it; a file that commit added and the checkout no
// longer has is listed with `gone: true`.

export const isFrozen = file =>
  file.startsWith(GOLDEN_DIR) || KIT_FILES.includes(file) || KIT_DIRS.some(dir => file.startsWith(dir))

export function frozenFiles(checkout) {
  return checkout.memo('frozen', () => {
    const out = git(checkout.root, [
      'log',
      '--reverse',
      '--diff-filter=A',
      '--format=%x01%H',
      '--name-only',
      `${BASE}..HEAD`,
      '--',
      GOLDEN_DIR,
      ...KIT_FILES,
      ...KIT_DIRS,
    ])
    const added = new Map()
    for (const chunk of out.split('\u0001').filter(Boolean)) {
      const [sha, ...names] = chunk.split('\n').filter(Boolean)
      for (const file of names) if (isFrozen(file) && !added.has(file)) added.set(file, sha)
    }
    return [...added].map(([file, sha]) => ({ file, sha, gone: !checkout.exists(file) }))
  })
}

// An allowlist's rows (`#` comments): each row's tab-separated fields.
export const readAllow = name => readTsv(path.join(TOOLS, name))

// counts.conf's retirements: `retire<TAB>path<TAB>reason`.
export const retired = () =>
  new Set(
    readTsv(path.join(TOOLS, 'counts.conf'))
      .filter(([kind]) => kind === 'retire')
      .map(([, file]) => file),
  )
