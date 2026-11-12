'use client'

import { useId, useRef } from 'react'
import { GO_TO_CHIP, GO_TO_CHIP_PLAIN } from '@/constants/buttons'
import { GO_TO } from '@/features/help/constants'
import { scrollToStart } from '@/utils/scroll'
import type { HelpSection } from '@/features/help/types'

/**
 * Help's sections (H4 B), each part a bold lead and its text, under a "Go to" row of chips, as the
 * Conditions reference has (D1): a chip moves focus to its section's heading, and scrolls it to the
 * top, at once where the device asks for reduced motion.
 */
export function HelpGuide({ sections }: Readonly<{ sections: HelpSection[] }>) {
  const prefix = useId()
  const headings = useRef(new Map<string, HTMLElement>())
  const headingId = (id: string) => `${prefix}-${id}`
  const goTo = (id: string) => {
    const heading = headings.current.get(id)
    heading?.focus({ preventScroll: true })
    scrollToStart(heading)
  }

  return (
    <>
      <nav aria-label={GO_TO.label} className='flex flex-col gap-2'>
        <p aria-hidden className='text-xs font-semibold text-text-secondary'>
          {GO_TO.caption}
        </p>
        <ul className='flex flex-wrap gap-1.5'>
          {sections.map(section => (
            <li key={section.id}>
              <button
                type='button'
                onClick={() => goTo(section.id)}
                className={`${GO_TO_CHIP} ${GO_TO_CHIP_PLAIN}`}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {sections.map(section => (
        <section
          key={section.id}
          aria-labelledby={headingId(section.id)}
          className='flex flex-col gap-2.5'
        >
          <h3
            ref={node => {
              if (node) headings.current.set(section.id, node)
              else headings.current.delete(section.id)
            }}
            id={headingId(section.id)}
            tabIndex={-1}
            className='scroll-mt-3 rounded-sm text-base font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          >
            {section.title}
          </h3>
          {section.parts.map(part => (
            <p
              key={part.lead ?? part.text}
              className='text-sm leading-relaxed text-text-secondary'
            >
              {part.lead && (
                <strong className='font-semibold text-text-primary'>
                  {part.lead}
                </strong>
              )}
              {part.text}
            </p>
          ))}
        </section>
      ))}
    </>
  )
}
