import { Shield } from 'lucide-react'
import { otherSpeeds } from './utils'
import { HitPointsTile } from '@/features/sheet/components/hit-points-editor/hit-points-tile'
import { Conditions } from '@/features/sheet/components/sheet-tiles/conditions'
import { DeathSavesStat } from '@/features/sheet/components/sheet-tiles/death-saves-stat'
import { InitiativeStat } from '@/features/sheet/components/sheet-tiles/initiative-stat'
import { Portrait } from '@/features/sheet/components/sheet-tiles/portrait'
import { Stat } from '@/features/sheet/components/sheet-tiles/stat'
import { WalkingSpeed } from '@/features/sheet/components/sheet-tiles/walking-speed'
import { SHEET_CARD } from '@/features/sheet/constants'
import { creatureLine, crWords, relationWords } from '@/utils/creature-words'
import { formatModifier } from '@/utils/format-modifier'
import type { RollActions } from '@/features/rolling/types'
import type { CreatureFacts, TableSheet } from '@/types/table'
import type { ReactNode } from 'react'

/**
 * The top of a creature's sheet, in place of a character's (module 0.36.0): its name, numbered
 * where its character has more than one of that name, what it is, whose it is, and its challenge
 * rating, and whether it's in its lair; its conditions; then its numbers, with every speed it has,
 * and under them the creature's own: its legendary actions and resistances, its hit dice, and its
 * lair's initiative. Its hit dice are read only, never spent here, and it has no Heroic
 * Inspiration; from module 0.44.0 its hit points are set from their tile, where the game takes
 * them. Each line its facts don't give is left out, so a wild-shaped form can add one of its own
 * later.
 * @param name - Its name as its tab says it, such as "Bat 2".
 * @param combatId - The combat it waits to roll initiative in.
 * @param follows - The character it acts right after in initiative, while that one's in it.
 * @param idPrefix - What its pane's ids begin with.
 */
export function CreatureHeader({
  name,
  sheet,
  facts,
  actions,
  combatId,
  follows,
  onShowConditions,
  idPrefix = '',
}: Readonly<{
  name: string
  sheet: TableSheet
  facts: CreatureFacts
  actions: RollActions
  combatId?: string
  follows?: string
  onShowConditions?: (id: string) => void
  idPrefix?: string
}>) {
  const { creature } = sheet
  const line = creatureLine(creature)
  const cr = creature ? crWords(creature.cr) : undefined
  const lair = creature?.lair?.inside === true
  const speeds = otherSpeeds(sheet)
  return (
    <section
      aria-labelledby={`${idPrefix}creature-name`}
      className={SHEET_CARD}
    >
      <div className='flex items-center gap-4'>
        <Portrait name={name} src={sheet.portrait} />
        <div className='flex min-w-0 flex-col gap-0.5'>
          <h2
            id={`${idPrefix}creature-name`}
            className='truncate text-lg leading-tight font-semibold'
          >
            {name}
          </h2>
          {line && <p className='text-sm font-semibold'>{line}</p>}
          <p className='text-sm text-text-secondary'>
            {relationWords(facts.relation)}
          </p>
          {(cr !== undefined || lair) && (
            <div className='mt-1 flex flex-wrap gap-1.5'>
              {cr !== undefined && <Chip>CR {cr}</Chip>}
              {lair && <Chip>In its lair</Chip>}
            </div>
          )}
        </div>
      </div>
      <Conditions
        conditions={sheet.conditions}
        onShowConditions={onShowConditions}
      />
      <dl className='grid grid-cols-2 gap-2 @min-[560px]:grid-cols-3 @min-[860px]:grid-cols-5'>
        {sheet.hp && (
          <Stat label='Hit points' short='HP'>
            {/* Set from here at its own pane, where the game takes it, from module 0.44.0. */}
            <HitPointsTile hp={sheet.hp} />
          </Stat>
        )}
        {/* An important NPC makes death saving throws, as a character does: shown as its are. */}
        {creature?.important && (
          <DeathSavesStat sheet={sheet} actions={actions} />
        )}
        {sheet.ac !== null && (
          <Stat label='Armor class' short='AC'>
            <span className='inline-flex items-center gap-1'>
              <Shield aria-hidden className='size-4 text-text-secondary' />
              {sheet.ac}
            </span>
          </Stat>
        )}
        {/* A summon without a challenge rating, as 2024's are, has none of its own. */}
        <Stat label='Proficiency' short='Prof'>
          {sheet.proficiency === null ? '—' : formatModifier(sheet.proficiency)}
        </Stat>
        {sheet.initiative !== null && (
          <InitiativeStat
            modifier={sheet.initiative}
            combatId={combatId}
            follows={follows}
            actions={actions}
          />
        )}
        {(sheet.speed || speeds.length > 0) && (
          <Stat label='Speed'>
            {sheet.speed && <WalkingSpeed speed={sheet.speed} />}
            {speeds.map(speed => (
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
      <CreatureStats sheet={sheet} />
    </section>
  )
}

/** One of the header's chips, such as its challenge rating. */
function Chip({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className='rounded-full border border-border bg-page px-2.5 py-0.5 text-xs font-semibold'>
      {children}
    </span>
  )
}

/**
 * The creature's own numbers, under its header's tiles, where any applies: its legendary actions
 * and resistances as they stand, its hit dice, which are spent in the game alone, and in its lair,
 * the lair's initiative.
 */
function CreatureStats({ sheet }: Readonly<{ sheet: TableSheet }>) {
  const { creature } = sheet
  if (!creature) return
  const { legendary, resistance, hitDice, lair } = creature
  const stats: [string, string][] = []
  if (legendary) {
    stats.push(['Legendary actions', `${legendary.value} of ${legendary.max}`])
  }
  if (resistance) {
    stats.push([
      'Legendary resistance',
      `${resistance.value} of ${resistance.max}`,
    ])
  }
  if (hitDice) {
    stats.push([
      'Hit dice',
      `${hitDice.value} of ${hitDice.max} (${hitDice.denomination})`,
    ])
  }
  if (lair?.inside && lair.initiative !== null) {
    stats.push(['Lair initiative', String(lair.initiative)])
  }
  if (stats.length === 0) return
  return (
    <dl
      aria-label='Creature stats'
      className='grid grid-cols-2 gap-2 @min-[560px]:grid-cols-4'
    >
      {stats.map(([label, value]) => (
        <div
          key={label}
          className='flex flex-col gap-0.5 rounded-xl border border-border px-3 py-2'
        >
          <dt className='text-xs text-text-secondary'>{label}</dt>
          <dd className='font-semibold tabular-nums'>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
