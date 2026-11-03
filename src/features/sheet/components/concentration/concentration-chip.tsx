'use client'

import { useState, type ReactNode } from 'react'
import { CircleOff } from 'lucide-react'
import { ChoiceMenu } from '../../../rolling/components/roll-menu/choice-menu'
import { useConcentrating } from './use-concentrating'
import { ConfirmModal } from '@/components/modal/confirm-modal'
import type { SheetConcentrationEffect } from '@/types/sending-stone'

/** What ending a concentration asks, and says it does. */
export const ASKED = {
  confirmLabel: 'End',
  cancelLabel: 'Keep',
  body: 'What it keeps up on your allies ends too.',
}

/** What ending one is called, as its button and menu item are: "End concentration on Bless". */
export function endLabel(effect: SheetConcentrationEffect): string {
  return `End concentration on ${effect.name}`
}

/**
 * The Concentrating chip among the header's conditions, while the game takes ending a
 * concentration from here: a tap with one concentration asks to end it; with more, it offers a menu
 * of them, each asking to end it. Without any to end, it's the chip it always was, as `fallback`.
 * @param fallback - The chip as it is otherwise, which opens the condition's place in Effects.
 */
export function ConcentrationChip({
  className,
  children,
  fallback,
}: Readonly<{
  className: string
  /** What the chip shows: its icon, its name and what's concentrated on. */
  children: ReactNode
  fallback: ReactNode
}>) {
  const { effects = [], end } = useConcentrating()
  const [menu, setMenu] = useState<HTMLElement>()
  const [asked, setAsked] = useState<SheetConcentrationEffect>()
  if (!end || effects.length === 0) return fallback
  const confirm = (effect?: SheetConcentrationEffect) => (
    <ConfirmModal
      open={effect !== undefined}
      onClose={() => setAsked(undefined)}
      title={effect ? `${endLabel(effect)}?` : ''}
      confirmLabel={ASKED.confirmLabel}
      cancelLabel={ASKED.cancelLabel}
      onConfirm={async () => {
        if (effect) end(effect)
      }}
    >
      <p>{ASKED.body}</p>
    </ConfirmModal>
  )
  if (effects.length === 1) {
    const [effect] = effects
    return (
      <>
        <button
          type='button'
          aria-haspopup='dialog'
          onClick={() => setAsked(effect)}
          className={className}
        >
          {children}
        </button>
        {confirm(asked)}
      </>
    )
  }
  return (
    <>
      <button
        type='button'
        aria-haspopup='menu'
        aria-expanded={menu !== undefined}
        onClick={event => setMenu(menu ? undefined : event.currentTarget)}
        className={className}
      >
        {children}
      </button>
      {menu && (
        <ChoiceMenu
          anchor={menu}
          title='Concentrating'
          items={effects.map(effect => ({
            id: effect.id,
            label: endLabel(effect),
            icon: CircleOff,
            tint: 'text-text-secondary',
          }))}
          onChoose={id => {
            setMenu(undefined)
            setAsked(effects.find(effect => effect.id === id))
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
      {confirm(asked)}
    </>
  )
}
