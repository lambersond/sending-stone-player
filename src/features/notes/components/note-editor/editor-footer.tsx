'use client'

import { LoaderCircle } from 'lucide-react'

/**
 * An editor's footer, below its fields and pinned to the modal's bottom (round 0.35.0 §8.10): why
 * Save was refused, over the keys that save, from 640 px of the modal, then Cancel and Save, after
 * the fields in Tab order.
 */
export function EditorFooter({
  error,
  hint,
  saving,
  canSave,
  onCancel,
}: Readonly<{
  error?: string
  /** The keys that save, as the editor takes them. */
  hint: string
  saving: boolean
  canSave: boolean
  onCancel: () => void
}>) {
  return (
    <div className='flex flex-col gap-2'>
      {error && (
        <p role='alert' className='text-sm text-danger'>
          {error}
        </p>
      )}
      <div className='flex items-center justify-end gap-2'>
        <p className='hidden min-w-0 flex-1 text-xs text-text-secondary @min-[640px]:block'>
          {hint}
        </p>
        {/* Off while it's saving: what's sent is kept or refused, and only then can it be left. */}
        <button
          type='button'
          disabled={saving}
          onClick={onCancel}
          className='min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
        >
          Cancel
        </button>
        <button
          type='submit'
          disabled={!canSave}
          className='inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
        >
          {saving && (
            <LoaderCircle
              aria-hidden
              className='size-4 motion-safe:animate-spin'
            />
          )}
          Save
        </button>
      </div>
    </div>
  )
}
