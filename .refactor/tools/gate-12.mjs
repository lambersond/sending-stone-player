// Gate 12, cycles (round.md §3.4, SA F14): the import graph of src (type-only imports included, as
// R/analysis/metrics/graph.mjs counts it) has no strongly connected group the base lacks, and no
// group grows: each head group's modules, followed back to the base, all sit in one base group,
// and none is new since the base. Groups gone are listed (group 1 after commit 7, the db group
// after commit 9, all four after integration; from commit 23 the import-cycle test holds it).
import { gate, graphEdges, readBaseJson, stronglyConnected, verdict } from './gate-lib.mjs'

gate('12', checkout => {
  const problems = []
  const notes = []
  const base = readBaseJson('base.json')
  const files = checkout.files.filter(file => file.startsWith('src/') && /\.(ts|tsx)$/.test(file))
  const groups = stronglyConnected(graphEdges(files, file => checkout.parse(file), checkout.resolver.resolve))
  const groupOf = new Map()
  base.groups.forEach((group, index) => group.forEach(file => groupOf.set(file, index)))
  const left = new Set()
  for (const group of groups) {
    const back = group.map(file => checkout.base(file))
    const homes = new Set(back.map(file => (file === undefined ? undefined : groupOf.get(file))))
    if (homes.size !== 1 || homes.has(undefined)) {
      problems.push(`a cycle group the base lacks, or that grew: ${group.join(', ')}`)
    } else {
      const [home] = homes
      left.add(home)
      notes.push(`group of ${group.length} (base ${base.groups[home].length}): ${group.join(', ')}`)
    }
  }
  base.groups.forEach((group, index) => {
    if (!left.has(index)) notes.push(`base group gone: ${group.length} files from ${group[0]}`)
  })
  return verdict(problems, `${groups.length} cycle groups (base ${base.groups.length})`, notes)
})
