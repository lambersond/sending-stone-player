// Gate 1, assertions (round.md §3.4): per test (its describe/it title path and occurrence), the
// ordered expect(...) statements, whitespace collapsed outside strings, at base and head; every
// base list equals the head's for the same test, paths followed (moves.tsv, git's renames, the
// checkout's moves.d splits). The goldens' tests are held the same way from the commit that added
// them. Allowlist gate1.allow (path, reason): a test file whose tests may be gone (commit 26's
// retirement of C1, C3 and C9 only).
import fs from 'node:fs'
import path from 'node:path'
import {
  BASE_DIR,
  expectsOf,
  frozenFiles,
  gate,
  git,
  isTestFile,
  parse,
  readAllow,
  testsOf,
  verdict,
} from './gate-lib.mjs'

gate('1', checkout => {
  const problems = []
  const allowed = new Set(readAllow('gate1.allow').map(([file]) => file))
  const headTests = file =>
    checkout.memo(`tests:${file}`, () => {
      const sf = checkout.parse(file)
      const map = new Map()
      for (const test of testsOf(sf)) {
        if (test.kind === 'test') map.set(`${test.key}\0${test.occurrence}`, expectsOf(test, sf))
      }
      return map
    })
  let tests = 0
  const compare = (origin, file, list, where) => {
    for (const { key, occurrence, expects } of list) {
      tests += 1
      const now = where(key)
      if (!now) {
        if (!allowed.has(origin)) problems.push(`${origin}: gone (${key})`)
        continue
      }
      const head = headTests(now).get(`${key}\0${occurrence}`)
      if (!head) problems.push(`${origin} → ${now}: no test "${key}" #${occurrence}`)
      else if (JSON.stringify(head) !== JSON.stringify(expects)) {
        const at = expects.findIndex((line, i) => head[i] !== line)
        const index = at === -1 ? expects.length : at
        problems.push(
          `${origin} → ${now}: "${key}" #${occurrence}, expect ${index + 1} of ${expects.length}: ` +
            `base ${JSON.stringify(expects[index] ?? '(none)')}, head ${JSON.stringify(head[index] ?? '(none)')}`,
        )
      }
    }
  }
  // The base test files.
  const root = path.join(BASE_DIR, 'expects')
  const baseFiles = checkout.baseFiles.filter(file => file.startsWith('src/') && isTestFile(file))
  for (const file of baseFiles) {
    const json = path.join(root, `${file}.json`)
    if (!fs.existsSync(json)) throw new Error(`no ${json}: run R/tools/base.sh --force`)
    compare(file, file, JSON.parse(fs.readFileSync(json, 'utf8')), key =>
      checkout.headOfTest(file, key),
    )
  }
  // The goldens' (and the kit test's) tests, from the commit that added each.
  let frozen = 0
  for (const { file, sha, gone } of frozenFiles(checkout)) {
    if (!isTestFile(file) || file.endsWith('.snap')) continue
    frozen += 1
    const sf = parse(file, git(checkout.root, ['show', `${sha}:${file}`]))
    const list = testsOf(sf)
      .filter(test => test.kind === 'test')
      .map(test => ({ key: test.key, occurrence: test.occurrence, expects: expectsOf(test, sf) }))
    compare(file, file, list, () => (gone ? undefined : file))
  }
  return verdict(problems, `${tests} tests in ${baseFiles.length} base test files and ${frozen} frozen ones`)
})
