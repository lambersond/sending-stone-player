'use client'

import { type ReactNode, type Ref } from 'react'
import { BellRing, Check, LoaderCircle, Timer } from 'lucide-react'
import { useSecondsLeft } from './use-seconds-left'
import {
  abilitiesOf,
  advantageOf,
  advantageWords,
  choicesOf,
  clock,
  midiTitleOf,
  titleOf,
} from './utils'
import { useD20Rolls } from '@/features/rolling/components/d20-rolls/use-d20-rolls'
import { RollButton } from '@/features/rolling/components/roll-button/roll-button'
import { useSheetId } from '@/features/sheet/hooks/use-sheet-ids'
import { useTableRole } from '@/hooks/use-table-api'
import { formatModifier } from '@/utils/format-modifier'
import { seatWords } from '@/utils/seat-words'
import type { Ability, Choice } from './types'
import type { RollActions, RollTarget } from '@/features/rolling/types'
import type { SheetRoll } from '@/types/roll'
import type { TablePrompt, TableSheet } from '@/types/table'

/**
 * The saving throws the Gamemaster's game asks of the character, at the top of every tab of their
 * sheet: such as a concentration check after damage, or a save a spell targeting them calls for.
 * Each rolls as the sheet rolls that save, a tap as the sheet has it, or a right-click or
 * long-press for advantage, disadvantage or a modified roll; the game makes it with the same dice,
 * on the card that asked. Answered, it waits for the game; and where this device doesn't send the
 * player's rolls to the game, it says so. What Midi-QOL asks, from module 0.27.0, which may be an
 * ability or skill check too, is rolled only as Midi-QOL has it rolled, with a tap, before the
 * time it gives runs out; then Midi-QOL rolls it, as it says, or leaves it to Foundry. From module
 * 0.41.0, at the character's own pane, which of their companions the game asks too is said under
 * its heading, first, and alone where the character is asked nothing; and its heading is named
 * apart in each pane, a companion's pane having its own banner.
 */
export function PromptBanner({
  ref,
  prompts,
  notice,
  sheet,
  answering,
  sending,
  onSend,
  onRoll,
}: Readonly<{
  /** The banner, which the rolls' toasts start below while it shows. */
  ref?: Ref<HTMLElement>
  prompts: TablePrompt[]
  /** Which of the character's companions the game asks too (module 0.41.0). */
  notice?: ReactNode
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
  const { asks } = seatWords(useTableRole())
  const heading = useSheetId('prompts-heading')
  return (
    <section
      ref={ref}
      aria-labelledby={heading}
      className='shrink-0 border-b border-primary/30 bg-primary/5 px-3 py-2.5 md:px-6 lg:px-7'
    >
      <h2
        id={heading}
        className='flex items-center gap-1.5 text-xs font-semibold text-primary-text'
      >
        <BellRing aria-hidden className='size-3.5' />
        {asks}
      </h2>
      {notice}
      {prompts.length > 0 && (
        <ul className='mt-1.5 grid gap-2'>
          {prompts.map(prompt =>
            prompt.source ? (
              <MidiPromptRow
                key={prompt.id}
                prompt={prompt}
                choices={choicesOf(prompt, sheet)}
                answering={answering.has(prompt.id)}
                sending={sending}
                onRoll={actions.onRoll}
              />
            ) : (
              <PromptRow
                key={prompt.id}
                prompt={prompt}
                abilities={abilitiesOf(prompt, sheet)}
                answering={answering.has(prompt.id)}
                sending={sending}
                actions={actions}
              />
            ),
          )}
        </ul>
      )}
      {!sending && (
        <p className='mt-2 text-xs text-text-secondary'>
          This device doesn&apos;t send your rolls to the table.{' '}
          <button
            type='button'
            onClick={onSend}
            className='font-semibold text-primary-text underline-offset-2 hover:underline'
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
 * One thing Midi-QOL asks: what, what asks it, its DC where shown, and how Midi-QOL has each choice
 * rolled; a button for each, which rolls it as Midi-QOL has it, and only so, and how long is left
 * to. Once its time is up, Midi-QOL is rolling it, or where Foundry asks the player too, it's left
 * to Foundry; and once the game says it was rolled in Foundry, or by Midi-QOL, it says so a moment.
 */
function MidiPromptRow({
  prompt,
  choices,
  answering,
  sending,
  onRoll,
}: Readonly<{
  prompt: TablePrompt
  choices: Choice[]
  answering: boolean
  sending: boolean
  onRoll: RollActions['onRoll']
}>) {
  const left = useSecondsLeft(prompt.expiresAt)
  const foundry = prompt.askedInFoundry === true
  const details = [
    prompt.dc === undefined ? undefined : `DC ${prompt.dc}`,
    advantageOf(choices),
  ].filter(Boolean)
  const line = 'flex items-center gap-1.5 text-xs text-text-secondary'
  const spinner = (
    <LoaderCircle
      aria-hidden
      className='size-3.5 shrink-0 motion-safe:animate-spin'
    />
  )
  let state
  if (prompt.closed) {
    let said = foundry ? 'Left to Foundry' : 'Midi rolled it'
    if (prompt.closed === 'rolled') said = 'Rolled in Foundry'
    state = (
      <p className={line}>
        <Check aria-hidden className='size-3.5 shrink-0' />
        {said}
      </p>
    )
  } else if (answering) {
    state = (
      <p className={line}>
        {spinner}
        Rolled. Waiting for the table…
      </p>
    )
  } else if (left <= 0) {
    state = foundry ? (
      <p className={line}>Left to Foundry</p>
    ) : (
      <p className={line}>
        {spinner}
        Midi is rolling…
      </p>
    )
  } else {
    state = (
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
        <p role='timer' className={line}>
          <Timer aria-hidden className='size-3.5 shrink-0' />
          <span className='tabular-nums'>
            {foundry
              ? `Answer here or in Foundry · ${clock(left)}`
              : `Midi rolls for you in ${clock(left)}`}
          </span>
        </p>
        {sending && (
          <div className='flex flex-wrap gap-1.5'>
            {choices.map(({ key, short, target }) => {
              const how = advantageWords(target.mode)
              return (
                <button
                  key={key}
                  type='button'
                  aria-label={`Roll ${target.label}${how ? `, ${how}` : ''}, ${formatModifier(target.modifier)}`}
                  onClick={() => onRoll(target)}
                  className='h-9 touch-manipulation rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
                >
                  {choices.length > 1 ? (
                    <span
                      className={prompt.type === 'skill' ? '' : 'uppercase'}
                    >
                      {short}{' '}
                    </span>
                  ) : (
                    'Roll '
                  )}
                  <span className='tabular-nums'>
                    {formatModifier(target.modifier)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }
  return (
    <li className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5'>
      <div className='min-w-0'>
        <p className='text-sm font-semibold'>{midiTitleOf(prompt, choices)}</p>
        {details.length > 0 && (
          <p className='text-xs text-text-secondary'>{details.join(' · ')}</p>
        )}
      </div>
      {state}
    </li>
  )
}
