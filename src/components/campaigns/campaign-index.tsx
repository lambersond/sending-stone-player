'use client'

import {
  createContext,
  Fragment,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { byId, campaignHeadingId } from './campaign-ids'
import { CampaignRow, type CampaignRowData } from './campaign-row'
import { PageToasts } from '@/components/page-toast'
import { SearchField } from '@/components/search-field'
import { CAMPAIGN_SEARCH_FROM, CAMPAIGNS_PATH } from '@/constants/campaign'
import { matchesSearch } from '@/utils/search'

// The Gamemaster's campaigns page (round 0.39.0, the design's option A): their campaigns as a
// list, those that need them first, and the chosen one's page beside it on a wide screen, or in its
// place on a phone, with All campaigns to go back. The chosen campaign is the address's
// `?campaign=<id>`, so a reload or a link reopens it, and on a phone Back returns to the list.

/**
 * From how wide the index shows a campaign beside its list, in CSS pixels: the width of the index
 * itself, as its CSS's `@min-[900px]/index` reads it, so the script and the CSS agree.
 */
export const INDEX_WIDE = 900

/** Finds where focus goes next, once it's there. */
type Find = () => HTMLElement | null | undefined

type CampaignChoice = {
  /** The campaign the address chooses, where it's one of the list. */
  chosen?: string
  /** Shows a campaign, as its row does: beside the list when wide, in its place on a phone. */
  choose: (id: string) => void
  /**
   * Where focus goes once the dialog acting has closed and the page has what the action changed,
   * as the page behind an open dialog is inert: the page's heading after Delete, a character's
   * sheet link after Remove.
   */
  focusNext: (find: Find) => void
}

/** Nothing chosen, nothing to choose: anywhere outside the index, as a lone campaign's page. */
const NO_CHOICE: CampaignChoice = {
  choose: () => {},
  focusNext: () => {},
}

const CampaignChoiceContext = createContext<CampaignChoice>(NO_CHOICE)

/** The index's choice of campaign, for what's drawn inside it: its head and each campaign page. */
export function useCampaignChoice(): CampaignChoice {
  return use(CampaignChoiceContext)
}

/** A campaign's address on the page. */
const addressOf = (id: string) =>
  `${CAMPAIGNS_PATH}?campaign=${encodeURIComponent(id)}`

/** Whether a dialog is open, behind which the page is inert. */
const dialogOpen = () => document.querySelector('dialog[open]') !== null

type Props = {
  /** Each campaign's row, in the page's order. */
  rows: CampaignRowData[]
  /** Each campaign's page by its id, drawn on the server. */
  details: Record<string, ReactNode>
  /** The campaign the page was first drawn showing: the one chosen, else the first in order. */
  first?: string
  /** The page's head: its heading, what it's for, and its buttons. */
  head: ReactNode
}

/**
 * The index of the Gamemaster's campaigns and the campaign shown. The server draws the list and
 * the page of the campaign shown, and the CSS decides what shows at each width: on a phone the
 * list, or with a campaign chosen its page alone; from 900 px of the index both, side by side, so
 * nothing waits on the browser's width to draw. With none chosen, the campaign shown is the first
 * in order as the page was first drawn, kept through every refresh that re-sorts the list: only a
 * row, New campaign, All campaigns, Back or Forward, or that campaign gone, changes it.
 */
export function CampaignIndex({ rows, details, first, head }: Readonly<Props>) {
  const root = useRef<HTMLDivElement>(null)
  // The campaign the address chooses: one, and one of the list, as the server read it too.
  const asked = useSearchParams().getAll('campaign')
  const one = asked.length === 1 ? asked[0] : undefined
  const chosen =
    one !== undefined && rows.some(({ id }) => id === one) ? one : undefined

  // The campaign shown: the one chosen; else the one kept, the first view's or the last chosen;
  // else, once that one is gone, the first in order, kept from then on.
  const [kept, setKept] = useState(first)
  const shown =
    chosen ??
    (kept !== undefined && rows.some(({ id }) => id === kept)
      ? kept
      : rows[0]?.id)
  if (shown !== kept) setKept(shown)

  // Whether the index is wide enough for the list and a campaign side by side, as its CSS has it:
  // unknown until the browser has measured it, as on the server.
  const [wide, setWide] = useState<boolean>()
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= INDEX_WIDE)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Whether this page added the address's entry, as a phone's tap does: All campaigns then goes
  // back to the list's, rather than adding another.
  const pushed = useRef(false)

  // Where focus goes next, and when: once no dialog is open, as the page behind one is inert, and
  // what it finds is there. Tried after each render, as the refreshed page or the address arrives,
  // and as a dialog closes, after the browser has given focus back to what opened it.
  const next = useRef<Find>(undefined)
  // The campaign chosen as this render shows it, for what waits on the address to show.
  const shows = useRef(chosen)
  useLayoutEffect(() => {
    shows.current = chosen
  })
  const applyNext = useCallback(() => {
    const find = next.current
    if (!find || dialogOpen()) return
    const target = find()
    if (!target) return
    next.current = undefined
    target.focus()
  }, [])
  useLayoutEffect(applyNext)
  useEffect(() => {
    document.addEventListener('close', applyNext, true)
    return () => document.removeEventListener('close', applyNext, true)
  }, [applyNext])

  /** Focus to a campaign's row, once the list shows again. */
  const toRow = useCallback(
    (id: string): Find =>
      () =>
        shows.current === undefined
          ? [
              ...(root.current?.querySelectorAll<HTMLElement>(
                '[data-campaign]',
              ) ?? []),
            ].find(row => row.dataset.campaign === id)
          : undefined,
    [],
  )

  // An address naming no campaign of the list, such as one since deleted, or more than one, is
  // dropped.
  const naming = asked.length > 0
  useEffect(() => {
    if (!naming || chosen !== undefined) return
    globalThis.history.replaceState(undefined, '', CAMPAIGNS_PATH)
    pushed.current = false
  }, [naming, chosen])

  // The browser's Back or Forward: the entry this page added is left behind, and on a phone, back
  // at the list, focus returns to the row of the campaign left.
  useEffect(() => {
    const popped = () => {
      pushed.current = false
      const now = new URLSearchParams(globalThis.location.search).get(
        'campaign',
      )
      if (wide !== true && chosen !== undefined && now === null) {
        next.current = toRow(chosen)
      }
    }
    globalThis.addEventListener('popstate', popped)
    return () => globalThis.removeEventListener('popstate', popped)
  }, [wide, chosen, toRow])

  const choose = useCallback(
    (id: string) => {
      // Wide, choosing another replaces the address, so Back leaves the page rather than stepping
      // through campaigns, and focus stays where it is, on the row.
      if (wide === true) {
        globalThis.history.replaceState(undefined, '', addressOf(id))
        return
      }
      // On a phone, its page in place of the list, from its top, its heading focused once it shows.
      globalThis.history.pushState(undefined, '', addressOf(id))
      pushed.current = true
      next.current = () =>
        shows.current === id ? byId(campaignHeadingId(id)) : undefined
      globalThis.scrollTo({ top: 0 })
    },
    [wide],
  )

  const allCampaigns = () => {
    if (chosen === undefined) return
    next.current = toRow(chosen)
    if (pushed.current) {
      globalThis.history.back()
    } else {
      globalThis.history.replaceState(undefined, '', CAMPAIGNS_PATH)
    }
  }

  const focusNext = useCallback((find: Find) => {
    next.current = find
  }, [])

  const choice = useMemo(
    () => ({ chosen, choose, focusNext }),
    [chosen, choose, focusNext],
  )

  return (
    <PageToasts>
      <CampaignChoiceContext value={choice}>
        <div
          ref={root}
          className='@container/index flex min-w-0 flex-col gap-5'
        >
          {head}
          {rows.length > 0 ? (
            <div className='grid min-w-0 gap-4 @min-[900px]/index:grid-cols-[340px_minmax(0,1fr)] @min-[900px]/index:items-start'>
              <CampaignList
                rows={rows}
                // Marked current only once the page knows it's wide, as only there is it beside
                // the list.
                current={wide === true ? shown : undefined}
                hidden={chosen !== undefined}
                choose={choose}
              />
              <div
                className={clsx(
                  'min-w-0 flex-col gap-4',
                  chosen === undefined
                    ? 'hidden @min-[900px]/index:flex'
                    : 'flex',
                )}
              >
                {chosen !== undefined && (
                  <button
                    type='button'
                    onClick={allCampaigns}
                    className='inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary @min-[900px]/index:hidden'
                  >
                    <ChevronLeft aria-hidden className='size-4' />
                    All campaigns
                  </button>
                )}
                {/* By its id, so that nothing of one campaign's page, a line saying it saved or a
                    section opened, carries to another's. */}
                {shown !== undefined && (
                  <Fragment key={shown}>{details[shown]}</Fragment>
                )}
              </div>
            </div>
          ) : (
            <p className='rounded-2xl border border-dashed border-border p-8 text-center text-text-secondary'>
              You haven&apos;t set up a campaign yet. Use <em>New campaign</em>{' '}
              to set one up, then connect Foundry to it.
            </p>
          )}
        </div>
      </CampaignChoiceContext>
    </PageToasts>
  )
}

