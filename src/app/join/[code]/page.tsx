import { Suspense } from 'react'
import { InviteChoice } from './invite-choice'
import { InviteSkeleton } from './invite-skeleton'
import { JOIN_PATH } from '@/constants/campaign'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Join a campaign' }

/**
 * A campaign's invite link: a signed-in player chooses which of its characters they play. Signed
 * out, to the login page and back, before anything is sent; then its outline shimmering while
 * the invite is read (v0.48.0).
 */
export default async function JoinPage({ params }: PageProps<'/join/[code]'>) {
  const { code } = await params
  const user = await requireUser(`${JOIN_PATH}/${code}`)

  return (
    <Suspense fallback={<InviteSkeleton />}>
      <InviteChoice code={code} userId={user.id} />
    </Suspense>
  )
}
