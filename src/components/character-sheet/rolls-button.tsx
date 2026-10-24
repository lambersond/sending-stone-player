'use client'

import { useCallback, useId, useState } from 'react'
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
  useRole,
} from '@floating-ui/react'
import { History } from 'lucide-react'
import {
  DamageDue,
  offersDamage,
  RollHistory,
  rollsName,
  type TableRolls,
} from './roll-tray'
import { InPortalRoot, usePortalRoot } from '@/components/modal'
import { useCreature } from '@/hooks/use-creature'
import { needsPlayer } from '@/hooks/use-table-rolls'
import type { LocalRoll } from '@/hooks/use-sheet-roller'

/**
 * The player's rolls, behind a button beside the settings' cog, where they pop up as toasts rather
 * than staying in the banner: what the banner would hold, the latest in full with the damage it
 * waits for, the earlier ones, and whether they reach the table, so that nothing the banner offers
 * is lost. A dot on the button says while a roll's damage waits for the player, as one whose
 * toast they closed; and each such roll's damage is to roll here, even once other rolls follow it,
 * as the banner offers only the latest's (`offersDamage`). An attack that missed doesn't wait
 * (`needsPlayer`): its damage is offered as the banner offers it, while it's the latest, and from
 * its row. It opens and closes as the cog's settings do; menus and dialogs opened from it open
 * inside it, so that choosing from one, or Escape on one, closes only that. Never inside a dialog
 * itself, it leaves Escape to the browser, for that dialog to close on it.
 */
export function RollsButton({
  rolls,
  rolling,
  table,
}: Readonly<{ rolls: LocalRoll[]; rolling: boolean; table: TableRolls }>) {
  const [open, setOpen] = useState(false)
  const title = useId()
  const root = usePortalRoot()
  // A creature's own, at its pane (module 0.36.0).
  const named = rollsName(useCreature())
  // eslint-disable-next-line unicorn/no-null -- floating-ui waits for a root that's null
  const [inside, setInside] = useState<HTMLDivElement | null>(null)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next, _, reason) => {
      // Escape on the damage menu, or the dialog that changes the damage, opened inside closes
      // only that.
      if (
        reason === 'escape-key' &&
        inside?.querySelector('[role=menu], dialog[open]')
      ) {
        return
      }
      setOpen(next)
    },
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // No taller than the room below the button, as on a phone turned sideways; it scrolls inside.
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`
        },
      }),
    ],
  })
  // The popover, which is also where menus and dialogs opened from it go.
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node)
      setInside(node)
    },
    [refs],
  )
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    // On to the damage menu's own Escape, where focus isn't in it, and the dialog's, which the
    // browser closes on Escape as the key goes past.
    useDismiss(context, { bubbles: { escapeKey: true } }),
    useRole(context, { role: 'dialog' }),
  ])
  const waiting = rolls.filter(roll =>
    needsPlayer(roll, table.states.get(roll.id)),
  )
  // Those the latest roll in full doesn't offer: those before it, and it too while dice roll, as
  // they then show in its place. Where the latest is one of the Gamemaster's as the character
  // (#156), the player's own latest's is offered beneath it.
  const offered = rolling ? undefined : offersDamage(rolls)
  const earlier = waiting.filter(roll => roll !== offered)
  return (
    <>
      {/* Named by what it shows, rather than an aria-label, so that the dot is said too. */}
      <button
        ref={refs.setReference}
        type='button'
        title={named}
        className='relative rounded-lg p-2 text-text-secondary transition-colors @max-[366px]:p-1.5 hover:bg-primary/5 hover:text-text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary'
        {...getReferenceProps()}
      >
        <History aria-hidden className='size-4' />
        <span className='sr-only'>{named}</span>
        {waiting.length > 0 && (
          <span className='absolute top-1 right-1 size-1.5 rounded-full bg-primary'>
            <span className='sr-only'>, damage to roll</span>
          </span>
        )}
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager context={context} modal={false}>
            {/* Its content scrolls, not it, so that a menu opened inside may reach past it. Over
                the rolls' toasts, which are 100001 and start just below the button, as it does. */}
            <div
              ref={attach}
              style={floatingStyles}
              aria-labelledby={title}
              className='z-[100002] flex w-96 max-w-[calc(100vw-1rem)] flex-col rounded-xl border border-border bg-card text-text-primary shadow-xl outline-none'
              {...getFloatingProps()}
            >
              <div className='flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-3'>
                <p
                  id={title}
                  className='text-xs font-semibold text-text-secondary'
                >
                  {named}
                </p>
                <InPortalRoot root={inside}>
                  {/* Named each by its roll, as their buttons all say "Roll damage". */}
                  {earlier.length > 0 && (
                    <div className='flex flex-col gap-2 border-b border-border pb-2'>
                      {earlier.map(roll => (
                        <div
                          key={roll.id}
                          role='group'
                          aria-labelledby={`${title}-${roll.id}`}
                        >
                          <p
                            id={`${title}-${roll.id}`}
                            className='truncate text-sm font-semibold'
                          >
                            {roll.label}
                          </p>
                          <DamageDue
                            roll={roll}
                            state={table.states.get(roll.id)}
                            onRollDamage={table.rollDamage}
                            modifies={table.modifies}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <RollHistory
                    rolls={rolls}
                    rolling={rolling}
                    table={table}
                    announce={false}
                  />
                </InPortalRoot>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
