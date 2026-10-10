'use client'

import { useEffect, useId, useRef } from 'react'
import clsx from 'clsx'
import { CONDITION_BASICS, CONDITIONS, SRD_LINKS } from '@/constants/conditions'
import type { SheetCondition } from '@/types/sending-stone'

/**
 * Every condition of D&D's 2024 rules, with its rules as the SRD 5.2 gives them, after what a
 * condition is and how long one lasts. Those the character has are marked, Exhaustion with its
 * level. A row of their names at the top jumps to each, for a quick look in the middle of a fight;
 * and it opens at one, where it's opened for one, such as from a description naming it.
 */
export function ConditionsReference({
  conditions,
  at,
}: Readonly<{
  conditions: SheetCondition[]
  /** The condition to show first, by its id. */
  at?: string
}>) {
  const prefix = useId()
  const sections = useRef(new Map<string, HTMLElement>())
  const has = new Map(conditions.map(condition => [condition.id, condition]))
  const anchor = (id: string) => `${prefix}-${id}`
  const jumpTo = (id: string) => {
    const reduced = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    sections.current.get(id)?.scrollIntoView?.({
      block: 'start',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }
  // Opened at a condition, it's there at once: a frame after it's drawn, as the dialog it's in is
  // shown only after that, and nothing in a dialog not shown yet can be scrolled to.
  useEffect(() => {
    if (!at) return
    const frame = requestAnimationFrame(() =>
      sections.current
        .get(at)
        ?.scrollIntoView?.({ block: 'start', behavior: 'auto' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [at])

  return (
    <div className='flex flex-col gap-5 text-sm'>
      <nav aria-label='Go to a condition'>
        <ul className='flex flex-wrap gap-1.5'>
          {CONDITIONS.map(condition => (
            <li key={condition.id}>
              <button
                type='button'
                onClick={() => jumpTo(condition.id)}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                  has.has(condition.id)
                    ? 'border-ruby/40 bg-ruby/10 text-ruby hover:bg-ruby/20'
                    : 'border-border hover:border-primary hover:bg-primary/5',
                )}
              >
                {condition.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className='flex flex-col gap-2 text-text-secondary'>
        {CONDITION_BASICS.map(basic => (
          <p key={basic.title ?? 'what'}>
            {basic.title && (
              <strong className='text-text-primary'>{basic.title}. </strong>
            )}
            {basic.text}
          </p>
        ))}
      </div>

      {CONDITIONS.map(condition => {
        const yours = has.get(condition.id)
        return (
          <section
            key={condition.id}
            ref={node => {
              if (node) sections.current.set(condition.id, node)
              else sections.current.delete(condition.id)
            }}
            aria-labelledby={`${anchor(condition.id)}-name`}
            className={clsx(
              'flex scroll-mt-2 flex-col gap-2 rounded-2xl border p-4',
              yours ? 'border-ruby/40 bg-ruby/5' : 'border-border',
            )}
          >
            <div className='flex items-center justify-between gap-2'>
              <h3
                id={`${anchor(condition.id)}-name`}
                className='text-base font-semibold'
              >
                {condition.name}
              </h3>
              {yours && (
                <span className='shrink-0 rounded-full bg-ruby/15 px-2 py-0.5 text-xs font-semibold text-ruby'>
                  {yours.level === null
                    ? 'You have it'
                    : `You're at level ${yours.level}`}
                </span>
              )}
            </div>
            {condition.rules.map(rule => (
              <p key={rule.title}>
                <strong>{rule.title}.</strong> {rule.text}
              </p>
            ))}
          </section>
        )
      })}

      <p className='text-xs text-text-secondary'>
        This work includes material from the System Reference Document 5.2 (“SRD
        5.2”) by Wizards of the Coast LLC, available at{' '}
        <a
          href={SRD_LINKS.srd}
          target='_blank'
          rel='noreferrer'
          className='underline underline-offset-2'
        >
          {SRD_LINKS.srd}
        </a>
        . The SRD 5.2 is licensed under the Creative Commons Attribution 4.0
        International License, available at{' '}
        <a
          href={SRD_LINKS.licence}
          target='_blank'
          rel='noreferrer'
          className='break-all underline underline-offset-2'
        >
          {SRD_LINKS.licence}
        </a>
        . Each condition&apos;s opening line is left out here.
      </p>
    </div>
  )
}
