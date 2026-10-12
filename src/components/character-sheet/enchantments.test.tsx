/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import {
  enchantingSheet,
  enchantment,
  sheetAction,
  sheetItem,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  SheetActivityFavorite,
  SheetUse,
} from '@/types/sending-stone'

/*
 * Enchant activities and the enchantments they apply, from module 0.21.0, as Ari's sheet uses them
 * at the table: Magic Weapon cast on a weapon of hers, a Flame Tongue set alight and put out as a
 * switch, Dagger of Venom's Coat Blade ended once it's coated, and the enchantments her inventory
 * shows, ended from there.
 */

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

/** The rolls the game takes, enchantments ended among them. */
const KINDS: RollKind[] = ['use', 'endEnchantment', 'attack', 'damage']

const PLUS_TWO = '8OhsRxK3dF1JeQXO'

/** The Flame Tongue's Ablaze, as the game applied it. */
const ABLAZE = {
  item: 'flametongue',
  effect: 'ablazeEffect001',
  profile: 'ablazeProfile01',
}

/**
 * Ari's sheet, its Actions tab listing Magic Weapon and her items for their enchant activities, as
 * the module lists an item under each kind of action it has: the Flame Tongue under Bonus Actions,
 * set alight or not, and Dagger of Venom under Actions, coated or not.
 */
const ariSheet = ({
  alight = false,
  coated = false,
}: { alight?: boolean; coated?: boolean } = {}): CharacterSheet => {
  const sheet = enchantingSheet()
  const weapons = sheet.inventory.sections[0].items
  const flameTongue = weapons.find(({ id }) => id === 'flametongue')!
  const venom = weapons.find(({ id }) => id === 'venom')!
  const engulf = flameTongue.activities![1].activity!
  const coat = venom.activities![1].activity!
  const enchanted = (use: SheetUse, applied: (typeof ABLAZE)[]): SheetUse => ({
    ...use,
    enchant: { ...use.enchant!, applied },
  })
  return {
    ...sheet,
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            id: 'venom',
            name: 'Dagger of Venom',
            type: 'weapon',
            activityName: 'Coat Blade',
            activationType: 'action',
            uses: venom.uses,
            activity: enchanted(
              coat,
              coated
                ? [
                    {
                      item: 'venom',
                      effect: 'venomEffect01',
                      profile: 'venomProfile01',
                    },
                  ]
                : [],
            ),
          }),
        ],
      },
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [
          sheetAction({
            id: 'magicweapon',
            name: 'Magic Weapon',
            type: 'spell',
            activation: '1 Bonus Action',
            activationType: 'bonus',
            level: 2,
            concentration: true,
            activity: sheet.spells[1].spells[0].activity,
          }),
          sheetAction({
            id: 'flametongue',
            name: 'Flame Tongue',
            type: 'weapon',
            activityName: 'Engulf in Flames',
            activation: '1 Bonus Action',
            activationType: 'bonus',
            activity: enchanted(engulf, alight ? [ABLAZE] : []),
          }),
        ],
      },
    ],
  }
}

/**
 * The game, which makes each request as it answers it by its id: everything posted, in order. One
 * it hasn't answered is still on its way.
 */
