'use client'

import { CopyField } from '@/components/copy-button/copy-button'
import { useToast } from '@/features/campaigns/hooks/use-toast'

/** The campaign's invite link, to copy, its button saying Copy, then Copied. */
export function InviteLink({ url }: Readonly<{ url: string }>) {
  const toast = useToast()
  return (
    <CopyField
      value={url}
      label='invite link'
      word
      // Its button already says Copied, so the toast isn't said again.
      onCopied={() => toast('Invite link copied', { announce: false })}
    />
  )
}
