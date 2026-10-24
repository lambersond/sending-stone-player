import { companionRow, numberedNames, tintOf } from './companion-row'
import type { TableCompanion } from '@/types/table'

const brakka: TableCompanion = { key: 'brakka', name: 'Brakka', kind: 'owned' }
const bat = (key: string): TableCompanion => ({
  key,
  name: 'Bat',
  kind: 'summoned',
  from: 'Find Familiar',
})
const drake: TableCompanion = {
  key: 'drake',
  name: 'Drake',
  kind: 'summoned',
  from: 'Summon Dragon',
}

const NONE = new Set<string>()

describe('companionRow', () => {
  it('lists the companions in the module’s order, unmarked', () => {
    expect(companionRow([], [brakka, bat('b1'), drake], NONE)).toEqual([
      brakka,
      bat('b1'),
      drake,
    ])
  })

  it('keeps one no longer listed, marked gone, in its place', () => {
    const last = companionRow([], [brakka, bat('b1'), drake], NONE)
    expect(companionRow(last, [brakka, drake], NONE)).toEqual([
      brakka,
      { ...bat('b1'), gone: true },
      drake,
    ])
    // First where it was first, and after another gone one where it followed it.
    expect(companionRow(last, [drake], NONE)).toEqual([
      { ...brakka, gone: true },
      { ...bat('b1'), gone: true },
      drake,
    ])
  })

  it('leaves out a gone one once dismissed', () => {
    const last = companionRow(
      companionRow([], [brakka, bat('b1')], NONE),
      [brakka],
      NONE,
    )
    expect(companionRow(last, [brakka], new Set(['b1']))).toEqual([brakka])
  })

  it('unmarks one listed again', () => {
    const last = companionRow(
      companionRow([], [brakka, bat('b1')], NONE),
      [brakka],
      NONE,
    )
    expect(last[1].gone).toBe(true)
    expect(companionRow(last, [brakka, bat('b1')], NONE)).toEqual([
      brakka,
      bat('b1'),
    ])
  })

  it('is empty with none listed and none kept', () => {
    expect(companionRow([], [], NONE)).toEqual([])
  })
})

const row = (...names: [string, string][]) =>
  names.map(([key, name]) => ({ key, name }))

describe('numberedNames', () => {
  it('leaves a name the row holds once as it is', () => {
    const { names, kept } = numberedNames(row(['brakka', 'Brakka']), new Map())
    expect(names.get('brakka')).toBe('Brakka')
    expect(kept.size).toBe(0)
  })

  it('numbers a repeated name in the row’s order, among unique names', () => {
    const { names, kept } = numberedNames(
      row(
        ['brakka', 'Brakka'],
        ['b1', 'Bat'],
        ['b2', 'Bat'],
        ['drake', 'Drake'],
        ['b3', 'Bat'],
      ),
      new Map(),
    )
    expect([...names.values()]).toEqual([
      'Brakka',
      'Bat 1',
      'Bat 2',
      'Drake',
      'Bat 3',
    ])
    expect(kept).toEqual(
      new Map([
        ['b1', 1],
        ['b2', 2],
        ['b3', 3],
      ]),
    )
  })

  it('keeps the name’s case and spacing as given', () => {
    const { names } = numberedNames(
      row(['a', 'Giant  bat'], ['b', 'Giant  bat'], ['c', 'giant  bat']),
      new Map(),
    )
    expect([...names.values()]).toEqual([
      'Giant  bat 1',
      'Giant  bat 2',
      'giant  bat',
    ])
  })

  it('keeps each number with its creature, as one leaves and another comes', () => {
    const first = numberedNames(
      row(['b1', 'Bat'], ['b2', 'Bat'], ['b3', 'Bat']),
      new Map(),
    )
    // Bat 1 leaves the row: Bat 2 and Bat 3 keep their numbers.
    const second = numberedNames(row(['b2', 'Bat'], ['b3', 'Bat']), first.kept)
    expect([...second.names.values()]).toEqual(['Bat 2', 'Bat 3'])
    // A new Bat takes the lowest number free.
    const third = numberedNames(
      row(['b2', 'Bat'], ['b3', 'Bat'], ['b4', 'Bat']),
      second.kept,
    )
    expect([...third.names.values()]).toEqual(['Bat 2', 'Bat 3', 'Bat 1'])
    // The last Bat left is "Bat", and its number is dropped.
    const last = numberedNames(row(['b3', 'Bat']), third.kept)
    expect(last.names.get('b3')).toBe('Bat')
    expect(last.kept.has('b3')).toBe(false)
    // Another Bat after it starts again from 1.
    const again = numberedNames(row(['b3', 'Bat'], ['b5', 'Bat']), last.kept)
    expect([...again.names.values()]).toEqual(['Bat 1', 'Bat 2'])
  })

  it('gives a number kept twice once only', () => {
    const { names } = numberedNames(
      row(['b1', 'Bat'], ['b2', 'Bat']),
      new Map([
        ['b1', 1],
        ['b2', 1],
      ]),
    )
    expect([...names.values()]).toEqual(['Bat 1', 'Bat 2'])
  })
})

describe('tintOf', () => {
  it('gives one name one of the prototype’s tints, the same each time', () => {
    const tints = [
      'bg-attack/15 text-attack-text',
      'bg-whisper/15 text-whisper',
      'bg-spell/15 text-spell-text',
      'bg-party/15 text-party',
    ]
    for (const name of ['Brakka', 'Bat', 'Drake', 'Imp', 'Wolf']) {
      expect(tints).toContain(tintOf(name))
      expect(tintOf(name)).toBe(tintOf(name))
    }
    // By the sum of its code units, modulo four: "Bat" is 66 + 97 + 116 = 279, 3.
    expect(tintOf('Bat')).toBe('bg-party/15 text-party')
    // Two of one name share one.
    expect(tintOf('Bat')).toBe(tintOf(String('Bat')))
  })
})
