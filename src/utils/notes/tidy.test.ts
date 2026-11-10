import { tidyViewOf } from './tidy'
import type { HeldTidy } from '@/utils/notes/types'

const SEEN = new Date('2026-11-03T18:00:00Z')
const CHANGED = new Date('2026-11-05T18:00:00Z')

/** An entry as held, of the current sheet unless said. */
const entry = (
  fields: Partial<HeldTidy['entries'][number]>,
): HeldTidy['entries'][number] => ({
  source: 'journal',
  entryId: 'tidyRavenhill01',
  title: 'Ravenhill',
  html: '<p>Ravens.</p>',
  sort: 1,
  secret: false,
  firstSeenAt: null,
  changedAt: null,
  ...fields,
})

const held = (
  entries: HeldTidy['entries'],
  fields: Partial<HeldTidy> = {},
): HeldTidy => ({ entries, active: true, version: '13.10.5', ...fields })

describe('utils/notes/tidy', () => {
  it('lists the current sheet’s entries by their place, then the Classic boxes, under Tidy’s titles', () => {
    const view = tidyViewOf(
      held([
        entry({ source: 'classic', entryId: 'notes', title: '', sort: 5 }),
        entry({ entryId: 'second', title: ' ', sort: 2 }),
        entry({ source: 'classic', entryId: 'notes1', title: '', sort: 1 }),
        entry({
          source: 'classic',
          entryId: 'notes3',
          title: 'Errands',
          sort: 3,
        }),
        entry({ firstSeenAt: SEEN, changedAt: CHANGED }),
      ]),
    )

    expect(view?.entries.map(({ key, title }) => [key, title])).toEqual([
      ['journal:tidyRavenhill01', 'Ravenhill'],
      ['journal:second', 'Journal Entry 2'],
      ['classic:notes1', 'Persons of Interest'],
      ['classic:notes3', 'Errands'],
      ['classic:notes', 'Journal Entries'],
    ])
    expect(view?.entries[0]).toEqual({
      key: 'journal:tidyRavenhill01',
      from: 'journal',
      title: 'Ravenhill',
      html: '<p>Ravens.</p>',
      secret: false,
      firstSeenAt: SEEN.toISOString(),
      changedAt: CHANGED.toISOString(),
    })
  })

  it.each([
    ['active', { active: true, version: '13.10.5' }, [true, true, false]],
    ['turned off', { active: false, version: '13.10.5' }, [false, true, false]],
    ['not installed', { active: false, version: null }, [false, false, false]],
    [
      '14, which shows no Classic boxes',
      { active: true, version: '14.4.1' },
      [true, true, true],
    ],
    [
      'unsaid by the hello',
      { active: null, version: null },
      [true, true, false],
    ],
  ])(
    'says whether Tidy is %s',
    (_name, state, [active, installed, classicGone]) => {
      expect(tidyViewOf(held([entry({})], state))).toMatchObject({
        active,
        installed,
        classicGone,
      })
    },
  )

  it('is none for a character holding no entries', () => {
    expect(tidyViewOf(held([]))).toBeUndefined()
    expect(tidyViewOf(undefined)).toBeUndefined()
  })
})
