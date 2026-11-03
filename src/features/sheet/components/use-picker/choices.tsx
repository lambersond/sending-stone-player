'use client'

import { chargesOf } from '../action-info/utils'
import { Chip } from './chip'
import { ChipRow } from './chip-row'
import { EnchantWhat } from './enchant-what'
import { Go } from './go'
import { ProfileChoice } from './profile-choice'
import { TargetList } from './target-list'
import { TickList } from './tick-list'
import { useChoices } from './use-choices'
import {
  leadFor,
  levelLabel,
  poolLabel,
  sectionsOf,
  tickedOf,
  tickGo,
  whomOf,
} from './utils'
import { ordinal, poolName } from '@/utils/action-groups'
import type { Picked, Picking, Whom } from './types'
import type { Belonging } from '@/features/sheet/types'
import type { CastIndex, SheetSpellSection } from '@/types/sending-stone'
import type { TableCombat } from '@/types/table'

/**
 * An attack's or a use's choices: the slot, or the level a spell an item casts is cast at, the
 * ammunition, the way it enchants and the attack mode, each a row of chips where there's a choice;
 * then whom at, as `whomOf` has it.
 */
export function Choices({
  picking,
  combat,
  spellbook,
  casts,
  belongings,
  last,
  areas,
  selfTargets,
  onPick,
}: Readonly<{
  picking: Exclude<Picking, { kind: 'alone' }>
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  casts: CastIndex
  belongings: ReadonlyMap<string, Belonging>
  last?: string
  areas: boolean
  selfTargets: boolean
  onPick: (picked: Picked) => void
}>) {
  const choosing = useChoices({
    picking,
    combat,
    spellbook,
    casts,
    selfTargets,
    onPick,
  })
  const {
    pools,
    levels,
    ammunition,
    modes,
    slot,
    setSlot,
    ammo,
    setAmmo,
    mode,
    setMode,
    enchant,
    spends,
    offered,
    profile,
    setChosen,
    enchantsAt,
  } = choosing
  // Whom at.
  const whom = whomOf({
    picking,
    combat,
    last,
    areas,
    enchant,
    selfTargets,
    preset: choosing.preset,
    helpful: choosing.helpful,
    base: choosing.base,
    castAt: choosing.castAt,
  })

  return (
    <div className='flex flex-col gap-4'>
      {pools.length > 0 && (
        <ChipRow label={spends ? 'Cast at' : 'At level'}>
          {pools.map(pool => (
            <Chip
              key={pool.id}
              selected={pool.id === slot}
              disabled={(spends && pool.value === 0) || !enchantsAt(pool.level)}
              onSelect={() => setSlot(pool.id)}
              label={spends ? poolLabel(pool) : pool.label}
            >
              {poolName(pool)}
              {spends && (
                <span className='font-normal text-text-secondary'>
                  {' '}
                  · {pool.value} left
                </span>
              )}
            </Chip>
          ))}
        </ChipRow>
      )}
      {levels.length > 0 && (
        <ChipRow label={spends ? 'Cast at' : 'At level'}>
          {levels.map(level => (
            <Chip
              key={level.level}
              selected={`spell${level.level}` === slot}
              disabled={(spends && level.short) || !enchantsAt(level.level)}
              onSelect={() => setSlot(`spell${level.level}`)}
              label={levelLabel(level, spends)}
            >
              {ordinal(level.level)}
              {spends && level.charges !== null && (
                <span className='font-normal text-text-secondary'>
                  {' '}
                  · {chargesOf(level.charges)}
                </span>
              )}
            </Chip>
          ))}
        </ChipRow>
      )}
      {ammunition.length > 0 && (
        <ChipRow label='Ammunition'>
          {ammunition.map(({ id, name, quantity }) => (
            <Chip
              key={id}
              selected={id === ammo}
              disabled={quantity <= 0}
              onSelect={() => setAmmo(id)}
              label={`${name}, ${quantity} left`}
            >
              {name}{' '}
              <span className='font-normal text-text-secondary'>
                · {quantity}
              </span>
            </Chip>
          ))}
        </ChipRow>
      )}
      {enchant && (enchant.profiles.length > 1 || offered.length === 0) && (
        <ProfileChoice
          profiles={offered}
          chosen={profile?.id}
          onChoose={setChosen}
        />
      )}
      {modes.length > 0 && (
        <ChipRow label='Mode'>
          {modes.map(({ value, label }) => (
            <Chip
              key={value}
              selected={value === mode}
              onSelect={() => setMode(value)}
              label={label}
            >
              {label}
            </Chip>
          ))}
        </ChipRow>
      )}
      <WhomChoice
        whom={whom}
        choosing={choosing}
        combat={combat}
        belongings={belongings}
        onPick={onPick}
      />
    </div>
  )
}

/** Whom at, as `whomOf` has it: those to tick, one to tap, what to enchant, or no one to pick. */
function WhomChoice({
  whom,
  choosing,
  combat,
  belongings,
  onPick,
}: Readonly<{
  whom: Whom
  choosing: ReturnType<typeof useChoices>
  combat?: TableCombat
  belongings: ReadonlyMap<string, Belonging>
  onPick: (picked: Picked) => void
}>) {
  const { search, pick, options, profile } = choosing
  switch (whom.kind) {
    case 'tick': {
      return <TickStep whom={whom} choosing={choosing} combat={combat} />
    }
    case 'tap': {
      return (
        <TargetList
          lead={whom.lead}
          sections={whom.sections}
          {...search}
          last={whom.last}
          preset={whom.preset}
          onTap={combatant => pick([combatant])}
          onNone={() => pick([])}
        />
      )
    }
    case 'enchant': {
      return (
        <EnchantWhat
          enchant={whom.enchant}
          verb={whom.verb}
          belongings={belongings}
          ready={!!profile}
          onGo={item =>
            profile &&
            onPick({
              targets: [],
              ...options,
              enchant: { profile: profile.id, ...(item && { item }) },
            })
          }
        />
      )
    }
    case 'attack': {
      return <Go label='Attack' onGo={() => pick([])} />
    }
    case 'use': {
      const { at } = whom
      return (
        <>
          {at && <p className='text-sm text-text-secondary'>At: Self</p>}
          <Go
            label={whom.verb}
            onGo={() => onPick({ ...(at ?? { targets: [] }), ...options })}
          />
        </>
      )
    }
  }
}

/**
 * Those to tick, as many as a use or an area attack takes at the slot chosen, or the level, then
 * made at those ticked.
 */
function TickStep({
  whom: { targets, area, most: takes, verb, helps },
  choosing: { ticked, setTicked, search, pick },
  combat,
}: Readonly<{
  whom: Extract<Whom, { kind: 'tick' }>
  choosing: ReturnType<typeof useChoices>
  combat?: TableCombat
}>) {
  const { most, chosen } = tickedOf(ticked, targets, takes)
  return (
    <TickList
      lead={leadFor(area, takes)}
      sections={sectionsOf(targets, combat, { helpful: helps })}
      {...search}
      ticked={chosen}
      full={chosen.length >= most}
      onToggle={id =>
        setTicked(
          chosen.includes(id)
            ? chosen.filter(other => other !== id)
            : [...chosen, id],
        )
      }
      go={tickGo(verb, chosen.length)}
      onGo={() => pick(targets.filter(({ id }) => chosen.includes(id)))}
    />
  )
}
