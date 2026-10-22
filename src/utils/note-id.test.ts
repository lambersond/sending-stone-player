/**
 * @jest-environment node
 */
import { newNoteId, NOTE_ID } from './note-id'

describe('utils/note-id', () => {
  it('makes 16 letters and digits, as Foundry’s own ids are', () => {
    expect(newNoteId()).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(NOTE_ID.test(newNoteId())).toBe(true)
  })

  it('never makes the same id twice in 10,000', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newNoteId()))

    expect(ids.size).toBe(10_000)
  })

  it('draws on the platform’s cryptographic random numbers, never Math.random', () => {
    const random = jest.spyOn(Math, 'random')
    const crypto = jest.spyOn(globalThis.crypto, 'getRandomValues')

    newNoteId()

    expect(random).not.toHaveBeenCalled()
    expect(crypto).toHaveBeenCalled()
  })

  it('throws away the bytes past the last whole 62, so that no letter is likelier', () => {
    // Every byte from 248 on is thrown away; 0 is A, 61 is 9, 62 is A again, 247 is 9.
    const bytes = [
      255,
      248,
      0,
      61,
      62,
      247,
      ...Array.from({ length: 18 }, () => 1),
    ]
    jest
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementationOnce(array => {
        ;(array as Uint8Array).set(bytes)
        return array
      })

    expect(newNoteId()).toBe('A9A9BBBBBBBBBBBB')
  })

  it('rejects ids of the wrong length or with other characters', () => {
    expect(NOTE_ID.test('abcdefghijklmno')).toBe(false)
    expect(NOTE_ID.test('abcdefghijklmnopq')).toBe(false)
    expect(NOTE_ID.test('abcdefgh-jklmnop')).toBe(false)
  })
})
