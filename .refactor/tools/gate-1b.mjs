// Gate 1b, the whole test file (round.md §3.4, SA F1): each base test file (paths followed) and its
// head, both parsed, with these dropped from both: import declarations; the path strings of
// jest.mock/requireActual/requireMock/doMock, require(), import() and `typeof import()`; a mock
// factory's keys that are moved names (moves.tsv `name` rows), compared apart as a multiset of
// `key: value` (a factory left with nothing but a requireActual spread goes); guardNoDb()
// statements; the base's top-level helpers the kit replaced (R3.3: a name the head no longer
// declares and imports from the kit, test-utils, test-utils-node or dice-renderer); comments;
// type aliases and interfaces. Then printed with the TS printer, whitespace collapsed outside
// strings: the two must be equal, and each file's leading `@jest-environment` docblock must be
// equal and first. A split file (moves.d) is held test by test: each test's statement equal in
// the file its split names, every other statement of a head piece one of the base's at the same
// describe path, and every base statement in some piece.
// Allowlist gate1b.allow: `<base path>\tmock\t<mock path>\t<reason>` (those jest.mock statements
// left out on both sides) or `<base path>\tfile\t-\t<reason>` (the file not compared).
import ts from 'typescript'
import {
  BASE_DIR,
  KIT_MODULES,
  gate,
  importsOf,
  isTestFile,
  leadingDocblock,
  movedNames,
  parse,
  print,
  propertyName,
  readAllow,
  squeeze,
  testsOf,
  topLevelNames,
  verdict,
} from './gate-lib.mjs'
import fs from 'node:fs'
import path from 'node:path'

const PATH_CALLS = new Set(['mock', 'doMock', 'requireActual', 'requireMock', 'unmock'])
const PLACEHOLDER = '<path>'

const isJestCall = (node, names) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'jest' &&
  names.has(node.expression.name.text)

const MOCKS = new Set(['mock', 'doMock'])
const mockOf = statement => {
  if (!ts.isExpressionStatement(statement)) return undefined
  const call = statement.expression
  const spec = isJestCall(call, MOCKS) ? call.arguments[0] : undefined
  return spec && ts.isStringLiteralLike(spec) ? call : undefined
}

const returnedObject = factory => {
  if (!factory || !(ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))) return undefined
  let at = ts.isBlock(factory.body)
    ? factory.body.statements.findLast(s => ts.isReturnStatement(s))?.expression
    : factory.body
  while (at && (ts.isParenthesizedExpression(at) || ts.isAsExpression(at))) at = at.expression
  return at && ts.isObjectLiteralExpression(at) ? at : undefined
}

const isRequireActualSpread = property =>
  ts.isSpreadAssignment(property) &&
  ts.isCallExpression(property.expression) &&
  isJestCall(property.expression, new Set(['requireActual']))

