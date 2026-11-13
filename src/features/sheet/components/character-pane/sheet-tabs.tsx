'use client'

import { type ComponentProps, type ReactNode } from 'react'
import clsx from 'clsx'
import { SheetSettings } from '../sheet-settings/sheet-settings'
import { RollsButton } from '@/features/rolling/components/rolls-button/rolls-button'
import { SHEET_TABS_ROW } from '@/features/sheet/constants'
import type { SheetTab, TabEntry } from './types'
import type { SheetSettingsProps } from '../sheet-settings/types'

/**
 * The sheet's row of tabs. A container, so the tabs show only their icons, but for the chosen one,
 * where all their labels don't fit; the settings' cog after them, at the end of the row, and the
 * rolls' button before it where they pop up as toasts (`rolls`). No gap before them, as their
 * margin and their own padding keep them apart: a caster's seven tabs, with a condition's dot on
 * Effects, take 301 pixels, of the 302 beside both on a 390-pixel screen. Narrower, the tabs and
 * the buttons are a little tighter, so that they take 277 of the 280 on a 360-pixel one; narrower
 * still, the tabs scroll. From `sm` (v0.44), a finger wide on a tablet: the icons, the rolls'
 * button and the cog are 44-pixel squares, in a row 48 pixels tall; where the labels show, the
 * tabs are compact again.
 * @param conditions - How many conditions the character has, which Effects' dot says.
 * @param cookbookModal - The player's Magical Recipe Book, beside the cog, never in its settings,
 *   which close as it opens.
 */
export function SheetTabs({
  rowRef,
  tabs,
  tab,
  idPrefix,
  conditions,
  onShow,
  rolls,
  settings,
  cookbookModal,
}: Readonly<{
  rowRef: (row: HTMLDivElement | null) => void
  tabs: TabEntry[]
  tab: SheetTab
  idPrefix: string
  conditions: number
  onShow: (tab: SheetTab) => void
  rolls?: ComponentProps<typeof RollsButton>
  settings: SheetSettingsProps
  cookbookModal: ReactNode
}>) {
  return (
    <div ref={rowRef} className={clsx('@container', SHEET_TABS_ROW)}>
      <div
        role='tablist'
        aria-label='Character sheet'
        className='flex min-w-0 gap-0.5 overflow-x-auto @3xl:gap-1'
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`${idPrefix}sheet-tab-${id}`}
            type='button'
            role='tab'
            title={label}
            aria-selected={tab === id}
            aria-controls={`${idPrefix}sheet-panel`}
            onClick={() => onShow(id)}
            className={clsx(
              'flex shrink-0 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors',
              // From sm, 44-pixel icons while the row has no room for their labels.
              'sm:@max-3xl:min-h-11 sm:@max-3xl:min-w-11',
              // Seven tabs' icons, Effects' dot, the chosen one's label, the rolls' button and
              // the settings' cog fit a 360-pixel screen; on a narrower one the tabs scroll.
              // Tighter under 366 pixels inside the row's padding, a screen under 390.
              tab === id ? 'px-2' : 'px-1.5 @max-[366px]:px-1 @3xl:px-2',
              tab === id
                ? 'bg-primary/10 text-primary-text'
                : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
            )}
          >
            <Icon aria-hidden className='size-4' />
            <span className={clsx(tab !== id && 'sr-only @3xl:not-sr-only')}>
              {label}
            </span>
            {id === 'effects' && conditions > 0 && (
              <span className='size-1.5 rounded-full bg-ruby'>
                <span className='sr-only'>
                  ,{' '}
                  {conditions === 1
                    ? '1 condition'
                    : `${conditions} conditions`}
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className='ml-auto flex shrink-0 items-center'>
        {rolls && <RollsButton {...rolls} />}
        <SheetSettings {...settings} />
        {cookbookModal}
      </div>
    </div>
  )
}
