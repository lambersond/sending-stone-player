'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { UserRound, Users } from 'lucide-react'
import Link from 'next/link'
import { Concentrating } from '@/components/character-sheet/concentration'
import { ConditionsOpener } from '@/components/character-sheet/conditions-panel'
import { DescriptionLinks } from '@/components/character-sheet/description-actions'
import { Enchanting } from '@/components/character-sheet/enchantments'
import {
  FavoriteMarks,
  NO_MARKS,
} from '@/components/character-sheet/favorite-mark'
import {
  Holdings,
  InventoryList,
} from '@/components/character-sheet/inventory-tab'
import { EntryIcon } from '@/components/character-sheet/sheet-entry'
import { SheetText } from '@/components/character-sheet/sheet-text'
import { Charging } from '@/components/character-sheet/uses-button'
import { EmptyState } from '@/components/game-table/empty-state'
import { TableApiContext } from '@/hooks/use-table-api'
import { megabytes } from '@/utils/format-amount'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import type { PartyState } from '@/hooks/use-party-sheet'
import type { TableSeat } from '@/types/character'
import type { PartyView } from '@/types/party'

/*
 * A party's sheet, as dnd5e's group sheet shows it to those who may see it in Foundry (module
 * 0.30.0): its members, by name and portrait only, its stash and its description. The same core
 * is its own page and the side panel over a character's sheet, so it carries everything it reads
 * by itself, wherever it's placed: nothing in it spends, stars, ends or rolls, and its
 * descriptions load through the party's own API.
 */

type Props = {
  /** The party sheet's API, such as `/api/characters/<id>/party/<group>`. */
  api: string
  role: SeatRole
  view: PartyView
  /** The player's own character's sheet, which its name in the members links to. */
  ownSheetHref?: string
}

/** What nothing in a party's sheet does: none of a character's actions are given it. */
const NO_ACTIONS = {}

/**
 * The party's sheet: its members, then its inventory or its description, in tabs; or, where its
 * sheet isn't here, why. It renders no page around it.
 */
export function PartySheet({ api, role, view, ownSheetHref }: Readonly<Props>) {
  const seat = useMemo<TableSeat>(
    () => ({ role, api, key: `party:${view.group.id}` }),
    [role, api, view.group.id],
  )
  // Whatever it's placed in, such as a character's sheet, it's given nothing of that.
  return (
    <TableApiContext value={seat}>
      <FavoriteMarks keys={NO_MARKS}>
        <ConditionsOpener show={undefined}>
          <DescriptionLinks actions={undefined}>
            <Enchanting actions={NO_ACTIONS}>
              <Concentrating actions={NO_ACTIONS}>
                <Charging actions={NO_ACTIONS}>
                  {view.sheet ? (
                    <PartyContents
                      view={view}
                      sheet={view.sheet}
                      ownSheetHref={ownSheetHref}
                    />
                  ) : (
                    <NoPartySheet role={role} view={view} />
                  )}
                </Charging>
              </Concentrating>
            </Enchanting>
          </DescriptionLinks>
        </ConditionsOpener>
      </FavoriteMarks>
    </TableApiContext>
  )
}

/**
 * The party's sheet as its hook has it: while it's first fetched, once it's no longer the seat's
 * to see, or else the sheet. Its page and its side panel each show it so.
 */
export function PartySheetFor({
  api,
  role,
  view,
  state,
  ownSheetHref,
}: Readonly<Omit<Props, 'view'> & { view?: PartyView; state: PartyState }>) {
  if (state === 'gone') {
    return (
      <EmptyState icon={Users} title="This party sheet isn't available">
        {role === 'gm'
          ? "It's no longer in this campaign in Foundry."
          : "It's no longer shared with your character in Foundry."}
      </EmptyState>
    )
  }
  if (!view) {
    return (
      <p
        role='status'
        className='py-16 text-center text-sm text-text-secondary'
      >
        Loading the party sheet…
      </p>
    )
  }
  return (
    <PartySheet api={api} role={role} view={view} ownSheetHref={ownSheetHref} />
  )
}

type Tab = 'inventory' | 'description'

