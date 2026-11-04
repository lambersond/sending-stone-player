import type { Ability, Choice } from './types'
import type { RollMode } from '@/types/sending-stone'
import type { TablePrompt, TableSheet } from '@/types/table'

/** The abilities on the sheet a prompt may be rolled with, in its order. */
export function abilitiesOf(prompt: TablePrompt, sheet: TableSheet): Ability[] {
  return prompt.abilities.flatMap(id => {
    const ability = sheet.abilities.find(each => each.id === id)
    return ability ? [ability] : []
  })
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
 * The ways to answer what Midi-QOL asks that are on the sheet, in its order: a save or
 * concentration check by its abilities' saves, an ability check by their checks, and a skill check
 * by its skills.
 */
export function choicesOf(prompt: TablePrompt, sheet: TableSheet): Choice[] {
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
export function advantageWords(mode: RollMode): string | undefined {
  if (mode > 0) return 'Advantage (Midi)'
  if (mode < 0) return 'Disadvantage (Midi)'
  return undefined
}

/**
 * What Midi-QOL asks, in words, after what asks it: such as "Hold Person: Wisdom save", "Web:
 * Athletics or Acrobatics check" or "Bless: Concentration check".
 */
export function midiTitleOf(prompt: TablePrompt, choices: Choice[]): string {
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
export function advantageOf(choices: Choice[]): string | undefined {
  const words = choices.map(({ target }) => advantageWords(target.mode))
  if (words.every(each => each === words[0])) return words[0]
  return choices
    .flatMap(({ name }, index) =>
      words[index] ? [`${name}: ${words[index]}`] : [],
    )
    .join(' · ')
}

/** The whole seconds from one moment until another, none once it's come. */
export function secondsLeft(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 1000))
}

/** Such as "0:42". */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
