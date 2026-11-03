'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { UserRound, Users } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/empty-state/empty-state'
import { EntryIcon } from '@/components/entry-icon/entry-icon'
import { JournalCard } from '@/features/notes/components/journal-card/journal-card'
import { hasDraft, journalOpen } from '@/features/notes/hooks/use-notes'
import { Charging } from '@/features/sheet/components/charging/charging'
import { Concentrating } from '@/features/sheet/components/concentration/concentrating'
import { ConditionsOpener } from '@/features/sheet/components/conditions/conditions-opener'
import { DescriptionLinks } from '@/features/sheet/components/description-actions/description-links'
import { Enchanting } from '@/features/sheet/components/enchantments/enchanting'
import { NO_MARKS } from '@/features/sheet/components/favorite-mark/constants'
import { FavoriteMarks } from '@/features/sheet/components/favorite-mark/favorite-marks'
import { NO_FAVORITING } from '@/features/sheet/components/favoriting/constants'
import { Favoriting } from '@/features/sheet/components/favoriting/favoriting'
import { Holdings } from '@/features/sheet/components/inventory-tab/holdings'
import { InventoryList } from '@/features/sheet/components/inventory-tab/inventory-list'
import { SheetText } from '@/features/sheet/components/sheet-text/sheet-text'
import { MoveStatus } from '@/features/transfers/components/move-status/move-status'
import { partyControls } from '@/features/transfers/components/party-controls/controls'
import { PartyMoveDialog } from '@/features/transfers/components/party-controls/party-controls'
import { Transferring } from '@/features/transfers/components/transferring/transferring'
import { NO_TRANSFERS } from '@/features/transfers/constants'
import { useTransfers } from '@/features/transfers/hooks/use-transfers'
import { TableApiContext } from '@/hooks/use-table-api'
import { megabytes } from '@/utils/format-amount'
import { seatWords } from '@/utils/seat-words'
import type { PartySheetProps, PartyTab } from './types'
import type { PartyMoving } from '@/features/transfers/types'
import type { TableSeat } from '@/types/character'
import type { PartyView } from '@/types/party'
import type { SeatRole } from '@/types/seats'

/*
 * A party's sheet, as dnd5e's group sheet shows it to those who may see it in Foundry (module
 * 0.30.0): its members, by name and portrait only, its stash and its description. The same core
 * is its own page and the side panel over a character's sheet, so it carries everything it reads
 * by itself, wherever it's placed: nothing in it spends, stars, ends or rolls, and its
 * descriptions load through the party's own API. From module 0.31.0, a seat that may take from it
 * takes items and coins from its stash, into the character it's given, through that character's
 * API: never a character's own Give, which it resets as it resets the rest. From module 0.32.0's
 * feedback, the seat at a character may also send its things to anyone but itself, give it the
 * character's coins, and share one of its coins among its characters, each made as that character.
 */

/** What nothing in a party's sheet does: none of a character's actions are given it. */
const NO_ACTIONS = {}

/**
 * The party's sheet: its members, then its inventory or its description, in tabs; or, where its
 * sheet isn't here, why. It renders no page around it.
 */
export function PartySheet({
  api,
  role,
  view,
  ownSheetHref,
  takeInto,
  notes = false,
}: Readonly<PartySheetProps>) {
  const seat = useMemo<TableSeat>(
    () => ({ role, api, key: `party:${view.group.id}` }),
    [role, api, view.group.id],
  )
  const transfers = useTransfers({ role })
  // Held here, not in the row, so that a dialog open stays open as its row changes, or its Take
  // goes, as when the game stops taking moves: what's sent then says why it wasn't taken. What it
  // was opened for, and with whom, is kept as it closes, as it's closed rather than removed: a
  // distribution sent after the party's members changed is refused, never shared among others
  // than the dialog said.
  const [moving, setMoving] = useState<PartyMoving>()
  const [open, setOpen] = useState(false)
  const { group } = view
  const takes = !!view.moves && !!takeInto
  // What else a seat at a character may do with it, from module 0.32.0; the Gamemaster's own
  // party page takes alone.
  const own = takeInto?.kind === 'own'
  const receivers = view.moves?.characters
  const recipients = view.moves?.send
  const sends =
    takes &&
    own &&
    !!recipients &&
    recipients.parties.length + recipients.characters.length > 0
  const among = useMemo(
    () => (takes && own ? (view.moves?.distribute ?? []) : []),
    [takes, own, view.moves?.distribute],
  )
  const gives =
    takes && own && role === 'player' ? view.moves?.give?.currency : undefined
  const { pending, take } = transfers
  const controls = useMemo(
    () =>
      takes
        ? partyControls({
            group,
            pending,
            sends,
            ...(recipients && { recipients }),
            ...(receivers && { receivers }),
            ...(gives && { gives }),
            among,
            onOpen: opened => {
              setMoving(opened)
              setOpen(true)
            },
          })
        : NO_TRANSFERS,
    [takes, group, pending, sends, recipients, receivers, gives, among],
  )
  const close = useCallback(() => setOpen(false), [])
  // A move sent closes its dialog on a Take that waits for it, which can't be given focus back:
  // where the move stands, over the stash, is given it instead. This runs after the dialog's own
  // close, which is inside this sheet, so the page behind it is no longer inert.
  const status = useRef<HTMLDivElement>(null)
  const sent = useRef(false)
  const send = useCallback<typeof take>(
    (...move) => {
      sent.current = true
      take(...move)
    },
    [take],
  )
  useEffect(() => {
    if (open || !sent.current) return
    sent.current = false
    status.current?.focus()
  }, [open])
  // Whatever it's placed in, such as a character's sheet, it's given nothing of that: from module
  // 0.37.0, no favorites either, which a party has none of.
  return (
    <TableApiContext value={seat}>
      <FavoriteMarks keys={NO_MARKS}>
        <Favoriting value={NO_FAVORITING}>
          <ConditionsOpener show={undefined}>
            <DescriptionLinks actions={undefined}>
              <Enchanting actions={NO_ACTIONS}>
                <Concentrating actions={NO_ACTIONS}>
                  <Charging actions={NO_ACTIONS}>
                    <Transferring controls={controls}>
                      {view.sheet ? (
                        <PartyContents
                          api={api}
                          role={role}
                          notes={notes}
                          view={view}
                          sheet={view.sheet}
                          ownSheetHref={ownSheetHref}
                          status={
                            <MoveStatus
                              ref={status}
                              latest={transfers.latest}
                              onDismiss={transfers.dismiss}
                            />
                          }
                          dialog={
                            takeInto && (
                              <PartyMoveDialog
                                open={open}
                                moving={moving}
                                takeInto={takeInto}
                                group={group}
                                role={role}
                                view={view}
                                onClose={close}
                                onSend={send}
                              />
                            )
                          }
                        />
                      ) : (
                        <NoPartySheet
                          api={api}
                          role={role}
                          notes={notes}
                          view={view}
                        />
                      )}
                    </Transferring>
                  </Charging>
                </Concentrating>
              </Enchanting>
            </DescriptionLinks>
          </ConditionsOpener>
        </Favoriting>
      </FavoriteMarks>
    </TableApiContext>
  )
}

