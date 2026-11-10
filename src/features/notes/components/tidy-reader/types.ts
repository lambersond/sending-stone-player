import type { TidyPaneProps } from '../tidy-pane/types'
import type { TidySectionPaneProps } from '../tidy-section-pane/types'
import type { NoteTidyView } from '@/types/notes'

export type TidyReaderProps = Omit<TidySectionPaneProps, 'onPick'> & {
  /** The entry picked; none for their page. */
  entry?: NoteTidyView
  onPick: TidyPaneProps['onPick']
}