// The normalizer of one side of a file: `norm(node)` prints a node with the dropped parts gone
// ('' when the whole node goes); `movedKeys` gathers the moved mock keys it took out.
function normalizer(sf, { moved, dropHelpers, dropMocks }) {
  const movedKeys = []
  const marked = new Set()
  const dropped = new Set()
  const visitStatements = (statements, top) => {
    for (const statement of statements) {
      if (
        ts.isImportDeclaration(statement) ||
        ts.isImportEqualsDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement)
      ) {
        dropped.add(statement)
      } else if (
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression) &&
        ts.isIdentifier(statement.expression.expression) &&
        statement.expression.expression.text === 'guardNoDb'
      ) {
        dropped.add(statement)
      } else if (top && dropHelpers.size > 0) {
        const names = topLevelNames({ statements: [statement] })
        if (names.size > 0 && [...names].every(name => dropHelpers.has(name))) dropped.add(statement)
      }
      const mock = mockOf(statement)
      if (mock) {
        if (dropMocks.has(mock.arguments[0].text)) {
          dropped.add(statement)
          continue
        }
        const object = returnedObject(mock.arguments[1])
        if (object) {
          let took = 0
          for (const property of object.properties) {
            const name = !ts.isSpreadAssignment(property) && property.name && propertyName(property)
            if (name && moved.has(name)) {
              took += 1
              movedKeys.push(squeeze(print(property, sf)))
            }
          }
          if (took > 0) {
            marked.add(object)
            const left = object.properties.filter(
              p => !(!ts.isSpreadAssignment(p) && p.name && moved.has(propertyName(p))),
            )
            if (left.every(isRequireActualSpread)) dropped.add(statement)
          }
        }
      }
    }
  }
  const walk = node => {
    if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
      visitStatements(node.statements, ts.isSourceFile(node))
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  const literal = node => ts.isStringLiteralLike(node)
  const transformer = context => {
    const { factory } = context
    const visit = node => {
      if (dropped.has(node)) return undefined
      if (
        (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isMethodDeclaration(node)) &&
        node.parent &&
        marked.has(node.parent) &&
        moved.has(propertyName(node))
      ) {
        return undefined
      }
      if (ts.isCallExpression(node) && node.arguments.length > 0 && literal(node.arguments[0])) {
        const isPath =
          isJestCall(node, PATH_CALLS) ||
          node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')
        if (isPath) {
          const visited = ts.visitEachChild(node, visit, context)
          return factory.updateCallExpression(visited, visited.expression, visited.typeArguments, [
            factory.createStringLiteral(PLACEHOLDER),
            ...visited.arguments.slice(1),
          ])
        }
      }
      if (ts.isImportTypeNode(node)) {
        const visited = ts.visitEachChild(node, visit, context)
        return factory.updateImportTypeNode(
          visited,
          factory.createLiteralTypeNode(factory.createStringLiteral(PLACEHOLDER)),
          visited.attributes,
          visited.qualifier,
          visited.typeArguments,
          visited.isTypeOf,
        )
      }
      return ts.visitEachChild(node, visit, context)
    }
    return root => ts.visitNode(root, visit)
  }
  const norm = node => {
    if (dropped.has(node)) return ''
    const result = ts.transform(node, [transformer])
    const out = result.transformed[0]
    const text = out ? squeeze(ts.isSourceFile(out) ? ts.createPrinter({ removeComments: true }).printFile(out) : print(out, sf)) : ''
    result.dispose()
    return text
  }
  return { norm, movedKeys }
}

// The base's top-level helpers the head no longer declares and imports from the kit.
function kitReplaced(checkout, baseSf, heads) {
  const declared = new Set(heads.flatMap(file => [...topLevelNames(checkout.parse(file))]))
  const fromKit = new Map()
  for (const file of heads) {
    for (const edge of importsOf(checkout.parse(file))) {
      if (edge.typeOnly) continue
      const target = checkout.resolver.resolve(edge.spec, file).file
      if (!target || !KIT_MODULES.has(target)) continue
      for (const { imported, local } of edge.names) fromKit.set(local, { imported, target })
    }
  }
  const names = new Map()
  for (const name of topLevelNames(baseSf)) {
    if (!declared.has(name) && fromKit.has(name)) names.set(name, fromKit.get(name))
  }
  return names
}

// A declaration's JavaScript, `export` dropped, for comparing a replaced helper with the kit's.
function javascriptOf(sf, name, as = name) {
  for (const statement of sf.statements) {
    if (!topLevelNames({ statements: [statement] }).has(name)) continue
    const text = statement
      .getText(sf)
      .replace(/^export\s+/, '')
      .replaceAll(new RegExp(`\\b${name}\\b`, 'g'), as)
    const js = ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve },
      fileName: sf.fileName,
    }).outputText
    return squeeze(js)
  }
  return undefined
}

// A test file's pieces for a split: its tests' statements by key and occurrence, and its other
// statements by the describe path they sit in.
function piecesOf(sf, norm) {
  const leaves = new Map()
  const context = []
  const tests = testsOf(sf)
  const byNode = new Map(tests.map(test => [test.node, test]))
  for (const test of tests) {
    if (test.kind === 'test') leaves.set(`${test.key}\0${test.occurrence}`, norm(test.statement ?? test.node))
  }
  const scan = (statements, at) => {
    for (const statement of statements) {
      const call = ts.isExpressionStatement(statement) ? byNode.get(statement.expression) : undefined
      if (call?.kind === 'describe') {
        const callback = call.node.arguments.at(-1)
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && ts.isBlock(callback.body)) {
          scan(callback.body.statements, call.key)
        }
      } else if (!call) {
        const text = norm(statement)
        if (text) context.push(`${at}\0${text}`)
      }
    }
  }
  scan(sf.statements, '')
  return { leaves, context }
}

