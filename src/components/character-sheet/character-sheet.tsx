'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Shield, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { useD20Rolls, type RollActions } from './d20-rolls'
import { useFavorite } from './favorite-mark'
import { HitDiceList, hitDieSpending, type HitDieSpending } from './hit-dice'
import { RollButton } from './roll-button'
import { SheetHeading } from './sheet-heading'
import {
  Conditions,
  DeathSavesStat,
  HitPoints,
  InitiativeStat,
  isShowingDeathSaves,
  Portrait,
  Stat,
  StatTag,
  WalkingSpeed,
} from './sheet-tiles'
import { useCharging } from './uses-button'
import {
  CreatureHeader,
  otherSpeeds,
} from '@/components/companions/creature-header'
import { ConfirmModal } from '@/components/modal'
import { useSheetId } from '@/hooks/use-sheet-ids'
import { formatModifier } from '@/utils/format-modifier'
import { hitDicePools } from '@/utils/formulas'
import { articled } from '@/utils/wild-shape'
import {
  formLineOf,
  legendWords,
  skillsNoteWords,
} from '@/utils/wild-shape-words'
import type { SheetFormulaRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type {
  RollMode,
  SheetAbility,
  SheetForm,
  SheetSkill,
} from '@/types/sending-stone'
import type { CreatureFacts, TableCombat, TableSheet } from '@/types/table'

type Props = {
  name: string
  sheet: TableSheet
  /** The encounter under way, in which the character may be waiting to roll initiative. */
  combat?: TableCombat
  onRoll: (roll: SheetRoll) => void
  /** Spends hit dice, rolling them. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Shows one of the character's conditions in full, with its rules, by its id. */
  onShowConditions?: (id: string) => void
  /**
   * A creature's sheet rather than the character's (module 0.36.0), such as a companion's: its
   * header is the creature's.
   */
  creature?: CreatureFacts
  /**
   * The character a companion acts right after in initiative, while it's in the combat (module
   * 0.36.0): its Initiative tile says so, and rolls nothing.
   */
  follows?: string
  /** What the ids of its pane begin with, as a companion's pane's do (module 0.36.0). */
  idPrefix?: string
}

/**
 * A player's character sheet: who they are, their vital numbers, and their abilities and skills.
 * Each rolls when tapped, and a right-click or long-press offers advantage, disadvantage, or a
 * roll with extra dice or modifiers. Laid out after Tidy 5e's character sheet.
 */
export function CharacterSheet({
  name,
  sheet,
  combat,
  onRoll,
  onRollFormula,
  onShowConditions,
  creature,
  follows,
  idPrefix,
}: Readonly<Props>) {
  const { actions, dialogs } = useD20Rolls(onRoll)
  const abbreviation = (id: string) =>
    sheet.abilities.find(ability => ability.id === id)?.abbreviation ??
    id.toUpperCase()
  // The character's place in the encounter, while it has no initiative yet; not a companion's that
  // acts right after its character, which rolls none.
  const waiting =
    !follows &&
    combat?.combatants.some(
      ({ side, initiative }) => side === 'me' && initiative === null,
    )
  const combatId = waiting ? combat?.id : undefined
  const abilitiesId = useSheetId('abilities-heading')
  const skillsId = useSheetId('skills-heading')
  const traitsId = useSheetId('traits-heading')
  // What the character is transformed into, from module 0.40.0, whose numbers some of these are:
  // never at a creature's pane.
  const form = creature ? undefined : sheet.form
  const beast = form?.beast
  const marked =
    !!beast && (beast.abilities.length > 0 || beast.saves.length > 0)

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {creature ? (
        <CreatureHeader
          name={name}
          sheet={sheet}
          facts={creature}
          actions={actions}
          combatId={combatId}
          follows={follows}
          onShowConditions={onShowConditions}
          idPrefix={idPrefix}
        />
      ) : (
        <SheetHeader
          name={name}
          sheet={sheet}
          actions={actions}
          combatId={combatId}
          follows={follows}
          onShowConditions={onShowConditions}
          spending={hitDieSpending(sheet, onRollFormula)}
        />
      )}

      <section aria-labelledby={abilitiesId} className='flex flex-col gap-3'>
        <SheetHeading id={abilitiesId}>Abilities</SheetHeading>
        {form && marked && (
          <p className='-mt-1 flex items-center gap-1.5 px-1 text-xs text-text-secondary'>
            <span
              aria-hidden
              className='size-3 shrink-0 rounded-[3px] border border-wild/45 bg-wild-bg'
            />
            {legendWords(form.name, name)}
          </p>
        )}
        <ul className='grid grid-cols-3 gap-2 @xl:grid-cols-6'>
          {sheet.abilities.map(ability => (
            <AbilityTile
              key={ability.id}
              ability={ability}
              {...actions}
              {...(form && {
                beast: {
                  form: form.name,
                  check: !!beast?.abilities.includes(ability.id),
                  save: !!beast?.saves.includes(ability.id),
                },
              })}
            />
          ))}
        </ul>
      </section>

      {sheet.skills.length > 0 && (
        <section aria-labelledby={skillsId} className='flex flex-col gap-2'>
          <div className='flex items-baseline justify-between gap-2 px-1'>
            <SheetHeading id={skillsId}>Skills</SheetHeading>
            <span aria-hidden className='text-xs text-text-secondary'>
              Modifier · Passive
            </span>
          </div>
          <ul className='grid gap-x-4 rounded-2xl border border-border bg-card p-1.5 @2xl:grid-cols-2'>
            {sheet.skills.map(skill => (
              <SkillRow
                key={skill.id}
                skill={skill}
                ability={abbreviation(skill.ability)}
                {...actions}
                {...(form &&
                  beast?.skills.includes(skill.id) && { beast: form.name })}
              />
            ))}
          </ul>
          {form && (
            <p className='px-1 text-xs text-text-secondary'>
              {skillsNoteWords(form.name, name)}
            </p>
          )}
        </section>
      )}

      {sheet.traits.length > 0 && (
        <section aria-labelledby={traitsId} className='flex flex-col gap-2'>
          <SheetHeading id={traitsId}>Traits</SheetHeading>
          <dl className='grid gap-x-4 rounded-2xl border border-border bg-card p-1.5 @2xl:grid-cols-2'>
            {sheet.traits.map(trait => (
              <div
                key={trait.id}
                className='flex flex-col gap-0.5 rounded-xl px-2.5 py-2'
              >
                <dt className='text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
                  {trait.label}
                </dt>
                <dd className='text-sm'>{trait.values.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {dialogs}
    </div>
  )
}

/* -------------------------------------------- */

function SheetHeader({
  name,
  sheet,
  actions,
  combatId,
  follows,
  onShowConditions,
  spending,
}: Readonly<{
  name: string
  sheet: TableSheet
  actions: RollActions
  /** The combat the character waits to roll initiative in. */
  combatId?: string
  /** The character it acts right after in initiative, while that one's in the combat. */
  follows?: string
  onShowConditions?: (id: string) => void
  /** How a hit die is spent; their counts alone without. */
  spending?: HitDieSpending
}>) {
  const identity = [sheet.species, sheet.background].filter(Boolean)
  const pools = hitDicePools(sheet.classes)
  const dying = isShowingDeathSaves(sheet)
  // What the character is transformed into, from module 0.40.0: its name heads the header, the
  // form's size, CR and senses in the class line's place, as it keeps its own creature type.
  const { form } = sheet
  const senses = sheet.traits.find(({ id }) => id === 'senses')?.values ?? []
  return (
    <header className='flex flex-col gap-4 rounded-2xl border border-border bg-card p-4'>
      <div className='flex items-center gap-4'>
        <Portrait name={name} src={sheet.portrait} />
        <div className='min-w-0'>
          {form && (
            <h2
              tabIndex={-1}
              className='text-lg leading-tight font-semibold outline-none'
            >
              {name}
              <span className='font-medium text-text-secondary'>
                {` as ${articled(form.name)}`}
              </span>
            </h2>
          )}
          <p className='font-semibold'>
            {form ? formLineOf(form, senses) : classLine(sheet)}
          </p>
          {identity.length > 0 && (
            <p className='text-sm text-text-secondary'>
              {identity.join(' · ')}
            </p>
          )}
          <Inspiration inspired={sheet.inspiration} />
        </div>
      </div>
      <Conditions
        conditions={sheet.conditions}
        onShowConditions={onShowConditions}
      />
      {/* The hit points and the hit dice side by side, however wide the sheet; while the
          character is dying, the death saves on a row of their own; then the numbers after them,
          two to a row on a phone, and four wider. Only where the sheet is as wide as it gets do
          the numbers go on the row beside one size of hit die, eight to a row: narrower, an eighth
          is too narrow for a Roll badge, temporary hit points or a speed of 120 ft. Not beside
          more than one size, which is taller, nor while the death saves show, which would leave
          half the next row empty. Without hit dice, the hit points and the numbers make one row,
          or the hit points one of their own on a phone. */}
      <dl
        className={clsx(
          'grid grid-cols-2 gap-2',
          pools.length > 0 ? '@lg:grid-cols-4' : '@lg:grid-cols-6',
          pools.length === 1 && !dying && '@5xl:grid-cols-8',
        )}
      >
        {sheet.hp && (
          <Stat label='Hit points' wide={pools.length > 0 ? 'pair' : 'double'}>
            <HitPoints hp={sheet.hp} />
          </Stat>
        )}
        {/* Spent any time, a tap a die of that size, for the hit points it gives back; or more at
            once, from its popover. */}
        {pools.length > 0 && (
          <Stat label='Hit dice' wide='pair'>
            <HitDiceList pools={pools} spending={spending} />
          </Stat>
        )}
        <DeathSavesStat sheet={sheet} actions={actions} />
        {sheet.ac !== null && (
          <Stat label='Armor class' short='AC' tag={acTag(form)}>
            <span className='inline-flex items-center gap-1'>
              <Shield aria-hidden className='size-4 text-text-secondary' />
              {sheet.ac}
            </span>
          </Stat>
        )}
        {sheet.proficiency !== null && (
          <Stat label='Proficiency' short='Prof'>
            {formatModifier(sheet.proficiency)}
          </Stat>
        )}
        {sheet.initiative !== null && (
          <InitiativeStat
            modifier={sheet.initiative}
            combatId={combatId}
            follows={follows}
            actions={actions}
            tag={form?.name}
          />
        )}
        {sheet.speed && (
          <Stat label='Speed' tag={form?.name}>
            <WalkingSpeed speed={sheet.speed} />
            {/* A form's every speed, as a creature's header shows them. */}
            {form &&
              otherSpeeds(sheet).map(speed => (
                <span
                  key={speed}
                  className='block text-xs font-semibold text-text-secondary'
                >
                  {speed}
                </span>
              ))}
          </Stat>
        )}
      </dl>
    </header>
  )
}

/**
 * Whether the character has Heroic Inspiration: while the game takes it from here, from module
 * 0.29.0, a button that uses it, or gains it, once the player says so, as dnd5e's sheet's does,
 * the game's chat saying so; else, as before, a mark only while they have it.
 */
function Inspiration({ inspired }: Readonly<{ inspired: boolean }>) {
  const { inspire } = useCharging()
  const [open, setOpen] = useState(false)
  // What the confirm was opened to do, which it asks and does however the sheet changes while it's
  // open: the Gamemaster granting it meanwhile never turns the player's gain into a use.
  const [asked, setAsked] = useState<'use' | 'gain'>('use')
  const mark = (
    <>
      <Sparkles aria-hidden className='size-3.5' />
      Inspired
    </>
  )
  if (!inspire) {
    return (
      inspired && (
        <p className='mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-label'>
          {mark}
        </p>
      )
    )
  }
  const label = inspired
    ? 'Inspired. Use Heroic Inspiration'
    : 'Not inspired. Gain Heroic Inspiration'
  const verb = asked === 'use' ? 'Use' : 'Gain'
  return (
    <div className='mt-1'>
      <button
        type='button'
        aria-label={label}
        title={label}
        onClick={() => {
          setAsked(inspired ? 'use' : 'gain')
          setOpen(true)
        }}
        className={clsx(
          '-mx-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold transition-colors hover:bg-primary/5',
          inspired ? 'text-gold-label' : 'text-text-secondary',
        )}
      >
        {inspired ? mark : 'Not inspired'}
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        title={`${verb} Heroic Inspiration?`}
        confirmLabel={verb}
        onConfirm={async () => {
          inspire(asked)
        }}
      >
        <p>Foundry’s chat will say so.</p>
      </ConfirmModal>
    </div>
  )
}

/* -------------------------------------------- */

function AbilityTile({
  ability,
  onRoll,
  onMenu,
  beast,
}: Readonly<
  {
    ability: SheetAbility
    /**
     * On a shaped sheet, from module 0.40.0, which half of it is the form's: its check, its score
     * the beast's, and its save, the beast's bonus above the character's own.
     */
    beast?: { form: string; check: boolean; save: boolean }
  } & RollActions
>) {
  const { label, abbreviation, score, check, save, saveProficient } = ability
  const SaveIcon = saveProficient ? ShieldCheck : Shield
  const whose = (marked?: boolean) =>
    marked && beast ? `, the ${beast.form}’s` : ''
  return (
    <li
      className={clsx(
        'flex flex-col overflow-hidden rounded-2xl border bg-card',
        beast?.check || beast?.save ? 'border-wild/45' : 'border-border',
      )}
    >
      <RollButton
        target={{
          label: `${label} check`,
          modifier: check,
          mode: ability.checkMode,
          source: { kind: 'ability', key: ability.id },
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${label} check, ${formatModifier(check)}${modeText(ability.checkMode)}${whose(beast?.check)}`}
        className={clsx(
          'flex flex-col items-center gap-1 px-2 pt-2.5 pb-2 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5',
          beast?.check && 'bg-wild-bg/55',
        )}
      >
        <span
          className={clsx(
            'text-xs font-semibold tracking-wider uppercase',
            beast?.check ? 'text-wild' : 'text-text-secondary',
          )}
        >
          {abbreviation}
        </span>
        <span className='text-2xl leading-none font-bold tabular-nums'>
          {formatModifier(check)}
        </span>
        <span className='flex items-center gap-1'>
          {score !== null && (
            <span className='rounded-full border border-border px-2 text-xs tabular-nums'>
              {score}
            </span>
          )}
          <ModeChip mode={ability.checkMode} />
        </span>
      </RollButton>
      <RollButton
        target={{
          label: `${label} saving throw`,
          modifier: save,
          mode: ability.saveMode,
          source: { kind: 'save', key: ability.id },
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${label} saving throw, ${formatModifier(save)}${saveProficient ? ', proficient' : ''}${modeText(ability.saveMode)}${whose(beast?.save)}`}
        className={clsx(
          'flex items-center justify-center gap-1 border-t border-border py-1.5 text-xs transition-colors hover:bg-primary/5 focus-visible:bg-primary/5',
          beast?.save && 'bg-wild-bg/55',
        )}
      >
        <SaveIcon
          aria-hidden
          className={clsx(
            'size-3.5',
            saveProficient ? 'text-primary' : 'text-text-secondary',
          )}
        />
        <span className='text-text-secondary'>Save</span>
        <span className='font-semibold tabular-nums'>
          {formatModifier(save)}
        </span>
        <ModeChip mode={ability.saveMode} />
      </RollButton>
    </li>
  )
}

/** Proficiency, as a skill's multiplier says it. */
export const PROFICIENCY: Record<string, string> = {
  '0.5': 'half proficiency',
  '1': 'proficient',
  '2': 'expertise',
}

function SkillRow({
  skill,
  ability,
  onRoll,
  onMenu,
  beast,
}: Readonly<
  {
    skill: SheetSkill
    ability: string
    /** On a shaped sheet, from module 0.40.0, the form's name, where the bonus is the form's. */
    beast?: string
  } & RollActions
>) {
  const favorite = useFavorite(`skill:${skill.id}`)
  const proficiency = PROFICIENCY[String(skill.proficiency)]
  const details = [
    proficiency,
    skill.passive === null ? undefined : `passive ${skill.passive}`,
  ].filter(Boolean)
  return (
    <li>
      <RollButton
        target={{
          label: `${skill.label} check`,
          modifier: skill.total,
          mode: skill.mode,
          source: { kind: 'skill', key: skill.id },
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${skill.label} check, ${formatModifier(skill.total)}${details.length > 0 ? ` (${details.join(', ')})` : ''}${modeText(skill.mode)}${beast ? `, the ${beast}’s` : ''}${favorite ? ', favorite' : ''}`}
        className='flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5'
      >
        <ProficiencyMark value={skill.proficiency} />
        <span className='w-8 shrink-0 text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
          {ability}
        </span>
        <span className='flex min-w-0 flex-1 items-center gap-1'>
          <span className='truncate font-medium'>{skill.label}</span>
          {beast && <StatTag>{`${beast}’s`}</StatTag>}
          {favorite && (
            <Star aria-hidden className='size-3 shrink-0 fill-gold text-gold' />
          )}
        </span>
        <ModeChip mode={skill.mode} />
        <span className='w-8 text-right font-semibold tabular-nums'>
          {formatModifier(skill.total)}
        </span>
        <span className='w-7 text-right text-xs text-text-secondary tabular-nums'>
          {skill.passive}
        </span>
      </RollButton>
    </li>
  )
}

/** Proficiency as dnd5e's sheets mark it: none, half, proficient, or expertise. */
function ProficiencyMark({ value }: Readonly<{ value: number }>) {
  return (
    <span
      aria-hidden
      className={clsx(
        'size-3 shrink-0 rounded-full border-2',
        value === 0 && 'border-border',
        value === 0.5 &&
          'border-primary bg-[linear-gradient(90deg,var(--color-primary)_50%,transparent_50%)]',
        value === 1 && 'border-primary bg-primary',
        value >= 2 && 'border-primary bg-primary ring-2 ring-primary/30',
      )}
    />
  )
}

/** Advantage or disadvantage from the character's conditions and features. */
export function ModeChip({ mode }: Readonly<{ mode: RollMode }>) {
  if (mode === 0) return
  return (
    <span
      aria-hidden
      className={clsx(
        'rounded px-1 text-[10px] font-bold tracking-wide uppercase',
        mode > 0 ? 'bg-primary/15 text-primary-text' : 'bg-ruby/15 text-ruby',
      )}
    >
      {mode > 0 ? 'Adv' : 'Dis'}
    </span>
  )
}

/* -------------------------------------------- */

/** Advantage or disadvantage, as a roll's label says it. */
export function modeText(mode: RollMode): string {
  if (mode > 0) return ', with advantage'
  if (mode < 0) return ', with disadvantage'
  return ''
}

/**
 * Whose the Armor class is on a shaped sheet (module 0.40.0): the form's, or the Circle of the
 * Moon's where its floor is the AC.
 */
function acTag(form?: SheetForm): string | undefined {
  if (!form) return undefined
  return form.flooredAc ? 'Circle of the Moon' : form.name
}

/** Such as "Fighter 4 / Rogue 1 · Champion", or the level alone. */
export function classLine(sheet: TableSheet): string {
  if (sheet.classes.length === 0) {
    return sheet.level === null ? 'Character' : `Level ${sheet.level}`
  }
  const classes = sheet.classes
    .map(({ name, levels }) => (levels === null ? name : `${name} ${levels}`))
    .join(' / ')
  const subclasses = sheet.classes.flatMap(({ subclass }) =>
    subclass ? [subclass] : [],
  )
  return subclasses.length > 0
    ? `${classes} · ${subclasses.join(' / ')}`
    : classes
}
