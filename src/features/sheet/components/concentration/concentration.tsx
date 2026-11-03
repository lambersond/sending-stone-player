'use client'

import { endLabel, ASKED } from './concentration-chip'
import { useConcentrating } from './use-concentrating'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import type { SheetConcentrationEffect } from '@/types/sending-stone'

/*
 * The character's concentrations, as dnd5e keeps them, from module 0.29.0: each ended from the
 * sheet, once the player says so, as dnd5e's Break Concentration ends it, with what depends on it,
 * such as Bless on their allies. Nothing goes to the game's chat, as dnd5e posts nothing.
 */

/**
 * A button that ends a concentration once the player says so; nothing while the game doesn't take
 * it from here.
 */
export function EndConcentrationButton({
  effect,
}: Readonly<{ effect: SheetConcentrationEffect }>) {
  const { end } = useConcentrating()
  if (!end) return
  return (
    <ConfirmDialog
      trigger='End'
      triggerLabel={endLabel(effect)}
      triggerClassName='shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/5'
      title={`${endLabel(effect)}?`}
      confirmLabel={ASKED.confirmLabel}
      cancelLabel={ASKED.cancelLabel}
      onConfirm={async () => {
        end(effect)
      }}
    >
      <p>{ASKED.body}</p>
    </ConfirmDialog>
  )
}
