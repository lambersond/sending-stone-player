/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ALONE_SPEND_KEY, asks, UsePicker, type Picking } from './use-picker'
import { TableApiContext } from '@/hooks/use-table-api'
import {
  aloneSpells,
  battleaxeAction,
  burningHandsAction,
  hellishRebukeAction,
  longbowAction,
  pactSpells,
  potionAction,
  sheetAction,
} from '@/mocks/sending-stone'
import type {
  SheetAction,
  SheetSpellSection,
  TableDamagePlan,
} from '@/types/sending-stone'

/*
 * Damage on its own's choices in the use picker, from module 0.41.0 (round 0.41.0 §2.3, §2.4,
 * §2.11.2, §7): the level, the weapon's mode and ammunition, and the Spend switch.
 */

/** Where this device keeps Thorin's Spend switch, at his player's seat. */
const THORIN = `${ALONE_SPEND_KEY}:player:char-1`

const picking = (action: SheetAction, healing = false): Picking => ({
  kind: 'alone',
  action,
  healing,
  choice: {},
})

const renderPicker = (
  action: SheetAction,
  {
    spellbook = aloneSpells(),
    healing = false,
    spendKey = THORIN,
  }: {
    spellbook?: SheetSpellSection[]
    healing?: boolean
    spendKey?: string
  } = {},
) => {
  const onPick = jest.fn()
  const onClose = jest.fn()
  const view = render(
    <UsePicker
      picking={picking(action, healing)}
      spellbook={spellbook}
      spendKey={spendKey}
      onPick={onPick}
      onClose={onClose}
    />,
  )
  return { onPick, onClose, ...view }
}

const dialog = () => screen.getByRole('dialog')

/** The chips a row offers: their text, whether each is chosen, and whether it can be. */
const chips = (row: string) =>
  within(screen.getByRole('group', { name: row }))
    .getAllByRole('radio')
    .map(radio => [
      radio.textContent,
      radio.getAttribute('aria-checked'),
      (radio as HTMLButtonElement).disabled,
    ])

const spend = () => within(dialog()).getByRole('switch')

/** What a screen reader hears as a pick changes the switch's words. */
const echo = () =>
  dialog().querySelector('[aria-live="polite"]')?.textContent ?? ''

/** A plan of one roll's dice, as the game sends it. */
const plan = (fields: Partial<TableDamagePlan> = {}): TableDamagePlan => ({
  normal: {
    critical: false,
    plannable: true,
    rolls: [
      {
        formula: '1d8 + 4',
        type: 'Slashing',
        dice: [{ faces: 8, number: 1 }],
      },
    ],
  },
  critical: null,
  choices: [],
  spends: [],
  ...fields,
})

/** A Longsword: nothing to choose, nothing spent. */
const longsword = sheetAction({
  id: 'longsword',
  name: 'Longsword',
  type: 'weapon',
  toHit: 7,
  attackId: 'swing',
  tableDamage: plan(),
})

/** Fire Bolt, a cantrip, scaling by the character's level, with nothing to choose. */
const fireBolt = sheetAction({
  id: 'bolt',
  name: 'Fire Bolt',
  type: 'spell',
  level: 0,
  toHit: 5,
  attackId: 'boltAttack',
  tableDamage: plan(),
})

/** A Dagger: one-handed, its first mode, or thrown, which spends it. */
const dagger = (spends: TableDamagePlan['spends'] = ['thrown']) =>
  sheetAction({
    id: 'dagger',
    name: 'Dagger',
    type: 'weapon',
    toHit: 5,
    attackId: 'stab',
    attackModes: [
      { value: 'oneHanded', label: 'One-Handed' },
      { value: 'thrown', label: 'Thrown' },
    ],
    tableDamage: plan({ spends }),
  })

