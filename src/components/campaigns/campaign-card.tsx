import clsx from 'clsx'
import {
  ArrowLeftRight,
  CookingPot,
  Dices,
  KeyRound,
  Link2Off,
  RefreshCw,
  Trash2,
  UserMinus,
} from 'lucide-react'
import Link from 'next/link'
import { CampaignParties } from './campaign-parties'
import { FoundrySettingsSection } from './foundry-settings'
import { SecretForm } from './secret-form'
import { CopyField } from '@/components/copy-button'
import { LocalTime } from '@/components/game-table/local-time'
import { ConfirmDialog } from '@/components/modal'
import { numberedNames } from '@/utils/companion-row'
import { gameHost } from '@/utils/game-host'
import type {
  CampaignRefusal,
  OwnedCampaign,
  SecretFormState,
} from '@/types/campaign'

type Props = {
  campaign: OwnedCampaign
  inviteUrl: string
  changeSecret: (
    state: SecretFormState,
    formData: FormData,
  ) => Promise<SecretFormState>
  resetInvite: () => Promise<void>
  /** Remove the player's character with this id from the campaign. */
  removePlayer: (characterId: string) => Promise<void>
  /**
   * Revoke the link from its player's Magical Recipe Book to the character with this id, from
   * module 0.38.0. Without it, the card offers no revoke.
   */
  revokeCookbookLink?: (characterId: string) => Promise<void>
  remove: () => Promise<void>
}

const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
const DANGER_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'

/**
 * One of a Gamemaster's campaigns: whether Foundry is connected, its invite link and its players.
 */
