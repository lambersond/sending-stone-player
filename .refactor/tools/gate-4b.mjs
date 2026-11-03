// Gate 4b, mocks that leave a name out (round.md §3.4, SA F8): for a jest.mock factory with no
// spread (no requireActual), every value name a module in the test's closure imports from the
// mocked module is a key of the factory (else it is `undefined` there: NaN timers, B20). The
// closure starts at the test and goes through value imports, not into a module a factory
// replaces. Base cases are allowlisted in gate4b.allow: `<test at base>\t<mocked module at
// base>\t<name>\t<reason>`, matched with paths followed; a new case fails.
import {
  closure,
  factoryObject,
  gate,
  importsOf,
  isTestFile,
  jestCalls,
  readAllow,
  verdict,
} from './gate-lib.mjs'

gate('4b', checkout => {
  const problems = []
  const notes = []
  const allow = new Set(readAllow('gate4b.allow').map(([test, module, name]) => `${test}\0${module}\0${name}`))
  const used = new Set()
  const tests = checkout.files.filter(file => file.startsWith('src/') && isTestFile(file) && /\.[jt]sx?$/.test(file))
  let checked = 0
  for (const file of tests) {
    const sf = checkout.parse(file)
    const replaced = new Map()
    for (const { method, spec, factory } of jestCalls(sf)) {
      if (method !== 'mock' && method !== 'doMock') continue
      const target = checkout.resolver.resolve(spec, file).file
      if (!target) continue
      const object = factoryObject(factory)
      if (factory && (!object || !object.spread)) replaced.set(target, { spec, object })
    }
    if (replaced.size === 0) continue
    const reach = closure(checkout, [file], module => replaced.has(module) && module !== file)
    for (const module of reach.files) {
      if (replaced.has(module) || !/\.(ts|tsx)$/.test(module)) continue
      for (const edge of importsOf(checkout.parse(module))) {
        if (edge.typeOnly) continue
        const target = checkout.resolver.resolve(edge.spec, module).file
        const mock = target && replaced.get(target)
        if (!mock?.object) continue
        const keys = new Set(mock.object.keys.map(key => key.name))
        for (const { imported } of edge.names) {
          if (imported === '*') continue
          checked += 1
          if (keys.has(imported)) continue
          const key = `${checkout.base(file) ?? file}\0${checkout.base(target) ?? target}\0${imported}`
          if (allow.has(key)) {
            used.add(key)
            continue
          }
          problems.push(`${file}: its mock of '${mock.spec}' (${target}) leaves out ${imported}, which ${module} imports`)
        }
      }
    }
  }
  for (const key of allow) {
    if (!used.has(key)) notes.push(`note gate4b.allow row no longer needed: ${key.split('\0').join(' ')}`)
  }
  return verdict(problems, `${checked} imported names checked against full mocks`, notes)
})