const TABS: { id: Tab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'description', label: 'Description' },
]

function PartyContents({
  view,
  sheet,
  ownSheetHref,
}: Readonly<{
  view: PartyView
  sheet: NonNullable<PartyView['sheet']>
  ownSheetHref?: string
}>) {
  const [tab, setTab] = useState<Tab>('inventory')
  const ids = useId()
  const membersId = `${ids}-members`
  // Its descriptions are kept apart from any character's on the page.
  const textsKey = `party:${view.group.id}`
  const { inventory } = sheet
  return (
    <div className='flex flex-col gap-6'>
      <section aria-labelledby={membersId} className='flex flex-col gap-2'>
        <h2 id={membersId} className='text-sm font-semibold'>
          Members
          <span className='text-text-secondary'> · {sheet.members.length}</span>
        </h2>
        {sheet.members.length > 0 && (
          <ul className='flex flex-col rounded-2xl border border-border bg-card p-1.5'>
            {sheet.members.map(member => (
              <li
                key={member.id}
                className='flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-1.5'
              >
                <EntryIcon src={member.portrait} fallback={UserRound} />
                {member.own && ownSheetHref ? (
                  <Link
                    href={ownSheetHref}
                    className='min-w-0 truncate font-medium text-primary-text underline-offset-2 hover:underline'
                  >
                    {member.name}
                  </Link>
                ) : (
                  <span className='min-w-0 truncate font-medium'>
                    {member.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className='flex flex-col gap-4'>
        <div
          role='tablist'
          aria-label='Party sheet'
          className='flex gap-1 border-b border-border pb-2'
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              id={`${ids}-tab-${id}`}
              type='button'
              role='tab'
              aria-selected={tab === id}
              aria-controls={`${ids}-panel-${id}`}
              onClick={() => setTab(id)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                tab === id
                  ? 'bg-primary/10 text-primary-text'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {TABS.map(({ id }) => (
          <div
            key={id}
            id={`${ids}-panel-${id}`}
            role='tabpanel'
            aria-labelledby={`${ids}-tab-${id}`}
            hidden={tab !== id}
            className='@container flex flex-col gap-6'
          >
            {tab === id &&
              (id === 'inventory' ? (
                <>
                  {inventory.currency.length > 0 && (
                    <Holdings inventory={inventory} />
                  )}
                  {/* Without rows, nothing in it rolls or is used. */}
                  <InventoryList characterId={textsKey} inventory={inventory} />
                </>
              ) : (
                <Description
                  textsKey={textsKey}
                  hash={sheet.description}
                  name={view.group.name}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Description({
  textsKey,
  hash,
  name,
}: Readonly<{ textsKey: string; hash: string | null; name: string }>) {
  if (!hash) {
    return <p className='text-sm text-text-secondary'>No description.</p>
  }
  return <SheetText characterId={textsKey} hash={hash} origin={{ name }} />
}

/** Why there's no sheet to show: no one may see it, it's too large, or it's on its way. */
function NoPartySheet({
  role,
  view,
}: Readonly<{ role: SeatRole; view: PartyView }>) {
  const { name } = view.group
  let title = `${name}'s party sheet hasn't arrived`
  let body: ReactNode =
    role === 'gm'
      ? 'It arrives the next time your game connects.'
      : "It arrives the next time your Gamemaster's game connects."
  if (view.private) {
    title = 'Not shared with any player in Foundry'
    body = `No player in this campaign has Observer or Owner on ${name} in Foundry, so its sheet isn't sent. Give them Observer or Owner on it to share it.`
  } else if (view.withheld?.reason === 'tooLarge') {
    const { bytes, limit } = view.withheld
    title = `${name} is too large to send`
    body = (
      <>
        {typeof bytes === 'number' &&
          typeof limit === 'number' &&
          `It came to ${megabytes(bytes, Math.ceil)}, more than the ${megabytes(limit, Math.floor)} this app takes. `}
        {seatWords(role).told}
      </>
    )
  }
  return (
    <EmptyState icon={Users} title={title}>
      {body}
    </EmptyState>
  )
}
