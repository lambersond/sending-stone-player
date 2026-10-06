/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionsTab } from './actions-tab'
import {
  characterSheet,
  fullerSheet,
  sheetAction,
  TEXTS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetAction } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) => {
  const onRoll = jest.fn()
  const onRollDamage = jest.fn()
  render(
    <ActionsTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
      onRoll={onRoll}
      onRollDamage={onRollDamage}
    />,
  )
  return { onRoll, onRollDamage }
}

/** A sheet whose only actions are these, under Actions. */
const withActions = (...actions: SheetAction[]) =>
  characterSheet({ actions: [{ id: 'action', label: 'Actions', actions }] })

/** The button that opens an action, named for it. */
const toggle = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}`), expanded: false })

/** What holds an action's uses, found by them, such as 7/10. */
const pill = (text: string) =>
  screen.getByText(text).parentElement?.parentElement

const rows = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map(item => item.textContent)

describe('components/character-sheet/actions-tab', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ html: '<p>A heavy hammer.</p>' }),
        }) as Response,
    )
  })

  it('lists actions by how they are activated, with what each rolls', () => {
    renderTab()

    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(['Actions', 'Bonus Actions', 'Reactions', 'Special'])
    expect(rows(screen.getByRole('region', { name: 'Actions' }))).toEqual([
      'WarhammerAction · reach 5 ft · Bludgeoning+71d8 + 4',
      'HandaxeAction · reach 5 ft or range 20/60 ft · Slashing+71d6 + 4',
      'GuidanceAction · Touch',
      'Fire BreathAction · 15 ft · Fire1/11 of 1 uses leftDEX 132d6',
    ])
    expect(rows(screen.getByRole('region', { name: 'Bonus Actions' }))).toEqual(
      ['Second WindBonus Action · Self · Healing1/11 of 1 uses left1d10 + 5'],
    )
    expect(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    ).toHaveClass('text-attack')
    expect(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    ).toHaveClass('text-damage')
    expect(
      screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
    ).toHaveClass('text-primary')
    expect(screen.getByTitle('DEX saving throw')).toHaveTextContent('DEX 13')
  })

  it('rolls an attack, or from its menu, with advantage and the like', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderTab()

    await user.click(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Warhammer attack',
      modifier: 7,
      advantage: undefined,
    })

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Handaxe attack, +7' }),
    )
    const menu = screen.getByRole('menu', { name: 'Handaxe attack +7' })
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Roll with advantage' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Handaxe attack',
      modifier: 7,
      advantage: 'adv',
    })
  })

  it("rolls damage, or a critical hit's from its menu", async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab()
    const damage = {
      label: 'Warhammer damage',
      parts: [
        {
          terms: [
            { sign: 1, count: 1, sides: 8 },
            { sign: 1, flat: 4 },
          ],
          type: 'Bludgeoning',
        },
      ],
      healing: false,
    }

    await user.click(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith({
      ...damage,
      critical: false,
    })

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    const menu = screen.getByRole('menu', {
      name: 'Warhammer damage 1d8 + 4',
    })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Roll critical damage'])
    await user.click(within(menu).getByRole('menuitem'))
    expect(onRollDamage).toHaveBeenLastCalledWith({ ...damage, critical: true })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('rolls healing, which has no critical hit', async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab()

    const healing = screen.getByRole('button', {
      name: 'Second Wind healing, 1d10 + 5',
    })
    fireEvent.contextMenu(healing)
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(healing)

    expect(onRollDamage).toHaveBeenLastCalledWith({
      label: 'Second Wind healing',
      parts: [
        {
          terms: [
            { sign: 1, count: 1, sides: 10 },
            { sign: 1, flat: 5 },
          ],
          type: 'Healing',
        },
      ],
      healing: true,
      critical: false,
    })
  })

  it('rolls every part of damage of several kinds together', async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab(
      withActions(
        sheetAction({
          id: 'flame-tongue',
          name: 'Flame Tongue',
          toHit: 8,
          damage: [
            { formula: '1d8 + 5', type: 'Slashing', healing: false },
            { formula: '2d6', type: 'Fire', healing: false },
          ],
        }),
      ),
    )

    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Flame TongueAction · Slashing, Fire+81d8 + 5 + 2d6',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Flame Tongue damage, 1d8 + 5 + 2d6',
      }),
    )
    expect(onRollDamage.mock.calls[0][0].parts).toEqual([
      {
        terms: [
          { sign: 1, count: 1, sides: 8 },
          { sign: 1, flat: 5 },
        ],
        type: 'Slashing',
      },
      { terms: [{ sign: 1, count: 2, sides: 6 }], type: 'Fire' },
    ])
  })

  it('keeps uses out of the way of what an action rolls, on a phone', () => {
    renderTab(
      withActions(
        sheetAction({
          id: 'staff',
          name: 'Staff of Fire',
          toHit: 2,
          uses: { value: 7, max: 10, recovery: 'Dawn' },
        }),
        sheetAction({
          id: 'wand',
          name: 'Wand of Magic Missiles',
          uses: { value: 5, max: 7, recovery: 'Dawn' },
        }),
      ),
    )

    expect(pill('7/10')).toHaveClass('hidden', '@md:inline')
    expect(pill('5/7')).not.toHaveClass('hidden')
  })

  it("shows a formula it can't read without rolling it", () => {
    renderTab(
      withActions(
        sheetAction({
          id: 'odd',
          name: 'Odd Blade',
          damage: [{ formula: 'max(1, 1d4)', type: null, healing: false }],
        }),
      ),
    )

    expect(screen.getByText('max(1, 1d4)').tagName).toBe('SPAN')
    expect(screen.queryByRole('button', { name: /damage/ })).toBeNull()
  })

  it('opens an action to all there is to know of it, and its description', async () => {
    const user = userEvent.setup()
    renderTab()

    const opener = toggle('Warhammer')
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    expect(fetch).not.toHaveBeenCalled()
    await user.click(opener)

    expect(opener).toHaveAttribute('aria-expanded', 'true')
    const body = (opener.closest('li') as HTMLElement).querySelector(
      '[id]',
    ) as HTMLElement
    expect(body.id).toBe(opener.getAttribute('aria-controls'))
    expect(within(body).getByText('Weapon')).toBeInTheDocument()
    expect(
      within(body)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Activation: Action',
      'Range: reach 5 ft',
      'Target: 1 Creature',
      'To hit: +7',
      'Damage: 1d8 + 4 Bludgeoning',
    ])
    expect(await within(body).findByText('A heavy hammer.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.warhammer}`,
      { signal: expect.any(AbortSignal) },
    )

    await user.click(opener)
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    expect(opener).not.toHaveAttribute('aria-controls')
    expect(body).not.toBeInTheDocument()
  })

  it('opens to a saving throw, uses and healing in words', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(toggle('Fire Breath'))
    await user.click(toggle('Second Wind'))

    const terms = screen
      .getAllByRole('term')
      .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`)
    expect(terms).toEqual([
      'Activation: Action',
      'Range: 15 ft',
      'Target: 15 ft Cone',
      'Saving throw: DC 13 DEX',
      'Damage: 2d6 Fire',
      'Uses: 1 of 1 left, Long Rest',
      'Activation: Bonus Action',
      'Range: Self',
      'Healing: 1d10 + 5',
      'Uses: 1 of 1 left, Short Rest, Long Rest',
    ])
    expect(screen.getAllByText('Feature')).toHaveLength(2)
  })

  it("names a spell's level and concentration, and an unidentified item's secret", async () => {
    const user = userEvent.setup()
    renderTab(
      withActions(
        sheetAction({
          id: 'guidance',
          name: 'Guidance',
          type: 'spell',
          level: 0,
          concentration: true,
        }),
        sheetAction({ id: 'shield', name: 'Shield', type: 'spell', level: 1 }),
        sheetAction({
          id: 'odd',
          name: 'Strange Wand',
          type: 'equipment',
          identified: false,
          activation: null,
        }),
      ),
    )

    for (const name of ['Guidance', 'Shield', 'Strange Wand']) {
      await user.click(toggle(name))
    }

    expect(screen.getByText('Cantrip · Concentration')).toBeInTheDocument()
    expect(screen.getByText('Level 1 spell')).toBeInTheDocument()
    expect(screen.getByText('Equipment · Not identified')).toBeInTheDocument()
    expect(
      within(screen.getAllByRole('listitem')[2]).queryByRole('term'),
    ).toBeNull()
  })

  it('opens an action of a kind it has no name for to just its facts', async () => {
    const user = userEvent.setup()
    renderTab(
      withActions(
        sheetAction({ id: 'odd', name: 'Odd Thing', type: 'container' }),
      ),
    )

    await user.click(toggle('Odd Thing'))

    const item = screen.getByRole('listitem')
    expect(item.querySelector('p')).toBeNull()
    expect(within(item).getByRole('term')).toHaveTextContent('Activation')
  })

  it('names a section the player named in Tidy 5e, whatever its name', () => {
    renderTab(
      characterSheet({
        actions: [
          {
            id: 'Rage & Fury',
            label: 'Rage & Fury',
            actions: [sheetAction({ id: 'rage', name: 'Rage' })],
          },
        ],
      }),
    )

    expect(
      screen.getByRole('region', { name: 'Rage & Fury' }),
    ).toHaveTextContent('Rage')
  })

  it('says so when there are no actions to show, as from an older module', () => {
    renderTab(characterSheet())

    expect(screen.getByText('No actions to show yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
