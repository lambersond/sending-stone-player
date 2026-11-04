import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { byId, campaignHeadingId } from '../utils/campaign-ids'
import { CAMPAIGNS_PATH } from '@/constants/campaign'
import { INDEX_WIDE } from '@/features/campaigns/components/campaign-index/constants'
import type { CampaignRowData, Find } from '@/features/campaigns/types'

/** A campaign's address on the page. */
const addressOf = (id: string) =>
  `${CAMPAIGNS_PATH}?campaign=${encodeURIComponent(id)}`

/** Whether a dialog is open, behind which the page is inert. */
const dialogOpen = () => document.querySelector('dialog[open]') !== null

/**
 * The index's choice of campaign and where focus goes: the campaign the address chooses, the one
 * shown, whether the index is wide enough for the list and a campaign side by side, and the way
 * each choice is made, kept in the address so a reload or Back reopens it.
 * @param rows - Each campaign's row, in the page's order.
 * @param first - The campaign the page was first drawn showing.
 */
export function useCampaignIndexNav(rows: CampaignRowData[], first?: string) {
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

  return { root, chosen, shown, wide, choose, allCampaigns, choice }
}
