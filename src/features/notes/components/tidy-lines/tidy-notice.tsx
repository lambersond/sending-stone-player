import { CircleOff } from 'lucide-react'
import { tidyNoticeWords } from '@/features/notes/utils/note-words'
import type { NotesTidyView } from '@/types/notes'

/**
 * Why none of a character's Tidy 5e Sheets entries can be changed now, Tidy turned off or not
 * installed in Foundry (module 0.45.0): a line under their title; nothing while Tidy is on.
 */
export function TidyNotice({
  tidy,
  name,
}: Readonly<{ tidy: NotesTidyView; name: string }>) {
  const words = tidyNoticeWords(tidy, name)
  if (!words) return
  return (
    <p className='inline-flex items-start gap-1.5 text-sm text-text-secondary'>
      <CircleOff aria-hidden className='mt-0.5 size-3.5 shrink-0' />
      {words}
    </p>
  )
}
