/**
 * @jest-environment node
 */
import { z } from 'zod'
import { leftOut, listOf, orNull } from './utils'

describe('schemas/utils', () => {
  describe('leftOut', () => {
    const schema = z.object({ count: leftOut(z.int().min(1)) })

    it.each([
      ['what it reads', { count: 3 }, { count: 3 }],
      ['a value its schema refuses', { count: 0 }, { count: undefined }],
      ['another type', { count: 'three' }, { count: undefined }],
      ['null', { count: null }, { count: undefined }],
      ['nothing, as nothing', {}, {}],
    ])('reads %s', (_, input, output) => {
      expect(schema.parse(input)).toStrictEqual(output)
    })
  })

  describe('orNull', () => {
    const schema = z.object({ name: orNull(z.string().max(3)) })

    it.each([
      ['what it reads', { name: 'Ash' }, { name: 'Ash' }],
      ['a value its schema refuses', { name: 'Ashes' }, { name: null }],
      ['another type', { name: 4 }, { name: null }],
      ['null', { name: null }, { name: null }],
      ['nothing, as null', {}, { name: null }],
    ])('reads %s', (_, input, output) => {
      expect(schema.parse(input)).toStrictEqual(output)
    })
  })

  describe('listOf', () => {
    const schema = z.object({ names: listOf(z.string(), 2) })

    it.each([
      ['what it reads', { names: ['Ash', 'Bo'] }, { names: ['Ash', 'Bo'] }],
      [
        'only its first, as many as it keeps',
        { names: ['Ash', 'Bo', 'Cy'] },
        { names: ['Ash', 'Bo'] },
      ],
      [
        'past what it can’t read, before it cuts',
        { names: [1, 'Ash', null, 'Bo', 'Cy'] },
        { names: ['Ash', 'Bo'] },
      ],
      ['another type, as none', { names: 'Ash' }, { names: [] }],
      ['nothing, as none', {}, { names: [] }],
    ])('reads %s', (_, input, output) => {
      expect(schema.parse(input)).toStrictEqual(output)
    })

    it('keeps every one it reads, where it is given no most', () => {
      expect(listOf(z.int()).parse([1, 'two', 3, 4])).toStrictEqual([1, 3, 4])
    })
  })
})
