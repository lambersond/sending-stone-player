import { HelpLinks } from '@/components/help-links'
import { NotOnCharacterPage } from '@/components/site-header/not-on-character-page'

/**
 * The site's footer (round 0.39.0), on every page with its header: Report a bug and Request a
 * feature, small and centred, wrapping on a narrow phone. A character's page, or its party's, has
 * none, as it has no header: its sheet's cog has the same links.
 */
export function SiteFooter() {
  return (
    <NotOnCharacterPage>
      <footer className='border-t border-border text-xs'>
        <nav aria-label='Help' className='mx-auto w-full max-w-[70rem] px-4'>
          <HelpLinks inline />
        </nav>
      </footer>
    </NotOnCharacterPage>
  )
}
