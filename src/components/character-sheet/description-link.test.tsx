/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DescriptionLinks,
  sheetTools,
  type DescriptionActions,
} from './description-actions'
import { SheetText } from './sheet-text'
import { Modal } from '@/components/modal'
import { characterSheet, sheetFavorites } from '@/mocks/sending-stone'
import type {
  SheetCondition,
  SheetSkill,
  SheetTool,
} from '@/types/sending-stone'

type User = ReturnType<typeof userEvent.setup>

/** Each test's description has a hash of its own, as loaded ones are kept by it. */
let hashes = 0
const nextHash = () => (++hashes).toString(16).padStart(14, '0')

const ORIGIN = { name: 'Worn Bardic Eternal Flame', item: 'flame' }

/** What the sheet gives descriptions to act with, each a mock. */
const actionsFor = (
  fields: Partial<DescriptionActions> = {},
): DescriptionActions => ({
  roll: jest.fn(),
  rollDamage: jest.fn(),
  rollFormula: jest.fn(),
  takes: () => true,
  ask: jest.fn(),
  abilities: characterSheet().abilities,
  skills: characterSheet().skills,
  tools: sheetTools(characterSheet()),
  proficiency: characterSheet().proficiency,
  conditions: [],
  rules: 'modern',
  showConditions: jest.fn(),
  ...fields,
})

/** A description with this HTML, drawn where the sheet says what its links do; and its hash. */
const renderText = async (
  html: string,
  actions: DescriptionActions = actionsFor(),
  wrap: (text: React.ReactNode) => React.ReactNode = text => text,
) => {
  const hash = nextHash()
  globalThis.fetch = jest.fn(
    async () => ({ ok: true, json: async () => ({ html }) }) as Response,
  )
  render(
    <DescriptionLinks actions={actions}>
      {wrap(<SheetText characterId='char-1' hash={hash} origin={ORIGIN} />)}
    </DescriptionLinks>,
  )
  await waitFor(() =>
    expect(document.querySelector('.sheet-text')).not.toBeNull(),
  )
  return { hash, actions }
}

const save = (attributes: string, label = 'DC 15 Dexterity') =>
  `<p>Make a <span class="ss-save roll" data-n="3" ${attributes}>${label}</span> saving throw.</p>`

const check = (attributes: string, label = 'DC 15 Strength (Athletics)') =>
  `<p>Make a <span class="ss-check roll" data-n="4" ${attributes}>${label}</span> check.</p>`

/** Thieves' Tools, as Thorin's sheet has them, proficient. */
const THIEF: SheetTool = {
  id: 'thief',
  name: "Thieves' Tools",
  ability: 'dex',
  total: 5,
  passive: null,
  proficiency: 1,
  mode: 0,
}

/** The menu's items, as named. */
const itemsOf = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map(item => item.getAttribute('aria-label') ?? item.textContent)

/**
 * Whether the browser would take Escape, last pressed, as a request to close the modal dialog it
 * was pressed in: it does, once the key has gone everywhere, unless something cancelled it.
 */
const escapes = () => {
  const pressed: KeyboardEvent[] = []
  const keep = (event: KeyboardEvent) => {
    if (event.key === 'Escape') pressed.push(event)
  }
  globalThis.addEventListener('keydown', keep, true)
  return {
    closesDialog: () => pressed.at(-1)?.defaultPrevented === false,
    stop: () => globalThis.removeEventListener('keydown', keep, true),
  }
}

/** A description in a modal dialog, as the dialog about an item's activity shows one. */
const inDialog = (text: React.ReactNode) => (
  <Modal open onClose={jest.fn()} title='Starry Wisp'>
    {text}
  </Modal>
)