const TABS: { id: PartyTab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'description', label: 'Description' },
]

function PartyContents({
  api,
  role,
  notes,
  view,
  sheet,
  ownSheetHref,
  status,
  dialog,
}: Readonly<{
  api: string
  role: SeatRole
  /** Whether its Description tab starts with the party's journal notes. */
  notes: boolean
  view: PartyView
  sheet: NonNullable<PartyView['sheet']>
  ownSheetHref?: string
  /** Where the latest move taken from it stands, over its stash. */
  status?: ReactNode
  /** The dialog a Take opens, after the tabs. */
  dialog?: ReactNode
}>) {
  // It opens on the stash; on Description where a note is being written there, or the journal is
  // open, as when either was under why there was no sheet, or before the panel was closed.
  const [tab, setTab] = useState<PartyTab>(() =>
    notes && (hasDraft(api) || journalOpen(api)) ? 'description' : 'inventory',
  )
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
                  {status}
                  {inventory.currency.length > 0 && (
                    <Holdings inventory={inventory} />
                  )}
                  {/* Without rows, nothing in it rolls or is used. */}
                  <InventoryList
                    characterId={textsKey}
                    inventory={inventory}
                    idPrefix={`${ids}-inventory`}
                  />
                </>
              ) : (
                <>
                  {notes && (
                    <JournalCard
                      kind='party'
                      look='party'
                      api={api}
                      role={role}
                      name={view.group.name}
                      active
                    />
                  )}
                  <Description
                    textsKey={textsKey}
                    hash={sheet.description}
                    name={view.group.name}
                    headingId={notes ? `${ids}-description` : undefined}
                  />
                </>
              ))}
          </div>
        ))}
      </div>
      {dialog}
    </div>
  )
}

/**
 * The party's description; under a heading of its own where the notes come before it, so the two
 * read apart.
 */
function Description({
  textsKey,
  hash,
  name,
  headingId,
}: Readonly<{
  textsKey: string
  hash: string | null
  name: string
  /** Its heading's id, where it has one. */
  headingId?: string
}>) {
  const text = hash ? (
    <SheetText characterId={textsKey} hash={hash} origin={{ name }} />
  ) : (
    <p className='text-sm text-text-secondary'>No description.</p>
  )
  if (!headingId) return text
  return (
    <section aria-labelledby={headingId} className='flex flex-col gap-2'>
      <h2 id={headingId} className='text-sm font-semibold'>
        Description
      </h2>
      {text}
    </section>
  )
}

/**
 * Why there's no sheet to show: no one may see it, it's too large, or it's on its way; and under
 * it the party's journal notes, which need no sheet.
 */
function NoPartySheet({
  api,
  role,
  notes,
  view,
}: Readonly<{
  api: string
  role: SeatRole
  notes: boolean
  view: PartyView
}>) {
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
  const why = (
    <EmptyState icon={Users} title={title}>
      {body}
    </EmptyState>
  )
  if (!notes) return why
  return (
    <div className='flex flex-col gap-2'>
      {why}
      <JournalCard
        kind='party'
        look='party'
        api={api}
        role={role}
        name={name}
        active
      />
    </div>
  )
}
