/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expandSheet } from './slim-sheet'
import { characterSheet, roster } from '@/mocks/sending-stone'
import { quillSheet, slimQuillSheet } from '@/mocks/slim-sheet'
import { parseGameEvent } from '@/schemas/sending-stone'

type Json = Record<string, any>

/** A sheet's character as character.updated reads it. */
const readAs = (sheet: unknown) =>
  parseGameEvent('character.updated', { character: { ...roster[0], sheet } })
    ?.data

/** A slim sheet of only these, besides what any sheet has. */
const slim = (fields: Json): Json => ({
  ...characterSheet(),
  ...fields,
  slim: 1,
})

/** A slim sheet with these spell rows. */
const withSpells = (spells: unknown[]) =>
  slim({ spells: [{ id: 'spell1', label: '1st Level', slots: null, spells }] })

/**
 * Pairs of sheets the module built in its harness, of its test characters, full and slim, as its
 * slim check writes them (SLIM_FIXTURE).
 */
const FIXTURE = path.join(
  process.cwd(),
  'src',
  'utils',
  'slim-sheet.fixture.json',
)

/** A row of this name, of an id rows share. */
const named = (name: string) => ({ id: 'same', name })

/**
 * How long a sheet stopped by a bound may take at most, in milliseconds: on its own it takes well
 * under a second, mostly copying what came; this leaves room for a busy machine. That it's null is
 * what shows it stopped.
 */
const QUICKLY = 10_000

/** Expand, timed. */
const timed = (sheet: unknown) => {
  const start = Date.now()
  const result = expandSheet(sheet)
  return { result, ms: Date.now() - start }
}

