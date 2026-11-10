import type { TidyPaneProps } from '../tidy-pane/types'
import type { TidySectionPaneProps } from '../tidy-section-pane/types'
import type { NoteTidyView } from '@/types/notes'

export type TidyReaderProps = Omit<TidySectionPaneProps, 'onPick'> & {
  /** The entry picked; none for their page. */
  entry?: NoteTidyView
  /** What comes before the first entry in reading order: the book's last note. */
  before?: TidyPaneProps['before']
  onPick: TidyPaneProps['onPick']
}
