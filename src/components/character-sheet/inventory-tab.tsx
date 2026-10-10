'use client'

import { useId, useState, type ReactNode } from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import clsx from 'clsx'
import { Backpack, Package } from 'lucide-react'
import {
  ActionEntry,
  useActionRows,
  type ActionRows,
  type TableDamage,
} from './action-entry'
import { joinParts, SheetEntry } from './sheet-entry'
import { SheetFact } from './sheet-fact'
import { SheetHeading } from './sheet-heading'
import { UsesLeft } from './uses-left'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'
import { compactAmount } from '@/utils/format-amount'
import { itemAction } from '@/utils/sheet-actions'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type {
  SheetAction,
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/**
 * The character's inventory, as dnd5e's Inventory tab shows it to its player: coin, load and
 * attunement, items by type, and containers, each opening to what it holds. What an item rolls is
 * beside it, as on the Actions tab, whether it's equipped or not: each a button that rolls it, or
 * uses it in the Gamemaster's game while the game takes items' uses.
 */
export function InventoryTab({
  characterId,
  sheet,
  favorites,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  /** Shown first, such as the character's favorites. */
  favorites?: ReactNode
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses an item in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    spellbook: sheet.spells,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
  })
  const { inventory } = sheet
  const { currency, encumbrance, attunement } = inventory
  const empty =
    inventory.sections.length === 0 && inventory.containers.length === 0
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {favorites}
      {(currency.length > 0 || encumbrance || attunement) && (
        <Holdings inventory={inventory} />
      )}

      {inventory.sections.map(section => (
        <section
          key={section.id}
          aria-labelledby={`inventory-${section.id}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`inventory-${section.id}`}>
            {section.label}
          </SheetHeading>
          {/* A container, so that each row fits the list it's in. */}
          <ul className='@container rounded-2xl border border-border bg-card p-1.5'>
            {section.items.map(item => (
              <ItemEntry
                key={item.id}
                characterId={characterId}
                item={item}
                rows={rows}
              />
            ))}
          </ul>
        </section>
      ))}

      {inventory.containers.length > 0 && (
        <section
          aria-labelledby='inventory-containers'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='inventory-containers'>Containers</SheetHeading>
          <ul className='@container rounded-2xl border border-border bg-card p-1.5'>
            {inventory.containers.map(container => (
              <ItemEntry
                key={container.id}
                characterId={characterId}
                item={container}
                rows={rows}
              />
            ))}
          </ul>
        </section>
      )}

      {empty && (
        <p className='text-sm text-text-secondary'>No items to show yet.</p>
      )}

      {dialogs}
    </div>
  )
}

/** Coin, how much the character carries, and how many items they are attuned to. */
function Holdings({ inventory }: Readonly<{ inventory: SheetInventory }>) {
  const { currency, encumbrance, attunement } = inventory
  return (
    // On a phone, coin across the top, and load and attunement side by side under it.
    <dl className='grid grid-cols-2 gap-2 @xl:grid-cols-3'>
      {currency.length > 0 && (
        <SheetFact label='Currency' className='col-span-2 @xl:col-span-1'>
          <ul className='flex flex-wrap gap-x-3 gap-y-1'>
            {currency.map(coin => (
              <li
                key={coin.id}
                title={coin.label}
                className={clsx(coin.value === 0 && 'text-text-secondary')}
              >
                <CoinAmount coin={coin} />
              </li>
            ))}
          </ul>
        </SheetFact>
      )}
      {encumbrance && (
        <SheetFact
          label='Encumbrance'
          className={clsx(!attunement && 'col-span-2 @xl:col-span-1')}
        >
          <Load encumbrance={encumbrance} />
        </SheetFact>
      )}
      {attunement && (
        <SheetFact
          label='Attunement'
          className={clsx(!encumbrance && 'col-span-2 @xl:col-span-1')}
        >
          <span className='font-semibold tabular-nums'>
            {attunement.value}
            {attunement.max !== null && ` / ${attunement.max}`}
          </span>
        </SheetFact>
      )}
    </dl>
  )
}

type Coin = SheetInventory['currency'][number]

/**
 * How much of a coin the character has, such as "41 GP". From 1,000, it's shortened, as in
 * "12.8k GP", so that every coin fits on a phone, and the exact amount is a click or tap away.
 */
function CoinAmount({ coin }: Readonly<{ coin: Coin }>) {
  const short = compactAmount(coin.value)
  if (short === undefined) {
    return <CoinText amount={coin.value.toLocaleString()} coin={coin} />
  }
  return <ExactAmount short={short} coin={coin} />
}

/** An amount and the coin's abbreviation after it, smaller, as in "41 GP". */
function CoinText({ amount, coin }: Readonly<{ amount: string; coin: Coin }>) {
  return (
    <>
      <span className='font-semibold tabular-nums'>{amount}</span>{' '}
      <span className='text-xs'>{coin.abbreviation}</span>
    </>
  )
}

/**
 * A shortened amount of a coin, as a button that opens a popover above it with the exact amount,
 * and the coin's name, such as "Gold": by a click or tap, or Enter or Space. Escape, or a click
 * or tap elsewhere, closes it; inside a dialog too, and only it.
 */
function ExactAmount({ short, coin }: Readonly<{ short: string; coin: Coin }>) {
  const [open, setOpen] = useState(false)
  const amount = useId()
  const shown = `${short} ${coin.abbreviation}`.trimEnd()
  const root = usePortalRoot()
  useTopmostEscape(open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  return (
    <>
      <button
        ref={refs.setReference}
        type='button'
        // What it shows, then what it opens to.
        aria-label={`${shown}, exact amount`}
        className='rounded-md underline decoration-text-secondary/60 decoration-dotted underline-offset-4 transition-colors hover:text-primary'
        {...getReferenceProps()}
      >
        <CoinText amount={short} coin={coin} />
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-labelledby={amount}
              className='z-50 flex max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2 text-text-primary shadow-xl outline-none'
              {...getFloatingProps()}
            >
              {coin.label && (
                <p className='text-xs font-semibold text-text-secondary'>
                  {coin.label}
                </p>
              )}
              <p id={amount}>
                <CoinText amount={coin.value.toLocaleString()} coin={coin} />
              </p>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}

/**
 * What the character carries of the most they can, as a bar, marked where being encumbered and
 * heavily encumbered begin under the variant rule.
 */
function Load({
  encumbrance,
}: Readonly<{ encumbrance: NonNullable<SheetInventory['encumbrance']> }>) {
  const { value, max, units, encumbered, heavilyEncumbered } = encumbrance
  const share = (weight: number) =>
    max ? Math.min(100, Math.max(0, (weight / max) * 100)) : 0
  const over =
    (heavilyEncumbered !== null && value > heavilyEncumbered) ||
    (max !== null && value > max)
  const loaded = encumbered !== null && value > encumbered
  return (
    <span className='flex flex-col gap-1.5'>
      <span className='tabular-nums'>
        <span className='font-semibold'>{value.toLocaleString()}</span>
        {max !== null && ` / ${max.toLocaleString()}`} {units}
      </span>
      {max !== null && (
        <span
          aria-hidden
          className='relative h-1.5 overflow-hidden rounded-full bg-border'
        >
          <span
            className={clsx(
              'absolute inset-y-0 left-0 rounded-full',
              over && 'bg-danger',
              !over && loaded && 'bg-warning',
              !over && !loaded && 'bg-primary',
            )}
            style={{ width: `${share(value)}%` }}
          />
          {[encumbered, heavilyEncumbered].map(
            (threshold, index) =>
              threshold !== null && (
                <span
                  key={index}
                  className='absolute inset-y-0 w-0.5 bg-text-secondary/60'
                  style={{ left: `${share(threshold)}%` }}
                />
              ),
          )}
        </span>
      )}
    </span>
  )
}

/**
 * An item, or a container that opens to what it holds. Given the rows actions are in, one that
 * rolls shows what it rolls beside it, as an action does.
 */
export function ItemEntry({
  characterId,
  item,
  rows,
}: Readonly<{
  characterId: string
  item: SheetItem | SheetContainer
  rows?: ActionRows
}>) {
  const container = 'contents' in item ? item : undefined
  const { weight, uses } = item
  const capacity = container?.capacity
  const heft =
    weight && `${weight.value.toLocaleString()} ${weight.units}`.trim()
  const detail = joinParts(
    item.equipped && 'Equipped',
    item.attuned && 'Attuned',
    heft,
    item.price,
  )
  // In full when open, as the line under its name may be cut short.
  const facts: { label: string; value: string }[] = []
  if (capacity) {
    facts.push({
      label: 'Capacity',
      value: `${capacity.value.toLocaleString()} / ${capacity.max.toLocaleString()} ${capacity.units}`,
    })
  }
  if (heft) facts.push({ label: 'Weight', value: heft })
  if (item.price) facts.push({ label: 'Price', value: item.price })
  const meta = joinParts(
    !item.identified && 'Not identified',
    item.rarity,
    item.attunement === 'required' && 'Requires attunement',
    item.attunement === 'optional' && 'Attunement optional',
    ...item.properties,
  )
  const quantity = item.quantity !== 1 && (
    <span className='text-sm font-semibold text-text-secondary tabular-nums'>
      ×{item.quantity}
    </span>
  )
  const action = rows && !container ? itemAction(item) : undefined
  if (rows && action) {
    return (
      <ActionEntry
        action={action}
        rows={rows}
        look={{
          // What it is to carry, rather than how it's used, which it opens to; or nothing.
          detail: detail ?? '',
          marks: quantity,
          meta,
          facts,
        }}
      />
    )
  }
  return (
    <SheetEntry
      characterId={characterId}
      name={item.name}
      img={item.img}
      fallback={container ? Backpack : Package}
      favoriteKey={`item:${item.id}`}
      detail={detail}
      aside={
        (item.quantity !== 1 || uses) && (
          <span className='flex shrink-0 items-center gap-1.5'>
            {quantity}
            {uses && <UsesLeft uses={uses} />}
          </span>
        )
      }
      meta={meta}
      facts={facts}
      text={item.text}
      origin={{ name: item.name, item: item.id }}
    >
      {container && (
        <Contents characterId={characterId} container={container} rows={rows} />
      )}
    </SheetEntry>
  )
}

function Contents({
  characterId,
  container,
  rows,
}: Readonly<{
  characterId: string
  container: SheetContainer
  rows?: ActionRows
}>) {
  if (container.contents === null) {
    return (
      <p className='text-sm text-text-secondary'>
        What it holds isn&apos;t known yet.
      </p>
    )
  }
  if (container.contents.length === 0) {
    return <p className='text-sm text-text-secondary'>It&apos;s empty.</p>
  }
  return (
    <ul
      aria-label={`In the ${container.name}`}
      className='@container -ml-2.5 rounded-xl border border-border'
    >
      {container.contents.map(item => (
        <ItemEntry
          key={item.id}
          characterId={characterId}
          item={item}
          rows={rows}
        />
      ))}
    </ul>
  )
}
