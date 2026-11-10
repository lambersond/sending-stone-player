import { TidyPane } from '../tidy-pane/tidy-pane'
import { TidySectionPane } from '../tidy-section-pane/tidy-section-pane'
import type { TidyReaderProps } from './types'

/**
 * What the reader shows of a character's Tidy 5e Sheets entries (module 0.45.0): the one picked,
 * or their page.
 */
export function TidyReader({ entry, ...section }: Readonly<TidyReaderProps>) {
  if (!entry) return <TidySectionPane {...section} />
  return (
    <TidyPane
      // Keyed by the entry, so another one starts at its top.
      key={entry.key}
      entry={entry}
      tidy={section.tidy}
      name={section.name}
      form={section.form}
      contents={section.contents}
      onPick={section.onPick}
    />
  )
}
