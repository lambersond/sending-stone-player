// The gates' base (round.md §3.4), from 24f808b's git objects and its jest run:
// `node base-tsv.mjs <jest-base.json> [outdir]` (outdir: X/base) writes
//   jest-base.tsv   file, fullName, status, numPassingAsserts, occurrence (one row per test)
//   expects/<path>.json   gate 1's per-test expect lists of each base test file
//   files/<path>    gate 1b's base test files as they were (normalized by the gate itself, since
//                   its dropped lines follow moves.tsv, which grows)
//   base.json       the base's import-graph groups (gate 12), server graph and directives (gate 11)
import fs from 'node:fs'
import path from 'node:path'
import {
  APP,
  BASE,
  BASE_DIR,
  directiveOf,
  escapeField,
  expectsOf,
  git,
  graphEdges,
  isSource,
  isTestFile,
  makeResolver,
  parse,
  readJest,
  serverGraph,
  stronglyConnected,
  testsOf,
  blobs,
} from './gate-lib.mjs'

const [jestJson, outdir = BASE_DIR] = process.argv.slice(2)
if (!jestJson) {
  process.stderr.write('usage: node base-tsv.mjs <jest-base.json> [outdir]\n')
  process.exit(2)
}

// 1. The tests jest ran at the base.
const jest = readJest(jestJson)
const rows = ['file\tfullName\tstatus\tnumPassingAsserts\toccurrence']
for (const suite of jest.suites) {
  for (const test of suite.tests) {
    rows.push(
      [suite.file, escapeField(test.fullName), test.status, test.numPassingAsserts, test.occurrence].join('\t'),
    )
  }
}
fs.mkdirSync(outdir, { recursive: true })
fs.writeFileSync(path.join(outdir, 'jest-base.tsv'), rows.join('\n') + '\n')

// 2. The base tree, read from git.
const files = git(APP, ['ls-tree', '-r', '--name-only', '-z', BASE]).split('\0').filter(Boolean)
const wanted = files.filter(file => file === 'tsconfig.json' || (file.startsWith('src/') && isSource(file)))
const texts = blobs(APP, wanted.map(file => `${BASE}:${file}`))
const text = file => texts.get(`${BASE}:${file}`)
const parsed = new Map()
const parseOf = file => {
  if (!parsed.has(file)) parsed.set(file, parse(file, text(file)))
  return parsed.get(file)
}
const fileSet = new Set(files)
const resolver = makeResolver(APP, fileSet, text)
const srcFiles = wanted.filter(file => file.startsWith('src/') && /\.(ts|tsx)$/.test(file))

// 3. Each base test file as it was, and its tests' expect lists.
const testFiles = srcFiles.filter(isTestFile)
for (const file of testFiles) {
  const out = path.join(outdir, 'files', file)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, text(file))
  const sf = parseOf(file)
  const tests = testsOf(sf)
    .filter(test => test.kind === 'test')
    .map(test => ({ key: test.key, occurrence: test.occurrence, expects: expectsOf(test, sf) }))
  const json = path.join(outdir, 'expects', `${file}.json`)
  fs.mkdirSync(path.dirname(json), { recursive: true })
  fs.writeFileSync(json, JSON.stringify(tests, undefined, 1) + '\n')
}

// 4. The import graph's groups, the server graph and every file's directive.
const groups = stronglyConnected(graphEdges(srcFiles, parseOf, resolver.resolve))
const { server, boundaries } = serverGraph(srcFiles, parseOf, resolver.resolve)
const directives = Object.fromEntries(
  srcFiles.map(file => [file, directiveOf(parseOf(file))]).filter(([, directive]) => directive),
)
fs.writeFileSync(
  path.join(outdir, 'base.json'),
  JSON.stringify({ commit: BASE, groups, server, boundaries, directives }, undefined, 1) + '\n',
)
process.stdout.write(
  `base: ${rows.length - 1} tests in ${jest.suites.length} suites; ${testFiles.length} test files; ` +
    `${groups.length} cycle groups; ${server.length} server modules, ${boundaries.length} client ` +
    `boundaries; ${Object.keys(directives).length} directives\n`,
)
