#!/usr/bin/env node
'use strict'
/*
 * move.cjs: v0.43's whole-file move codemod (round.md §1.0 R1.0.1, commit 5; M).
 *
 *   node move.cjs --root <checkout> [--owners <owners.tsv>] [--spec <tsv>] [--check-ts N]
 *                 [--no-git] [--no-lint] [--dry] [--x <scratch folder of the locks>]
 *   node move.cjs --root <checkout> --verify     (after a run: nothing changed but imports and paths)
 *
 * The moves: owners.tsv's rows whose path_after is another path (a file move) or "DELETED (barrel …)"
 * (one of the 27 barrels), or a spec of `from<TAB>to` lines (`to` = `-` deletes a barrel). In order:
 *  1. A barrel's own declarations (only components/notes/index.ts has one: NotesPlace) go first to
 *     their 2b home with export-move.cjs (owners.tsv's "moved in 2b … ← components/notes/index.ts"),
 *     so the barrel holds re-exports only.
 *  2. Every import through a barrel points at the declaring module (one declaration per module when
 *     a line took names from several), in its old specifier's style; `export … from` lines, import
 *     types and the seven barrel jest.mock factories (with the requireActual and `typeof import()`
 *     inside them, and a requireActual whose destructured names all come from one module) too. Then
 *     the barrels are deleted (git rm).
 *  3. Every module-specifier string whose file or target moves is re-specified for the new layout,
 *     all moves at once (relative stays relative, from the file's new folder; `@/…` stays `@/…`):
 *     imports, export-from, `import()` and `typeof import()` types, which is what TypeScript's
 *     LanguageService getEditsForFileRename does per rename, and (4.) jest.mock, doMock, unmock,
 *     requireActual, requireMock and require() paths, which TypeScript does not see. TS's own call
 *     takes ~55 s a rename on this program (327 renames: 5 h), so this pass resolves each specifier
 *     with TS's module resolution and `--check-ts N` compares it with getEditsForFileRename on N of
 *     the moves (each alone, on the unmoved program): the specifiers must be the same.
 *     A string literal that is a moved file's repo path ('src/components/…/prompt-banner.tsx',
 *     read by its test with readFileSync: prompt-banner.test.tsx, end-turn.test.ts) is set to the
 *     new path too, and listed: those lines are not mock paths, so gate 1b needs gate1b.allow rows.
 *  5. git mv per file (history follows), git rm per barrel, the new contents written; then eslint's
 *     own fixers for the import lines only (prettier, import/order, no-duplicates, newline-after-
 *     import, no-multiple-empty-lines) under the checks locks, and a test's leading
 *     @jest-environment docblock checked to stay first. Nothing else in a file changes.
 *  6. R/tools/moves.tsv gets a `file` record per move, a `delete` per barrel and a `name` per
 *     barrel declaration moved (the format: the file's header and handoff/moves-format.txt).
 */
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const lib = require('./export-move.cjs')

function fromOwners(ownersFile) {
  const files = []
  const barrels = []
  const rows = fs.readFileSync(ownersFile, 'utf8').split('\n').slice(1).filter(Boolean)
  for (const line of rows) {
    const [base, after] = line.split('\t')
    if (base === '-' || after === '=') continue
    if (after.startsWith('DELETED')) barrels.push(base)
    else {
      const to = after.split(' ')[0]
      if (to !== base) files.push([base, to])
    }
  }
  return { files, barrels }
}

function fromSpec(specFile) {
  const files = []
  const barrels = []
  for (const line of fs.readFileSync(specFile, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [from, to] = line.split('\t')
    if (to === '-') barrels.push(from)
    else files.push([from, to])
  }
  return { files, barrels }
}

/** exported name → { file, imported } for a barrel of `export { … } from` lines. */
function barrelExports(p, file) {
  const ts = p.ts
  const sf = p.sourceFile(file)
  const map = new Map()
  for (const st of sf.statements) {
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      const target = p.resolve(st.moduleSpecifier.text, file)
      if (!target) throw new Error(`barrel ${p.rel(file)}: ${st.moduleSpecifier.text} does not resolve`)
      for (const el of st.exportClause.elements) {
        map.set(el.name.text, { file: target, imported: (el.propertyName ?? el.name).text })
      }
    } else if (ts.isImportDeclaration(st)) {
      continue
    } else {
      throw new Error(`barrel ${p.rel(file)} has a statement that is not a re-export: ${st.getText(sf).slice(0, 60)}`)
    }
  }
  return map
}

