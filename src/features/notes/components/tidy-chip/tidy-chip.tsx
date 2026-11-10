import { NotebookTabs } from 'lucide-react'
import { tidyChipWords } from '@/features/notes/utils/note-words'
import type { TidySource } from '@/types/notes'

/**
 * A Tidy 5e Sheets entry's chip (module 0.45.0): an icon and its words, never colour alone (§9.7),
 * "Tidy 5e", or "Tidy 5e Classic" on a box of Tidy's Classic sheet; its `id` for what it describes.
 */
export function TidyChip({
  from,
  id,
}: Readonly<{ from: TidySource; id?: string }>) {
  return (
    <span
      id={id}
      className='inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-text'
    >
      <NotebookTabs aria-hidden className='size-3.5 shrink-0' />
      {tidyChipWords(from)}
    </span>
  )
}
