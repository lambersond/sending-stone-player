// Gate 4, stale mocks (round.md §3.4): in every test file, each jest.mock / doMock / requireActual
// / requireMock path resolves (tsconfig paths, `@/`, src modulePaths, relative to the test's
// folder, packages); for a jest.mock or doMock the module is in the import closure of the test's
// own imports (a requireActual target needs no importer: R3.3's dice-renderer lines); and every
// key of a mock factory's object literal is an export of the module (`__esModule` aside; a
// package's keys are not checked).
import {
  closure,
  exportsOf,
  factoryObject,
  gate,
  isTestFile,
  jestCalls,
  verdict,
} from './gate-lib.mjs'

gate('4', checkout => {
  const problems = []
  const tests = checkout.files.filter(file => file.startsWith('src/') && isTestFile(file) && /\.[jt]sx?$/.test(file))
  let mocks = 0
  let packages = 0
  for (const file of tests) {
    const sf = checkout.parse(file)
    const calls = jestCalls(sf)
    if (calls.length === 0) continue
    const reach = checkout.memo(`closure:${file}`, () => closure(checkout, [file, 'jest.setup.ts']))
    for (const { method, spec, factory } of calls) {
      if (method === 'unmock') continue
      mocks += 1
      const target = checkout.resolver.resolve(spec, file)
      if (!target.file && !target.external) {
        problems.push(`${file}: jest.${method}('${spec}') resolves to nothing`)
        continue
      }
      if (method !== 'mock' && method !== 'doMock') continue
      const reached = target.file ? reach.files.has(target.file) : reach.packages.has(target.external)
      if (!reached) problems.push(`${file}: jest.${method}('${spec}') mocks a module the test never imports`)
      if (target.external) {
        packages += 1
        continue
      }
      const object = factoryObject(factory)
      if (!object) continue
      const names = exportsOf(checkout, target.file)
      for (const { name } of object.keys) {
        if (name === '__esModule') continue
        if (!names.has(name)) problems.push(`${file}: jest.${method}('${spec}') mocks ${name}, which ${target.file} does not export`)
      }
    }
  }
  return verdict(problems, `${mocks} mock paths in ${tests.length} test files (${packages} package mocks' keys not checked)`)
})
