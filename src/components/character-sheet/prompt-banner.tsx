'use client'

import { useEffect, useState, type Ref } from 'react'
import { BellRing, Check, LoaderCircle, Timer } from 'lucide-react'
import { useD20Rolls, type RollActions } from './d20-rolls'
import { RollButton, type RollTarget } from './roll-button'
import { useTableRole } from '@/hooks/use-table-api'
import { formatModifier } from '@/utils/format-modifier'
import { seatWords } from '@/utils/seat-words'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollMode } from '@/types/sending-stone'
import type { TablePrompt, TableSheet } from '@/types/table'

type Ability = TableSheet['abilities'][number]

/**
 * The saving throws the Gamemaster's game asks of the character, at the top of every tab of their
 * sheet: such as a concentration check after damage, or a save a spell targeting them calls for.
 * Each rolls as the sheet rolls that save, a tap as the sheet has it, or a right-click or
 * long-press for advantage, disadvantage or a modified roll; the game makes it with the same dice,
 * on the card that asked. Answered, it waits for the game; and where this device doesn't send the
 * player's rolls to the game, it says so. What Midi-QOL asks, from module 0.27.0, which may be an
 * ability or skill check too, is rolled only as Midi-QOL has it rolled, with a tap, before the
 * time it gives runs out; then Midi-QOL rolls it, as it says, or leaves it to Foundry.
 */
export function PromptBanner({
  ref,
  prompts,
  sheet,
  answering,
  sending,
  onSend,
  onRoll,
}: Readonly<{
  /** The banner, which the rolls' toasts start below while it shows. */
  ref?: Ref<HTMLElement>
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
  const { asks } = seatWords(useTableRole())
  return (
    <section
      ref={ref}
      aria-labelledby='prompts-heading'
      className='shrink-0 border-b border-primary/30 bg-primary/5 px-3 py-2.5 md:px-6 lg:px-7'
    >
      <h2
        id='prompts-heading'
        className='flex items-center gap-1.5 text-xs font-semibold text-primary-text'
      >
        <BellRing aria-hidden className='size-3.5' />
        {asks}
      </h2>
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

/** The abilities on the sheet a prompt may be rolled with, in its order. */
function abilitiesOf(prompt: TablePrompt, sheet: TableSheet): Ability[] {
  return prompt.abilities.flatMap(id => {
    const ability = sheet.abilities.find(each => each.id === id)
    return ability ? [ability] : []
  })
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

/**
 * One way to answer what Midi-QOL asks: its key, its name, such as "Dexterity" or "Athletics",
 * and its abbreviation where it has one; and the roll, with the sheet's modifier and the advantage
 * or disadvantage Midi-QOL gives it, as the game makes it.
 */
type Choice = {
  key: string
  name: string
  short: string
  target: RollTarget
}

/**
 * The ways to answer what Midi-QOL asks that are on the sheet, in its order: a save or
 * concentration check by its abilities' saves, an ability check by their checks, and a skill check
 * by its skills.
 */
function choicesOf(prompt: TablePrompt, sheet: TableSheet): Choice[] {
  const prompted = prompt.id
  const modeOf = (key: string): RollMode => {
    const given = prompt.advantage?.[key]
    if (given === 'adv') return 1
    return given === 'dis' ? -1 : 0
  }
  if (prompt.type === 'skill') {
    return (prompt.skills ?? []).flatMap(key => {
      const skill = sheet.skills.find(({ id }) => id === key)
      if (!skill) return []
      const choice: Choice = {
        key,
        name: skill.label,
        short: skill.label,
        target: {
          label: `${skill.label} check`,
          modifier: skill.total,
          mode: modeOf(key),
          source: { kind: 'skill', key, prompt: prompted },
        },
      }
      return [choice]
    })
  }
  return abilitiesOf(prompt, sheet).map(ability => {
    const check = prompt.type === 'check'
    let label = `${ability.label} saving throw`
    if (check) label = `${ability.label} check`
    else if (prompt.type === 'concentration') label = 'Concentration check'
    return {
      key: ability.id,
      name: ability.label,
      short: ability.abbreviation,
      target: {
        label,
        modifier: check ? ability.check : ability.save,
        mode: modeOf(ability.id),
        source: check
          ? { kind: 'ability', key: ability.id, prompt: prompted }
          : { kind: 'save', key: ability.id, prompt: prompted },
      },
    }
  })
}

/** How Midi-QOL has a choice rolled, in words, where not normally. */
function advantageWords(mode: RollMode): string | undefined {
  if (mode > 0) return 'Advantage (Midi)'
  if (mode < 0) return 'Disadvantage (Midi)'
  return undefined
}

/**
 * What Midi-QOL asks, in words, after what asks it: such as "Hold Person: Wisdom save", "Web:
 * Athletics or Acrobatics check" or "Bless: Concentration check".
 */
function midiTitleOf(prompt: TablePrompt, choices: Choice[]): string {
  const names = new Intl.ListFormat('en', { type: 'disjunction' }).format(
    choices.map(({ name }) => name),
  )
  let kind = `${names || 'A'} check`
  if (prompt.type === 'save') kind = `${names || 'A'} save`
  else if (prompt.type === 'concentration') {
    const [only] = choices
    kind =
      only && only.key !== 'con'
        ? `Concentration check (${only.name})`
        : 'Concentration check'
  }
  return prompt.label ? `${prompt.label}: ${kind}` : kind
}

/**
 * Of the advantage Midi-QOL gives, what's said once: the same for every choice, as for the only
 * one, without naming it; else each choice's that isn't normal, by name.
 */
function advantageOf(choices: Choice[]): string | undefined {
  const words = choices.map(({ target }) => advantageWords(target.mode))
  if (words.every(each => each === words[0])) return words[0]
  return choices
    .flatMap(({ name }, index) =>
      words[index] ? [`${name}: ${words[index]}`] : [],
    )
    .join(' · ')
}

/** The whole seconds from one moment until another, none once it's come. */
function secondsLeft(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 1000))
}

/**
 * The whole seconds left until a moment, by this page's clock, ticking down each second until it
 * comes, at none.
 */
function useSecondsLeft(until: string): number {
  const at = Date.parse(until)
  const [now, setNow] = useState(() => Date.now())
  const left = secondsLeft(at, now)
  useEffect(() => {
    if (left <= 0) return
    // Checked often, to turn with the clock's seconds, but drawn again only as it does.
    const timer = setInterval(() => {
      const moment = Date.now()
      setNow(seen =>
        secondsLeft(at, moment) === secondsLeft(at, seen) ? seen : moment,
      )
    }, 200)
    return () => clearInterval(timer)
  }, [at, left])
  return left
}

/** Such as "0:42". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
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
