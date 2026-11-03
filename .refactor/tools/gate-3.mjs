// Gate 3, counts (round.md §3.4), derived from the checkout: head suites ≥ base suites − retired
// (counts.conf's `retire` rows, commit 26's only); every head test not in the base sits in a file
// absent at the base or in a split's target (moves.d), so no base file gains a test; and the head
// runs at least as many tests as the base less the retired ones.
import { gate, readBaseTests, retired, verdict } from './gate-lib.mjs'

gate('3', checkout => {
  const problems = []
  const base = readBaseTests()
  const gone = retired()
  const baseSuites = new Set(base.map(test => test.file))
  const keep = [...baseSuites].filter(file => !gone.has(file))
  const known = new Set(
    base.map(test => {
      const file = checkout.headOfTest(test.file, test.fullName)
      return `${file}\0${test.fullName}\0${test.occurrence}`
    }),
  )
  const targets = new Set(checkout.splits.map(split => split.to))
  const { suites, totals } = checkout.jest
  if (suites.length < keep.length) {
    problems.push(`${suites.length} suites ran, the base had ${baseSuites.size} (${gone.size} retired)`)
  }
  let added = 0
  const addedIn = new Map()
  for (const suite of suites) {
    const baseFile = checkout.base(suite.file)
    const newFile = baseFile === undefined
    for (const test of suite.tests) {
      if (known.has(`${suite.file}\0${test.fullName}\0${test.occurrence}`)) continue
      added += 1
      addedIn.set(suite.file, (addedIn.get(suite.file) ?? 0) + 1)
      if (!newFile && !targets.has(suite.file)) {
        problems.push(`${suite.file} (base ${baseFile}): a test the base did not have: "${test.fullName}"`)
      }
    }
  }
  const baseTests = base.filter(test => !gone.has(test.file)).length
  if (totals.tests < baseTests) problems.push(`${totals.tests} tests ran, the base had ${baseTests}`)
  const notes = [...addedIn].map(([file, count]) => `new ${file}: ${count} test(s)`)
  return verdict(
    problems,
    `${suites.length} suites (base ${baseSuites.size}), ${totals.tests} tests (base ${base.length}), ${added} new`,
    notes,
  )
})