/** Step 2: importers, import types and mocks of the barrels point at the declaring modules. */
function unbarrel(p, barrels) {
  const ts = p.ts
  const exportsOf = new Map(barrels.map(b => [b, barrelExports(p, b)]))
  const program = p.program()
  let count = 0
  for (const f of [...p.names]) {
    if (exportsOf.has(f)) continue
    const sf = program.getSourceFile(f)
    if (!sf) continue
    const edits = []
    const where = n => `${p.rel(f)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`
    const targetOf = (barrel, name, n) => {
      const e = exportsOf.get(barrel).get(name)
      if (!e) throw new Error(`${where(n)}: ${name} is not exported by ${p.rel(barrel)}`)
      return e
    }
    const handledTypes = new Set()
    for (const { literal, decl, type } of lib.importLiterals(ts, sf)) {
      const b = p.resolve(literal.text, f)
      if (!exportsOf.has(b)) continue
      if (decl) {
        const isImport = ts.isImportDeclaration(decl)
        const nb = isImport ? decl.importClause && decl.importClause.namedBindings : decl.exportClause
        if (isImport && decl.importClause && decl.importClause.name) throw new Error(`${where(decl)}: a default import of a barrel`)
        if (!nb || !(ts.isNamedImports(nb) || ts.isNamedExports(nb))) throw new Error(`${where(decl)}: not a named import of a barrel`)
        const groups = new Map()
        for (const el of nb.elements) {
          const name = (el.propertyName ?? el.name).text
          const t = targetOf(b, name, el)
          const local = el.name.text
          const text = (el.isTypeOnly ? 'type ' : '') + (t.imported === local ? local : `${t.imported} as ${local}`)
          if (!groups.has(t.file)) groups.set(t.file, [])
          groups.get(t.file).push({ text, same: text === el.getText(sf) })
        }
        if (groups.size === 1 && [...groups.values()][0].every(g => g.same)) {
          const [target] = groups.keys()
          edits.push([literal.getStart(sf) + 1, literal.end - 1, p.spec(f, target, literal.text)])
        } else {
          const lines = [...groups].map(([target, els]) =>
            lib.declText(ts, sf, decl, els.map(e => e.text), `'${p.spec(f, target, literal.text)}'`),
          )
          edits.push([decl.getStart(sf), decl.end, lines.join('\n')])
        }
        count++
      } else if (type && type.qualifier) {
        let q = type.qualifier
        while (ts.isQualifiedName(q)) q = q.left
        const t = targetOf(b, q.text, type)
        if (t.imported !== q.text) throw new Error(`${where(type)}: an import type of a renamed barrel export`)
        edits.push([literal.getStart(sf) + 1, literal.end - 1, p.spec(f, t.file, literal.text)])
        handledTypes.add(type)
        count++
      }
    }
    const calls = lib.pathCalls(ts, sf)
    const mocks = calls.filter(c => c.kind === 'mock' || c.kind === 'doMock').map(c => c.call)
    for (const { call, kind, literal } of calls) {
      const b = p.resolve(literal.text, f)
      if (!exportsOf.has(b)) continue
      let names
      let scope
      if (kind === 'mock' || kind === 'doMock') {
        names = call.arguments[1] && lib.factoryKeys(ts, call.arguments[1])
        scope = call.arguments[1]
      } else if (kind === 'requireActual' || kind === 'requireMock') {
        if (ts.findAncestor(call.parent, n => mocks.includes(n))) continue // follows its mock
        names = lib.namesReadFrom(ts, sf, call, program.getTypeChecker())
      }
      if (!names || !names.length) throw new Error(`${where(call)}: jest.${kind} of a barrel without names to follow`)
      const files = new Set(names.map(n => targetOf(b, n, call).file))
      if (files.size !== 1) throw new Error(`${where(call)}: jest.${kind} of a barrel reads several modules`)
      if (names.some(n => targetOf(b, n, call).imported !== n)) throw new Error(`${where(call)}: a renamed barrel export`)
      const [target] = files
      edits.push([literal.getStart(sf) + 1, literal.end - 1, p.spec(f, target, literal.text)])
      const inner = n => {
        if (n !== literal && ts.isStringLiteral(n) && p.resolve(n.text, f) === b) {
          const up = n.parent
          if ((ts.isCallExpression(up) && up.arguments[0] === n) || ts.isLiteralTypeNode(up)) {
            edits.push([n.getStart(sf) + 1, n.end - 1, p.spec(f, target, n.text)])
            if (ts.isLiteralTypeNode(up)) handledTypes.add(up.parent)
          }
        }
        ts.forEachChild(n, inner)
      }
      if (scope) ts.forEachChild(scope, inner)
      for (const t of call.typeArguments || []) inner(t)
      count++
    }
    for (const { literal, type } of lib.importLiterals(ts, sf)) {
      if (type && !handledTypes.has(type) && exportsOf.has(p.resolve(literal.text, f))) {
        throw new Error(`${where(type)}: an import type of a barrel not followed`)
      }
    }
    if (edits.length) p.write(f, lib.applyEdits(sf.text, dedupe(edits)))
  }
  for (const b of barrels) p.remove(b)
  return count
}

