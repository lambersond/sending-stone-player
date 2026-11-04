/**
 * @jest-environment node
 */
import { HIT_DIE } from '@/constants/sending-stone'

describe('HIT_DIE', () => {
  it('is built from the sizes a die of damage may be, as it was written', () => {
    expect(HIT_DIE.source).toBe('^d(4|6|8|10|12)$')
    expect(HIT_DIE.flags).toBe('')
  })
})
