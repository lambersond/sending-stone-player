/**
 * @jest-environment node
 */
import { z } from 'zod'
import { leftOut, orNull } from './utils'

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
})
