/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  asks,
  enchantPicks,
  targetsOf,
  UsePicker,
  useTargetsOf,
  type Picking,
} from './use-picker'
import {
  castingSheet,
  enchantingSheet,
  sheetAction,
  sheetSpell,
  WAND_LEVELS,
} from '@/mocks/sending-stone'
import { castIndex, type CastIndex } from '@/utils/casts'
import { belongingsOf } from '@/utils/enchantments'
import { activityActions, itemAction, spellAction } from '@/utils/sheet-actions'
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

/** The chips a row offers: their text, whether each is chosen, and whether it can be. */
const chips = (row: string) =>
  within(screen.getByRole('group', { name: row }))
    .getAllByRole('radio')
    .map(radio => [
      radio.textContent,
      radio.getAttribute('aria-checked'),
      (radio as HTMLButtonElement).disabled,
    ])

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
    casts,
  }: {
    combat?: TableCombat | null
    last?: string
    areas?: boolean
    casts?: CastIndex
  } = {},
) => {
  const onPick = jest.fn()
  const onClose = jest.fn()
  render(
    <UsePicker
      picking={picking}
      combat={combat ?? undefined}
      spellbook={spellbook}
      casts={casts}
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

  it('casts a spell through its free casting with no slots offered, at its own level, from module 0.21.0', async () => {
    const user = userEvent.setup()
    const free = spell('bless', 'Bless (Cast (free casting))', 1, {
      activity: use('utility', { count: 3, affects: 'ally' }),
      consumesSlot: false,
      forward: { charges: 1, short: false },
    })
    const { onPick } = renderPicker(using(free))

    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('group', { name: /Cast at|At level/ })).toBeNull()
    expect(screen.getByText('Tick who to target. Up to 3.')).toBeInTheDocument()
    for (const name of [/^Thorin/, /^Vex/, /^Goblin$/]) {
      await user.click(screen.getByRole('checkbox', { name }))
    }
    expect(
      screen.getByRole('checkbox', { name: /^Goblin Boss/ }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cast at 3 targets' }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [fight.combatants[1], fight.combatants[2], fight.combatants[0]],
    })
    // Nothing is asked of it out of a fight.
    expect(asks(using(free), undefined, spellbook)).toBe(false)
  })

  it('uses a spell’s check called for once it’s cast at the level chosen, spending none, from module 0.21.0', async () => {
    const user = userEvent.setup()
    // The 2014 Entangle's Escape Plants, which the module uses at the slot's level, as dnd5e does
    // with the slot unticked, spending none.
    const plants = spell('orb', 'Entangle (Escape Plants Check)', 1, {
      activity: use('check', { count: 1 }),
      check: {
        checks: [{ type: 'check', ability: 'str' }],
        dc: 18,
        own: false,
      },
      consumesSlot: false,
    })
    const { onPick } = renderPicker(using(plants))

    expect(chips('At level')).toEqual([
      ['1st', 'true', false],
      ['2nd', 'false', false],
      ['3rd', 'false', false],
    ])
    await user.click(screen.getByRole('radio', { name: '2nd Level' }))
    await user.click(screen.getByRole('button', { name: /^Goblin$/ }))

    expect(onPick).toHaveBeenCalledWith({
      targets: [fight.combatants[0]],
      slot: 'spell2',
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

    it('takes more for each level it is cast above its own, with its only pool of slots, as the game does', () => {
      const ray = spell('ray', 'Scorching Cone', 1, {
        attackId: 'rayAttack',
        toHit: 6,
        attackArea: { count: 1, perLevel: 1, affects: 'creature' },
      })
      render(
        <UsePicker
          picking={attacking(ray)}
          combat={fight}
          spellbook={[
            {
              id: 'pact',
              label: 'Pact Magic',
              slots: { value: 2, max: 2, level: 3 },
              spells: [sheetSpell({ id: 'ray', name: 'Scorching Cone' })],
            },
          ]}
          areas
          onPick={jest.fn()}
          onClose={jest.fn()}
        />,
      )

      // Cast with a 3rd-level pact slot, two levels higher: three targets.
      expect(
        screen.getByText('Tick who is caught in the area. Up to 3.'),
      ).toBeInTheDocument()
    })

    it('ticks no more than the game takes at once, however many an area may catch', async () => {
      const user = userEvent.setup()
      const crowd: TableCombat = {
        ...fight,
        combatants: Array.from({ length: 22 }, (_, index) =>
          combatant({ id: `foe${index}`, name: `Foe ${index}` }),
        ),
      }
      renderPicker(
        attacking({
          ...breath,
          attackArea: { count: null, perLevel: null, affects: 'creature' },
        }),
        { combat: crowd, areas: true },
      )

      expect(
        screen.getByText('Tick who is caught in the area.'),
      ).toBeInTheDocument()
      for (const index of Array.from({ length: 20 }, (_, at) => at)) {
        await user.click(
          screen.getByRole('checkbox', { name: new RegExp(`^Foe ${index}$`) }),
        )
      }
      expect(screen.getByRole('checkbox', { name: /^Foe 20$/ })).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Attack 20 targets' }),
      ).toBeInTheDocument()
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

  describe('a spell an item casts, from module 0.20.0', () => {
    const sheet = castingSheet()
    const casts = castIndex(sheet)
    const [wand, flame] = sheet.actions[0].actions

    /** The Wand's Magic Missile, cast at the levels given, or at its own alone. */
    const wandWith = (levels?: typeof WAND_LEVELS): SheetAction => {
      const cast = { ...wand.cast! }
      delete cast.levels
      return { ...wand, cast: levels ? { ...cast, levels } : cast }
    }

    it('asks at which level it is cast, out of a fight too, where the item casts it higher', () => {
      expect(asks(using(wand), undefined, spellbook, casts)).toBe(true)
      expect(asks(attacking(wand), undefined, spellbook, casts)).toBe(true)
      // Its copy, as the Spells tab lists it, at the levels of the item's Cast of it.
      const copy = spellAction(sheet.spells[0].spells[0])!
      expect(asks(using(copy), undefined, spellbook, casts)).toBe(true)
      expect(asks(using(copy), undefined, spellbook)).toBe(false)
      // Hex, cast at its level alone, asks nothing out of a fight.
      const hex = activityActions(flame)[0]
      expect(asks(using(hex), undefined, spellbook, casts)).toBe(false)
      expect(asks(using(wandWith()), undefined, spellbook, casts)).toBe(false)
    })

    it('offers each level with the charges it spends, preset to its own, and casts at the one chosen', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(using(wand), { combat: null, casts })

      expect(chips('Cast at')).toEqual([
        ['1st · 1 charge', 'true', false],
        ['2nd · 2 charges', 'false', false],
        ['3rd · 3 charges', 'false', false],
      ])
      await user.click(
        screen.getByRole('radio', { name: '2nd Level, 2 charges' }),
      )
      await user.click(screen.getByRole('button', { name: 'Cast' }))
      expect(onPick).toHaveBeenCalledWith({ targets: [], slot: 'spell2' })
    })

    it('casts at its own level unless another is chosen, saying so', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(using(wand), { combat: null, casts })
      await user.click(screen.getByRole('button', { name: 'Cast' }))
      expect(onPick).toHaveBeenCalledWith({ targets: [], slot: 'spell1' })
    })

    it('offers no level it has too few charges left for', () => {
      const shorter = wandWith([
        WAND_LEVELS[0],
        WAND_LEVELS[1],
        { ...WAND_LEVELS[2], short: true },
      ])
      renderPicker(using(shorter), { combat: null, casts })
      expect(chips('Cast at')).toEqual([
        ['1st · 1 charge', 'true', false],
        ['2nd · 2 charges', 'false', false],
        ['3rd · 3 charges', 'false', true],
      ])
    })

    it('uses a later activity that spends nothing at any level, saying no charges', async () => {
      const user = userEvent.setup()
      const higher = castingSheet()
      const [strike, hexCast] = higher.actions[0].actions[1].activities!
      higher.actions[0].actions[1].activities = [
        strike,
        {
          ...hexCast,
          cast: {
            ...hexCast.cast!,
            levels: [
              { level: 1, charges: 1, short: false },
              { level: 2, charges: 2, short: true },
            ],
          },
        },
      ]
      const [bonus] = activityActions(spellAction(higher.spells[0].spells[1])!)
      const { onPick } = renderPicker(using(bonus), {
        casts: castIndex(higher),
      })

      expect(screen.queryByRole('group', { name: 'Cast at' })).toBeNull()
      expect(chips('At level')).toEqual([
        ['1st', 'true', false],
        ['2nd', 'false', false],
      ])
      expect(screen.getByText('Choose who to use it at.')).toBeInTheDocument()
      await user.click(screen.getByRole('radio', { name: '2nd Level' }))
      await user.click(screen.getByRole('button', { name: /^Goblin$/ }))
      expect(onPick).toHaveBeenCalledWith({
        targets: [fight.combatants[0]],
        slot: 'spell2',
      })
    })

    it('offers no level, and sends none, for one cast at its level alone', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPicker(using(wandWith()), { casts })
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      await user.click(screen.getByRole('checkbox', { name: /^Goblin$/ }))
      await user.click(screen.getByRole('button', { name: 'Cast at 1 target' }))
      expect(onPick).toHaveBeenCalledWith({ targets: [fight.combatants[0]] })
    })

    it('takes as many targets more as the level chosen is above its own', async () => {
      const user = userEvent.setup()
      renderPicker(using(wand), { casts })

      expect(
        screen.getByText('Tick who to target. Up to 3.'),
      ).toBeInTheDocument()
      await user.click(
        screen.getByRole('radio', { name: '2nd Level, 2 charges' }),
      )
      expect(
        screen.getByText('Tick who to target. Up to 4.'),
      ).toBeInTheDocument()
      for (const name of [/^Goblin$/, /^Vex/, /^Goblin Boss/, /^Wolf/]) {
        await user.click(screen.getByRole('checkbox', { name }))
      }
      expect(
        screen.getByRole('button', { name: 'Cast at 4 targets' }),
      ).toBeInTheDocument()
    })
  })

  it('closes, and shows nothing while nothing is picked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPicker(attacking(warhammer))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})

/** An action whose enchant activity enchants so. */
const enchanting = (
  action: SheetAction,
  enchant: Partial<NonNullable<SheetUse['enchant']>>,
): SheetAction => ({
  ...action,
  activity: {
    ...action.activity!,
    enchant: { ...action.activity!.enchant!, ...enchant },
  },
})

/** Ways to enchant without limits, so many. */
const ways = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `way${index}`,
    name: `Flame Blade (${['Fire', 'Cold', 'Acid', 'Lightning', 'Thunder'][index]})`,
    min: null,
    max: null,
  }))

describe('components/character-sheet/use-picker for enchant activities, from module 0.21.0', () => {
  const sheet = enchantingSheet()
  const belongings = belongingsOf(sheet)
  const magicWeapon = spellAction(sheet.spells[1].spells[0])!
  const shillelagh = spellAction(sheet.spells[0].spells[0])!
  const [flameTongue, venom] = sheet.inventory.sections[0].items
    .slice(3)
    .map(item => itemAction(item)!)
  const engulf = activityActions(flameTongue)[0]
  const coat = activityActions(venom)[0]

  const renderEnchant = (action: SheetAction) => {
    const onPick = jest.fn()
    render(
      <UsePicker
        picking={using(action)}
        combat={fight}
        spellbook={sheet.spells}
        belongings={belongings}
        onPick={onPick}
        onClose={jest.fn()}
      />,
    )
    return { onPick }
  }

  it('asks which item for one that enchants another, and how for one that enchants its own in more ways than one', () => {
    const ask = (action: SheetAction) =>
      asks(using(action), fight, sheet.spells)
    expect(ask(magicWeapon)).toBe(true)
    expect(ask(shillelagh)).toBe(true)
    expect(asks(using(shillelagh), undefined, sheet.spells)).toBe(true)
    expect(ask(engulf)).toBe(false)
    expect(ask(enchanting(engulf, { profiles: ways(2) }))).toBe(true)
    expect(ask(coat)).toBe(false)
    // The way it's on its own item already isn't one to use it in again.
    expect(
      ask(
        enchanting(coat, {
          profiles: ways(2),
          applied: [{ item: 'venom', effect: 'e1', profile: 'way0' }],
        }),
      ),
    ).toBe(false)
  })

  it('uses one that asks nothing in its first way, at the level it is cast at by default', () => {
    expect(enchantPicks(engulf, sheet.spells)).toEqual({
      enchant: { profile: 'ablazeProfile01' },
    })
    expect(enchantPicks(magicWeapon, sheet.spells)).toEqual({
      slot: 'spell2',
      enchant: { profile: 'SLSudYaACjmmmZsU' },
    })
    expect(enchantPicks(warhammer, sheet.spells)).toEqual({})
  })

  it('offers the ways it enchants at the level chosen, again as it changes, and no level with none', async () => {
    const user = userEvent.setup()
    renderEnchant(magicWeapon)
    expect(chips('Enchantment')).toEqual([['Magic Weapon, +1', 'true', false]])
    await user.click(
      screen.getByRole('radio', { name: '4th Level, 1 slot left' }),
    )
    expect(chips('Enchantment')).toEqual([['Magic Weapon, +2', 'true', false]])
    await user.click(
      screen.getByRole('radio', { name: '2nd Level, 2 slots left' }),
    )
    expect(chips('Enchantment')).toEqual([['Magic Weapon, +1', 'true', false]])
  })

  it('cuts a long way short to the width of its row, saying the whole of it', () => {
    const long = 'Giant’s Bane: Paired Attunement Bonuses and a Great Deal More'
    renderEnchant(
      enchanting(magicWeapon, {
        profiles: [
          { id: 'plusOne', name: long, min: null, max: null },
          { id: 'plusTwo', name: 'Magic Weapon, +2', min: null, max: null },
        ],
      }),
    )
    const row = screen.getByRole('group', { name: 'Enchantment' })
    // A fieldset is as wide as what's in it unless it's let shrink, so its chips never cut a name
    // short and the picker scrolls sideways on a phone: it's let shrink.
    expect(row.tagName).toBe('FIELDSET')
    expect(row).toHaveClass('min-w-0')
    const chip = within(row).getByRole('radio', { name: long })
    expect(chip).toHaveClass('max-w-full')
    expect(chip.firstElementChild).toHaveClass('block', 'truncate')
  })

  it('offers no level at which it enchants nothing', () => {
    renderEnchant(
      enchanting(magicWeapon, {
        profiles: [
          { id: 'plusOne', name: 'Magic Weapon, +1', min: null, max: 2 },
          { id: 'plusTwo', name: 'Magic Weapon, +2', min: 4, max: 5 },
        ],
      }),
    )
    expect(chips('Cast at')).toEqual([
      ['2nd · 2 left', 'true', false],
      ['3rd · 1 left', 'false', true],
      ['4th · 1 left', 'false', false],
    ])
  })

  it('lists the items it may enchant with their names and icons, marking those it enchants already', () => {
    renderEnchant(
      enchanting(magicWeapon, {
        applied: [{ item: 'club', effect: 'e1', profile: 'SLSudYaACjmmmZsU' }],
      }),
    )
    expect(screen.getByText('Choose what to enchant.')).toBeInTheDocument()
    const longsword = screen.getByRole('button', { name: 'Longsword' })
    expect(longsword.querySelector('img')).toHaveAttribute(
      'src',
      'https://game.test/longsword.webp',
    )
    expect(
      screen.getByRole('button', {
        name: /^Club\b.*enchanted by it already$/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Quarterstaff' }),
    ).toBeInTheDocument()
  })

  it('enchants the item tapped, at once, in the way and with the slot chosen', async () => {
    const user = userEvent.setup()
    const { onPick } = renderEnchant(magicWeapon)
    await user.click(
      screen.getByRole('radio', { name: '4th Level, 1 slot left' }),
    )
    await user.click(screen.getByRole('button', { name: 'Longsword' }))
    expect(onPick).toHaveBeenCalledWith({
      targets: [],
      slot: 'spell4',
      enchant: { profile: '8OhsRxK3dF1JeQXO', item: 'longsword' },
    })
  })

  it('leaves it on its card, enchanting none of the character’s items', async () => {
    const user = userEvent.setup()
    const { onPick } = renderEnchant(shillelagh)
    await user.click(
      screen.getByRole('button', { name: /^Leave it on the card/ }),
    )
    expect(onPick).toHaveBeenCalledWith({
      targets: [],
      enchant: { profile: 'Oy8fP2N3q4R5s6T7' },
    })
  })

  it('says where none of the character’s items can take it, still leaving it on the card', () => {
    renderEnchant(enchanting(shillelagh, { items: [] }))
    expect(
      screen.getByText('None of your items can take it.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Leave it on the card/ }),
    ).toBeInTheDocument()
  })

  it('lists more ways than a row has room for one under another, each name said in full', async () => {
    const user = userEvent.setup()
    const { onPick } = renderEnchant(
      enchanting(engulf, { toggle: false, profiles: ways(5) }),
    )
    const group = screen.getByRole('radiogroup', { name: 'Enchantment' })
    expect(within(group).getAllByRole('radio')).toHaveLength(5)
    await user.click(
      within(group).getByRole('radio', { name: 'Flame Blade (Thunder)' }),
    )
    await user.click(screen.getByRole('button', { name: 'Use' }))
    expect(onPick).toHaveBeenCalledWith({
      targets: [],
      enchant: { profile: 'way4' },
    })
  })

  it('never offers one that enchants its own item the way it is on it already', () => {
    renderEnchant(
      enchanting(coat, {
        profiles: ways(3),
        applied: [{ item: 'venom', effect: 'e1', profile: 'way1' }],
      }),
    )
    expect(chips('Enchantment')).toEqual([
      ['Flame Blade (Fire)', 'true', false],
      ['Flame Blade (Acid)', 'false', false],
    ])
    expect(
      screen.queryByText('Choose what to enchant.'),
    ).not.toBeInTheDocument()
  })
})
