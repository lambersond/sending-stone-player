'use client'

import { Trash2 } from 'lucide-react'
import { DeleteCharacterWarning } from './delete-character-warning'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'

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
  return (
    <ConfirmDialog
      trigger={<Trash2 aria-hidden className='size-4' />}
      triggerLabel={`Delete ${name}`}
      triggerClassName='rounded-lg p-2.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'
      title={`Delete ${name}?`}
      confirmLabel='Delete'
      onConfirm={() => onRemove(characterId)}
      danger
    >
      <DeleteCharacterWarning name={name} />
    </ConfirmDialog>
  )
}
