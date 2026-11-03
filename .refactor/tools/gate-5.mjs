// Gate 5, overridden constants (round.md §3.4): the five overrides a test makes by jest.mock still
// bite. For each, the test (path followed) still mocks a module with the name as a key; that module
// declares the name itself; some module in the test's closure imports the name from it; and no
// other module in the closure declares the name at its top level (a copy the mock would miss).
import { closure, factoryObject, gate, importsOf, jestCalls, topLevelNames, verdict } from './gate-lib.mjs'

const OVERRIDES = [
  ['src/components/character-sheet/effect-controls.test.tsx', 'EFFECT_SETTLE'],
  ['src/components/character-sheet/wild-shape.test.tsx', 'WILD_SHAPE_SETTLE'],
  ['src/components/cookbook-card/cookbook-dish-list.test.tsx', 'DISH_ATTEMPTS'],
  ['src/app/api/cookbook/dishes/route.test.ts', 'MOST_DISHES_WAITING'],
  ['src/hooks/use-sheet-roller.elven-off.test.tsx', 'ELVEN_LINE'],
]

gate('5', checkout => {
  const problems = []
  const notes = []
  for (const [baseTest, name] of OVERRIDES) {
    const test = checkout.head(baseTest)
    if (!test) {
      problems.push(`${baseTest}: gone`)
      continue
    }
    const mock = jestCalls(checkout.parse(test)).find(
      call => call.method === 'mock' && factoryObject(call.factory)?.keys.some(key => key.name === name),
    )
    if (!mock) {
      problems.push(`${test}: no jest.mock overrides ${name} any more`)
      continue
    }
    const module = checkout.resolver.resolve(mock.spec, test).file
    if (!module) {
      problems.push(`${test}: '${mock.spec}' resolves to no module`)
      continue
    }
    if (!topLevelNames(checkout.parse(module)).has(name)) {
      problems.push(`${test}: ${module} does not declare ${name} itself`)
      continue
    }
    const reach = closure(checkout, [test])
    const readers = []
    for (const file of reach.files) {
      if (file === module || file === test || !/\.(ts|tsx)$/.test(file)) continue
      const sf = checkout.parse(file)
      if (topLevelNames(sf).has(name)) problems.push(`${test}: ${file} declares its own ${name}, which the mock misses`)
      const reads = importsOf(sf).some(
        edge =>
          !edge.typeOnly &&
          checkout.resolver.resolve(edge.spec, file).file === module &&
          edge.names.some(n => n.imported === name),
      )
      if (reads) readers.push(file)
    }
    if (readers.length === 0) problems.push(`${test}: nothing it imports reads ${name} from ${module}`)
    else notes.push(`${test}: ${name} from ${module}, read by ${readers.sort().join(', ')}`)
  }
  return verdict(problems, `${OVERRIDES.length} overrides`, notes)
})
