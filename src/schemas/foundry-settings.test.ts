/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { foundrySettingsSchema } from './foundry-settings'
import { foundrySettings } from '@/mocks/sending-stone'

const read = (settings: unknown) => foundrySettingsSchema.parse(settings)

/** As many entries as asked, each made from its index. */
const many = <T>(count: number, make: (index: number) => T) =>
  Array.from({ length: count }, (_, index) => make(index))

const row = (index: number) => ({
  id: `row${index}`,
  label: `Row ${index}`,
  value: true,
  text: 'On',
})

describe('schemas/foundry-settings', () => {
  it('reads what a module from 0.30.0 sends, as sent', () => {
    expect(read(foundrySettings())).toEqual(foundrySettings())
  })

  it("throws on anything that isn't format 1, for its reader to take as no settings", () => {
    expect(() => read({ ...foundrySettings(), format: 2 })).toThrow()
    expect(() => read('On')).toThrow()
    expect(() => read(null)).toThrow()
  })

  it('drops an entry it can’t read, keeping the others, and a list it can’t read as none', () => {
    const settings = foundrySettings()
    const [campaign, world] = settings.sections
    expect(
      read({
        ...settings,
        modules: [{ id: 'midi-qol', title: 'Midi-QOL' }, 'lib-wrapper', 7],
        sections: [
          { ...campaign, rows: [campaign.rows[0], { id: 'attacks' }] },
          { id: 'dnd5e', rows: [] },
          world,
        ],
        results: [
          settings.results[0],
          { ...settings.results[1], state: 'sometimes' },
        ],
      }),
    ).toEqual({
      format: 1,
      // A version it can't read is unknown, and a module not said to be enabled isn't.
      modules: [
        { id: 'midi-qol', title: 'Midi-QOL', version: null, active: false },
      ],
      sections: [{ ...campaign, rows: [campaign.rows[0]] }, world],
      results: [settings.results[0]],
    })
    expect(
      read({ format: 1, modules: 'midi', sections: {}, results: undefined }),
    ).toEqual({ format: 1, modules: [], sections: [], results: [] })
  })

  it('keeps only what the card shows, dropping any other key', () => {
    const settings = foundrySettings()
    const [section] = settings.sections
    const sent = {
      ...settings,
      secret: 'hunter2',
      modules: [{ ...settings.modules[0], url: 'https://example.com' }],
      sections: [
        { ...section, hidden: true, rows: [{ ...section.rows[0], raw: {} }] },
      ],
      results: [{ ...settings.results[0], why: ['x'] }],
    }

    expect(JSON.stringify(read(sent))).not.toMatch(
      /hunter2|example|hidden|raw|why/,
    )
  })

  it('keeps a value too long to read as none, the setting kept, and drops a string too long', () => {
    const [section] = foundrySettings().sections
    const sections = [
      {
        ...section,
        rows: [
          { ...row(0), value: 'x'.repeat(100) },
          { ...row(1), value: 'x'.repeat(101) },
          { ...row(2), value: { nested: true } },
          { ...row(3), text: 'x'.repeat(301) },
          { ...row(4), note: 'x'.repeat(301) },
          { ...row(5), label: 'x'.repeat(300) },
        ],
      },
    ]

    expect(read({ ...foundrySettings(), sections }).sections[0].rows).toEqual([
      { ...row(0), value: 'x'.repeat(100) },
      { ...row(1), value: null },
      { ...row(2), value: null },
      row(4),
      { ...row(5), label: 'x'.repeat(300) },
    ])
  })

  it('reads as many as 20 modules, 8 sections of 40 rows each and 8 results, and no more', () => {
    const settings = read({
      format: 1,
      modules: many(21, index => ({
        id: `m${index}`,
        title: `Module ${index}`,
        version: '1.0.0',
        active: true,
      })),
      sections: many(9, index => ({
        id: `s${index}`,
        title: `Section ${index}`,
        rows: many(41, row),
      })),
      results: many(9, index => ({
        id: `r${index}`,
        state: 'shown',
        text: `Result ${index}`,
      })),
    })

    expect(settings.modules).toHaveLength(20)
    expect(settings.sections).toHaveLength(8)
    expect(settings.sections.map(({ rows }) => rows.length)).toEqual(
      many(8, () => 40),
    )
    expect(settings.results).toHaveLength(8)
    expect(settings.results.at(-1)?.id).toBe('r7')
  })
})