export function CampaignCard({
  campaign,
  inviteUrl,
  changeSecret,
  resetInvite,
  removePlayer,
  revokeCookbookLink,
  remove,
}: Readonly<Props>) {
  const details = [campaign.worldTitle, gameHost(campaign.gameUrl)].filter(
    Boolean,
  )
  return (
    <article
      aria-labelledby={`campaign-${campaign.id}`}
      // No wider than the page's column, nor its header than the card, so the header's one-line
      // details are cut rather than the page pushed sideways on a phone.
      className='grid min-w-0 gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6'
    >
      <header className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3
            id={`campaign-${campaign.id}`}
            className='truncate text-lg font-semibold'
          >
            {campaign.title}
          </h3>
          <p className='truncate text-sm text-text-secondary'>
            {details.join(' · ')}
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

      <section className='grid gap-1.5'>
        <h4 className='text-sm font-medium'>Invite link</h4>
        <CopyField value={inviteUrl} label='invite link' />
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-sm text-text-secondary'>
            Share it with your players. They sign in and choose their character.
          </p>
          <ConfirmDialog
            trigger={
              <>
                <RefreshCw aria-hidden className='size-4' />
                Reset link
              </>
            }
            triggerClassName={QUIET_BUTTON}
            title='Reset the invite link?'
            confirmLabel='Reset link'
            onConfirm={resetInvite}
          >
            <p>
              The current link to {campaign.title} stops working and a new one
              takes its place. Players who already joined keep their characters.
            </p>
          </ConfirmDialog>
        </div>
      </section>

      <section className='grid gap-2'>
        <h4 className='text-sm font-medium'>Characters</h4>
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
                  href={`/campaigns/${campaign.id}/characters/${character.id}`}
                  aria-label={`Open ${character.name}'s sheet`}
                  className='truncate font-medium text-text-primary underline-offset-2 hover:text-primary hover:underline'
                >
                  {character.name}
                </Link>
              )
              return (
                <li
                  key={character.id}
                  // Its right group drops under its name where the row is too narrow for both.
                  className={clsx(
                    'flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-lg bg-page pr-1 pl-3',
                    companions ? 'py-1.5' : 'py-1',
                  )}
                >
                  {/* Its companions under its name, as listed (module 0.36.0). */}
                  {companions ? (
                    <div className='flex min-w-0 flex-col gap-0.5'>
                      {link}
                      <p className='text-xs text-text-secondary'>
                        {companions}
                      </p>
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
                      character.player &&
                      character.characterId &&
                      revokeCookbookLink && (
                        <ConfirmDialog
                          trigger={<Link2Off aria-hidden className='size-4' />}
                          triggerLabel={`Revoke ${character.player}’s cookbook link for ${character.name}`}
                          triggerClassName='rounded-md p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'
                          title={`Revoke ${character.player}’s cookbook link for ${character.name}?`}
                          confirmLabel='Revoke link'
                          onConfirm={revokeCookbookLink.bind(
                            undefined,
                            character.characterId,
                          )}
                          danger
                        >
                          <p>
                            Dishes from {character.player}’s Magical Recipe Book
                            stop reaching {campaign.title} until they make a new
                            link code.
                          </p>
                        </ConfirmDialog>
                      )}
                    {character.player && character.characterId && (
                      <ConfirmDialog
                        trigger={<UserMinus aria-hidden className='size-4' />}
                        triggerLabel={`Remove ${character.player} as ${character.name}`}
                        triggerClassName='rounded-md p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'
                        title={`Remove ${character.player} as ${character.name}?`}
                        confirmLabel='Remove'
                        onConfirm={removePlayer.bind(
                          undefined,
                          character.characterId,
                        )}
                        danger
                      >
                        <p>
                          {character.player} stops following {campaign.title} as{' '}
                          {character.name}, and {character.name} can be chosen
                          again from the invite link.
                        </p>
                      </ConfirmDialog>
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

      <CampaignParties campaign={campaign} />

      <section className='grid gap-1'>
        <h4 className='flex items-center gap-1.5 text-sm font-medium'>
          <Dices aria-hidden className='size-4 text-text-secondary' />
          Players&apos; rolls
        </h4>
        <p className='text-sm text-text-secondary'>{rollsText(campaign)}</p>
      </section>

      <section className='grid gap-1'>
        <h4 className='flex items-center gap-1.5 text-sm font-medium'>
          <ArrowLeftRight aria-hidden className='size-4 text-text-secondary' />
          Items and coins
        </h4>
        <p className='text-sm text-text-secondary'>{movesText(campaign)}</p>
      </section>

      <section className='grid gap-1'>
        <h4 className='flex items-center gap-1.5 text-sm font-medium'>
          <CookingPot aria-hidden className='size-4 text-text-secondary' />
          Cookbook dishes
        </h4>
        <p className='text-sm text-text-secondary'>{dishesText(campaign)}</p>
        {campaign.dishes &&
          (campaign.dishes.waiting > 0 || campaign.dishes.inFoundry > 0) && (
            <p className='text-sm text-text-secondary'>
              {campaign.dishes.waiting} waiting for Foundry ·{' '}
              {campaign.dishes.inFoundry} in Foundry for you
            </p>
          )}
      </section>

      <FoundrySettingsSection campaign={campaign} />

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
        <ConfirmDialog
          trigger={
            <>
              <Trash2 aria-hidden className='size-4' />
              Delete campaign
            </>
          }
          triggerClassName={DANGER_BUTTON}
          title={`Delete ${campaign.title}?`}
          confirmLabel='Delete campaign'
          onConfirm={remove}
          danger
        >
          <p>
            Its chat and combats are deleted, and its players&apos; characters
            stop following it. This can&apos;t be undone.
          </p>
          <p>
            To set it up again, you would need a new invite link for your
            players.
          </p>
        </ConfirmDialog>
      </footer>
    </article>
  )
}

/**
 * Whether the players' rolls are made in the Gamemaster's game, and if not, how they could be; and
 * whether they're asked here for the saves the game asks of them.
 */
function rollsText(campaign: OwnedCampaign): string {
  const { rolls } = campaign
  const made = madeText(campaign)
  return rolls.enabled && rolls.reaching && rolls.prompts
    ? `${made} When your game asks one of their characters for a saving throw, such as a concentration check, its player is asked here to roll it.`
    : made
}

/** Whether the players' rolls are made in the Gamemaster's game, and if not, how they could be. */
function madeText({ rolls }: OwnedCampaign): string {
  if (rolls.enabled && rolls.reaching && rolls.spells) {
    return 'Checks, saves, initiative, death saves, attacks and spells your players roll and cast here are made in your game too, with the same dice. Their attacks, spells and features spend ammunition, uses and spell slots there.'
  }
  if (rolls.enabled && rolls.reaching && rolls.attacks) {
    return 'Checks, saves, initiative, death saves and attacks your players roll here are made in your game too, with the same dice. Their attacks spend ammunition, uses and spell slots there.'
  }
  if (rolls.enabled && rolls.reaching) {
    return 'Checks, saves, initiative and death saves your players roll here are made in your game too, with the same dice. Their attacks and spells stay here: to have them made in your game too, tick Attacks, spells and features on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
  }
  if (rolls.enabled) {
    return 'Turned on in Foundry. Players’ rolls reach your game while it’s open; for now they stay here.'
  }
  return 'They stay here. To have them made in your game with the same dice, tick Players roll in the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/**
 * Whether the players move items and coins from here, from module 0.31.0, and if not, how they
 * could: with a module before that, which has no such setting, by updating it first.
 */
function movesText({ transfers, foundry }: OwnedCampaign): string {
  if (transfers.enabled && transfers.reaching) {
    return 'Your players take from and give to the parties they own in Foundry, and give to each other, from here. Each move is made in your game at once and posts a line in its chat.'
  }
  if (transfers.enabled) {
    return 'Turned on in Foundry. Moves reach your game while it’s open.'
  }
  if (before(foundry?.module?.version, MOVES_FROM)) {
    return 'Players can’t move items and coins from here. Sending Stone 0.31.0 or later in Foundry lets them.'
  }
  return 'Players can’t move items and coins from here. To let them, tick Players move items and coins on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that moves items and coins: major, minor and patch. */
const MOVES_FROM = [0, 31, 0] as const

/**
 * Whether the game takes dishes from the Magical Recipe Book, from module 0.38.0, and if not, why:
 * a module before that, which has no such switch, says nothing of dishes; nor does one under
 * another system than dnd5e 5, where the switch does nothing. The app keeps only whether they're
 * on, so the system is read from the hello's own, which the snapshot keeps: without it, a switch
 * ticked under dnd5e 6 would read as unticked.
 */
function dishesText({ dishes, foundry }: OwnedCampaign): string {
  if (dishes?.enabled) {
    return 'On in Foundry. Players send dishes from the Magical Recipe Book, and each reaches you as a card only Gamemasters see.'
  }
  if (before(foundry?.module?.version, DISHES_FROM)) {
    return 'Your Sending Stone module doesn’t take dishes yet. Version 0.38.0 or later does.'
  }
  const system = foundry?.system
  if (system && !(system.id === 'dnd5e' && system.version.startsWith('5.'))) {
    return 'Off. Dishes need dnd5e 5.x in Foundry for now.'
  }
  return 'Off. To take dishes, tick Dishes from the Magical Recipe Book on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that takes dishes from the Magical Recipe Book. */
const DISHES_FROM = [0, 38, 0] as const

/**
 * Is a module's version, as its hello said it, known to be before this one? One it doesn't say,
 * or that doesn't read as major.minor.patch, isn't.
 */
function before(
  version: string | null | undefined,
  than: readonly number[],
): boolean {
  const parts = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  if (!parts) return false
  const numbers = parts.slice(1).map(Number)
  const differs = numbers.findIndex((part, index) => part !== than[index])
  return differs !== -1 && numbers[differs] < than[differs]
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

function FoundryStatus({ campaign }: Readonly<{ campaign: OwnedCampaign }>) {
  let label = 'Waiting for Foundry'
  let dot = 'bg-text-secondary'
  if (campaign.live) {
    label = 'Live'
    dot = 'bg-primary motion-safe:animate-pulse'
  } else if (campaign.connected) {
    label = 'Offline'
  }
  return (
    <span className='inline-flex shrink-0 flex-col items-end gap-0.5'>
      <span className='inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-semibold'>
        <span aria-hidden className={clsx('size-2 rounded-full', dot)} />
        {label}
      </span>
      {!campaign.live && campaign.lastSeenAt && (
        <span className='text-xs text-text-secondary'>
          Last heard <LocalTime value={campaign.lastSeenAt} />
        </span>
      )}
    </span>
  )
}

/**
 * A character's companions as its card lists them (module 0.36.0): "Companions: Brakka, Bat 1
 * (summoned), Bat 2 (summoned)", in the module's order, a repeated name numbered as a fresh row of
 * tabs numbers it. None where it has none.
 */
function companionsLine(
  companions: OwnedCampaign['characters'][number]['companions'] = [],
): string | undefined {
  if (companions.length === 0) return undefined
  const { names } = numberedNames(
    companions.map(({ name }, index) => ({ key: String(index), name })),
    new Map(),
  )
  const listed = companions.map(
    ({ kind }, index) =>
      `${names.get(String(index))}${kind === 'summoned' ? ' (summoned)' : ''}`,
  )
  return `Companions: ${listed.join(', ')}`
}
