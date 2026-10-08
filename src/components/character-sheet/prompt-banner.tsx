'use client'

import { BellRing, LoaderCircle } from 'lucide-react'
import { useD20Rolls, type RollActions } from './d20-rolls'
import { RollButton, type RollTarget } from './roll-button'
import { formatModifier } from '@/utils/format-modifier'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { TablePrompt, TableSheet } from '@/types/table'

type Ability = TableSheet['abilities'][number]

/**
 * The saving throws the Gamemaster's game asks of the character, at the top of every tab of their
 * sheet: such as a concentration check after damage, or a save a spell targeting them calls for.
 * Each rolls as the sheet rolls that save, a tap as the sheet has it, or a right-click or
 * long-press for advantage, disadvantage or a modified roll; the game makes it with the same dice,
 * on the card that asked. Answered, it waits for the game; and where this device doesn't send the
 * player's rolls to the game, it says so.
 */
export function PromptBanner({
  prompts,
  sheet,
  answering,
  sending,
  onSend,
  onRoll,
}: Readonly<{
  prompts: TablePrompt[]
  sheet: TableSheet
  /** The prompts answered from this page, on their way to the game or made there. */
  answering: ReadonlySet<string>
  /** Whether this device sends the player's rolls to the game. */
  sending: boolean
  /** Sends them from now on. */
  onSend: () => void
  onRoll: (roll: SheetRoll) => void
}>) {
  const { actions, dialogs } = useD20Rolls(onRoll)
  return (
    <section
      aria-labelledby='prompts-heading'
      className='shrink-0 border-b border-primary/30 bg-primary/5 px-3 py-2.5 md:px-6 lg:px-7'
    >
      <h2
        id='prompts-heading'
        className='flex items-center gap-1.5 text-xs font-semibold text-primary'
      >
        <BellRing aria-hidden className='size-3.5' />
        Your Gamemaster asks
      </h2>
      <ul className='mt-1.5 grid gap-2'>
        {prompts.map(prompt => (
          <PromptRow
            key={prompt.id}
            prompt={prompt}
            abilities={prompt.abilities.flatMap(id => {
              const ability = sheet.abilities.find(each => each.id === id)
              return ability ? [ability] : []
            })}
            answering={answering.has(prompt.id)}
            sending={sending}
            actions={actions}
          />
        ))}
      </ul>
      {!sending && (
        <p className='mt-2 text-xs text-text-secondary'>
          This device doesn&apos;t send your rolls to the table.{' '}
          <button
            type='button'
            onClick={onSend}
            className='font-semibold text-primary underline-offset-2 hover:underline'
          >
            Send them
          </button>
        </p>
      )}
      {dialogs}
    </section>
  )
}

/** One save the game asks for: what, its DC and what asks, where shown, and its roll. */
function PromptRow({
  prompt,
  abilities,
  answering,
  sending,
  actions,
}: Readonly<{
  prompt: TablePrompt
  abilities: Ability[]
  answering: boolean
  sending: boolean
  actions: RollActions
}>) {
  const concentration = prompt.type === 'concentration'
  const details = [
    prompt.dc === undefined ? undefined : `DC ${prompt.dc}`,
    prompt.label,
  ].filter(Boolean)
  return (
    <li className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5'>
      <div className='min-w-0'>
        <p className='text-sm font-semibold'>{titleOf(prompt, abilities)}</p>
        {details.length > 0 && (
          <p className='text-xs text-text-secondary'>{details.join(' · ')}</p>
        )}
      </div>
      {answering ? (
        <p className='flex items-center gap-1.5 text-xs text-text-secondary'>
          <LoaderCircle
            aria-hidden
            className='size-3.5 shrink-0 motion-safe:animate-spin'
          />
          Rolled. Waiting for the table…
        </p>
      ) : (
        sending && (
          <div className='flex flex-wrap gap-1.5'>
            {abilities.map(ability => {
              const target: RollTarget = {
                label: concentration
                  ? 'Concentration check'
                  : `${ability.label} saving throw`,
                modifier: ability.save,
                mode: ability.saveMode,
                source: { kind: 'save', key: ability.id, prompt: prompt.id },
              }
              return (
                <RollButton
                  key={ability.id}
                  target={target}
                  onRoll={actions.onRoll}
                  onMenu={actions.onMenu}
                  label={`Roll ${target.label}, ${formatModifier(ability.save)}`}
                  className='h-9 rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
                >
                  {abilities.length > 1 ? (
                    <span className='uppercase'>{ability.abbreviation} </span>
                  ) : (
                    'Roll '
                  )}
                  <span className='tabular-nums'>
                    {formatModifier(ability.save)}
                  </span>
                </RollButton>
              )
            })}
          </div>
        )
      )}
    </li>
  )
}

/**
 * What the game asks for, in words: such as "Dexterity saving throw", "Strength or Dexterity
 * saving throw", or "Concentration check", naming its ability where it isn't Constitution.
 */
export function titleOf(prompt: TablePrompt, abilities: Ability[]): string {
  if (prompt.type === 'concentration') {
    const [ability] = abilities
    return ability && ability.id !== 'con'
      ? `Concentration check (${ability.label})`
      : 'Concentration check'
  }
  const names = abilities.map(({ label }) => label)
  const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(names)
  return `${list || 'A'} saving throw`
}
