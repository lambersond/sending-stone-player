'use client'

import { useTransition } from 'react'
import { LoaderCircle, Trash2 } from 'lucide-react'

type Props = {
  characterId: string
  name: string
  onRemove: (characterId: string) => Promise<void>
}

export function RemoveCharacterButton({
  characterId,
  name,
  onRemove,
}: Readonly<Props>) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type='button'
      aria-label={`Remove ${name}`}
      title='Remove'
      disabled={pending}
      onClick={() => startTransition(() => onRemove(characterId))}
      className='rounded-lg p-2.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50'
    >
      {pending ? (
        <LoaderCircle aria-hidden className='size-4 animate-spin' />
      ) : (
        <Trash2 aria-hidden className='size-4' />
      )}
    </button>
  )
}
