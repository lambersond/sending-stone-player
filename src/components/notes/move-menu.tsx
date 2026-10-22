'use client'

import { Fragment, useId, useRef, useState } from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
} from '@floating-ui/react'
import clsx from 'clsx'
import { Check, ChevronDown, FolderInput, LoaderCircle } from 'lucide-react'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'

type Props = {
  entry: NoteEntryView
  /** The book's chapters, oldest first. */
  chapters: NoteChapterView[]
  /** The move is on its way: its button is off, with a spinner. */
  busy: boolean
  /** The card's labelled button, "Move to chapter"; else the note bar's icon button. */
  labelled?: boolean
  onMove: (chapterId: string | null) => void
}

/**
 * Move to a chapter (round 0.35.0 §9.3): a menu of the book's chapters, oldest first, and No
 * chapter for a note in one, the note's own place checked and off. It opens inside the dialog it's
 * in, over its edges, as the inventory's menus do, and Escape closes it alone, giving focus back
 * to its button. The move is the change Edit's Chapter field sends, so the caller offers it only
 * where Edit is. Nothing where the book has no chapter.
 */
export function MoveMenu({
  entry,
  chapters,
  busy,
  labelled = false,
  onMove,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  // eslint-disable-next-line unicorn/no-null -- floating-ui marks no active item with null
  const [active, setActive] = useState<number | null>(null)
  const list = useRef<(HTMLElement | null)[]>([])
  const menuId = useId()
  const root = usePortalRoot()
  useTopmostEscape(open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // No taller than the room on the side it's on, its chapters scrolled inside it: a journal
      // may hold fifty.
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`
        },
      }),
    ],
  })
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [
      useClick(context),
      useDismiss(context),
      useListNavigation(context, {
        listRef: list,
        activeIndex: active,
        onNavigate: setActive,
        loop: true,
      }),
    ],
  )
  if (chapters.length === 0) return

  const choices = [
    ...chapters.map(chapter => ({ id: chapter.id, title: chapter.title })),
    // eslint-disable-next-line unicorn/no-null -- out of its chapter, into none
    ...(entry.chapterId === null ? [] : [{ id: null, title: 'No chapter' }]),
  ]
  // The first that can be chosen takes focus as the menu opens: its own place can't be.
  const first = Math.max(
    0,
    choices.findIndex(choice => choice.id !== entry.chapterId),
  )
  const icon = busy ? (
    <LoaderCircle aria-hidden className='size-5 motion-safe:animate-spin' />
  ) : (
    <FolderInput aria-hidden className='size-5' />
  )
  const button = {
    ref: refs.setReference,
    type: 'button' as const,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    disabled: busy,
    ...getReferenceProps(),
  }

  return (
    <>
      {labelled ? (
        <button
          {...button}
          className='relative z-10 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
        >
          {icon}
          Move to chapter
          <ChevronDown aria-hidden className='size-4 text-text-secondary' />
        </button>
      ) : (
        <button
          {...button}
          aria-label={`Move ${entry.title} to a chapter`}
          title='Move to a chapter'
          className='flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary disabled:opacity-60'
        >
          {icon}
        </button>
      )}
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager
            context={context}
            initialFocus={0}
            modal={false}
          >
            <div
              ref={refs.setFloating}
              id={menuId}
              role='menu'
              aria-label='Move to'
              style={floatingStyles}
              className='z-50 flex w-64 max-w-[calc(100vw-1rem)] flex-col overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1.5 text-text-primary shadow-xl outline-none'
              {...getFloatingProps()}
            >
              <p
                aria-hidden
                className='shrink-0 px-2.5 pt-1 pb-1.5 text-xs font-semibold text-text-secondary'
              >
                Move to
              </p>
              {choices.map((choice, index) => {
                const here = choice.id === entry.chapterId
                return (
                  <Fragment key={choice.id ?? ''}>
                    {choice.id === null && (
                      <div
                        role='separator'
                        className='my-1 shrink-0 border-t border-border'
                      />
                    )}
                    <button
                      type='button'
                      role='menuitemradio'
                      aria-checked={here}
                      disabled={here}
                      ref={node => {
                        list.current[index] = node
                      }}
                      tabIndex={(active ?? first) === index ? 0 : -1}
                      className={clsx(
                        'flex min-h-11 w-full shrink-0 items-center gap-2 rounded-lg px-2.5 text-left text-sm outline-none',
                        here ? 'text-text-secondary' : 'font-medium',
                        active === index && 'bg-primary/10',
                      )}
                      {...getItemProps({
                        onClick: () => {
                          setOpen(false)
                          onMove(choice.id)
                        },
                      })}
                    >
                      <span className='min-w-0 flex-1 break-words'>
                        {choice.title}
                      </span>
                      {here && (
                        <Check aria-hidden className='size-4 shrink-0' />
                      )}
                    </button>
                  </Fragment>
                )
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