function dedupe(edits) {
  const seen = new Set()
  return edits.filter(e => {
    const k = e.join('\0')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Steps 3-4: every module-specifier string (imports, export-from, import(), import types, jest.mock
 * and its kin, require) whose file or target moves is re-specified for the new layout, all moves at
 * once: a relative one from the file's new folder to the target's new place, an `@/…` one to the
 * target's new path. Returns the edits per file (current paths) and the specifiers it could not keep.
 */
function rewriteForMoves(p, moved, { jest = true } = {}) {
  const ts = p.ts
  const program = p.program()
  const edits = new Map()
  const problems = []
  const pathStrings = []
  const byPath = new Map([...moved].map(([a, b]) => [p.rel(a), p.rel(b)]))
  for (const f of p.names) {
    const sf = program.getSourceFile(f)
    if (!sf) continue
    const newF = moved.get(f) ?? f
    const literals = [
      ...lib.importLiterals(ts, sf).map(l => l.literal),
      ...(jest ? lib.pathCalls(ts, sf).map(c => c.literal) : []),
    ]
    const fileEdits = []
    // A string that is a moved file's repo path (a test reading its unit's source by path:
    // prompt-banner.test.tsx, end-turn.test.ts) names the file's new path.
    const walk = node => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const to = byPath.get(node.text)
        if (to && !literals.includes(node)) {
          fileEdits.push([node.getStart(sf) + 1, node.end - 1, to])
          pathStrings.push(`${p.rel(newF)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: '${node.text}' → '${to}'`)
        }
      }
      ts.forEachChild(node, walk)
    }
    if (jest) walk(sf)
    for (const literal of literals) {
      const spec = literal.text
      const target = p.resolve(spec, f)
      const where = `${p.rel(f)}:${sf.getLineAndCharacterOfPosition(literal.getStart(sf)).line + 1}`
      if (!target) {
        if (spec.startsWith('.') && newF !== f) problems.push(`${where}: ${spec} does not resolve, and its file moves`)
        continue
      }
      const newT = moved.get(target) ?? target
      if (newT === target && newF === f) continue
      if (spec.startsWith('@/') && newT === target) continue
      if (!spec.startsWith('.') && !spec.startsWith('@/')) {
        problems.push(`${where}: ${spec} names a moved file through another alias`)
        continue
      }
      if (/^index\./.test(path.basename(target)) && !/\/index$/.test(spec)) {
        problems.push(`${where}: ${spec} names a folder's index`)
        continue
      }
      const next = p.spec(newF, newT, spec)
      if (next !== spec) fileEdits.push([literal.getStart(sf) + 1, literal.end - 1, next])
    }
    if (fileEdits.length) edits.set(f, fileEdits)
  }
  return { edits, problems, pathStrings }
}

/**
 * --check-ts N: for N of the moves, each alone on the program before any move, TypeScript's
 * LanguageService getEditsForFileRename and rewriteForMoves must give the same specifiers (TS's take
 * ~1 min a move on this program, so the codemod uses its own pass and checks it against TS's here).
 */
function checkAgainstTs(p, files, n) {
  const fmt = p.ts.getDefaultFormatCodeSettings('\n')
  const step = Math.max(1, Math.floor(files.length / n))
  let bad = 0
  for (let i = 0; i < files.length && i / step < n; i += step) {
    const [from, to] = files[i].map(f => p.abs(f))
    const tsEdits = new Map()
    for (const fe of p.ls.getEditsForFileRename(from, to, fmt, {})) {
      const list = fe.textChanges.map(c => `${c.span.start}:${c.newText}`).sort()
      if (list.length) tsEdits.set(path.resolve(fe.fileName), list)
    }
    const mine = new Map()
    for (const [f, es] of rewriteForMoves(p, new Map([[from, to]]), { jest: false }).edits) {
      mine.set(f, es.map(([s, , t]) => `${s}:${t}`).sort())
    }
    const same =
      tsEdits.size === mine.size && [...tsEdits].every(([f, l]) => JSON.stringify(mine.get(f)) === JSON.stringify(l))
    if (!same) bad++
    console.error(`check-ts ${p.rel(from)}: ${same ? 'same' : 'DIFFERENT'} (${tsEdits.size} files)`)
    if (!same) console.error(JSON.stringify({ ts: [...tsEdits], mine: [...mine] }, null, 1))
  }
  return bad
}

/**
 * --verify: every renamed or modified src file staged in the checkout (against HEAD) equals its old
 * text once import and export-from lines are cut, module-path strings (import types, jest.mock and
 * kin) and moved-file path strings blanked, and whitespace and trailing commas dropped (prettier
 * re-wraps a line a longer path pushed past 80 columns); a leading @jest-environment docblock stays
 * first. Prints what differs; exit 1 if anything does.
 */
function verify(root) {
  const ts = require(require.resolve('typescript', { paths: [root] }))
  const git = a => cp.execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
  const status = git(['diff', '--cached', '-M', '--name-status', 'HEAD', '--', 'src']).trim().split('\n').filter(Boolean)
  const paths = new Set()
  for (const line of status) {
    const [st, a, b] = line.split('\t')
    if (st.startsWith('R')) paths.add(a).add(b)
  }
  const norm = (file, text) => {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const cuts = []
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) || (ts.isExportDeclaration(st) && st.moduleSpecifier)) cuts.push([st.getFullStart(), st.end, ''])
    }
    const blank = n => cuts.push([n.getStart(sf), n.end, "'<path>'"])
    const walk = n => {
      if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) blank(n.argument.literal)
      else if (ts.isStringLiteral(n) && paths.has(n.text)) blank(n)
      ts.forEachChild(n, walk)
    }
    walk(sf)
    for (const c of lib.pathCalls(ts, sf)) blank(c.literal)
    cuts.sort((a, b) => b[0] - a[0] || b[1] - a[1])
    let t = text
    let last = Infinity
    for (const [s, e, r] of cuts) {
      if (e > last) continue
      t = t.slice(0, s) + r + t.slice(e)
      last = s
    }
    return t.replace(/\s+/g, '').replace(/,(?=[)\]}>])/g, '')
  }
  let compared = 0
  const bad = []
  for (const line of status) {
    const [st, a, b] = line.split('\t')
    if (!/^[RM]/.test(st) || !/\.tsx?$/.test(b || a)) continue
    compared++
    const old = git(['show', `HEAD:${a}`])
    const now = fs.readFileSync(path.join(root, b || a), 'utf8')
    if (norm(a, old) !== norm(b || a, now)) bad.push(`differs beyond imports and paths: ${a}${b ? ` → ${b}` : ''}`)
    const doc = old.match(/^\/\*\*[\s\S]*?\*\//)
    if (doc && /@jest-environment/.test(doc[0]) && !now.startsWith(doc[0])) bad.push(`docblock not first: ${b || a}`)
  }
  for (const l of bad) console.log(l)
  const renamed = status.filter(l => l.startsWith('R')).length
  const gone = status.filter(l => l.startsWith('D')).length
  console.log(`verify: ${compared} files compared, ${bad.length} differ; ${renamed} renames, ${gone} deletions`)
  return bad.length ? 1 : 0
}

