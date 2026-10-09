/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  asks,
  targetsOf,
  UsePicker,
  useTargetsOf,
  type Picking,
} from './use-picker'
import { sheetAction, sheetSpell } from '@/mocks/sending-stone'
import type {
  SheetAction,
  SheetSpellSection,
  SheetUse,
} from '@/types/sending-stone'
import type { TableCombat, TableCombatant } from '@/types/table'

const combatant = (
  fields: Partial<TableCombatant> & Pick<TableCombatant, 'id' | 'name'>,
): TableCombatant => ({
  initiative: 10,
  defeated: false,
  side: 'other',
  ...fields,
})

const fight: TableCombat = {
  id: 'cmbt1',
  name: null,
  started: true,
  round: 2,
  combatants: [
    combatant({ id: 'goblin1', name: 'Goblin', initiative: 18 }),
    combatant({ id: 'thorin1', name: 'Thorin Oakenshield', side: 'me' }),
    combatant({ id: 'vex1', name: 'Vex', side: 'party' }),
    combatant({ id: 'boss1', name: 'Goblin Boss', initiative: 4 }),
    combatant({ id: 'wolf1', name: 'Wolf', defeated: true }),
  ],
}

/** Slots of 1st to 3rd level, the 2nd used up. */
const spellbook: SheetSpellSection[] = [
  {
    id: 'spell1',
    label: '1st Level',
    slots: { value: 2, max: 4, level: 1 },
    spells: [
      sheetSpell({ id: 'bless', name: 'Bless' }),
      sheetSpell({ id: 'cure', name: 'Cure Wounds' }),
      sheetSpell({ id: 'orb', name: 'Chromatic Orb' }),
      sheetSpell({ id: 'shield', name: 'Shield' }),
    ],
  },
  {
    id: 'spell2',
    label: '2nd Level',
    slots: { value: 0, max: 3, level: 2 },
    spells: [],
  },
  {
    id: 'spell3',
    label: '3rd Level',
    slots: { value: 1, max: 2, level: 3 },
    spells: [sheetSpell({ id: 'fireball', name: 'Fireball', level: 3 })],
  },
]

const use = (
  type: SheetUse['type'],
  targets: Partial<SheetUse['targets']> = {},
): SheetUse => ({
  id: 'act',
  type,
  targets: {
    self: false,
    area: false,
    count: null,
    perLevel: null,
    affects: 'creature',
    ...targets,
  },
})

const spell = (
  id: string,
  name: string,
  level: number,
  fields: Partial<SheetAction> = {},
) => sheetAction({ id, name, type: 'spell', level, ...fields })

const warhammer = sheetAction({
  id: 'warhammer',
  name: 'Warhammer',
  type: 'weapon',
  attackId: 'swing',
  toHit: 7,
})
const attacking = (action: SheetAction): Picking => ({
  kind: 'attack',
  action,
  request: { label: `${action.name} attack`, modifier: 7 },
})
const using = (action: SheetAction): Picking => ({ kind: 'use', action })

const renderPicker = (
  picking: Picking,
  {
    combat = fight,
    last,
    areas,
  }: { combat?: TableCombat | null; last?: string; areas?: boolean } = {},
) => {
  const onPick = jest.fn()
  const onClose = jest.fn()
  render(
    <UsePicker
      picking={picking}
      combat={combat ?? undefined}
      spellbook={spellbook}
      last={last}
      areas={areas}
      onPick={onPick}
      onClose={onClose}
    />,
  )
  return { onPick, onClose }
}

