'use client'

import { Fragment, useState } from 'react'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { CampaignRow } from '../campaign-row/campaign-row'
import {
  INDEX_BESIDE,
  INDEX_CAMPAIGN,
  INDEX_GRID,
  INDEX_LIST,
  INDEX_ROOT,
} from './constants'
import { countWords } from './utils'
import { SearchField } from '@/components/search-field/search-field'
import { CAMPAIGN_SEARCH_FROM } from '@/constants/campaign'
import { PageToasts } from '@/features/campaigns/components/page-toast/page-toast'
import { CampaignChoiceContext } from '@/features/campaigns/hooks/use-campaign-choice'
import { useCampaignIndexNav } from '@/features/campaigns/hooks/use-campaign-index-nav'
import { matchesSearch } from '@/utils/search'
import type { CampaignIndexProps } from './types'
import type { CampaignRowData } from '@/features/campaigns/types'

// The Gamemaster's campaigns page (round 0.39.0, the design's option A): their campaigns as a
// list, those that need them first, and the chosen one's page beside it on a wide screen, or in its
// place on a phone, with All campaigns to go back. The chosen campaign is the address's
// `?campaign=<id>`, so a reload or a link reopens it, and on a phone Back returns to the list.

/**
 * The index of the Gamemaster's campaigns and the campaign shown. The server draws the list and
 * the page of the campaign shown, and the CSS decides what shows at each width: on a phone the
 * list, or with a campaign chosen its page alone; from 900 px of the index both, side by side, so
 * nothing waits on the browser's width to draw. With none chosen, the campaign shown is the first
 * in order as the page was first drawn, kept through every refresh that re-sorts the list: only a
 * row, New campaign, All campaigns, Back or Forward, or that campaign gone, changes it.
 */
export function CampaignIndex({
  rows,
  details,
  first,
  head,
}: Readonly<CampaignIndexProps>) {
  const { root, chosen, shown, wide, choose, allCampaigns, choice } =
    useCampaignIndexNav(rows, first)

  return (
    <PageToasts>
      <CampaignChoiceContext value={choice}>
        <div ref={root} className={INDEX_ROOT}>
          {head}
          {rows.length > 0 ? (
            <div className={INDEX_GRID}>
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
                  INDEX_CAMPAIGN,
                  chosen === undefined ? INDEX_BESIDE : 'flex',
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
        INDEX_LIST,
        '-m-1 p-1 @min-[900px]/index:sticky @min-[900px]/index:top-4 @min-[900px]/index:max-h-[calc(100dvh-2rem)] @min-[900px]/index:overflow-y-auto',
        hidden ? INDEX_BESIDE : 'flex',
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
