// Gate 9, the lint ratchet (round.md §3.4): `eslint -f json` warnings per (unit, rule) and, for
// no-restricted-syntax, per (unit, check) ≤ the ratchet's, the unit being src/features/<feature>
// and otherwise src/<top folder> (the repo's top folder outside src); errors stay 0. The ratchet
// is R/analysis/ratchet-base.json (commit 1) until src/features exists (commit 5), then
// R/analysis/ratchet-moved.json (taken after commit 5 under these conditions).
import fs from 'node:fs'
import path from 'node:path'
import { syntaxCheck } from '../analysis/metrics/lint.mjs'
import { ANALYSIS, gate, verdict } from './gate-lib.mjs'

function unitOf(file) {
  const parts = file.split('/')
  if (parts[0] !== 'src') return parts.length > 1 ? parts[0] : '(root)'
  if (parts[1] === 'features' && parts.length > 3) return `src/features/${parts[2]}`
  return parts.length > 2 ? `src/${parts[1]}` : 'src'
}

gate('9', checkout => {
  const moved = checkout.has('src/features') || checkout.files.some(file => file.startsWith('src/features/'))
  const name = moved ? 'ratchet-moved.json' : 'ratchet-base.json'
  const ratchetFile = path.join(ANALYSIS, name)
  if (!fs.existsSync(ratchetFile)) return verdict([`no ${ratchetFile} (taken after commit 5)`], name)
  const ratchet = JSON.parse(fs.readFileSync(ratchetFile, 'utf8'))
  const lint = JSON.parse(fs.readFileSync(path.join(checkout.outdir, 'eslint.json'), 'utf8'))
  const byUnit = new Map()
  const byCheck = new Map()
  let errors = 0
  let warnings = 0
  const add = (map, unit, key) => {
    if (!map.has(unit)) map.set(unit, new Map())
    map.get(unit).set(key, (map.get(unit).get(key) ?? 0) + 1)
  }
  for (const result of lint) {
    const file = path.relative(checkout.root, result.filePath)
    errors += result.errorCount
    for (const message of result.messages) {
      if (message.severity === 2) continue
      warnings += 1
      const rule = message.ruleId ?? '(no rule)'
      add(byUnit, unitOf(file), rule)
      if (rule === 'no-restricted-syntax') add(byCheck, unitOf(file), syntaxCheck(message.message))
    }
  }
  const problems = []
  if (errors > 0) {
    const where = lint
      .filter(r => r.errorCount > 0)
      .flatMap(r =>
        r.messages
          .filter(m => m.severity === 2)
          .map(m => `${path.relative(checkout.root, r.filePath)}:${m.line} ${m.ruleId}: ${m.message}`),
      )
    problems.push(`${errors} lint error(s): ${where.slice(0, 20).join(' | ')}`)
  }
  const compare = (now, then, what) => {
    for (const [unit, counts] of now) {
      for (const [key, count] of counts) {
        const limit = then[unit]?.[key] ?? 0
        if (count > limit) problems.push(`${unit} ${what} ${key}: ${count} warnings, the ratchet ${limit}`)
      }
    }
  }
  compare(byUnit, ratchet.byFolder, 'rule')
  compare(byCheck, ratchet.noRestrictedSyntaxByCheck ?? {}, 'check')
  return verdict(problems, `${warnings} warnings, ${errors} errors, against ${name} (${ratchet.totals?.warnings} warnings)`)
})
