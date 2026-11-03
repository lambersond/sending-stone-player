// Gate 8, prisma (round.md §3.4, R3.4), from commit 2 (once the node kit, test-utils-node.ts, is
// in the checkout): each of the 25 route suites that use no prismaMock
// (R/analysis/T/route-suites.txt, "noprisma") calls guardNoDb() at its top level, and passed.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { ANALYSIS, gate, notApplicable, verdict } from './gate-lib.mjs'

gate('8', checkout => {
  if (!checkout.exists('src/utils/test-utils-node.ts')) return notApplicable('no node kit yet (commit 2)')
  const list = fs
    .readFileSync(path.join(ANALYSIS, 'T/route-suites.txt'), 'utf8')
    .split('\n')
    .filter(line => line.startsWith('noprisma '))
    .map(line => line.split(' ')[2])
  const problems = []
  const status = new Map(checkout.jest.suites.map(suite => [suite.file, suite.status]))
  for (const baseFile of list) {
    const file = checkout.head(baseFile)
    if (!file) {
      problems.push(`${baseFile}: gone`)
      continue
    }
    const guarded = checkout
      .parse(file)
      .statements.some(
        s =>
          ts.isExpressionStatement(s) &&
          ts.isCallExpression(s.expression) &&
          ts.isIdentifier(s.expression.expression) &&
          s.expression.expression.text === 'guardNoDb',
      )
    if (!guarded) problems.push(`${file}: no guardNoDb()`)
    if (status.get(file) !== 'passed') problems.push(`${file}: ${status.get(file) ?? 'not run'}`)
  }
  if (list.length !== 25) problems.push(`route-suites.txt names ${list.length} noprisma suites, not 25`)
  return verdict(problems, `${list.length} suites`)
})
