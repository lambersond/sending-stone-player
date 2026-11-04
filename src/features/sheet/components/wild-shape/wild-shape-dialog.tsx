'use client'

import { use, useRef, type ReactNode, type RefObject } from 'react'
import { BeastList } from './beast-list'
import { WildShapeContext } from './context'
import { FormPicker } from './form-picker'
import { KnownForms } from './known-forms'
import { LearnFooter } from './learn-footer'
import { PickerFooter } from './picker-footer'
import { titleOf } from './utils'
import { Modal } from '@/components/modal/modal'

/**
 * The pane's one Wild Shape dialog (round 0.40.0 §5.3, §5.8): a sheet from the bottom of a phone's
 * screen, a dialog on a wide one, its views the form picker, the Known forms manager and a Beast
 * to learn, Back between them; its note and its button kept in view under what scrolls.
 */
export function WildShapeDialog({
  body,
}: Readonly<{
  /** What's inside the dialog, for focus to be found in it. */
  body: RefObject<HTMLDivElement | null>
}>) {
  const { view, back: goBack, fromPicker, close, block } = use(WildShapeContext)
  const first = useRef<HTMLElement>(null)
  let back: { label: string; onClick: () => void } | undefined
  if (view?.kind === 'learn') {
    back = { label: 'Back to known forms', onClick: goBack }
  } else if (view?.kind === 'known' && fromPicker) {
    back = { label: 'Back to Wild Shape', onClick: goBack }
  }
  let footer: ReactNode
  // No footer where the druid knows no forms yet, as there's no Become: only Choose forms….
  if (view?.kind === 'picker' && (block?.known.length ?? 0) > 0) {
    footer = <PickerFooter />
  }
  if (view?.kind === 'learn') footer = <LearnFooter replace={view.replace} />
  return (
    <Modal
      open={view !== undefined}
      onClose={close}
      title={titleOf(view)}
      placement='sheet'
      initialFocus={first}
      back={back}
      footer={footer}
    >
      <div ref={body} className='flex flex-col gap-4'>
        {view?.kind === 'picker' && <FormPicker first={first} />}
        {view?.kind === 'known' && <KnownForms />}
        {view?.kind === 'learn' && <BeastList />}
      </div>
    </Modal>
  )
}
