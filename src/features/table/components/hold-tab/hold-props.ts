import clsx from 'clsx'
import type { TabHold } from '@/features/table/types'

/** What a tab held to end the turn takes on its button: its handlers, classes and description. */
export function holdProps(hold?: TabHold) {
  return {
    ...hold?.handlers,
    'aria-describedby': hold?.offer?.id,
    className: clsx(
      // A held touch neither selects the label nor opens iOS's callout, and the fill keeps inside.
      hold?.touch &&
        'touch-manipulation overflow-hidden select-none [-webkit-touch-callout:none]',
    ),
  }
}