function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (['--no-git', '--no-lint', '--dry', '--verify'].includes(a)) out[a.slice(2)] = true
    else out[a.slice(2)] = argv[++i]
  }
  return out
}

function main() {
  const a = args(process.argv.slice(2))
  const root = path.resolve(a.root || process.cwd())
  if (a.verify) {
    process.exitCode = verify(root)
    return
  }
  const owners = path.resolve(a.owners || path.join(root, '.refactor/owners.tsv'))
  const { files, barrels } = a.spec ? fromSpec(path.resolve(a.spec)) : fromOwners(owners)
  const p = new lib.Project(root)
  const abs = f => p.abs(f)
  const t0 = Date.now()
  const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`

  // Checks before anything moves.
  const froms = new Set(files.map(([f]) => f))
  const tos = new Set()
  for (const [from, to] of files) {
    if (!p.exists(abs(from))) throw new Error(`${from} is missing`)
    if (tos.has(to)) throw new Error(`two files move to ${to}`)
    if (p.exists(abs(to)) && !froms.has(to)) throw new Error(`${to} exists`)
    tos.add(to)
  }
  for (const b of barrels) if (!p.exists(abs(b))) throw new Error(`barrel ${b} is missing`)

  // 1. A barrel's own declarations, to their 2b homes.
  const records = []
  const spec2b = lib.specFromOwners(owners)
  for (const b of barrels) {
    const sf = p.sourceFile(abs(b))
    const locals = sf.statements.filter(s => !p.ts.isExportDeclaration(s) && !p.ts.isImportDeclaration(s))
    if (!locals.length) continue
    const rows = spec2b.filter(r => r[1] === b)
    if (!rows.length) throw new Error(`barrel ${b} declares something with no 2b home in owners.tsv`)
    for (const [dest, , names] of rows) {
      const res = lib.exportMove(p, { source: b, dest, names: names.split(/\s+/) })
      console.error(`${b}: ${res.moved.join(' ')} → ${dest} first (the barrel must hold re-exports only)`)
      for (const n of res.moved) records.push(['name', b, dest, n, b])
    }
  }

  // 2. Barrels.
  const unbarrelled = unbarrel(p, barrels.map(abs))
  console.error(`barrels: ${barrels.length} gone, ${unbarrelled} import lines and mocks pointed at their modules (${secs()})`)

  // 3-4. The file moves: every specifier re-specified at once, then the renames.
  if (a['check-ts']) {
    const bad = checkAgainstTs(p, files, Number(a['check-ts']))
    if (bad) throw new Error(`check-ts: ${bad} moves differ from TypeScript's edits`)
  }
  const moved = new Map(files.map(([from, to]) => [abs(from), abs(to)]))
  const { edits, problems, pathStrings } = rewriteForMoves(p, moved)
  if (problems.length) throw new Error('specifiers that cannot follow:\n' + problems.join('\n'))
  // Not module specifiers: gate 1b sees these lines change (gate1b.allow rows, the orchestrator's).
  for (const line of pathStrings) console.error(`path string followed its file (gate1b.allow): ${line}`)
  let specs = 0
  for (const [f, es] of edits) {
    p.write(f, lib.applyEdits(p.read(f), es))
    specs += es.length
  }
  for (const [from, to] of moved) p.rename(from, to)
  console.error(`moves: ${files.length} files, ${specs} specifiers in ${edits.size} files (${secs()})`)

  for (const [from, to] of files) records.push(['file', from, to, '-', from])
  for (const b of barrels) records.push(['delete', b, '-', '-', b])
  const changed = [...p.changed].map(f => p.rel(f))
  if (a.dry) {
    console.log(JSON.stringify({ moves: files.length, barrels: barrels.length, changed }, null, 2))
    return
  }
  p.flush({ git: !a['no-git'] })
  if (!a['no-lint']) lib.lintFix(root, [...p.changed], a.x || lib.X_DEFAULT)
  if (!a['no-git']) cp.execFileSync('git', ['add', '-A', '--', ...changed], { cwd: root })
  lib.record(root, records)
  console.log(JSON.stringify({ moves: files.length, barrels: barrels.length, edited: changed.length, seconds: Math.round((Date.now() - t0) / 1000) }))
}

try {
  main()
} catch (e) {
  console.error(e.stack || String(e))
  process.exit(1)
}