describe('components/character-sheet/use-picker, damage on its own, from module 0.41.0', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  afterEach(cleanup)

  it('offers Burning Hands’ levels, each with how many are left, and the switch on, naming the slot it spends', () => {
    renderPicker(burningHandsAction())

    expect(dialog()).toHaveAccessibleName('Burning Hands')
    expect(dialog()).toHaveTextContent(
      'Its damage goes to your Gamemaster’s game on its own, for your Gamemaster to apply.',
    )
    expect(chips('At level')).toEqual([
      ['1st · 2 left', 'true', false],
      ['2nd · 1 left', 'false', false],
    ])
    expect(
      screen.getByRole('radio', { name: '1st Level, 2 slots left' }),
    ).toBeInTheDocument()
    expect(spend()).toHaveAccessibleName('Spend a 1st-level spell slot')
    expect(spend()).toBeChecked()
    expect(spend()).toHaveAccessibleDescription(
      'Turn it off where it was spent in Foundry already.',
    )
    expect(
      within(dialog()).getByRole('button', { name: 'Roll damage' }),
    ).toBeInTheDocument()
    // Whom at is never asked.
    expect(within(dialog()).queryByText(/No target|Choose who/)).toBeNull()
  })

  it('names the slot picked in the switch, a screen reader told so, and goes on with it, spending it', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker(burningHandsAction())
    expect(echo()).toBe('')

    await user.click(screen.getByRole('radio', { name: /^2nd Level/ }))
    expect(spend()).toHaveAccessibleName('Spend a 2nd-level spell slot')
    expect(echo()).toBe('Spend a 2nd-level spell slot')
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [],
      slot: 'spell2',
      consume: true,
    })
  })

  it('offers an empty pool only with the switch off, saying no more how many are left, and moves off it as it is turned on', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker(burningHandsAction(), {
      spellbook: aloneSpells(2, 0),
    })
    expect(chips('At level')).toEqual([
      ['1st · 2 left', 'true', false],
      ['2nd · 0 left', 'false', true],
    ])

    await user.click(spend())
    expect(spend()).not.toBeChecked()
    expect(chips('At level')).toEqual([
      ['1st', 'true', false],
      ['2nd', 'false', false],
    ])
    expect(screen.getByRole('radio', { name: '2nd Level' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '2nd Level' }))
    expect(spend()).toHaveAccessibleName('Spend a 2nd-level spell slot')

    // On again, the pick never rests on the empty one.
    await user.click(spend())
    expect(chips('At level')).toEqual([
      ['1st · 2 left', 'true', false],
      ['2nd · 0 left', 'false', true],
    ])
    expect(spend()).toHaveAccessibleName('Spend a 1st-level spell slot')
    expect(echo()).toBe('Spend a 1st-level spell slot')

    await user.click(spend())
    await user.click(screen.getByRole('radio', { name: '2nd Level' }))
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))
    expect(onPick).toHaveBeenCalledWith({ targets: [], slot: 'spell2' })
  })

  it('remembers the switch on this device for that character, on the first time, off once left off', async () => {
    const user = userEvent.setup()
    const first = renderPicker(burningHandsAction())
    await user.click(spend())
    expect(globalThis.localStorage.getItem(THORIN)).toBe('off')
    first.unmount()

    renderPicker(burningHandsAction())
    expect(spend()).not.toBeChecked()
    cleanup()

    // Another character's, or the Gamemaster's at Thorin's sheet, is its own.
    renderPicker(burningHandsAction(), {
      spendKey: `${ALONE_SPEND_KEY}:player:char-2`,
    })
    expect(spend()).toBeChecked()
    cleanup()
    renderPicker(burningHandsAction(), {
      spendKey: `${ALONE_SPEND_KEY}:gm:gm:c1:thorin`,
    })
    expect(spend()).toBeChecked()
  })

  it('turns the switch with Space and Enter, as a tap does', async () => {
    const user = userEvent.setup()
    renderPicker(burningHandsAction())

    spend().focus()
    await user.keyboard(' ')
    expect(spend()).not.toBeChecked()
    await user.keyboard('{Enter}')
    expect(spend()).toBeChecked()
  })

  it('casts a pact-only warlock’s spell at its pact slot, with no chips, naming the pact slot', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker(hellishRebukeAction(), {
      spellbook: pactSpells(),
    })

    expect(within(dialog()).queryByRole('group')).toBeNull()
    expect(spend()).toHaveAccessibleName('Spend a pact slot (3rd level)')
    // With no chips, the switch has focus.
    expect(spend()).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))
    expect(onPick).toHaveBeenCalledWith({
      targets: [],
      slot: 'pact',
      consume: true,
    })
  })

  it('names a potion’s use, rolling healing', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker(potionAction(), {
      spellbook: [],
      healing: true,
    })

    expect(dialog()).toHaveTextContent(
      'Its healing goes to your Gamemaster’s game on its own, for your Gamemaster to apply.',
    )
    expect(spend()).toHaveAccessibleName('Spend a use of Potion of Healing')
    await user.click(screen.getByRole('button', { name: 'Roll healing' }))
    expect(onPick).toHaveBeenCalledWith({ targets: [], consume: true })
  })

  it('names a slot and a use together, for a spell with a material it spends', () => {
    const hands = burningHandsAction()
    renderPicker(
      burningHandsAction({
        tableDamage: { ...hands.tableDamage!, spends: ['slot', 'uses'] },
      }),
    )

    expect(spend()).toHaveAccessibleName(
      'Spend a 1st-level spell slot and a use of Burning Hands',
    )
  })

  it('says it in the Gamemaster’s words at their seat', () => {
    render(
      <TableApiContext
        value={{
          role: 'gm',
          api: '/api/campaigns/c1/characters/thorin',
          key: 'gm:c1:thorin',
        }}
      >
        <UsePicker
          picking={picking(burningHandsAction())}
          spellbook={aloneSpells()}
          onPick={jest.fn()}
          onClose={jest.fn()}
        />
      </TableApiContext>,
    )

    expect(dialog()).toHaveTextContent(
      'Its damage goes to your game on its own, for you to apply.',
    )
  })

  it('gives focus to the level chosen as it opens', () => {
    renderPicker(burningHandsAction())

    expect(
      screen.getByRole('radio', { name: '1st Level, 2 slots left' }),
    ).toHaveFocus()
  })

  it('asks only where there is something to choose or spend', () => {
    const spells = aloneSpells()
    const ask = (action: SheetAction, spellbook = spells) =>
      asks(picking(action), undefined, spellbook)

    expect(ask(burningHandsAction())).toBe(true)
    expect(ask(hellishRebukeAction(), pactSpells())).toBe(true)
    expect(ask(potionAction(), [])).toBe(true)
    expect(ask(battleaxeAction(), [])).toBe(true)
    expect(ask(longbowAction(), [])).toBe(true)
    // Nothing to choose, nothing spent.
    expect(ask(longsword, [])).toBe(false)
    expect(ask(fireBolt)).toBe(false)
    // A thrown weapon's switch shows only in a thrown mode, its modes asking anyway.
    expect(ask(dagger())).toBe(true)
    // One level and nothing spent: rolled at once, at its slot.
    expect(
      ask(
        burningHandsAction({
          tableDamage: plan({
            choices: [{ level: 2, normal: plan().normal, critical: null }],
          }),
        }),
        [aloneSpells()[0]],
      ),
    ).toBe(false)
  })

  describe("a weapon's mode and ammunition (round 0.41.0 §2.11.2)", () => {
    it('offers a versatile weapon’s modes, the first chosen, with no switch where it spends nothing', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(battleaxeAction(), { spellbook: [] })

      expect(chips('Mode')).toEqual([
        ['One-Handed', 'true', false],
        ['Two-Handed', 'false', false],
      ])
      expect(within(dialog()).queryByRole('switch')).toBeNull()
      expect(screen.getByRole('radio', { name: 'One-Handed' })).toHaveFocus()

      await user.click(screen.getByRole('radio', { name: 'Two-Handed' }))
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(onPick).toHaveBeenCalledWith({
        targets: [],
        attackMode: 'twoHanded',
      })
    })

    it('offers a single-mode bow’s two ammunitions, the first with any left chosen, one with none left only with the switch off', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(longbowAction(), { spellbook: [] })

      expect(within(dialog()).queryByRole('group', { name: 'Mode' })).toBeNull()
      expect(chips('Ammunition')).toEqual([
        ['Arrows of Fire · 20', 'true', false],
        ['Arrows · 0', 'false', true],
      ])
      expect(spend()).toHaveAccessibleName('Spend an Arrows of Fire')
      expect(spend()).toBeChecked()

      await user.click(spend())
      expect(chips('Ammunition')).toEqual([
        ['Arrows of Fire · 20', 'true', false],
        ['Arrows · 0', 'false', false],
      ])
      await user.click(screen.getByRole('radio', { name: 'Arrows, 0 left' }))
      expect(spend()).toHaveAccessibleName('Spend an Arrows')
      expect(echo()).toBe('Spend an Arrows')
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(onPick).toHaveBeenCalledWith({
        targets: [],
        ammunition: 'arrows',
      })
    })

    it('fires a bow’s one ammunition, named, with no chips', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(
        longbowAction({
          ammunition: [
            { id: 'arrowsFire', name: 'Arrows of Fire', quantity: 5 },
          ],
        }),
        { spellbook: [] },
      )

      expect(within(dialog()).queryByRole('group')).toBeNull()
      expect(spend()).toHaveAccessibleName('Spend an Arrows of Fire')
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(onPick).toHaveBeenCalledWith({
        targets: [],
        ammunition: 'arrowsFire',
        consume: true,
      })
    })

    it('spends a thrown weapon only in a thrown mode, and a returning one never', async () => {
      const user = userEvent.setup()
      const { onPick, unmount } = renderPicker(dagger(), { spellbook: [] })

      expect(within(dialog()).queryByRole('switch')).toBeNull()
      await user.click(screen.getByRole('radio', { name: 'Thrown' }))
      expect(spend()).toHaveAccessibleName('Spend the Dagger')
      expect(echo()).toBe('Spend the Dagger')
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(onPick).toHaveBeenCalledWith({
        targets: [],
        attackMode: 'thrown',
        consume: true,
      })
      unmount()

      renderPicker(dagger([]), { spellbook: [] })
      await user.click(screen.getByRole('radio', { name: 'Thrown' }))
      expect(within(dialog()).queryByRole('switch')).toBeNull()
    })

    it('offers a weapon’s choices only for its attack’s damage', () => {
      renderPicker(
        battleaxeAction({
          attackId: null,
          tableDamage: plan({ spends: ['uses'] }),
        }),
        { spellbook: [] },
      )

      expect(within(dialog()).queryByRole('group')).toBeNull()
      expect(spend()).toHaveAccessibleName('Spend a use of Battleaxe')
    })
  })

  it('goes on with nothing chosen as it opens afresh, its picks forgotten', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPicker(burningHandsAction())
    await user.click(screen.getByRole('radio', { name: /^2nd Level/ }))

    rerender(
      <UsePicker
        spellbook={aloneSpells()}
        spendKey={THORIN}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    )
    act(() => {
      rerender(
        <UsePicker
          picking={picking(burningHandsAction())}
          spellbook={aloneSpells()}
          spendKey={THORIN}
          onPick={jest.fn()}
          onClose={jest.fn()}
        />,
      )
    })
    expect(chips('At level')).toEqual([
      ['1st · 2 left', 'true', false],
      ['2nd · 1 left', 'false', false],
    ])
  })
})
