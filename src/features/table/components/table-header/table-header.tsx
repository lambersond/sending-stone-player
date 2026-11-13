'use client'

import clsx from 'clsx'
import { ArrowLeft, CircleQuestionMark, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { FullscreenButton } from '@/components/fullscreen-button/fullscreen-button'
import { LiveStatus } from '@/components/live-status/live-status'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import {
  HEADER_ICON_BUTTON,
  ICON_TARGET,
  TABLE_HEADER_BUTTON,
} from '@/constants/buttons'
import { DeleteCharacterWarning } from '@/features/characters/components/character-list/delete-character-warning'
import { HELP_TITLE } from '@/features/help/constants'
import { GM_PILL } from '@/features/table/constants'
import {
  campaignAndGame,
  headerLine,
  liveState,
  subtitle,
} from '@/features/table/utils/header'
import type { ShowHelp } from '@/features/help/types'
import type { Tab } from '@/features/table/types'
import type { Character } from '@/types/character'
import type { Connection, TableView } from '@/types/table'
import type { Ref } from 'react'

/**
 * The table's header: back to the character's campaigns or characters; its name, with the GM pill
 * at the Gamemaster's seat (#156), and what's happening in the tab shown; the live state, Help
 * (ROADMAP item 12), full screen, and for its player, a way to delete it.
 * @param ref - The header, which the sheet's roll toasts start below while its tabs aren't shown.
 * @param playing - Whether the character plays one of its campaign's characters.
 * @param onHelp - Opens Help, focus coming back to its button once it closes.
 */
export function TableHeader({
  ref,
  character,
  gm,
  playing,
  view,
  tab,
  connection,
  onHelp,
  deleteCharacter,
}: Readonly<{
  ref: Ref<HTMLElement>
  character: Character
  gm: boolean
  playing: boolean
  view: TableView
  tab: Tab
  connection: Connection
  onHelp: ShowHelp
  deleteCharacter?: () => Promise<void>
}>) {
  return (
    <header
      ref={ref}
      className='flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8'
    >
      <div className='flex min-w-0 items-center gap-2'>
        <Link
          // Back to the campaign it was opened from, chosen on the campaigns page (round
          // 0.39.0).
          href={
            gm
              ? `/campaigns?campaign=${encodeURIComponent(character.campaignId ?? '')}`
              : '/characters'
          }
          aria-label={gm ? 'Your campaigns' : 'All characters'}
          className={`-ml-1.5 sm:-ml-3 ${HEADER_ICON_BUTTON}`}
        >
          <ArrowLeft aria-hidden className='size-5' />
        </Link>
        <div className='min-w-0'>
          {/* On a wide screen, the class and subclass follow the name, cut short before it
            is. Narrower, the line under the name has them, on the Character tab. */}
          <div className='flex items-baseline gap-2 overflow-hidden'>
            {gm ? (
              // The name and its GM pill stand where the name alone does, and only the name
              // is cut short, so a long one on a phone never pushes the pill out of view.
              <div className='flex max-w-full shrink-0 items-baseline gap-2'>
                <h1 className='min-w-0 truncate text-lg leading-tight font-semibold'>
                  {character.name}
                </h1>
                <span className={GM_PILL}>
                  GM<span className='sr-only'>, Gamemaster view</span>
                </span>
              </div>
            ) : (
              <h1 className='max-w-full shrink-0 truncate text-lg leading-tight font-semibold'>
                {character.name}
              </h1>
            )}
            {playing && view.sheet && (
              <p className='hidden min-w-0 truncate text-sm text-text-secondary lg:block'>
                {headerLine(view.sheet)}
              </p>
            )}
          </div>
          <p
            className={clsx(
              'truncate text-sm text-text-secondary',
              playing && 'lg:hidden',
            )}
          >
            {subtitle(tab, view, character)}
          </p>
          {playing && (
            <p className='hidden truncate text-sm text-text-secondary lg:block'>
              {campaignAndGame(view, character)}
            </p>
          )}
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <LiveStatus state={liveState(playing, view, connection)} />
        <button
          type='button'
          aria-label={HELP_TITLE}
          title={HELP_TITLE}
          aria-haspopup='dialog'
          onClick={event => onHelp(event.currentTarget)}
          className={TABLE_HEADER_BUTTON}
        >
          <CircleQuestionMark aria-hidden className='size-4' />
        </button>
        <FullscreenButton />
        {!gm && deleteCharacter && (
          <ConfirmDialog
            trigger={<Trash2 aria-hidden className='size-4' />}
            triggerLabel={`Delete ${character.name}`}
            triggerClassName={`${ICON_TARGET} rounded-lg p-2 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger`}
            title={`Delete ${character.name}?`}
            confirmLabel='Delete'
            onConfirm={deleteCharacter}
            danger
          >
            <DeleteCharacterWarning name={character.name} />
          </ConfirmDialog>
        )}
      </div>
    </header>
  )
}
