'use client'

import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { effectControlName, EFFECT_WORDS } from '@/utils/effect-words'
import type { EffectChoice } from './types'

/**
 * The buttons inside one of the character's own effects' opened row (module 0.39.0), never on the
 * row itself, which opens it: Turn off or Turn on, then Delete…, which asks first. Each is named
 * with the effect; while a change of it waits, each is disabled, the one pressed turning.
 */
export function EffectButtons({
  name,
  choice,
  onDelete,
}: Readonly<{
  /** The effect's name, which each button is named with. */
  name: string
  choice: EffectChoice
  onDelete: () => void
}>) {
  return (
    <div className='flex flex-wrap gap-2'>
      {choice.ops.map(op => (
        <button
          key={op}
          type='button'
          aria-label={effectControlName(op, name)}
          aria-haspopup={op === 'delete' ? 'dialog' : undefined}
          disabled={choice.waiting}
          onClick={() => (op === 'delete' ? onDelete() : choice.choose(op))}
          className={clsx(
            'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-2 text-xs font-semibold transition-colors disabled:opacity-60',
            op === 'delete'
              ? 'text-danger hover:border-danger/50 hover:bg-danger/5'
              : 'hover:bg-primary/5',
          )}
        >
          {choice.pending === op && (
            <LoaderCircle
              aria-hidden
              className='size-3.5 shrink-0 motion-safe:animate-spin'
            />
          )}
          {EFFECT_WORDS[op].button}
        </button>
      ))}
    </div>
  )
}
