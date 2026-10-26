/* eslint-disable unicorn/no-null -- Prisma uses null for an unset date */
import { checkEffect, effectsAvailable } from './effect-commands'
import { fullerSheet } from '@/mocks/sending-stone'
import type { EffectInput } from '@/types/roll'
import type { SheetEffect } from '@/types/sending-stone'

const NOW = Date.parse('2026-10-28T12:00:00Z')

describe('utils/effect-commands, from module 0.39.0', () => {
  describe('effectsAvailable', () => {
    it('is so while the campaign lets its players and its module is fetching', () => {
      const polled = new Date(NOW - 5000)
      expect(
        effectsAvailable({ effectsEnabled: true, bridgePolledAt: polled }, NOW),
      ).toBe(true)
      expect(
        effectsAvailable(
          { effectsEnabled: false, bridgePolledAt: polled },
          NOW,
        ),
      ).toBe(false)
      expect(
        effectsAvailable({ effectsEnabled: true, bridgePolledAt: null }, NOW),
      ).toBe(false)
    })

    it('is so for a fetch 44 seconds ago, and no longer at 46', () => {
      expect(
        effectsAvailable(
          { effectsEnabled: true, bridgePolledAt: new Date(NOW - 44_000) },
          NOW,
        ),
      ).toBe(true)
      expect(
        effectsAvailable(
          { effectsEnabled: true, bridgePolledAt: new Date(NOW - 46_000) },
          NOW,
        ),
      ).toBe(false)
    })
  })

  describe('checkEffect', () => {
    const sheet = fullerSheet()

    it.each([
      ['Bless turned off', { op: 'disable', id: 'blessed' }],
      ['Bless deleted', { op: 'delete', id: 'blessed' }],
      ['Shield of Faith turned back on', { op: 'enable', id: 'shieldOfFaith' }],
      ['Shield of Faith deleted', { op: 'delete', id: 'shieldOfFaith' }],
      [
        "Rage turned off, by its item's dotted id",
        {
          op: 'disable',
          id: 'rage.raging',
        },
      ],
    ] as [string, EffectInput][])('lets %s', (_name, effect) => {
      expect(checkEffect(effect, sheet)).toBeUndefined()
    })

    it('refuses Rage deleted from its item, as its ops don’t list it', () => {
      expect(checkEffect({ op: 'delete', id: 'rage.raging' }, sheet)).toBe(
        'effect',
      )
    })

    /** Thorin's sheet with Bless, as the module now sends it, in place of the fixture's. */
    const withBless = (bless: Partial<SheetEffect>) => {
      const [temporary, inactive] = sheet.effects
      return {
        effects: [
          { ...temporary, effects: temporary.effects.slice(1) },
          {
            ...inactive,
            effects: [
              ...inactive.effects,
              { ...temporary.effects[0], ...bless },
            ],
          },
        ],
      }
    }

    describe('one already so, as the page may show an older sheet, which the module answers done with nothing written', () => {
      it.each([
        ['Bless turned on, as it is on', { op: 'enable', id: 'blessed' }],
        [
          'Shield of Faith turned off, as it is off',
          {
            op: 'disable',
            id: 'shieldOfFaith',
          },
        ],
        ['Rage turned on, as it is on', { op: 'enable', id: 'rage.raging' }],
      ] as [string, EffectInput][])('lets %s', (_name, effect) => {
        expect(checkEffect(effect, sheet)).toBeUndefined()
      })

      it('lets Bless be turned off again from a second device, once the first has turned it off', () => {
        expect(
          checkEffect(
            { op: 'disable', id: 'blessed' },
            withBless({ disabled: true, ops: ['enable', 'delete'] }),
          ),
        ).toBeUndefined()
      })

      it('lets Bless be turned off once the Gamemaster has turned it off in Foundry, which leaves only its delete', () => {
        expect(
          checkEffect(
            { op: 'disable', id: 'blessed' },
            withBless({ disabled: true, ops: ['delete'] }),
          ),
        ).toBeUndefined()
      })

      it.each([
        ['one the sheet lacks', 'hasted'],
        ['Bless, deleted in Foundry', 'blessed'],
      ])('lets %s be deleted, as it is gone', (_name, id) => {
        const [temporary, inactive] = sheet.effects
        const gone = {
          effects: [
            { ...temporary, effects: temporary.effects.slice(1) },
            inactive,
          ],
        }
        expect(checkEffect({ op: 'delete', id }, gone)).toBeUndefined()
      })

      it('lets the last effect be deleted, gone from a sheet with none left', () => {
        expect(
          checkEffect({ op: 'delete', id: 'blessed' }, { effects: [] }),
        ).toBeUndefined()
        expect(
          checkEffect(
            { op: 'delete', id: 'blessed' },
            {
              effects: sheet.effects.map(section => ({
                ...section,
                effects: [],
              })),
            },
          ),
        ).toBeUndefined()
      })

      it('still refuses Bless turned on once the Gamemaster has turned it off, as that’s not so', () => {
        expect(
          checkEffect(
            { op: 'enable', id: 'blessed' },
            withBless({ disabled: true, ops: ['delete'] }),
          ),
        ).toBe('effect')
      })

      it('still refuses one already so whose ops are none, which the module refuses before it reads what is so', () => {
        expect(
          checkEffect(
            { op: 'disable', id: 'blessed' },
            withBless({ disabled: true, ops: [] }),
          ),
        ).toBe('effect')
        expect(
          checkEffect(
            { op: 'enable', id: 'blessed' },
            withBless({ disabled: false, ops: [] }),
          ),
        ).toBe('effect')
      })
    })

    it('refuses an effect with no ops, as from a module before 0.39.0', () => {
      const [temporary] = sheet.effects
      const [bless] = temporary.effects
      expect(
        checkEffect(
          { op: 'disable', id: 'blessed' },
          {
            effects: [
              { ...temporary, effects: [{ ...bless, ops: undefined }] },
            ],
          },
        ),
      ).toBe('effect')
      expect(
        checkEffect(
          { op: 'disable', id: 'blessed' },
          { effects: [{ ...temporary, effects: [{ ...bless, ops: [] }] }] },
        ),
      ).toBe('effect')
      // Already so, Bless being on, but nothing is the player's from such a module.
      expect(
        checkEffect(
          { op: 'enable', id: 'blessed' },
          {
            effects: [
              { ...temporary, effects: [{ ...bless, ops: undefined }] },
            ],
          },
        ),
      ).toBe('effect')
    })

    it('refuses the delete of one gone from a sheet whose effects carry no ops, as from a module before 0.39.0, which has no command for it', () => {
      const older = {
        effects: sheet.effects.map(section => ({
          ...section,
          effects: section.effects.map(effect => ({
            ...effect,
            ops: undefined,
          })),
        })),
      }
      expect(checkEffect({ op: 'delete', id: 'hasted' }, older)).toBe('effect')
    })

    it.each([
      [
        'an effect the sheet lacks, turned off',
        { op: 'disable', id: 'hasted' },
      ],
      ['an effect the sheet lacks, turned on', { op: 'enable', id: 'hasted' }],
      [
        'another item’s effect of the same id',
        {
          op: 'disable',
          id: 'ring.raging',
        },
      ],
      ['the item’s id alone', { op: 'disable', id: 'rage' }],
    ] as [string, EffectInput][])('finds %s gone', (_name, effect) => {
      expect(checkEffect(effect, sheet)).toBe('gone')
    })

    it('finds every effect gone from no sheet, and every effect but a deleted one from one with no effects', () => {
      for (const op of ['disable', 'enable', 'delete'] as const) {
        expect(checkEffect({ op, id: 'blessed' })).toBe('gone')
      }
      for (const op of ['disable', 'enable'] as const) {
        expect(checkEffect({ op, id: 'blessed' }, { effects: [] })).toBe('gone')
      }
    })
  })
})
