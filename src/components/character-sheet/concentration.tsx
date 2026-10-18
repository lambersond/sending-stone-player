'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import { CircleOff } from 'lucide-react'
import { ChoiceMenu } from './roll-menu'
import { ConfirmDialog, ConfirmModal } from '@/components/modal'
import type { SheetConcentrationEffect } from '@/types/sending-stone'

/*
 * The character's concentrations, as dnd5e keeps them, from module 0.29.0: each ended from the
 * sheet, once the player says so, as dnd5e's Break Concentration ends it, with what depends on it,
 * such as Bless on their allies. Nothing goes to the game's chat, as dnd5e posts nothing.
 */

/**
 * What the sheet does with the character's concentrations: what they are, as the sheet says; and
 * end one, while the Gamemaster's game takes it from here.
 */
export type ConcentrationActions = {
  effects?: SheetConcentrationEffect[]
  end?: (effect: SheetConcentrationEffect) => void
}

/** Nothing, until it's given, as where the module says nothing of them. */
const Actions = createContext<ConcentrationActions>({})

/** Has concentrations ended wherever the sheet shows them. */
export function Concentrating({
  actions,
  children,
}: Readonly<{ actions: ConcentrationActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}

/** What the sheet does with the character's concentrations, as it's given. */
export function useConcentrating(): ConcentrationActions {
  return use(Actions)
}

/** What ending a concentration asks, and says it does. */
const ASKED = {
  confirmLabel: 'End',
  cancelLabel: 'Keep',
  body: 'What it keeps up on your allies ends too.',
}

/** What ending one is called, as its button and menu item are: "End concentration on Bless". */
function endLabel(effect: SheetConcentrationEffect): string {
  return `End concentration on ${effect.name}`
}

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

/**
 * What an effect's row shows once it's open, where the effect is one of the character's
 * concentrations, while the game takes ending it from here: what's concentrated on, and End. None
 * for any other effect.
 */
export function concentrationLead(
  effectId: string,
  actions: ConcentrationActions,
): ReactNode {
  const effect = actions.effects?.find(({ id }) => id === effectId)
  if (!effect || !actions.end) return
  // Not a paragraph: the confirm's dialog, with its heading, is rendered beside its button.
  return (
    <div className='flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs'>
      <span className='min-w-0 flex-1 font-semibold'>
        Concentrating on {effect.name}
      </span>
      <EndConcentrationButton effect={effect} />
    </div>
  )
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