describe('utils/slim-sheet', () => {
  describe('expandSheet', () => {
    it('makes a slim sheet whole: the sheet the module built, read the same', () => {
      const full = quillSheet()
      const sent = slimQuillSheet()
      const as = JSON.stringify(sent)

      expect(expandSheet(sent)).toEqual(full)
      expect(JSON.stringify(sent)).toBe(as)
      expect(readAs(sent)).toEqual(readAs(full))
    })

    it('makes each sheet the module built in its harness whole', () => {
      const pairs = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
        full: Json
        slim: Json
      }[]

      expect(pairs.length).toBeGreaterThan(0)
      for (const { full, slim: sent } of pairs) {
        expect(sent.slim).toBe(1)
        expect(expandSheet(sent)).toEqual(full)
        expect(readAs(sent)).toEqual(readAs(full))
      }
    })

    it('leaves a sheet in the full shape, as a module before 0.22.0 sends, as it is', () => {
      const sheet = characterSheet()

      expect(expandSheet(sheet)).toBe(sheet)
      for (const value of [null, undefined, 'sheet', 7, [{ slim: 1 }]]) {
        expect(expandSheet(value)).toBe(value)
      }
    })

    it('reads a slim format it does not know as no sheet, never as the slim sheet', () => {
      for (const format of [2, 0, '1', true, null, {}]) {
        expect(expandSheet({ ...slim({}), slim: format })).toBeNull()
      }
      expect(readAs({ ...slim({}), slim: 2 })).toEqual({
        character: { ...roster[0], sheet: null },
      })
    })

    it("puts back each kind of row's defaults, keeping what isn't one", () => {
      const sheet = expandSheet(
        slim({
          spells: [
            {
              id: 'spell0',
              label: 'Cantrips',
              slots: null,
              spells: [{ id: 'light', name: 'Light', prepared: 0 }],
            },
          ],
          inventory: {
            ...characterSheet().inventory,
            sections: [
              {
                id: 'loot',
                label: 'Loot',
                items: [
                  { id: 'gem', name: 'Gem', type: 'loot', equipped: false },
                ],
              },
            ],
            containers: [
              { id: 'chest', name: 'Chest', type: 'container', contents: [] },
              { id: 'box', name: 'Box', type: 'container', identified: false },
            ],
          },
          features: [
            {
              id: 'class',
              label: 'Class',
              text: null,
              features: [{ id: 'darkvision', name: 'Darkvision' }],
            },
          ],
        }),
      ) as Json

      expect(sheet.spells[0].spells).toEqual([
        {
          id: 'light',
          name: 'Light',
          img: null,
          level: 0,
          school: null,
          components: null,
          materials: null,
          concentration: false,
          ritual: false,
          activation: null,
          range: null,
          duration: null,
          target: null,
          // Unprepared, rather than not prepared at all.
          prepared: 0,
          uses: null,
          castFrom: null,
          text: null,
        },
      ])
      const item = {
        img: null,
        quantity: 1,
        weight: null,
        price: null,
        equipped: null,
        attunement: null,
        attuned: false,
        uses: null,
        rarity: null,
        properties: [],
        identified: true,
        text: null,
      }
      expect(sheet.inventory.sections[0].items).toEqual([
        { ...item, id: 'gem', name: 'Gem', type: 'loot', equipped: false },
      ])
      expect(sheet.inventory.containers).toEqual([
        // Empty, and not secret.
        {
          ...item,
          id: 'chest',
          name: 'Chest',
          type: 'container',
          capacity: null,
          contents: [],
        },
        {
          ...item,
          id: 'box',
          name: 'Box',
          type: 'container',
          identified: false,
          capacity: null,
          contents: null,
        },
      ])
      expect(sheet.features[0].features).toEqual([
        {
          id: 'darkvision',
          name: 'Darkvision',
          img: null,
          kind: null,
          requirements: null,
          activation: null,
          passive: false,
          uses: null,
          text: null,
        },
      ])
      // Each default its own: one row's list isn't another's.
      sheet.inventory.containers[0].properties.push('Heavy')
      expect(sheet.inventory.containers[1].properties).toEqual([])
    })

    it('puts back what a row that rolls rolls, which its damage marks, and nothing of it where it has none', () => {
      const sheet = expandSheet(
        withSpells([
          { id: 'shield', name: 'Shield', level: 1 },
          { id: 'bolt', name: 'Bolt', level: 1, toHit: 5, damage: [] },
        ]),
      ) as Json
      const [shield, bolt] = sheet.spells[0].spells

      expect(shield).not.toHaveProperty('damage')
      expect(shield).not.toHaveProperty('toHit')
      expect(bolt).toMatchObject({
        toHit: 5,
        attackId: null,
        activity: null,
        attackModes: null,
        ammunition: null,
        save: null,
        damage: [],
      })
      // A spell's usage is its own, always there.
      expect(bolt).toMatchObject({ concentration: false, range: null })

      const rolling = expandSheet(
        slim({
          inventory: {
            ...characterSheet().inventory,
            sections: [
              {
                id: 'weapons',
                label: 'Weapons',
                items: [{ id: 'dagger', name: 'Dagger', damage: [] }],
              },
            ],
          },
          features: [
            {
              id: 'class',
              label: 'Class',
              text: null,
              features: [{ id: 'surge', name: 'Surge', damage: [] }],
            },
          ],
        }),
      ) as Json
      const usage = {
        range: null,
        target: null,
        concentration: false,
        toHit: null,
        attackId: null,
        activity: null,
        attackModes: null,
        ammunition: null,
        save: null,
        damage: [],
      }
      expect(rolling.inventory.sections[0].items[0]).toMatchObject({
        ...usage,
        activation: null,
      })
      expect(rolling.features[0].features[0]).toEqual(
        expect.objectContaining(usage),
      )
    })

    it("puts back the defaults of each activity, whom it's used at and its damage's parts, of rows, actions and activity favorites", () => {
      const use = { id: 'u', type: 'heal', targets: { count: 1 } }
      const sheet = expandSheet(
        slim({
          ...withSpells([
            {
              id: 'cure',
              name: 'Cure',
              activity: use,
              damage: [{ formula: '1d8' }],
              activities: [{ id: 'u', name: 'Heal', type: 'heal' }],
            },
          ]),
          actions: [
            {
              id: 'action',
              label: 'Actions',
              actions: [
                {
                  id: 'claw',
                  name: 'Claw',
                  activity: use,
                  damage: [{ formula: '1d4', healing: true }],
                  activities: [
                    { id: 'a', name: 'A', type: 'attack', toHit: 3 },
                  ],
                },
              ],
            },
          ],
          favorites: [
            {
              type: 'activity',
              id: 'u',
              itemId: 'cure',
              name: 'Cure',
              activity: use,
              damage: [{ formula: '1d8', type: 'Healing' }],
            },
            // Only an activity favorite holds any.
            { type: 'item', id: 'cure', damage: [{ formula: '1d8' }] },
          ],
        }),
      ) as Json
      const targets = {
        self: false,
        area: false,
        count: 1,
        perLevel: null,
        affects: null,
      }
      const entry = {
        activation: null,
        activationType: null,
        range: null,
        target: null,
        uses: null,
        toHit: null,
        attackId: null,
        activity: null,
        attackModes: null,
        ammunition: null,
        save: null,
        damage: [],
      }

      expect(sheet.spells[0].spells[0]).toMatchObject({
        activity: { ...use, targets },
        damage: [{ formula: '1d8', type: null, healing: false }],
        activities: [{ ...entry, id: 'u', name: 'Heal', type: 'heal' }],
      })
      // An action's own keys are its own: only what it holds is filled in.
      expect(sheet.actions[0].actions).toEqual([
        {
          id: 'claw',
          name: 'Claw',
          activity: { ...use, targets },
          damage: [{ formula: '1d4', type: null, healing: true }],
          activities: [
            { ...entry, id: 'a', name: 'A', type: 'attack', toHit: 3 },
          ],
        },
      ])
      expect(sheet.favorites).toEqual([
        {
          type: 'activity',
          id: 'u',
          itemId: 'cure',
          name: 'Cure',
          activity: { ...use, targets },
          damage: [{ formula: '1d8', type: 'Healing', healing: false }],
        },
        { type: 'item', id: 'cure', damage: [{ formula: '1d8' }] },
      ])
    })

    describe('an action by reference', () => {
      const wand = {
        id: 'wand',
        name: 'Wand',
        img: 'wand.webp',
        type: 'wand',
        activation: 'Action',
        toHit: 4,
        damage: [{ formula: '1d6' }],
        activities: [{ id: 'zap', name: 'Zap', type: 'attack' }],
      }
      const sheetWith = (actions: unknown[], fields: Json = {}) =>
        expandSheet(
          slim({
            inventory: {
              ...characterSheet().inventory,
              sections: [{ id: 'loot', label: 'Loot', items: [wand] }],
            },
            actions: [{ id: 'action', label: 'Actions', actions }],
            ...fields,
          }),
        ) as Json
      const actionsOf = (actions: unknown[], fields?: Json) =>
        sheetWith(actions, fields).actions[0].actions
      const row = () => sheetWith([]).inventory.sections[0].items[0]

      it('takes its row whole, as the row is made whole, but where it has its own, or drops a key, keeping its other keys', () => {
        const [action] = actionsOf([
          {
            id: 'wand',
            ref: true,
            activation: 'Bonus Action',
            level: null,
            drop: ['activities'],
          },
        ])
        const { activities, ...taken } = row()

        expect(activities).toHaveLength(1)
        expect(action).toEqual({
          ...Object.fromEntries(
            Object.entries(taken).filter(([key]) =>
              [
                'id',
                'name',
                'img',
                'type',
                'activation',
                'range',
                'target',
                'toHit',
                'attackId',
                'activity',
                'attackModes',
                'ammunition',
                'save',
                'damage',
                'uses',
                'concentration',
                'identified',
                'text',
              ].includes(key),
            ),
          ),
          activation: 'Bonus Action',
          level: null,
        })
        expect(action).not.toHaveProperty('quantity')
        expect(action).not.toHaveProperty('ref')
        expect(action).not.toHaveProperty('drop')
      })

      it('copies what it takes, never sharing it with its row', () => {
        const sheet = sheetWith([{ id: 'wand', ref: true }])
        const [action] = sheet.actions[0].actions

        action.damage[0].formula = '9d9'
        expect(sheet.inventory.sections[0].items[0].damage[0].formula).toBe(
          '1d6',
        )
      })

      it("drops nothing for a drop that isn't a list", () => {
        const [action] = actionsOf([
          { id: 'wand', ref: true, drop: 'activities' },
        ])

        expect(action.activities).toEqual(row().activities)
      })

      it('is left out where its row is found nowhere, or it names none', () => {
        expect(
          actionsOf([
            { id: 'gone', ref: true, name: 'Gone' },
            { ref: true },
            { id: 7, ref: true },
            { id: 'wand', ref: true },
          ]).map(({ id }: Json) => id),
        ).toEqual(['wand'])
      })

      it("finds its row in Spells, then Inventory's sections, its containers at any depth, then Features", () => {
        const fields = {
          spells: [
            { id: 's', label: 'S', slots: null, spells: [named('spell')] },
          ],
          inventory: {
            ...characterSheet().inventory,
            sections: [{ id: 'l', label: 'L', items: [named('item')] }],
            containers: [
              {
                id: 'bag',
                name: 'Bag',
                type: 'container',
                contents: [
                  {
                    id: 'pouch',
                    name: 'Pouch',
                    type: 'container',
                    contents: [named('held'), { id: 'deep', name: 'Deep' }],
                  },
                ],
              },
            ],
          },
          features: [
            { id: 'f', label: 'F', text: null, features: [named('feature')] },
          ],
        }
        const take = (id: string, sheet: Json = fields) =>
          actionsOf([{ id, ref: true }], sheet).map(({ name }: Json) => name)

        expect(take('same')).toEqual(['spell'])
        expect(take('same', { ...fields, spells: [] })).toEqual(['item'])
        expect(
          take('same', {
            ...fields,
            spells: [],
            inventory: { ...fields.inventory, sections: [] },
          }),
        ).toEqual(['held'])
        expect(take('deep')).toEqual(['Deep'])
        expect(take('pouch')).toEqual(['Pouch'])
        expect(
          take('same', {
            ...fields,
            spells: [],
            inventory: characterSheet().inventory,
          }),
        ).toEqual(['feature'])
      })

      it('leaves an action sent whole, as one in no tab is, as it is but for its defaults', () => {
        const whole = {
          id: 'class',
          name: 'Wizard',
          type: 'class',
          ref: false,
          damage: [],
        }

        expect(actionsOf([whole])).toEqual([whole])
      })
    })

    describe('bounds', () => {
      it('stops a sheet of a million empty activities, as no sheet, quickly', () => {
        const { result, ms } = timed(
          withSpells([
            {
              id: 'wide',
              name: 'Wide',
              activities: Array.from({ length: 1_000_000 }, () => ({})),
            },
          ]),
        )

        expect(result).toBeNull()
        expect(ms).toBeLessThan(QUICKLY)
      })

      it('stops a sheet of 100,000 references to a row of 10,000 activities, quickly', () => {
        const { result, ms } = timed(
          slim({
            ...withSpells([
              {
                id: 'wide',
                name: 'Wide',
                activities: Array.from({ length: 10_000 }, (_, index) => ({
                  id: `a${index}`,
                  name: 'Attack',
                  type: 'attack',
                })),
              },
            ]),
            actions: [
              {
                id: 'action',
                label: 'Actions',
                actions: Array.from({ length: 100_000 }, () => ({
                  id: 'wide',
                  ref: true,
                })),
              },
            ],
          }),
        )

        expect(result).toBeNull()
        expect(ms).toBeLessThan(QUICKLY)
      })

      it('stops a million empty rows', () => {
        expect(
          expandSheet(
            withSpells(Array.from({ length: 1_000_000 }, () => ({}))),
          ),
        ).toBeNull()
      })

      it('takes containers 8 deep, but not 9', () => {
        /** A container holding one, so many deep, the last holding a gem. */
        const nested = (depth: number): Json =>
          depth === 1
            ? { id: 'gem', name: 'Gem' }
            : {
                id: `bag${depth}`,
                name: 'Bag',
                type: 'container',
                contents: [nested(depth - 1)],
              }
        const sheetOf = (depth: number) =>
          slim({
            inventory: {
              ...characterSheet().inventory,
              containers: [nested(depth)],
            },
          })

        let held = (expandSheet(sheetOf(8)) as Json).inventory.containers[0]
        for (let depth = 1; depth < 8; depth++) held = held.contents[0]
        expect(held).toMatchObject({ id: 'gem', quantity: 1, text: null })
        expect(expandSheet(sheetOf(9))).toBeNull()
      })

      it('never throws on junk, nor changes it', () => {
        const cyclic: Json = { slim: 1 }
        cyclic.spells = [{ id: 's', label: 'S', spells: [cyclic] }]
        const unreadable = {
          slim: 1,
          get spells(): unknown {
            throw new Error('Unreadable')
          },
        }
        const junk: unknown[] = [
          { slim: 1 },
          { slim: 1, spells: 'many' },
          { slim: 1, spells: [null, 5, { spells: 'some' }, { spells: [7] }] },
          {
            slim: 1,
            inventory: {
              sections: 'none',
              containers: [null, { contents: 'x' }, { contents: [null, 3] }],
            },
          },
          { slim: 1, inventory: [] },
          {
            slim: 1,
            actions: [
              null,
              { actions: 'x' },
              { actions: [null, 1, { ref: true }, { ref: 'yes', id: 'x' }] },
            ],
          },
          { slim: 1, favorites: [null, { type: 'activity', damage: 'x' }] },
          {
            slim: 1,
            features: [
              {
                features: [
                  {
                    id: 'f',
                    damage: [null, 'x'],
                    activity: { targets: [] },
                    activities: [null, 1, { activity: 'x', damage: {} }],
                  },
                ],
              },
            ],
            actions: [{ actions: [{ id: 'f', ref: true, drop: [null, {}] }] }],
          },
        ]

        for (const sheet of junk) {
          const as = JSON.stringify(sheet)
          expect(() => expandSheet(sheet)).not.toThrow()
          expect(() => readAs(sheet)).not.toThrow()
          expect(JSON.stringify(sheet)).toBe(as)
        }
        expect(expandSheet({ slim: 1, spells: 'many' })).toEqual({
          spells: 'many',
        })
        // What isn't JSON, as nothing a post holds is, and anything thrown, are no sheet.
        for (const sheet of [cyclic, unreadable]) {
          expect(expandSheet(sheet)).toBeNull()
          expect(readAs(sheet)).toEqual({
            character: { ...roster[0], sheet: null },
          })
        }
      })
    })
  })
})
