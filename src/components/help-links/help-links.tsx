import clsx from 'clsx'
import { Bug, Lightbulb, type LucideIcon } from 'lucide-react'
import { ISSUE_FORMS } from '@/constants/links'

/** Each link, in order: what it says, its icon, and the form it opens. */
const LINKS: { label: string; icon: LucideIcon; href: string }[] = [
  { label: 'Report a bug', icon: Bug, href: ISSUE_FORMS.bug },
  { label: 'Request a feature', icon: Lightbulb, href: ISSUE_FORMS.feature },
]

/**
 * Report a bug and Request a feature (round 0.39.0): the app's own issue forms on GitHub, each
 * opened in a new tab, which its name says; one under the other, as in the sheet's cog, or side by
 * side, wrapping, as in the page's footer (`inline`).
 */
export function HelpLinks({ inline = false }: Readonly<{ inline?: boolean }>) {
  return (
    <ul
      className={clsx(
        inline
          ? 'flex flex-wrap items-center justify-center gap-x-4'
          : 'flex flex-col',
      )}
    >
      {LINKS.map(({ label, icon: Icon, href }) => (
        <li key={label}>
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className={clsx(
              'inline-flex min-h-11 items-center gap-2 rounded-lg transition-colors',
              inline
                ? 'px-1 text-text-secondary hover:text-text-primary hover:underline hover:underline-offset-2'
                : 'w-full px-2 text-sm font-medium hover:bg-primary/5',
            )}
          >
            <Icon aria-hidden className='size-4 shrink-0' />
            {label}
            <span className='sr-only'> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
