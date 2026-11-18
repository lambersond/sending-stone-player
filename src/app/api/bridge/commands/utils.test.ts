import { isQuietLook, quietWaitFor } from './utils'
import { COMMANDS_QUIET_WAIT } from '@/constants/sending-stone'

describe('app/api/bridge/commands/utils, from module 0.50.0', () => {
  it.each([
    ['a look, nobody in the app', true, false, true],
    ['a look, someone in the app', true, true, false],
    ['a full fetch', false, false, false],
    ['a module before 0.50.0', undefined, false, false],
  ])('answers as a quiet look %s: %s', (_name, quiet, present, look) => {
    expect(isQuietLook(quiet, present)).toBe(look)
  })

  it.each([
    ['a full fetch handing over nothing', false, 0, COMMANDS_QUIET_WAIT],
    ['a look handing over nothing', true, 0, COMMANDS_QUIET_WAIT],
    ['a fetch handing over a command', false, 1, undefined],
    ['a module before 0.50.0', undefined, 0, undefined],
  ])('gives %s its quiet wait: %s', (_name, quiet, handed, wait) => {
    expect(quietWaitFor(quiet, handed)).toBe(wait)
  })

  it('waits 20 seconds while nobody is in the app', () => {
    expect(COMMANDS_QUIET_WAIT).toBe(20_000)
  })
})
