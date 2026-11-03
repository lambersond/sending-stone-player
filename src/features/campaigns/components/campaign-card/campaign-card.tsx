import clsx from 'clsx'
import {
  ArrowLeftRight,
  CookingPot,
  Dices,
  KeyRound,
  PawPrint,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { QUIET_BUTTON } from '../../constants'
import { campaignHeadingId, sheetLinkId } from '../../utils/campaign-ids'
import { CampaignParties } from '../campaign-parties/campaign-parties'
import { CampaignStatus, LastHeard } from '../campaign-status/campaign-status'
import { statusOf } from '../campaign-status/utils'
import { FoundrySettingsSection } from '../foundry-settings/foundry-settings'
import { SecretForm } from '../secret-form/secret-form'
import { LocalTime } from '@/components/local-time/local-time'
import { DeleteCampaign } from '@/features/campaigns/components/campaign-controls/delete-campaign'
import { InviteLink } from '@/features/campaigns/components/campaign-controls/invite-link'
import { RemovePlayer } from '@/features/campaigns/components/campaign-controls/remove-player'
import { ResetLink } from '@/features/campaigns/components/campaign-controls/reset-link'
import { RevokeCookbookLink } from '@/features/campaigns/components/campaign-controls/revoke-cookbook-link'
import { subOf } from '@/features/campaigns/components/campaign-row/utils'
import {
  companionsLine,
  dishesText,
  effectsText,
  movesText,
  rollsText,
  wildShapeText,
} from '@/features/campaigns/utils/feature-words'
import type { CampaignCardProps } from './types'
import type { CampaignRefusal, OwnedCampaign } from '@/types/campaign'

/**
 * One of a Gamemaster's campaigns, as its page shows it beside the index or in its place (round
 * 0.39.0): its head, why Foundry's posts were refused if they were, then its characters and party
 * sheets in one column, and its invite link and what the game lets its players do in the other,
 * side by side from 900 px of the index; and at its foot, Change secret and Delete campaign. The
 * server draws it, every campaign's for the index to show by id; its controls are the client's.
 */
export function CampaignCard({
  campaign,
  inviteUrl,
  changeSecret,
  resetInvite,
  removePlayer,
  revokeCookbookLink,
  remove,
}: Readonly<CampaignCardProps>) {
  return (
    <article
      aria-labelledby={campaignHeadingId(campaign.id)}
      // No wider than the page's column, so nothing in it pushes the page sideways on a phone.
      className='grid min-w-0 gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6'
    >
      <header className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2
            id={campaignHeadingId(campaign.id)}
            // Focused as it opens on a phone.
            tabIndex={-1}
            className='text-xl font-semibold tracking-tight break-words outline-none'
          >
            {campaign.title}
          </h2>
          <p className='text-sm text-text-secondary wrap-anywhere'>
            {subOf(campaign)}
          </p>
        </div>
        <FoundryStatus campaign={campaign} />
      </header>

      {campaign.refusal && (
        <RefusalNote
          refusal={campaign.refusal}
          title={campaign.title}
          lastSeenAt={campaign.lastSeenAt}
        />
      )}

      {/* Columns as divs, never sections: a section is a part of the campaign, such as its Cookbook
          dishes, which a reader finds by its heading. */}
      <div className='grid min-w-0 gap-5 @min-[900px]/index:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @min-[900px]/index:items-start'>
        <div className='grid min-w-0 gap-5'>
          <Characters
            campaign={campaign}
            removePlayer={removePlayer}
            revokeCookbookLink={revokeCookbookLink}
          />
          <CampaignParties campaign={campaign} />
        </div>

        <div className='grid min-w-0 gap-5'>
          <section className='grid gap-1.5'>
            <h3 className='text-sm font-medium'>Invite link</h3>
            <InviteLink url={inviteUrl} />
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm text-text-secondary'>
                Share it with your players. They sign in and choose their
                character.
              </p>
              <ResetLink title={campaign.title} reset={resetInvite} />
            </div>
          </section>

          <section className='grid gap-1'>
            <h3 className='flex items-center gap-1.5 text-sm font-medium'>
              <Dices aria-hidden className='size-4 text-text-secondary' />
              Players&apos; rolls
            </h3>
            <p className='text-sm text-text-secondary'>{rollsText(campaign)}</p>
          </section>

          <section className='grid gap-1'>
            <h3 className='flex items-center gap-1.5 text-sm font-medium'>
              <ArrowLeftRight
                aria-hidden
                className='size-4 text-text-secondary'
              />
              Items and coins
            </h3>
            <p className='text-sm text-text-secondary'>{movesText(campaign)}</p>
          </section>

          <section className='grid gap-1'>
            <h3 className='flex items-center gap-1.5 text-sm font-medium'>
              <CookingPot aria-hidden className='size-4 text-text-secondary' />
              Cookbook dishes
            </h3>
            <p className='text-sm text-text-secondary'>
              {dishesText(campaign)}
            </p>
            {campaign.dishes &&
              (campaign.dishes.waiting > 0 ||
                campaign.dishes.inFoundry > 0) && (
                <p className='text-sm text-text-secondary'>
                  {campaign.dishes.waiting} waiting for Foundry ·{' '}
                  {campaign.dishes.inFoundry} in Foundry for you
                </p>
              )}
          </section>

          <section className='grid gap-1'>
            <h3 className='flex items-center gap-1.5 text-sm font-medium'>
              <Sparkles aria-hidden className='size-4 text-text-secondary' />
              Players&apos; effects
            </h3>
            <p className='text-sm text-text-secondary'>
              {effectsText(campaign)}
            </p>
          </section>

          <section className='grid gap-1'>
            <h3 className='flex items-center gap-1.5 text-sm font-medium'>
              <PawPrint aria-hidden className='size-4 text-text-secondary' />
              Wild Shape
            </h3>
            <p className='text-sm text-text-secondary'>
              {wildShapeText(campaign)}
            </p>
          </section>

          <FoundrySettingsSection campaign={campaign} />
        </div>
      </div>

      <footer className='flex flex-wrap items-start justify-between gap-3 border-t border-border pt-4'>
        <details className='group min-w-0 flex-1'>
          <summary className={clsx(QUIET_BUTTON, 'cursor-pointer')}>
            <KeyRound aria-hidden className='size-4' />
            Change secret
          </summary>
          <div className='mt-3 max-w-md'>
            <SecretForm action={changeSecret} />
          </div>
        </details>
        <DeleteCampaign title={campaign.title} remove={remove} />
      </footer>
    </article>
  )
}

/**
 * A campaign's characters: each a link to its sheet, its companions under its name, and who plays
 * it, with their cookbook link and its revoke, and Remove; else why there are none yet.
 */
function Characters({
  campaign,
  removePlayer,
  revokeCookbookLink,
}: Readonly<
  Pick<CampaignCardProps, 'campaign' | 'removePlayer' | 'revokeCookbookLink'>
>) {
  return (
    <section className='grid gap-2'>
      <h3 className='text-sm font-medium'>Characters</h3>
      {campaign.characters.length > 0 && (
        <p className='-mt-1 text-xs text-text-secondary'>
          Open one to see its sheet and roll as it.
        </p>
      )}
      {campaign.characters.length > 0 ? (
        <ul className='grid gap-1.5 text-sm'>
          {campaign.characters.map(character => {
            const companions = companionsLine(character.companions)
            // Its sheet, as its player sees it, claimed or not (#156).
            const link = (
              <Link
                id={sheetLinkId(campaign.id, character.id)}
                href={`/campaigns/${campaign.id}/characters/${character.id}`}
                aria-label={`Open ${character.name}'s sheet`}
                className='truncate font-medium text-text-primary underline-offset-2 hover:text-primary hover:underline'
              >
                {character.name}
              </Link>
            )
            // What its controls act on, once a player has chosen it.
            const control =
              character.player && character.characterId
                ? {
                    campaignId: campaign.id,
                    campaignTitle: campaign.title,
                    actorId: character.id,
                    name: character.name,
                    player: character.player,
                    characterId: character.characterId,
                  }
                : undefined
            return (
              <li
                key={character.id}
                // Its right group drops under its name where the row is too narrow for both.
                className={clsx(
                  'flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-lg bg-page pr-1 pl-3',
                  companions ? 'py-1.5' : 'py-1',
                )}
              >
                {/* Its companions under its name, as listed (module 0.36.0). */}
                {companions ? (
                  <div className='flex min-w-0 flex-col gap-0.5'>
                    {link}
                    <p className='text-xs text-text-secondary'>{companions}</p>
                  </div>
                ) : (
                  link
                )}
                {/* No wider than the row, under the name: its player's name wraps first. */}
                <span className='flex min-w-0 items-center gap-1'>
                  <span
                    className={clsx(
                      'text-xs wrap-anywhere',
                      character.player
                        ? 'font-semibold text-primary'
                        : 'pr-2 text-text-secondary',
                    )}
                  >
                    {character.player ?? 'Not chosen yet'}
                  </span>
                  {/* Its player's Magical Recipe Book linked to it (module 0.38.0). */}
                  {character.cookbookLinked && (
                    <span className='shrink-0 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary-text'>
                      Cookbook linked
                    </span>
                  )}
                  {character.cookbookLinked &&
                    control &&
                    revokeCookbookLink && (
                      <RevokeCookbookLink
                        {...control}
                        revoke={revokeCookbookLink}
                      />
                    )}
                  {control && (
                    <RemovePlayer {...control} remove={removePlayer} />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className='text-sm text-text-secondary'>
          {campaign.rosterReceived
            ? 'Foundry sent no characters for this campaign. Add them on the campaign’s Players tab in Sending Stone’s settings in Foundry.'
            : 'The campaign’s characters appear here once Foundry sends them. Reloading the game in Foundry sends them at once.'}
        </p>
      )}
    </section>
  )
}

/**
 * Why the app last refused a post from Foundry for the campaign, and what to do about it: boxed
 * while Foundry hasn't reached the app since, muted once it has.
 */
function RefusalNote({
  refusal,
  title,
  lastSeenAt,
}: Readonly<{
  refusal: CampaignRefusal
  title: string
  lastSeenAt?: string
}>) {
  const time = <LocalTime value={refusal.at} />
  let text
  switch (refusal.reason) {
    case 'wrongSecret': {
      text = (
        <>
          At {time}, Sending Stone refused Foundry’s post for this campaign: the
          secret it came with isn’t this campaign’s. Enter this campaign’s
          secret on its Connection tab in Sending Stone’s settings in Foundry,
          in the browser you run the game from, or set a new one with Change
          secret below and enter that.
        </>
      )
      break
    }
    case 'notSetUp': {
      text = (
        <>
          At {time}, Foundry sent a campaign titled “{refusal.detail}” from this
          game, and no campaign here has that title. If it’s this one, rename it
          to “{title}” on its Connection tab in Sending Stone’s settings in
          Foundry.
        </>
      )
      break
    }
    case 'malformed': {
      text = (
        <>
          At {time}, Sending Stone couldn’t read what Foundry sent and dropped
          it{refusal.detail && `: ${refusal.detail}`}. Update the Sending Stone
          module; if it happens again, report it.
        </>
      )
      break
    }
  }
  return (
    <p
      data-refusal={refusal.reason}
      className={clsx(
        'text-sm wrap-anywhere',
        refusal.current
          ? 'rounded-lg border border-danger/40 bg-danger/5 p-3'
          : 'text-text-secondary',
      )}
    >
      {text}
      {!refusal.current && lastSeenAt && (
        <>
          {' '}
          Foundry has reached the app since, at <LocalTime value={lastSeenAt} />
          .
        </>
      )}
    </p>
  )
}

/** The head of a campaign's page: its chip, and under it when Foundry was last heard. */
function FoundryStatus({
  campaign,
}: Readonly<{
  campaign: Pick<OwnedCampaign, 'refusal' | 'live' | 'connected' | 'lastSeenAt'>
}>) {
  return (
    <span className='inline-flex shrink-0 flex-col items-end gap-0.5'>
      <CampaignStatus state={statusOf(campaign)} />
      <LastHeard campaign={campaign} />
    </span>
  )
}
