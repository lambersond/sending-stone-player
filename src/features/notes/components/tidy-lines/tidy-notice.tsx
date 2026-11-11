import { CircleOff, PawPrint } from 'lucide-react'
import {
  tidyFormWords,
  tidyNoticeWords,
} from '@/features/notes/utils/note-words'
import type { NotesTidyView } from '@/types/notes'
import type { SheetForm } from '@/types/sending-stone'

const LINE = 'inline-flex items-start gap-1.5 text-sm text-text-secondary'

/**
 * Why a character's Tidy 5e Sheets entries can't be changed now, or not for good (module 0.44.0):
 * Tidy turned off or not installed in Foundry; and while the character is transformed, as its
 * sheet says, that what's changed on its form's Journal tab is lost when the form ends, as they're
 * read off the character, never the form. Lines under their title; nothing otherwise.
 */
export function TidyNotice({
  tidy,
  name,
  form,
}: Readonly<{ tidy: NotesTidyView; name: string; form?: SheetForm['kind'] }>) {
  const off = tidyNoticeWords(tidy, name)
  const transformed = form && tidyFormWords(form, name)
  return (
    <>
      {off && (
        <p className={LINE}>
          <CircleOff aria-hidden className='mt-0.5 size-3.5 shrink-0' />
          {off}
        </p>
      )}
      {transformed && (
        <p className={LINE}>
          <PawPrint aria-hidden className='mt-0.5 size-3.5 shrink-0' />
          {transformed}
        </p>
      )}
    </>
  )
}