/**
 * The list of campaigns: a search from seven of them, by title and world, then those that need
 * their Gamemaster under Needs you, and the rest under Campaigns, labelled only where any needs
 * them, as the search leaves them. Beside a campaign on a wide screen it stays in view as the page
 * scrolls, scrolling itself where it's taller than the screen. Hidden on a phone while a campaign
 * is chosen.
 */
function CampaignList({
  rows,
  current,
  hidden,
  choose,
}: Readonly<{
  rows: CampaignRowData[]
  current?: string
  hidden: boolean
  choose: (id: string) => void
}>) {
  const [query, setQuery] = useState('')
  const searchable = rows.length >= CAMPAIGN_SEARCH_FROM
  // Only while the search shows, so that a list grown shorter isn't left filtered with no way back.
  const typed = searchable ? query.trim() : ''
  const shown = rows.filter(({ title, worldTitle }) =>
    matchesSearch([title, worldTitle ?? ''], typed),
  )
  const needs = shown.filter(({ flag }) => flag !== undefined)
  const rest = shown.filter(({ flag }) => flag === undefined)

  const group = (
    key: string,
    label: string,
    list: CampaignRowData[],
    visible: boolean,
  ) => (
    <Fragment key={key}>
      <h2
        id={`campaigns-${key}`}
        className={clsx(
          visible
            ? 'mt-2 px-0.5 text-[11px] font-bold tracking-[0.06em] text-text-secondary uppercase'
            : 'sr-only',
        )}
      >
        {label}
      </h2>
      <ul aria-labelledby={`campaigns-${key}`} className='grid gap-2'>
        {list.map(row => (
          <li key={row.id}>
            <CampaignRow
              row={row}
              current={row.id === current}
              onChoose={() => choose(row.id)}
            />
          </li>
        ))}
      </ul>
    </Fragment>
  )

  return (
    <div
      className={clsx(
        // Sticky beside a long campaign, and never taller than the screen, so its last rows stay
        // in reach; a little padding keeps the rows' focus rings inside its scrolling box.
        '-m-1 min-w-0 flex-col gap-2 p-1 @min-[900px]/index:sticky @min-[900px]/index:top-4 @min-[900px]/index:max-h-[calc(100dvh-2rem)] @min-[900px]/index:overflow-y-auto',
        hidden ? 'hidden @min-[900px]/index:flex' : 'flex',
      )}
    >
      {searchable && (
        <>
          <SearchField
            value={query}
            onChange={setQuery}
            label='Find a campaign'
            placeholder='Find a campaign'
          />
          <p role='status' className='sr-only'>
            {typed && countWords(shown.length)}
          </p>
        </>
      )}
      {needs.length > 0 && group('needs', 'Needs you', needs, true)}
      {rest.length > 0 && group('rest', 'Campaigns', rest, needs.length > 0)}
      {shown.length === 0 && (
        <p className='rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-secondary'>
          No campaign matches “{typed}”.
        </p>
      )}
    </div>
  )
}

/** How many campaigns the search shows, as its status line says it. */
const countWords = (count: number) =>
  count === 1 ? '1 campaign shown' : `${count} campaigns shown`
