import { cache } from 'react'
import { notFound } from 'next/navigation'
import { PartyPage } from '@/components/party-sheet'
import { getGroupView } from '@/db/party'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

type Props = PageProps<'/campaigns/[id]/party/[group]'>

/**
 * A party sheet of the Gamemaster's campaign, once per request: only the campaign's owner, whoever
 * may see it in Foundry. Signed out, to the login page and back here.
 */
const findParty = cache(async (campaignId: string, groupId: string) => {
  const path = `/campaigns/${encodeURIComponent(campaignId)}/party/${encodeURIComponent(groupId)}`
  const user = await requireUser(path)
  // Only the campaign's owner is let see it, which the view checks.
  return getGroupView({ role: 'gm', campaignId, userId: user.id }, groupId)
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, group } = await params
  const view = await findParty(id, group)
  return { title: view?.group.name ?? 'Party' }
}

/**
 * A party's sheet as its campaign's Gamemaster sees it (module 0.30.0), as its players do, and
 * where none may see it in Foundry, saying so. Anyone else, a campaign of another's, or a group no
 * longer in it is told only that it isn't open here.
 */
export default async function GmPartyPage({ params }: Props) {
  const { id, group } = await params
  const view = await findParty(id, group)
  if (!view) notFound()

  return (
    <PartyPage
      api={`/api/campaigns/${encodeURIComponent(id)}/party/${encodeURIComponent(group)}`}
      role='gm'
      initialView={view}
      // Back to its campaign, chosen on the campaigns page (round 0.39.0).
      back={{
        href: `/campaigns?campaign=${encodeURIComponent(id)}`,
        label: 'Your campaigns',
      }}
      // Taken into whichever of the campaign's characters is picked as it's taken (module
      // 0.31.0): only data, as the page that picks builds the way there itself.
      takeInto={{ kind: 'choose', campaignId: id }}
    />
  )
}