describe('components/character-sheet/description-link', () => {
  describe('a saving throw', () => {
    it('opens a menu: to ask the table, or roll the player’s own save, with advantage, disadvantage or modified', async () => {
      const user = userEvent.setup()
      await renderText(save('data-ability="dex" data-dc="15"'))

      const link = screen.getByRole('button', { name: 'DC 15 Dexterity' })
      expect(link).toHaveAttribute('aria-haspopup', 'menu')
      await user.click(link)

      const menu = screen.getByRole('menu', {
        name: 'DC 15 Dexterity saving throw',
      })
      expect(itemsOf(menu)).toEqual([
        'Ask the table',
        'Roll my Dexterity save (+1)',
        'Roll with advantage',
        'Roll with disadvantage',
        'Modify roll…',
      ])
      await waitFor(() =>
        expect(
          within(menu).getByRole('menuitem', { name: 'Ask the table' }),
        ).toHaveFocus(),
      )
    })

    it('asks the table for it, by its description and number', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        save('data-ability="dex" data-dc="15"'),
      )

      await user.click(screen.getByRole('button', { name: 'DC 15 Dexterity' }))
      await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))

      expect(actions.ask).toHaveBeenCalledWith({
        label: 'DC 15 Dexterity saving throw',
        text: hash,
        link: 3,
      })
      expect(screen.queryByRole('menu')).toBeNull()
      expect(actions.roll).not.toHaveBeenCalled()
    })

    it('rolls the player’s own, against its DC, for the game to make it against that too', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        save('data-ability="dex" data-dc="15"'),
      )
      const open = () =>
        user.click(screen.getByRole('button', { name: 'DC 15 Dexterity' }))
      const source = { kind: 'save', key: 'dex', text: hash, link: 3 }

      await open()
      await user.click(
        screen.getByRole('menuitem', { name: 'Roll my Dexterity save (+1)' }),
      )
      await open()
      await user.click(
        screen.getByRole('menuitem', { name: 'Roll with disadvantage' }),
      )

      expect(jest.mocked(actions.roll).mock.calls).toEqual([
        [
          {
            label: 'Dexterity saving throw',
            modifier: 1,
            advantage: undefined,
            source,
            explicit: false,
            dc: 15,
          },
        ],
        [
          {
            label: 'Dexterity saving throw',
            modifier: 1,
            advantage: 'dis',
            source,
            explicit: true,
            dc: 15,
          },
        ],
      ])
    })

    it('modifies the roll first, still against its DC', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        save('data-ability="dex" data-dc="12"', 'DC 12 Dexterity'),
      )

      await user.click(screen.getByRole('button', { name: 'DC 12 Dexterity' }))
      await user.click(screen.getByRole('menuitem', { name: 'Modify roll…' }))
      const dialog = screen.getByRole('dialog', { name: 'Modify roll' })
      await user.type(within(dialog).getByRole('textbox'), '1d4')
      await user.click(within(dialog).getByRole('button', { name: /^Roll/ }))

      expect(actions.roll).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Dexterity saving throw',
          extras: [{ sign: 1, count: 1, sides: 4 }],
          source: { kind: 'save', key: 'dex', text: hash, link: 3 },
          explicit: true,
          dc: 12,
        }),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('offers one roll for each ability it may be made with, as the sheet makes it', async () => {
      const user = userEvent.setup()
      const abilities = characterSheet().abilities.map(ability =>
        ability.id === 'dex' ? { ...ability, saveMode: 1 as const } : ability,
      )
      await renderText(
        save('data-ability="str|dex"', 'Strength or Dexterity'),
        actionsFor({ abilities }),
      )

      await user.click(
        screen.getByRole('button', { name: 'Strength or Dexterity' }),
      )

      expect(
        itemsOf(
          screen.getByRole('menu', {
            name: 'Strength or Dexterity saving throw',
          }),
        ),
      ).toEqual([
        'Ask the table',
        'Roll my Strength save (+7)',
        'Roll my Dexterity save (+1, advantage)',
      ])
    })

    it('rolls a concentration check as one, with Constitution', async () => {
      const user = userEvent.setup()
      const { actions } = await renderText(
        save(
          'data-ability="con" data-dc="10" data-type="concentration"',
          'DC 10 Concentration',
        ),
      )

      await user.click(
        screen.getByRole('button', { name: 'DC 10 Concentration' }),
      )
      const menu = screen.getByRole('menu', {
        name: 'DC 10 Concentration check',
      })
      await user.click(
        within(menu).getByRole('menuitem', {
          name: 'Roll my concentration check (+6)',
        }),
      )

      expect(actions.roll).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Concentration check',
          modifier: 6,
          source: expect.objectContaining({ kind: 'save', key: 'con' }),
          dc: 10,
        }),
      )
    })

    it('says why the table can’t be asked, where it can’t, and asks nothing', async () => {
      const user = userEvent.setup()
      const { actions } = await renderText(
        save('data-ability="dex" data-dc="15"'),
        actionsFor({
          askBlocked: 'your Gamemaster’s game isn’t taking rolls now',
        }),
      )

      await user.click(screen.getByRole('button', { name: 'DC 15 Dexterity' }))
      const menu = screen.getByRole('menu')
      const ask = within(menu).getByRole('menuitem', { name: 'Ask the table' })

      expect(ask).toBeDisabled()
      expect(ask).toHaveAccessibleDescription(
        'Your Gamemaster’s game isn’t taking rolls now.',
      )
      // The first that can be chosen takes focus.
      await waitFor(() =>
        expect(
          within(menu).getByRole('menuitem', {
            name: 'Roll my Dexterity save (+1)',
          }),
        ).toHaveFocus(),
      )
      await user.click(ask)
      expect(actions.ask).not.toHaveBeenCalled()
    })

    it('never asks the table for one in a secret, which the table mustn’t read', async () => {
      const user = userEvent.setup()
      await renderText(
        `<section class="secret">${save('data-ability="dex" data-dc="15"')}</section>`,
      )

      await user.click(screen.getByRole('button', { name: 'DC 15 Dexterity' }))

      expect(itemsOf(screen.getByRole('menu'))).toEqual([
        'Roll my Dexterity save (+1)',
        'Roll with advantage',
        'Roll with disadvantage',
        'Modify roll…',
      ])
    })

    it('opens its menu inside a dialog it’s in, as the page behind it can’t be used, where Escape closes only the menu', async () => {
      const user = userEvent.setup()
      const keys = escapes()
      await renderText(
        save('data-ability="dex" data-dc="15"'),
        actionsFor(),
        inDialog,
      )

      await user.click(screen.getByRole('button', { name: 'DC 15 Dexterity' }))

      const dialog = screen.getByRole('dialog', { name: 'Starry Wisp' })
      expect(dialog).toContainElement(screen.getByRole('menu'))
      await waitFor(() =>
        expect(
          screen.getByRole('menuitem', { name: 'Ask the table' }),
        ).toHaveFocus(),
      )
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()
      expect(keys.closesDialog()).toBe(false)

      // With the menu closed, Escape is the dialog's again.
      await user.keyboard('{Escape}')
      expect(keys.closesDialog()).toBe(true)
      keys.stop()
    })

    it('offers to send this device’s rolls where only that keeps the table from being asked', async () => {
      const user = userEvent.setup()
      const sendRolls = jest.fn()
      const { actions } = await renderText(
        save('data-ability="dex" data-dc="15"'),
        actionsFor({
          askBlocked: 'this device doesn’t send your rolls to the table',
          sendRolls,
        }),
      )

      await user.click(screen.getByRole('button', { name: 'DC 15 Dexterity' }))
      const menu = screen.getByRole('menu')
      expect(itemsOf(menu)).toEqual([
        'Ask the table',
        'Send my rolls to the table',
        'Roll my Dexterity save (+1)',
        'Roll with advantage',
        'Roll with disadvantage',
        'Modify roll…',
      ])
      expect(
        within(menu).getByRole('menuitem', { name: 'Ask the table' }),
      ).toHaveAccessibleDescription(
        'This device doesn’t send your rolls to the table.',
      )
      await user.click(
        within(menu).getByRole('menuitem', {
          name: 'Send my rolls to the table',
        }),
      )

      expect(sendRolls).toHaveBeenCalledTimes(1)
      expect(actions.ask).not.toHaveBeenCalled()
      expect(actions.roll).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  describe('a check', () => {
    it('opens a menu as a saving throw does: to ask the table, or roll the player’s own check, with advantage, disadvantage or modified', async () => {
      const user = userEvent.setup()
      await renderText(check('data-checks="skill:str:ath" data-dc="15"'))

      const link = screen.getByRole('button', {
        name: 'DC 15 Strength (Athletics)',
      })
      expect(link).toHaveAttribute('aria-haspopup', 'menu')
      await user.click(link)

      const menu = screen.getByRole('menu', {
        name: 'DC 15 Strength (Athletics) check',
      })
      expect(itemsOf(menu)).toEqual([
        'Ask the table',
        'Roll my Strength (Athletics) check (+7)',
        'Roll with advantage',
        'Roll with disadvantage',
        'Modify roll…',
      ])
    })

    it('asks the table for it, by its description and number', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        check('data-checks="skill:str:ath" data-dc="15"'),
      )

      await user.click(
        screen.getByRole('button', { name: 'DC 15 Strength (Athletics)' }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))

      expect(actions.ask).toHaveBeenCalledWith({
        label: 'DC 15 Strength (Athletics) check',
        text: hash,
        link: 4,
      })
      expect(actions.roll).not.toHaveBeenCalled()
    })

    it('rolls the player’s own, against its DC, for the game to make it against that too', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        check('data-checks="skill:str:ath" data-dc="15"'),
      )
      const open = () =>
        user.click(
          screen.getByRole('button', { name: 'DC 15 Strength (Athletics)' }),
        )
      const source = { kind: 'skill', key: 'ath', text: hash, link: 4 }

      await open()
      await user.click(
        screen.getByRole('menuitem', {
          name: 'Roll my Strength (Athletics) check (+7)',
        }),
      )
      await open()
      await user.click(
        screen.getByRole('menuitem', { name: 'Roll with disadvantage' }),
      )

      expect(jest.mocked(actions.roll).mock.calls).toEqual([
        [
          {
            label: 'Strength (Athletics) check',
            modifier: 7,
            advantage: undefined,
            source,
            explicit: false,
            dc: 15,
          },
        ],
        [
          {
            label: 'Strength (Athletics) check',
            modifier: 7,
            advantage: 'dis',
            source,
            explicit: true,
            dc: 15,
          },
        ],
      ])
    })

    it('modifies the roll first, still against its DC', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        check('data-checks="check:int" data-dc="12"', 'DC 12 Intelligence'),
      )

      await user.click(
        screen.getByRole('button', { name: 'DC 12 Intelligence' }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Modify roll…' }))
      const dialog = screen.getByRole('dialog', { name: 'Modify roll' })
      await user.type(within(dialog).getByRole('textbox'), '1d4')
      await user.click(within(dialog).getByRole('button', { name: /^Roll/ }))

      expect(actions.roll).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Intelligence check',
          modifier: -1,
          extras: [{ sign: 1, count: 1, sides: 4 }],
          source: { kind: 'ability', key: 'int', text: hash, link: 4 },
          explicit: true,
          dc: 12,
        }),
      )
    })

    it('offers one roll for each way it may be made, as the sheet makes it, with the ability the description names', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        check(
          'data-checks="check:int|check:wis|skill:dex:ste|skill:cha:ath"',
          'Intelligence, Wisdom, Stealth or Charisma (Athletics)',
        ),
      )

      await user.click(
        screen.getByRole('button', {
          name: 'Intelligence, Wisdom, Stealth or Charisma (Athletics)',
        }),
      )
      const menu = screen.getByRole('menu', {
        name: 'Intelligence, Wisdom, Dexterity (Stealth), or Charisma (Athletics) check',
      })
      expect(itemsOf(menu)).toEqual([
        'Ask the table',
        'Roll my Intelligence check (−1)',
        'Roll my Wisdom check (+1)',
        'Roll my Dexterity (Stealth) check (+1, disadvantage)',
        // Athletics' +7 is Strength's +4 and +3 more: with Charisma's +0, +3.
        'Roll my Charisma (Athletics) check (+3)',
      ])
      await user.click(
        within(menu).getByRole('menuitem', {
          name: 'Roll my Charisma (Athletics) check (+3)',
        }),
      )

      expect(actions.roll).toHaveBeenCalledWith({
        label: 'Charisma (Athletics) check',
        modifier: 3,
        advantage: undefined,
        source: { kind: 'skill', key: 'ath', text: hash, link: 4 },
        explicit: false,
      })
    })

    it('rolls a tool the character has as the sheet has it, and one it hasn’t as dnd5e does, with the ability alone', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        check(
          'data-checks="tool:dex:thief|tool:int:thief|tool:int:herb" data-dc="15"',
          'DC 15 tools',
        ),
        actionsFor({ tools: [THIEF] }),
      )

      await user.click(screen.getByRole('button', { name: 'DC 15 tools' }))
      const menu = screen.getByRole('menu', {
        name: "DC 15 Dexterity (Thieves' Tools) or Intelligence (Herbalism Kit) check",
      })
      expect(itemsOf(menu)).toEqual([
        'Ask the table',
        "Roll my Dexterity (Thieves' Tools) check (+5)",
        'Roll my Intelligence (Herbalism Kit) check (−1)',
      ])
      await user.click(
        within(menu).getByRole('menuitem', {
          name: 'Roll my Intelligence (Herbalism Kit) check (−1)',
        }),
      )

      expect(actions.roll).toHaveBeenCalledWith({
        label: 'Intelligence (Herbalism Kit) check',
        modifier: -1,
        advantage: undefined,
        source: { kind: 'tool', key: 'herb', text: hash, link: 4 },
        explicit: false,
        dc: 15,
      })
    })

    it('rolls a tool with the ability the description names, where it isn’t its own', async () => {
      const user = userEvent.setup()
      await renderText(
        check('data-checks="tool:int:thief"', 'Intelligence (Thieves’ Tools)'),
        actionsFor({ tools: [THIEF] }),
      )

      await user.click(
        screen.getByRole('button', { name: 'Intelligence (Thieves’ Tools)' }),
      )

      // Thieves' Tools' +5 is Dexterity's +1 and +4 more: with Intelligence's −1, +3.
      expect(itemsOf(screen.getByRole('menu'))).toContain(
        "Roll my Intelligence (Thieves' Tools) check (+3)",
      )
    })

    it('rolls a skill check made using a tool with advantage, where the character is proficient with both, as dnd5e does', async () => {
      const user = userEvent.setup()
      const html = check(
        'data-checks="skill:str:ath" data-using-tool="thief"',
        'Strength (Athletics)',
      )
      await renderText(html, actionsFor({ tools: [THIEF] }))

      await user.click(
        screen.getByRole('button', { name: 'Strength (Athletics)' }),
      )
      expect(
        itemsOf(
          screen.getByRole('menu', {
            name: "Strength (Athletics) check using Thieves' Tools",
          }),
        ),
      ).toContain('Roll my Strength (Athletics) check (+7, advantage)')
    })

    it('rolls a skill check made using a tool with the tool’s proficiency, where it’s higher than the skill’s, as dnd5e does, with advantage only where the character has both', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        check(
          'data-checks="skill:dex:ste" data-using-tool="thief" data-dc="15"',
          'DC 15 Dexterity (Stealth)',
        ),
        actionsFor({ tools: [THIEF] }),
      )

      await user.click(
        screen.getByRole('button', { name: 'DC 15 Dexterity (Stealth)' }),
      )
      // Stealth's +1 has no proficiency; Thieves' Tools' +3 is added. Proficient in only one, the
      // sheet's disadvantage on Stealth stands.
      await user.click(
        screen.getByRole('menuitem', {
          name: 'Roll my Dexterity (Stealth) check (+4, disadvantage)',
        }),
      )

      expect(actions.roll).toHaveBeenCalledWith({
        label: 'Dexterity (Stealth) check',
        modifier: 4,
        advantage: 'dis',
        source: { kind: 'skill', key: 'ste', text: hash, link: 4 },
        explicit: false,
        dc: 15,
      })
    })

    it.each([
      // Half proficiency, as from Jack of All Trades, is +1 of the +3, rounded down, as dnd5e
      // rounds it: the tool's +3 in its place; and dnd5e counts it as proficiency, for advantage.
      [
        'half proficient in the skill',
        { skill: { proficiency: 0.5, total: 2, mode: 0 as const }, tool: {} },
        'Roll my Dexterity (Stealth) check (+4, advantage)',
      ],
      // Expertise in the tool, or Tool Expertise, which the sheet's proficiency with it says: +6.
      [
        'with expertise in the tool',
        { skill: {}, tool: { proficiency: 2 } },
        'Roll my Dexterity (Stealth) check (+7, disadvantage)',
      ],
      // The skill's own proficiency, where it's as high as the tool's.
      [
        'as proficient in the skill',
        { skill: { proficiency: 1, total: 4, mode: 0 as const }, tool: {} },
        'Roll my Dexterity (Stealth) check (+4, advantage)',
      ],
      [
        'with expertise in the skill',
        { skill: { proficiency: 2, total: 7, mode: 0 as const }, tool: {} },
        'Roll my Dexterity (Stealth) check (+7, advantage)',
      ],
      // No proficiency with the tool: nothing added, and no advantage.
      [
        'not proficient with the tool',
        {
          skill: { proficiency: 1, total: 4, mode: 0 as const },
          tool: { proficiency: 0 },
        },
        'Roll my Dexterity (Stealth) check (+4)',
      ],
    ])(
      'rolls a skill check made using a tool %s with the higher proficiency of the two',
      async (_, { skill, tool }, item) => {
        const user = userEvent.setup()
        const stealth: SheetSkill = {
          ...characterSheet().skills.find(each => each.id === 'ste')!,
          ...skill,
        }
        await renderText(
          check(
            'data-checks="skill:dex:ste" data-using-tool="thief"',
            'Dexterity (Stealth)',
          ),
          actionsFor({
            skills: [stealth],
            tools: [{ ...THIEF, ...tool }],
          }),
        )

        await user.click(
          screen.getByRole('button', { name: 'Dexterity (Stealth)' }),
        )

        expect(itemsOf(screen.getByRole('menu'))).toContain(item)
      },
    )

    it('adds no tool’s proficiency where the sheet has no proficiency bonus', async () => {
      const user = userEvent.setup()
      await renderText(
        check(
          'data-checks="skill:dex:ste" data-using-tool="thief"',
          'Dexterity (Stealth)',
        ),
        actionsFor({ tools: [THIEF], proficiency: null }),
      )

      await user.click(
        screen.getByRole('button', { name: 'Dexterity (Stealth)' }),
      )

      expect(itemsOf(screen.getByRole('menu'))).toContain(
        'Roll my Dexterity (Stealth) check (+1, disadvantage)',
      )
    })

    it.each([
      ['proficient in both', {}, {}, '+7, advantage'],
      ['not proficient with the tool', {}, { proficiency: 0 }, '+7'],
      // Strength's +4, and the tool's proficiency in place of the skill's.
      ['not proficient in the skill', { proficiency: 0, total: 4 }, {}, '+7'],
      [
        'proficient in both, with disadvantage on the skill',
        { mode: -1 as const },
        {},
        '+7',
      ],
    ])(
      'gives a skill check made using a tool advantage only where the character is proficient in both, which disadvantage cancels: %s',
      async (_, skill: Partial<SheetSkill>, tool: Partial<SheetTool>, roll) => {
        const user = userEvent.setup()
        const skills = characterSheet().skills.map(each =>
          each.id === 'ath' ? { ...each, ...skill } : each,
        )
        await renderText(
          check(
            'data-checks="skill:str:ath" data-using-tool="thief"',
            'Strength (Athletics)',
          ),
          actionsFor({ skills, tools: [{ ...THIEF, ...tool }] }),
        )

        await user.click(
          screen.getByRole('button', { name: 'Strength (Athletics)' }),
        )

        expect(itemsOf(screen.getByRole('menu'))).toContain(
          `Roll my Strength (Athletics) check (${roll})`,
        )
      },
    )

    it('rolls an ability check, and a tool’s the character hasn’t, as the sheet makes that ability’s check, with its own bonus and mode, not its modifier', async () => {
      const user = userEvent.setup()
      // Jack of All Trades adds +1 to Intelligence's −1, and something gives advantage on it.
      const abilities = characterSheet().abilities.map(ability =>
        ability.id === 'int'
          ? { ...ability, check: 1, checkMode: 1 as const }
          : ability,
      )
      const { hash, actions } = await renderText(
        check(
          'data-checks="check:int|tool:int:herb" data-dc="12"',
          'DC 12 Intelligence',
        ),
        actionsFor({ abilities, tools: [] }),
      )

      await user.click(
        screen.getByRole('button', { name: 'DC 12 Intelligence' }),
      )
      const menu = screen.getByRole('menu')
      expect(itemsOf(menu)).toEqual([
        'Ask the table',
        'Roll my Intelligence check (+1, advantage)',
        'Roll my Intelligence (Herbalism Kit) check (+1, advantage)',
      ])
      await user.click(
        within(menu).getByRole('menuitem', {
          name: 'Roll my Intelligence check (+1, advantage)',
        }),
      )

      expect(actions.roll).toHaveBeenCalledWith({
        label: 'Intelligence check',
        modifier: 1,
        advantage: 'adv',
        source: { kind: 'ability', key: 'int', text: hash, link: 4 },
        explicit: false,
        dc: 12,
      })
    })

    it('rolls a tool the character has with its own mode, which the sheet combines with its ability’s', async () => {
      const user = userEvent.setup()
      const abilities = characterSheet().abilities.map(ability =>
        ability.id === 'dex' ? { ...ability, checkMode: -1 as const } : ability,
      )
      await renderText(
        check('data-checks="tool:dex:thief"', "Dexterity (Thieves' Tools)"),
        actionsFor({ abilities, tools: [{ ...THIEF, mode: 1 }] }),
      )

      await user.click(
        screen.getByRole('button', { name: "Dexterity (Thieves' Tools)" }),
      )

      expect(itemsOf(screen.getByRole('menu'))).toContain(
        "Roll my Dexterity (Thieves' Tools) check (+5, advantage)",
      )
    })

    it('names a skill and a tool as the sheet does, in the game’s language, in its title, its rolls, and what the table is asked for', async () => {
      const user = userEvent.setup()
      const skills = characterSheet().skills.map(skill =>
        skill.id === 'ath' ? { ...skill, label: 'Athlétisme' } : skill,
      )
      const outils = { ...THIEF, name: 'Outils de voleur' }
      const { hash, actions } = await renderText(
        check(
          'data-checks="skill:str:ath" data-using-tool="thief" data-dc="15"',
          'DD 15 Force (Athlétisme)',
        ) +
          check('data-checks="tool:dex:thief"', 'Dextérité').replace(
            'data-n="4"',
            'data-n="5"',
          ),
        actionsFor({ skills, tools: [outils] }),
      )

      await user.click(
        screen.getByRole('button', { name: 'DD 15 Force (Athlétisme)' }),
      )
      const menu = screen.getByRole('menu', {
        name: 'DC 15 Strength (Athlétisme) check using Outils de voleur',
      })
      expect(itemsOf(menu)).toContain(
        'Roll my Strength (Athlétisme) check (+7, advantage)',
      )
      await user.click(
        within(menu).getByRole('menuitem', { name: 'Ask the table' }),
      )
      expect(actions.ask).toHaveBeenCalledWith({
        label: 'DC 15 Strength (Athlétisme) check using Outils de voleur',
        text: hash,
        link: 4,
      })

      await user.click(screen.getByRole('button', { name: 'Dextérité' }))
      expect(
        itemsOf(
          screen.getByRole('menu', {
            name: 'Dexterity (Outils de voleur) check',
          }),
        ),
      ).toContain('Roll my Dexterity (Outils de voleur) check (+5)')
    })

    it('rolls a skill check made using a tool the character hasn’t as the sheet has it', async () => {
      const user = userEvent.setup()
      await renderText(
        check(
          'data-checks="skill:str:ath" data-using-tool="herb"',
          'Strength (Athletics)',
        ),
        actionsFor({ tools: [THIEF] }),
      )

      await user.click(
        screen.getByRole('button', { name: 'Strength (Athletics)' }),
      )
      expect(
        itemsOf(
          screen.getByRole('menu', {
            name: 'Strength (Athletics) check using Herbalism Kit',
          }),
        ),
      ).toContain('Roll my Strength (Athletics) check (+7)')
    })

    it('knows the tools the sheet lists, from module 0.18.0, and those among its favorites, as before', () => {
      const favorites = sheetFavorites()
      const herb = { ...THIEF, id: 'herb', name: 'Herbalism Kit' }

      // Before module 0.18.0, only the favorites name a tool.
      expect(sheetTools(characterSheet({ favorites }))).toEqual([THIEF])
      // The sheet's own come first, a favorite only where they don't have it.
      expect(
        sheetTools(
          characterSheet({ tools: [herb, { ...THIEF, total: 6 }], favorites }),
        ),
      ).toEqual([herb, { ...THIEF, total: 6 }])
      expect(sheetTools(characterSheet())).toEqual([])
    })

    it('offers no roll of a skill the sheet hasn’t, but still asks the table', async () => {
      const user = userEvent.setup()
      await renderText(
        check('data-checks="skill:dex:acr"', 'Dexterity (Acrobatics)'),
      )

      await user.click(
        screen.getByRole('button', { name: 'Dexterity (Acrobatics)' }),
      )

      expect(
        itemsOf(
          screen.getByRole('menu', { name: 'Dexterity (Acrobatics) check' }),
        ),
      ).toEqual(['Ask the table'])
    })

    it('never asks the table for one in a secret, and says why it can’t where it can’t', async () => {
      const user = userEvent.setup()
      const { actions } = await renderText(
        `<section class="secret">${check('data-checks="check:wis"', 'Wisdom')}</section>` +
          check('data-checks="check:str"', 'Strength').replace(
            'data-n="4"',
            'data-n="5"',
          ),
        actionsFor({
          askBlocked: 'your Gamemaster’s game isn’t taking rolls now',
        }),
      )

      await user.click(screen.getByRole('button', { name: 'Wisdom' }))
      expect(itemsOf(screen.getByRole('menu'))).toEqual([
        'Roll my Wisdom check (+1)',
        'Roll with advantage',
        'Roll with disadvantage',
        'Modify roll…',
      ])
      await user.keyboard('{Escape}')

      await user.click(screen.getByRole('button', { name: 'Strength' }))
      const ask = within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Ask the table',
      })
      expect(ask).toBeDisabled()
      expect(ask).toHaveAccessibleDescription(
        'Your Gamemaster’s game isn’t taking rolls now.',
      )
      await user.click(ask)
      expect(actions.ask).not.toHaveBeenCalled()
    })

    it('is only its text where the sheet says nothing of what its links do', async () => {
      const hash = nextHash()
      globalThis.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({ html: check('data-checks="check:str"') }),
          }) as Response,
      )
      render(<SheetText characterId='char-1' hash={hash} origin={ORIGIN} />)

      expect(await screen.findByText(/Make a/)).toHaveTextContent(
        'Make a DC 15 Strength (Athletics) check.',
      )
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  it('sets each link on one line where it fits, wrapping inside its own box where it’s wider than the text, as a long one may be on a phone', async () => {
    await renderText(
      `${save('data-ability="con"', 'Constitution saving throw against your spell save DC')}` +
        '<p><span class="ss-damage roll" data-n="1" data-formulas="7" data-types="fire">7 (2d6) fire damage</span> and <span class="ss-roll roll" data-n="2" data-formula="1d4">1d4</span></p>',
    )

    for (const name of [
      'Constitution saving throw against your spell save DC',
      '7 (2d6) fire damage, roll damage',
      '1d4, roll it',
    ]) {
      const link = screen.getByRole('button', { name })
      expect(link).toHaveClass('whitespace-normal', 'max-w-full', 'text-left')
      expect(link).not.toHaveClass('whitespace-nowrap')
    }
  })

  describe('damage and healing', () => {
    it('rolls at a tap with the player’s dice, named for where it’s from, for the game to roll it too', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        '<p>It takes <span class="ss-damage roll" data-n="1" data-formulas="2d6 + 3&amp;1d4" data-types="fire&amp;">2d6 + 3 fire</span>.</p>',
      )

      const link = screen.getByRole('button', {
        name: '2d6 + 3 fire, roll damage',
      })
      expect(link).not.toHaveAttribute('aria-haspopup')
      await user.click(link)

      expect(actions.rollDamage).toHaveBeenCalledWith({
        label: 'Worn Bardic Eternal Flame damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 2, sides: 6 },
              { sign: 1, flat: 3 },
            ],
            type: 'fire',
          },
          { terms: [{ sign: 1, count: 1, sides: 4 }], type: null },
        ],
        healing: false,
        text: { text: hash, link: 1 },
      })
    })

    it('asks which kind first, where it offers a choice, and rolls as that one', async () => {
      const user = userEvent.setup()
      const { actions } = await renderText(
        '<p><span class="ss-damage roll" data-n="2" data-formulas="1d10&amp;1d6" data-types="cold|fire&amp;necrotic">1d10</span></p>',
      )

      const link = screen.getByRole('button', { name: '1d10, roll damage' })
      expect(link).toHaveAttribute('aria-haspopup', 'menu')
      await user.click(link)
      const menu = screen.getByRole('menu', {
        name: 'Worn Bardic Eternal Flame damage, 1d10 + 1d6',
      })
      expect(itemsOf(menu)).toEqual(['Roll cold damage', 'Roll fire damage'])
      await user.click(
        within(menu).getByRole('menuitem', { name: 'Roll fire damage' }),
      )

      expect(actions.rollDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: [
            expect.objectContaining({ type: 'fire' }),
            expect.objectContaining({ type: 'necrotic' }),
          ],
          types: ['fire', null],
        }),
      )
    })

    it('heals, as healing', async () => {
      const user = userEvent.setup()
      const { actions } = await renderText(
        '<p>Regain <span class="ss-damage roll" data-n="0" data-formulas="2d4 + 2" data-types="healing" data-healing="true">2d4 + 2</span> hit points.</p>',
      )

      await user.click(
        screen.getByRole('button', { name: '2d4 + 2, roll healing' }),
      )

      expect(actions.rollDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Worn Bardic Eternal Flame healing',
          healing: true,
        }),
      )
    })

    it('is only its text where the app can’t read its formula', async () => {
      await renderText(
        '<p><span class="ss-damage roll" data-n="0" data-formulas="1d7">1d7</span> or <span class="ss-damage roll" data-n="1" data-formulas="2d6&amp;3d3">2d6</span></p>',
      )

      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.getByText(/1d7 or 2d6/)).toBeInTheDocument()
    })
  })

  describe('a roll of its own', () => {
    it('rolls at a tap with the player’s dice, named for where it’s from, for the game to roll it too', async () => {
      const user = userEvent.setup()
      const { hash, actions } = await renderText(
        '<p>Add <span class="ss-roll roll" data-n="4" data-formula="1d4">1d4</span>.</p>',
      )

      await user.click(screen.getByRole('button', { name: '1d4, roll it' }))

      expect(actions.rollFormula).toHaveBeenCalledWith({
        label: 'Worn Bardic Eternal Flame roll',
        terms: [{ sign: 1, count: 1, sides: 4 }],
        source: { kind: 'textRoll', text: hash, link: 4 },
      })
    })

    it('is only its text where the app can’t read its formula', async () => {
      await renderText(
        '<p><span class="ss-roll roll" data-n="4" data-formula="1d4 * 2">1d4 * 2</span></p>',
      )

      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  describe('a condition', () => {
    const prone: SheetCondition = {
      id: 'prone',
      name: 'Prone',
      img: null,
      level: null,
      detail: null,
      text: null,
    }

    it('shows its rules on a hover, and opens the conditions panel at it on a click', async () => {
      const user = userEvent.setup()
      const { actions } = await renderText(
        '<p>It falls <span class="ss-condition ref" data-condition="prone">Prone</span>.</p>',
      )

      const link = screen.getByRole('button', { name: 'Prone' })
      expect(link).toHaveClass('underline', 'decoration-dotted')
      expect(link).toHaveAttribute('aria-haspopup', 'dialog')
      await user.hover(link)
      const tip = await screen.findByRole('tooltip')
      expect(tip).toHaveTextContent(/^Prone/)
      expect(tip).toHaveTextContent('Restricted Movement.')
      expect(tip).not.toHaveTextContent('You have it')
      expect(tip).not.toHaveTextContent('2024 rules')
      expect(link).toHaveAccessibleDescription(/^Prone/)

      await user.click(link)
      expect(actions.showConditions).toHaveBeenCalledWith('prone')
      expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('says when the character has it, and that its rules are 2024’s in a 2014 world', async () => {
      const user = userEvent.setup()
      await renderText(
        '<p><span class="ss-condition ref" data-condition="prone">prone</span></p>',
        actionsFor({ conditions: [prone], rules: 'legacy' }),
      )

      await user.hover(screen.getByRole('button', { name: 'prone' }))

      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        /^Prone\(2024 rules\)You have it/,
      )
    })

    it('says what level of a condition with levels the character is at', async () => {
      const user = userEvent.setup()
      await renderText(
        '<p><span class="ss-condition ref" data-condition="exhaustion">Exhaustion</span></p>',
        actionsFor({ conditions: [{ ...prone, id: 'exhaustion', level: 2 }] }),
      )

      await user.hover(screen.getByRole('button', { name: 'Exhaustion' }))

      const tip = await screen.findByRole('tooltip')
      expect(tip).toHaveTextContent(/^ExhaustionYou're at level 2/)
      expect(tip).not.toHaveTextContent('You have it')
    })

    it.each([
      ['focus from the keyboard', (user: User) => user.tab()],
      [
        'a hover',
        (user: User) =>
          user.hover(screen.getByRole('button', { name: 'Grappled' })),
      ],
    ])(
      'closes its rules on Escape inside a dialog, and only them, when shown on %s',
      async (_, showTip) => {
        const user = userEvent.setup()
        const keys = escapes()
        await renderText(
          '<p><span class="ss-condition ref" data-condition="grappled">Grappled</span></p>',
          actionsFor(),
          inDialog,
        )
        // Focus in the dialog, as the browser puts it there on opening.
        screen.getByRole('button', { name: 'Close' }).focus()

        await showTip(user)
        const tip = await screen.findByRole('tooltip')
        expect(screen.getByRole('dialog')).toContainElement(tip)
        await user.keyboard('{Escape}')

        expect(screen.queryByRole('tooltip')).toBeNull()
        expect(keys.closesDialog()).toBe(false)
        await user.keyboard('{Escape}')
        expect(keys.closesDialog()).toBe(true)
        keys.stop()
      },
    )

    it('shows its rules on focus from the keyboard', async () => {
      const user = userEvent.setup()
      await renderText(
        '<p><span class="ss-condition ref" data-condition="grappled">Grappled</span></p>',
      )

      await user.tab()

      expect(screen.getByRole('button', { name: 'Grappled' })).toHaveFocus()
      expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Grappled/)
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('is only bold text where the app has no rules for it', async () => {
      await renderText(
        '<p><span class="ss-condition ref" data-condition="bleeding">Bleeding</span></p>',
      )

      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.getByText('Bleeding')).toHaveClass('ref')
    })
  })

  it('does nothing outside a sheet that says what links do: each is only its text', async () => {
    const hash = nextHash()
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            html:
              save('data-ability="dex"') +
              '<p><span class="ss-condition ref" data-condition="prone">Prone</span></p>',
          }),
        }) as Response,
    )
    render(<SheetText characterId='char-1' hash={hash} origin={ORIGIN} />)

    expect(
      await screen.findByText(/^Make a DC 15 Dexterity saving throw/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Prone')).toHaveClass('ref')
    await act(async () => {})
  })
})
