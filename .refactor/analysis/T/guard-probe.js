// Probe for guardNoDb's design: after each test, any prismaMock model method called is reported.
const { prismaMock } = require('/home/user/sending-stone-player/jest.setup.ts')
const fs = require('node:fs')
const out = process.env.GUARD_OUT
const isMock = f => typeof f === 'function' && f.mock && Array.isArray(f.mock.calls)
afterEach(() => {
  const hits = []
  for (const model of Object.keys(prismaMock)) {
    const value = prismaMock[model]
    if (model === '$extends') continue
    if (isMock(value) && value.mock.calls.length > 0) hits.push(`${model}()`)
    if (value && typeof value === 'object' || typeof value === 'function') {
      for (const method of Object.keys(value)) {
        const fn = value[method]
        if (isMock(fn) && fn.mock.calls.length > 0) hits.push(`${model}.${method}`)
      }
    }
  }
  if (hits.length) fs.appendFileSync(out, `${expect.getState().testPath}\t${expect.getState().currentTestName}\t${[...new Set(hits)].join(',')}\n`)
})