const answering = (answers: Record<string, Record<string, unknown>>) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posted.length}` }),
      } as Response
    }
    const id = String(url).split('/').at(-1) ?? ''
    const answer = answers[id] ?? { status: 'pending' }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, ...answer }),
    } as Response
  }) as typeof fetch
  return posted
}

/** An enchant activity used, or an enchantment ended, as the game made it. */
const made = (enchantment: Record<string, unknown>) => ({
  status: 'done',
  visible: true,
  rolls: [],
  use: { type: 'enchant' },
  damage: null,
  enchantment,
})

const pane = (sheet: CharacterSheet, kinds: RollKind[] = KINDS) => (
  <CharacterPane
    characterId='char-ari'
    name='Ari'
    sheet={toTableSheet(sheet, GAME)}
    rollsToTable={kinds}
  />
)

/** A tab of the sheet, shown. */
const show = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

/** The Flame Tongue's switch. */
const flameSwitch = () =>
  screen.getByRole('switch', { name: 'Flame Tongue (Engulf in Flames)' })

/** The button that opens a row, by its name. */
const toggleOf = (name: string | RegExp) =>
  screen.getByRole('button', {
    name: typeof name === 'string' ? new RegExp(`^${name}`) : name,
    expanded: false,
  })

// The game is asked after a request once a second, which a busy machine may be slow to get to.
jest.setTimeout(20_000)

describe('enchant activities at the table, from module 0.21.0', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  describe('a use', () => {
    it('casts Magic Weapon on the item tapped, in the way offered at the level chosen', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': made({
          enchanted: {
            item: 'longsword',
            itemName: 'Longsword',
            effect: 'mwEffect000001',
            profile: PLUS_TWO,
            name: 'Magic Weapon, +2',
          },
          ended: null,
        }),
      })
      render(pane(ariSheet()))
      await show(user, 'Actions')

      const row = toggleOf('Magic Weapon').closest('li')!
      expect(row).not.toHaveTextContent('Used in Foundry')
      await user.click(
        within(row).getByRole('button', { name: 'Cast Magic Weapon' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Magic Weapon' })
      expect(
        within(picker).getByRole('radio', { name: 'Magic Weapon, +1' }),
      ).toBeChecked()
      await user.click(
        within(picker).getByRole('radio', { name: '4th Level, 1 slot left' }),
      )
      expect(
        within(picker).getByRole('radio', { name: 'Magic Weapon, +2' }),
      ).toBeChecked()
      expect(fetch).not.toHaveBeenCalled()
      await user.click(
        within(picker).getByRole('button', { name: 'Longsword' }),
      )

      expect(posted[0]).toEqual({
        kind: 'use',
        item: 'magicweapon',
        activity: 'mw-cast',
        targets: [],
        slot: 'spell4',
        enchant: { profile: PLUS_TWO, item: 'longsword' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      await waitFor(
        () =>
          expect(screen.getByRole('status')).toHaveTextContent(
            'Cast at the table · Magic Weapon, +2 on Longsword',
          ),
        { timeout: 5000 },
      )
    })

    it('leaves Magic Weapon on its card, with the slot it is cast with by default', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(pane(ariSheet()))
      await show(user, 'Spells')

      await user.click(
        screen.getByRole('button', { name: 'Cast Magic Weapon' }),
      )
      await user.click(
        screen.getByRole('button', { name: /^Leave it on the card/ }),
      )
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'use',
          item: 'magicweapon',
          slot: 'spell2',
          enchant: { profile: 'SLSudYaACjmmmZsU' },
        }),
      )
    })
  })

  describe("a Flame Tongue's switch", () => {
    it('is off while the sheet says so, and sets it alight in its one way, with nothing asked', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(pane(ariSheet()))
      await show(user, 'Actions')

      const flames = screen.getByRole('switch', {
        name: 'Flame Tongue (Engulf in Flames)',
      })
      expect(flames).not.toBeChecked()
      await user.click(flames)

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toEqual({
        kind: 'use',
        item: 'flametongue',
        activity: 'engulf',
        targets: [],
        slot: null,
        enchant: { profile: 'ablazeProfile01' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      // It can't be turned while it's on its way.
      expect(flames).toBeDisabled()
    })

    it('holds what the game said it left it as until the sheet changes, then follows the sheet', async () => {
      const user = userEvent.setup()
      answering({
        'req-1': made({
          enchanted: { ...ABLAZE, itemName: 'Flame Tongue', name: 'Ablaze' },
          ended: null,
        }),
      })
      const { rerender } = render(pane(ariSheet()))
      await show(user, 'Actions')

      await user.click(flameSwitch())
      // Alight, as the game said, though the sheet hasn't said so yet.
      await waitFor(() => expect(flameSwitch()).toBeChecked(), {
        timeout: 5000,
      })
      expect(flameSwitch()).toBeEnabled()
      // The sheet says so too; and then, put out in the game, that it isn't.
      rerender(pane(ariSheet({ alight: true })))
      expect(flameSwitch()).toBeChecked()
      rerender(pane(ariSheet()))
      expect(flameSwitch()).not.toBeChecked()
    })

    it('puts it out, with nothing asked, as the switch is turned off', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': made({
          enchanted: null,
          ended: { ...ABLAZE, itemName: 'Flame Tongue', name: 'Ablaze' },
        }),
      })
      render(pane(ariSheet({ alight: true })))
      await show(user, 'Actions')

      const flames = screen.getByRole('switch', {
        name: 'Flame Tongue (Engulf in Flames)',
      })
      expect(flames).toBeChecked()
      await user.click(flames)

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toEqual({
        kind: 'endEnchantment',
        enchantment: { item: 'flametongue', effect: 'ablazeEffect001' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      // Out, as the game said, though the sheet still has it alight.
      await waitFor(() => expect(flames).not.toBeChecked(), { timeout: 5000 })
      expect(screen.getByRole('status')).toHaveTextContent(
        'AblazeEnded at the table',
      )
    })

    it('puts it out as the switch is turned off, with nothing asked, whatever the ways it may be set alight in', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      const sheet = ariSheet({ alight: true })
      const engulf = sheet.actions[1].actions[1].activity!
      engulf.enchant = {
        ...engulf.enchant!,
        profiles: [
          { id: 'ablazeProfile01', name: 'Ablaze', min: null, max: null },
          { id: 'frostProfile001', name: 'Frost', min: null, max: null },
        ],
      }
      render(pane(sheet))
      await show(user, 'Actions')

      expect(flameSwitch()).toBeChecked()
      await user.click(flameSwitch())

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'endEnchantment',
          enchantment: { item: 'flametongue', effect: 'ablazeEffect001' },
        }),
      ])
    })

    it('acts as its row does among the favorites', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      const sheet = ariSheet()
      const engulf = sheet.actions[1].actions[1].activity!
      const favorite: SheetActivityFavorite = {
        type: 'activity',
        id: 'engulf',
        itemId: 'flametongue',
        itemType: 'weapon',
        itemName: 'Flame Tongue',
        name: 'Engulf in Flames',
        img: null,
        activation: '1 Bonus Action',
        range: 'Self',
        target: null,
        toHit: null,
        activity: engulf,
        save: null,
        damage: [],
        uses: null,
      }
      // And Magic Weapon's Cast, which asks which item, as its row does.
      const magicWeapon: SheetActivityFavorite = {
        ...favorite,
        id: 'mw-cast',
        itemId: 'magicweapon',
        itemType: 'spell',
        itemName: 'Magic Weapon',
        name: 'Magic Weapon',
        range: 'Touch',
        activity: sheet.actions[1].actions[0].activity,
      }
      render(
        pane({ ...sheet, actions: [], favorites: [favorite, magicWeapon] }),
      )
      await show(user, 'Actions')

      // Named as the favorite is.
      const flames = screen.getByRole('switch', { name: 'Engulf in Flames' })
      expect(flames).not.toBeChecked()
      await user.click(flames)
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'use',
          item: 'flametongue',
          activity: 'engulf',
          enchant: { profile: 'ablazeProfile01' },
        }),
      )

      await user.click(
        screen.getByRole('button', { name: 'Cast Magic Weapon' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Magic Weapon' })
      await user.click(within(picker).getByRole('button', { name: 'Club' }))
      expect(posted[1]).toEqual(
        expect.objectContaining({
          kind: 'use',
          item: 'magicweapon',
          activity: 'mw-cast',
          slot: 'spell2',
          enchant: { profile: 'SLSudYaACjmmmZsU', item: 'club' },
        }),
      )
    })
  })

  describe('Dagger of Venom', () => {
    it('coats the blade in its one way, with nothing asked', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(pane(ariSheet()))
      await show(user, 'Actions')

      await user.click(
        screen.getByRole('button', {
          name: 'Use Dagger of Venom (Coat Blade)',
        }),
      )
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'use',
          item: 'venom',
          activity: 'coat',
          enchant: { profile: 'venomProfile01' },
        }),
      )
    })

    it('ends the coating, once the player says so, in place of using it again', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(pane(ariSheet({ coated: true })))
      await show(user, 'Actions')

      expect(
        screen.queryByRole('button', {
          name: 'Use Dagger of Venom (Coat Blade)',
        }),
      ).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'End Venom on Dagger of Venom' }),
      )
      const confirm = screen.getByRole('dialog', { name: 'End Venom?' })
      expect(confirm).toHaveTextContent(/^End Venom\?On Dagger of Venom\./)
      await user.click(within(confirm).getByRole('button', { name: 'Keep' }))
      expect(posted).toEqual([])

      await user.click(
        screen.getByRole('button', { name: 'End Venom on Dagger of Venom' }),
      )
      await user.click(
        within(screen.getByRole('dialog', { name: 'End Venom?' })).getByRole(
          'button',
          { name: 'End' },
        ),
      )
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'endEnchantment',
          enchantment: { item: 'venom', effect: 'venomEffect01' },
        }),
      )
    })

    it('ends the coating from beneath the dagger in the inventory, naming the dagger as it is listed', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      // As dnd5e's Dagger of Venom has it: its attack first, then Coat Blade, coated.
      const sheet = ariSheet()
      const venom = sheet.inventory.sections[0].items.find(
        ({ id }) => id === 'venom',
      )!
      const coat = venom.activities![1]
      coat.activity = {
        ...coat.activity!,
        enchant: {
          ...coat.activity!.enchant!,
          applied: [
            {
              item: 'venom',
              effect: 'venomEffect01',
              profile: 'venomProfile01',
            },
          ],
        },
      }
      render(pane(sheet))
      await show(user, 'Inventory')

      await user.click(toggleOf('Dagger of Venom'))
      await user.click(
        screen.getByRole('button', { name: 'End Venom on Dagger of Venom' }),
      )
      const confirm = screen.getByRole('dialog', { name: 'End Venom?' })
      expect(confirm).toHaveTextContent(/^End Venom\?On Dagger of Venom\. Only/)
      await user.click(within(confirm).getByRole('button', { name: 'End' }))
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'endEnchantment',
          enchantment: { item: 'venom', effect: 'venomEffect01' },
        }),
      )
    })
  })

  describe('the enchantments on items', () => {
    it('marks an enchanted item by its name, and says each of its enchantments once it is open', async () => {
      const user = userEvent.setup()
      answering({})
      render(pane(ariSheet()))
      await show(user, 'Inventory')

      for (const row of [
        toggleOf('Club'),
        toggleOf('Quarterstaff'),
        toggleOf('Greataxe'),
        screen.getByText('Pebble').closest('summary')!,
      ]) {
        expect(
          within(row).getByRole('img', { name: 'Enchanted' }),
        ).toBeInTheDocument()
      }
      expect(
        within(toggleOf('Longsword')).queryByRole('img', { name: 'Enchanted' }),
      ).toBeNull()

      await user.click(toggleOf('Club'))
      const club = within(screen.getByRole('list', { name: 'Enchantments' }))
      expect(club.getByRole('listitem')).toHaveTextContent(
        /^Magic Weapon, \+1 · Concentration · from Magic Weapon/,
      )
      // Bryn's, which Ari may end on her own club.
      expect(
        club.getByRole('button', { name: 'End Magic Weapon, +1 on Club' }),
      ).toBeInTheDocument()
    })

    it("ends another's on an item of the character's, once the player says so", async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(pane(ariSheet()))
      await show(user, 'Inventory')

      await user.click(toggleOf('Club'))
      await user.click(
        screen.getByRole('button', { name: 'End Magic Weapon, +1 on Club' }),
      )
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'End Magic Weapon, +1?' }),
        ).getByRole('button', { name: 'End' }),
      )
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'endEnchantment',
          enchantment: { item: 'club', effect: 'brynMagicWeap' },
        }),
      )
    })

    it('says what a template put on an item, with no End', async () => {
      const user = userEvent.setup()
      answering({})
      render(pane(ariSheet()))
      await show(user, 'Inventory')

      await user.click(toggleOf('Greataxe'))
      const greataxe = within(
        screen.getByRole('list', { name: 'Enchantments' }),
      )
      expect(greataxe.getByRole('listitem')).toHaveTextContent(/^Weapon, \+1$/)
      expect(greataxe.queryByRole('button', { name: /^End/ })).toBeNull()
    })

    it('asks before it ends one, saying on what, and that what it added goes with it but concentration goes on', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      const sheet = ariSheet()
      const weapons = sheet.inventory.sections[0].items
      weapons[0] = {
        ...weapons[0],
        name: 'Longsword, +1',
        enchantments: [
          enchantment({
            id: 'mwEffect000001',
            name: 'Magic Weapon, +1',
            source: 'Magic Weapon',
            concentration: true,
            duration: '59 Minutes',
          }),
        ],
      }
      render(pane(sheet))
      await show(user, 'Inventory')

      await user.click(toggleOf(/^Longsword, \+1/))
      await user.click(
        screen.getByRole('button', {
          name: 'End Magic Weapon, +1 on Longsword, +1',
        }),
      )
      const confirm = screen.getByRole('dialog', {
        name: 'End Magic Weapon, +1?',
      })
      const body = within(confirm).getByText(/^On Longsword, \+1\./)
      expect(body).toHaveTextContent(
        'On Longsword, +1. Only the enchantment ends, as from its card in your Gamemaster’s game; what it added to the item, such as an attack, goes with it. Any concentration on it goes on.',
      )
      expect(
        within(confirm)
          .getAllByRole('button')
          .map(button => button.textContent),
      ).toEqual(expect.arrayContaining(['Keep', 'End']))
      await user.click(within(confirm).getByRole('button', { name: 'Keep' }))
      expect(posted).toEqual([])

      await user.click(
        screen.getByRole('button', {
          name: 'End Magic Weapon, +1 on Longsword, +1',
        }),
      )
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'End Magic Weapon, +1?' }),
        ).getByRole('button', { name: 'End' }),
      )
      expect(posted).toEqual([
        {
          kind: 'endEnchantment',
          enchantment: { item: 'longsword', effect: 'mwEffect000001' },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      ])
    })

    it('says an enchantment whose time has run out is expired, and ends it once the player says so', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': made({
          enchanted: null,
          ended: {
            item: 'quarterstaff',
            itemName: 'Quarterstaff',
            effect: 'shillEffect01',
            name: 'Shillelagh (1d10)',
          },
        }),
      })
      render(pane(ariSheet()))
      await show(user, 'Inventory')

      await user.click(toggleOf('Quarterstaff'))
      const staff = screen.getByRole('list', { name: 'Enchantments' })
      expect(within(staff).getByRole('listitem')).toHaveTextContent(
        'Shillelagh (1d10) · Expired · from Shillelagh',
      )
      await user.click(
        within(staff).getByRole('button', {
          name: 'End Shillelagh (1d10) on Quarterstaff',
        }),
      )
      const confirm = screen.getByRole('dialog', {
        name: 'End Shillelagh (1d10)?',
      })
      expect(confirm).toHaveTextContent('On Quarterstaff.')
      expect(confirm).toHaveTextContent('Any concentration on it goes on.')
      await user.click(within(confirm).getByRole('button', { name: 'End' }))

      expect(posted[0]).toEqual({
        kind: 'endEnchantment',
        enchantment: { item: 'quarterstaff', effect: 'shillEffect01' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      await waitFor(
        () =>
          expect(screen.getByRole('status')).toHaveTextContent(
            'Shillelagh (1d10)Ended at the table',
          ),
        { timeout: 5000 },
      )
    })

    it('ends one on something that rolls nothing, as listed', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(pane(ariSheet()))
      await show(user, 'Inventory')

      await user.click(screen.getByText('Pebble'))
      await user.click(
        screen.getByRole('button', { name: 'End Continual Flame on Pebble' }),
      )
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'End' }),
      )
      expect(posted[0]).toEqual(
        expect.objectContaining({
          kind: 'endEnchantment',
          enchantment: { item: 'pebble', effect: 'contFlame01' },
        }),
      )
    })

    it('offers no End where the game doesn’t take it', async () => {
      const user = userEvent.setup()
      answering({})
      render(pane(ariSheet(), ['use', 'attack']))
      await show(user, 'Inventory')

      await user.click(toggleOf('Quarterstaff'))
      expect(
        within(screen.getByRole('list', { name: 'Enchantments' })).getByRole(
          'listitem',
        ),
      ).toHaveTextContent('Shillelagh (1d10) · Expired · from Shillelagh')
      expect(screen.queryByRole('button', { name: /^End / })).toBeNull()
    })
  })

  describe('in Foundry alone', () => {
    it('offers nothing of a build choice, such as Eldritch Spear', async () => {
      const user = userEvent.setup()
      answering({})
      render(pane(ariSheet()))
      await show(user, 'Features')

      expect(screen.getByText('Eldritch Spear')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Eldritch Spear$/ }),
      ).toBeNull()
    })

    it('says an enchant activity a module before 0.21.0 sends is used in Foundry, with nothing to use it by', async () => {
      const user = userEvent.setup()
      answering({})
      const sheet = enchantingSheet()
      const flameTongue = sheet.inventory.sections[0].items[3]
      const older = sheetItem({
        ...flameTongue,
        activities: flameTongue.activities!.map((activity, index) =>
          index === 1 ? { ...activity, activity: null } : activity,
        ),
      })
      render(
        pane({
          ...sheet,
          inventory: {
            ...sheet.inventory,
            sections: [{ id: 'weapon', label: 'Weapons', items: [older] }],
          },
        }),
      )
      await show(user, 'Inventory')

      await user.click(toggleOf('Flame Tongue'))
      const beneath = screen.getByRole('list', {
        name: 'Flame Tongue: its other activities',
      })
      expect(beneath).toHaveTextContent('Engulf in Flames')
      expect(beneath).toHaveTextContent('Used in Foundry')
      expect(within(beneath).queryByRole('switch')).toBeNull()
    })
  })
})
