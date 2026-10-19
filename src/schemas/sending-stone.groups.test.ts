/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { parseGameEvent } from './sending-stone'
import { groupEntry, groupSheet, roster } from '@/mocks/sending-stone'

// A campaign's Group actors, as module 0.30.0 sends them: in its hello, and in group.updated and
// group.removed.

/** A hello with these groups, as read. */
const helloWith = (groups?: unknown) =>
  parseGameEvent('bridge.hello', {
    sheetsApart: true,
    characters: roster,
    combats: [],
    ...(groups !== undefined && { groups }),
  })?.data as any

/** A group.updated for The Company with this sheet, and these fields, as read. */
const updated = (sheet: unknown, fields: object = {}) =>
  (
    parseGameEvent('group.updated', {
      group: { ...groupEntry(), sheet, ...fields },
    })?.data as any
  ).group

describe('schemas/sending-stone, groups (module 0.30.0)', () => {
  it('reads a hello without groups, as from an older module, as none', () => {
    expect(helloWith().groups).toEqual([])
    expect(helloWith(null).groups).toEqual([])
    expect(helloWith('the company').groups).toEqual([])
  })

  it("reads a hello's groups, keeping fields it doesn't know", () => {
    const company = { ...groupEntry(), sort: 100 }

    expect(helloWith([company]).groups).toEqual([company])
  })

  it('drops only a malformed group, keeping the others', () => {
    const second = groupEntry({ id: 'scouts', name: 'Scouts', primary: false })

    expect(
      helloWith([
        groupEntry({ id: '../company' }),
        { ...groupEntry(), type: 'encounter' },
        second,
        { ...groupEntry({ id: 'nameless' }), name: undefined },
      ]).groups,
    ).toEqual([second])
  })

  it.each([
    ['a level less than Observer', { thorin: 'limited' }],
    ['a key that is no actor id', { 'actor thorin': 'owner' }],
    ['a list', ['thorin']],
    ['nothing', undefined],
  ])("reads a group's access with %s as no one's, never more", (_, access) => {
    expect(helloWith([{ ...groupEntry(), access }]).groups).toEqual([
      groupEntry({ access: {} }),
    ])
  })

  it('reads a primary party it can’t read as not primary', () => {
    expect(helloWith([groupEntry({ primary: 'yes' as any })]).groups).toEqual([
      groupEntry({ primary: false }),
    ])
  })

  it('reads group.updated with its sheet, as the module sent it', () => {
    expect(updated(groupSheet())).toEqual({
      ...groupEntry(),
      sheet: groupSheet(),
    })
  })

  it('keeps nothing of a member but its name and portrait, such as its hit points', () => {
    const [thorin] = groupSheet().members
    const { members } = updated({
      ...groupSheet(),
      members: [
        { ...thorin, hp: { value: 31, max: 44 }, level: 5, classes: 'Fighter' },
        { ...thorin, id: 'actor-golem', type: 'construct' },
      ],
    }).sheet

    expect(members).toEqual([thorin])
    expect(members[0]).not.toHaveProperty('hp')
  })

  it('reads a slim sheet made whole', () => {
    const sheet = groupSheet()
    const [section] = sheet.inventory.sections
    const [map] = section.items
    const slim = {
      ...sheet,
      slim: 1,
      inventory: {
        ...sheet.inventory,
        // Each item leaves out what's at its default.
        sections: [
          {
            ...section,
            items: [
              {
                id: map.id,
                name: map.name,
                img: map.img,
                type: map.type,
                text: map.text,
              },
            ],
          },
        ],
      },
    }

    expect(updated(slim).sheet).toEqual(sheet)
  })

  it('reads a slim sheet in a format it can’t read as none', () => {
    expect(updated({ ...groupSheet(), slim: 2 }).sheet).toBeNull()
  })

  it('reads why a sheet was held back: for its size, or as no one may see it', () => {
    const tooLarge = { reason: 'tooLarge', bytes: 5_200_000, limit: 4_000_000 }

    expect(updated(null, { sheetWithheld: tooLarge })).toEqual({
      ...groupEntry(),
      sheet: null,
      sheetWithheld: tooLarge,
    })
    expect(
      updated(null, { access: {}, sheetWithheld: { reason: 'private' } }),
    ).toEqual({
      ...groupEntry({ access: {} }),
      sheet: null,
      sheetWithheld: { reason: 'private', bytes: null, limit: null },
    })
    expect(updated(null)).toEqual({ ...groupEntry(), sheet: null })
  })

  it('reads a sheet missing its description or stash as having none', () => {
    const { sheet } = updated({ members: groupSheet().members })

    expect(sheet.description).toEqual({ full: null, summary: null })
    expect(sheet.inventory).toEqual({
      sections: [],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    })
  })

  it('refuses a group.updated with no group it can read', () => {
    expect(() =>
      parseGameEvent('group.updated', {
        group: { ...groupEntry(), id: '' },
      }),
    ).toThrow()
    expect(() => parseGameEvent('group.updated', {})).toThrow()
  })

  it('reads group.removed', () => {
    expect(parseGameEvent('group.removed', { id: 'company' })).toEqual({
      type: 'group.removed',
      data: { id: 'company' },
    })
    expect(() => parseGameEvent('group.removed', { id: 'a/b' })).toThrow()
  })
})