gate('1b', checkout => {
  const problems = []
  const notes = []
  const moved = movedNames()
  const allow = readAllow('gate1b.allow')
  const allowFile = new Set(allow.filter(([, what]) => what === 'file').map(([file]) => file))
  const allowMocks = file => new Set(allow.filter(([f, what]) => f === file && what === 'mock').map(([, , spec]) => spec))
  const baseFiles = checkout.baseFiles.filter(file => file.startsWith('src/') && isTestFile(file))
  let compared = 0
  for (const file of baseFiles) {
    if (allowFile.has(file)) {
      notes.push(`skipped ${file} (gate1b.allow)`)
      continue
    }
    const stored = path.join(BASE_DIR, 'files', file)
    const baseText = fs.existsSync(stored) ? fs.readFileSync(stored, 'utf8') : checkout.baseText(file)
    const baseSf = parse(file, baseText)
    const splits = checkout.splitsOf(file)
    const remainder = checkout.head(file)
    const heads = [...new Set([...splits.map(s => s.to), ...(remainder ? [remainder] : [])])]
    if (heads.length === 0) {
      problems.push(`${file}: gone`)
      continue
    }
    const replaced = kitReplaced(checkout, baseSf, heads)
    for (const [name, { imported, target }] of replaced) {
      const kit = javascriptOf(checkout.parse(target), imported, name)
      const local = javascriptOf(baseSf, name)
      if (kit !== local) notes.push(`note ${file}: helper ${name} replaced by ${target}'s ${imported}, whose JavaScript differs (review)`)
    }
    const dropMocks = allowMocks(file)
    const base = normalizer(baseSf, { moved, dropHelpers: new Set(replaced.keys()), dropMocks })
    const baseBlock = leadingDocblock(baseText)
    for (const head of heads) {
      if (leadingDocblock(checkout.text(head)) !== baseBlock) {
        problems.push(`${file} → ${head}: the leading docblock is not the base's, or not first`)
      }
    }
    compared += 1
    if (splits.length === 0) {
      const headSide = normalizer(checkout.parse(heads[0]), { moved, dropHelpers: new Set(), dropMocks })
      const a = base.norm(baseSf)
      const b = headSide.norm(checkout.parse(heads[0]))
      if (a !== b) {
        let at = 0
        while (at < a.length && a[at] === b[at]) at += 1
        problems.push(
          `${file} → ${heads[0]}: differs at ${at}: base …${JSON.stringify(a.slice(Math.max(0, at - 60), at + 80))}… ` +
            `head …${JSON.stringify(b.slice(Math.max(0, at - 60), at + 80))}…`,
        )
      }
      const keysA = [...base.movedKeys].sort().join(' | ')
      const keysB = [...headSide.movedKeys].sort().join(' | ')
      if (keysA !== keysB) problems.push(`${file} → ${heads[0]}: moved mock keys differ: base [${keysA}], head [${keysB}]`)
      continue
    }
    // A split: test by test, and the rest statement by statement.
    const basePieces = piecesOf(baseSf, base.norm)
    const baseContext = new Set(basePieces.context)
    const seenContext = new Set()
    const headKeys = []
    for (const head of heads) {
      const sf = checkout.parse(head)
      const side = normalizer(sf, { moved, dropHelpers: new Set(), dropMocks })
      const pieces = piecesOf(sf, side.norm)
      headKeys.push(...side.movedKeys)
      for (const [key, text] of pieces.leaves) {
        const [title] = key.split('\0')
        if (checkout.headOfTest(file, title) !== head) continue
        const was = basePieces.leaves.get(key)
        if (was === undefined) continue
        if (was !== text) problems.push(`${file} → ${head}: test "${title}" differs`)
      }
      for (const item of pieces.context) {
        if (!baseContext.has(item)) problems.push(`${file} → ${head}: a statement not in the base: ${JSON.stringify(item.split('\0')[1].slice(0, 160))}`)
        seenContext.add(item)
      }
    }
    for (const [key] of basePieces.leaves) {
      const [title] = key.split('\0')
      const head = checkout.headOfTest(file, title)
      const sf = head && checkout.parse(head)
      if (!sf || !testsOf(sf).some(test => test.kind === 'test' && `${test.key}\0${test.occurrence}` === key)) {
        problems.push(`${file}: test "${title}" is in no piece`)
      }
    }
    for (const item of baseContext) {
      if (!seenContext.has(item)) problems.push(`${file}: a base statement in no piece: ${JSON.stringify(item.split('\0')[1].slice(0, 160))}`)
    }
    if ([...base.movedKeys].sort().join(' | ') !== headKeys.sort().join(' | ')) {
      problems.push(`${file}: moved mock keys differ across its pieces`)
    }
  }
  return verdict(problems, `${compared} base test files compared, ${moved.size} moved names`, notes)
})