describe('components/character-sheet/use-picker', () => {
  it('can attack anyone in the combat but the attacker', () => {
    expect(targetsOf(fight).map(({ id }) => id)).toEqual([
      'goblin1',
      'vex1',
      'boss1',
      'wolf1',
    ])
    expect(targetsOf()).toEqual([])
  })

  it('offers help to you and your allies first, and harm to all but you', () => {
    const cure = spell('cure', 'Cure Wounds', 1, {
      activity: use('heal', { count: 1, affects: 'ally' }),
    })
    const fireball = spell('fireball', 'Fireball', 3, {
      activity: use('save', { area: true }),
    })
    const shield = spell('shield', 'Shield', 1, {
      activity: use('utility', { self: true, affects: 'self' }),
    })
    expect(useTargetsOf(cure, fight).map(({ id }) => id)).toEqual([
      'thorin1',
      'vex1',
      'goblin1',
      'boss1',
      'wolf1',
    ])
    expect(useTargetsOf(fireball, fight).map(({ id }) => id)).toEqual([
      'goblin1',
      'vex1',
      'boss1',
      'wolf1',
    ])
    expect(useTargetsOf(shield, fight)).toEqual([])
    expect(useTargetsOf(fireball)).toEqual([])
  })

  it('asks before an attack or a use only whom at, in a fight, or with what, where there is a choice', () => {
    const shield = spell('shield', 'Shield', 1, {
      activity: use('utility', { self: true, affects: 'self' }),
    })
    const surge = sheetAction({
      id: 'surge',
      name: 'Action Surge',
      activity: use('utility', { affects: null }),
    })
    const cantrip = spell('bolt', 'Fire Bolt', 0, {
      attackId: 'bolt',
      toHit: 5,
    })
    const bow = sheetAction({
      id: 'bow',
      name: 'Longbow',
      type: 'weapon',
      attackId: 'shoot',
      ammunition: [
        { id: 'arrows', name: 'Arrows', quantity: 12 },
        { id: 'silver', name: 'Silvered Arrows', quantity: 3 },
      ],
    })
    expect(asks(attacking(warhammer), fight, spellbook)).toBe(true)
    expect(asks(attacking(warhammer), undefined, spellbook)).toBe(false)
    expect(asks(attacking(cantrip), undefined, spellbook)).toBe(false)
    expect(asks(attacking(bow), undefined, spellbook)).toBe(true)
    // Shield can be cast with 1st- or 3rd-level slots.
    expect(asks(using(shield), fight, spellbook)).toBe(true)
    expect(asks(using(surge), fight, spellbook)).toBe(false)
  })

  it('lists who can be attacked, the last target first, marking allies and the defeated, then no one', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker(attacking(warhammer), { last: 'boss1' })

    const dialog = screen.getByRole('dialog', { name: 'Warhammer attack' })
    const [close, ...buttons] = within(dialog).getAllByRole('button')
    expect(close).toHaveAccessibleName('Close')
    expect(buttons.map(button => button.textContent)).toEqual([
      'Goblin BossLast target',
      'Goblin',
      'VexAlly',
      'WolfDefeated',
      'No target',
    ])
    await user.click(
      within(dialog).getByRole('button', { name: /^Goblin Boss/ }),
    )
    expect(onPick).toHaveBeenCalledWith({ targets: [fight.combatants[3]] })
    await user.click(within(dialog).getByRole('button', { name: 'No target' }))
    expect(onPick).toHaveBeenLastCalledWith({ targets: [] })
  })

  it('attacks with the ammunition and mode chosen, preset to the first left, out of a fight too', async () => {
    const user = userEvent.setup()
    const bow = sheetAction({
      id: 'bow',
      name: 'Longbow',
      type: 'weapon',
      attackId: 'shoot',
      ammunition: [
        { id: 'broken', name: 'Broken Arrows', quantity: 0 },
        { id: 'arrows', name: 'Arrows', quantity: 12 },
        { id: 'silver', name: 'Silvered Arrows', quantity: 3 },
      ],
      attackModes: [
        { value: 'oneHanded', label: 'One-Handed' },
        { value: 'thrown', label: 'Thrown' },
      ],
    })
    const { onPick } = renderPicker(attacking(bow), { combat: null })

    expect(
      screen.getByRole('radio', { name: 'Broken Arrows, 0 left' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('radio', { name: 'Arrows, 12 left' }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'One-Handed' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.click(
      screen.getByRole('radio', { name: 'Silvered Arrows, 3 left' }),
    )
    await user.click(screen.getByRole('radio', { name: 'Thrown' }))
    await user.click(screen.getByRole('button', { name: 'Attack' }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [],
      ammunition: 'silver',
      attackMode: 'thrown',
    })
  })

  it('casts a spell attack with the slot chosen, preset as dnd5e would, the slots left showing', async () => {
    const user = userEvent.setup()
    const orb = spell('orb', 'Chromatic Orb', 1, {
      attackId: 'orbCast',
      toHit: 5,
    })
    const { onPick } = renderPicker(attacking(orb))

    expect(
      screen.getByRole('radio', { name: '1st Level, 2 slots left' }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('radio', { name: '2nd Level, 0 slots left' }),
    ).toBeDisabled()
    await user.click(
      screen.getByRole('radio', { name: '3rd Level, 1 slot left' }),
    )
    await user.click(screen.getByRole('button', { name: /^Goblin$/ }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [fight.combatants[0]],
      slot: 'spell3',
    })
  })

  it('uses an activity that spends no slot at the level chosen, one with none left too', async () => {
    const user = userEvent.setup()
    // A spell's save each turn, such as Spirit Guardians', after it's cast at its 1st-level slots.
    const aura = spell('shield', 'Shield (Emanation Save)', 1, {
      activity: use('save', { count: 1 }),
      consumesSlot: false,
    })
    const { onPick } = renderPicker(using(aura))

    const levels = screen.getByRole('group', { name: 'At level' })
    expect(
      within(levels)
        .getAllByRole('radio')
        .map(radio => [
          radio.textContent,
          radio.getAttribute('aria-checked'),
          (radio as HTMLButtonElement).disabled,
        ]),
    ).toEqual([
      ['1st', 'true', false],
      ['2nd', 'false', false],
      ['3rd', 'false', false],
    ])
    expect(screen.getByText('Choose who to use it at.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '2nd Level' }))
    await user.click(screen.getByRole('button', { name: /^Goblin$/ }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [fight.combatants[0]],
      slot: 'spell2',
    })
  })

  it('heals the one tapped, or no one', async () => {
    const user = userEvent.setup()
    const cure = spell('cure', 'Cure Wounds', 1, {
      activity: use('heal', { count: 1, affects: 'ally' }),
    })
    const { onPick } = renderPicker(using(cure))

    const dialog = screen.getByRole('dialog', { name: 'Cure Wounds' })
    expect(
      within(dialog).getByText('Choose who to cast it at.'),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^Vex/ }))
    expect(onPick).toHaveBeenCalledWith({
      targets: [fight.combatants[2]],
      slot: 'spell1',
    })
  })

  it('casts at those ticked, as many as the slot chosen lets it take', async () => {
    const user = userEvent.setup()
    const bless = spell('bless', 'Bless', 1, {
      activity: use('utility', { count: 3, perLevel: 1, affects: 'ally' }),
    })
    const { onPick } = renderPicker(using(bless))

    expect(screen.getByText('Tick who to target. Up to 3.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cast' })).toBeInTheDocument()
    for (const name of [/^Thorin/, /^Vex/, /^Goblin$/]) {
      await user.click(screen.getByRole('checkbox', { name }))
    }
    expect(
      screen.getByRole('checkbox', { name: /^Goblin Boss/ }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Cast at 3 targets' }),
    ).toBeInTheDocument()

    // Cast at 3rd level, it takes two more.
    await user.click(
      screen.getByRole('radio', { name: '3rd Level, 1 slot left' }),
    )
    expect(screen.getByText('Tick who to target. Up to 5.')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /^Goblin Boss/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Vex/ }))
    await user.click(screen.getByRole('button', { name: 'Cast at 3 targets' }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [fight.combatants[1], fight.combatants[0], fight.combatants[3]],
      slot: 'spell3',
    })
  })

  it('ticks who an area catches, with no limit, and casts at none', async () => {
    const user = userEvent.setup()
    const fireball = spell('fireball', 'Fireball', 3, {
      activity: use('save', { area: true }),
    })
    const { onPick } = renderPicker(using(fireball))

    expect(
      screen.getByText('Tick who is caught in the area.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cast' }))
    expect(onPick).toHaveBeenCalledWith({ targets: [] })
  })

  describe('an area attack', () => {
    const breath = sheetAction({
      id: 'breath',
      name: 'Breath Weapon',
      attackId: 'breathAttack',
      toHit: 5,
      attackArea: { count: 2, perLevel: null, affects: 'creature' },
    })

    it('ticks those it catches, as many as it takes, where the game makes it at them', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(attacking(breath), { areas: true })

      expect(
        screen.getByText('Tick who is caught in the area. Up to 2.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Attack' })).toBeInTheDocument()
      await user.click(screen.getByRole('checkbox', { name: /^Goblin Boss/ }))
      await user.click(screen.getByRole('checkbox', { name: /^Goblin$/ }))
      expect(screen.getByRole('checkbox', { name: /^Vex/ })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Attack 2 targets' }))

      expect(onPick).toHaveBeenCalledWith({
        targets: [fight.combatants[0], fight.combatants[3]],
      })
    })

    it('takes one target, as any attack, where the game makes it at one', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(attacking(breath))

      expect(screen.getByText('Choose who to attack.')).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).toBeNull()
      await user.click(screen.getByRole('button', { name: /^Goblin Boss/ }))
      expect(onPick).toHaveBeenCalledWith({ targets: [fight.combatants[3]] })
    })
  })

  it('uses a feature on oneself with one tap, and lists no one', async () => {
    const user = userEvent.setup()
    const shield = spell('shield', 'Shield', 1, {
      activity: use('utility', { self: true, affects: 'self' }),
    })
    const { onPick } = renderPicker(using(shield))

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cast' }))
    expect(onPick).toHaveBeenCalledWith({ targets: [], slot: 'spell1' })
  })

  it('closes, and shows nothing while nothing is picked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPicker(attacking(warhammer))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
