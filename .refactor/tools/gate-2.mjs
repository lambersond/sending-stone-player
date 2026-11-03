// Gate 2, per test (round.md §3.4): each base test (X/base/jest-base.tsv) is present at head (its
// file followed, its fullName and occurrence), `status: passed`, numPassingAsserts ≥ the base's.
// A test red in jest.json that l1.sh's rerun alone found green (reruns.tsv) counts as passed and
// is listed as a flake.
import path from 'node:path'
import { gate, readBaseTests, readTsv, retired, unescapeField, verdict } from './gate-lib.mjs'

gate('2', checkout => {
  const problems = []
  const notes = []
  const head = new Map()
  for (const suite of checkout.jest.suites) {
    for (const test of suite.tests) head.set(`${suite.file}\0${test.fullName}\0${test.occurrence}`, test)
  }
  const reruns = new Map(
    readTsv(path.join(checkout.outdir, 'reruns.tsv')).map(([file, fullName, status]) => [
      `${file}\0${unescapeField(fullName)}`,
      status,
    ]),
  )
  const gone = retired()
  const base = readBaseTests()
  for (const test of base) {
    if (gone.has(test.file)) continue
    const file = checkout.headOfTest(test.file, test.fullName)
    const now = file && head.get(`${file}\0${test.fullName}\0${test.occurrence}`)
    const where = `${test.file}${file && file !== test.file ? ` → ${file}` : ''}: "${test.fullName}"${test.occurrence ? ` #${test.occurrence}` : ''}`
    if (!now) problems.push(`${where}: not run`)
    else if (now.status !== 'passed') {
      if (reruns.get(`${file}\0${test.fullName}`) === 'passed') notes.push(`flake ${where}: ${now.status}, green alone`)
      else problems.push(`${where}: ${now.status}`)
    } else if (now.numPassingAsserts < test.numPassingAsserts) {
      problems.push(`${where}: ${now.numPassingAsserts} passing asserts, base ${test.numPassingAsserts}`)
    }
  }
  return verdict(problems, `${base.length} base tests`, notes)
})
