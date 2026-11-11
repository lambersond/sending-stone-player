import { TidyPane } from '../tidy-pane/tidy-pane'
import { TidySectionPane } from '../tidy-section-pane/tidy-section-pane'
import type { TidyReaderProps } from './types'

/**
 * What the reader shows of a character's Tidy 5e Sheets entries (module 0.44.0): the one picked,
 * or their page.
 */
export function TidyReader({
  entry,
  before,
  ...section
}: Readonly<TidyReaderProps>) {
  if (!entry) return <TidySectionPane {...section} />
  return (
    <TidyPane
      // Keyed by the entry, so another one starts at its top.
      key={entry.key}
      entry={entry}
      tidy={section.tidy}
      name={section.name}
      form={section.form}
      before={before}
      contents={section.contents}
      onPick={section.onPick}
    />
  )
}
