import { CopyField } from '@/components/copy-button'

/** What a Gamemaster sets up in Foundry for this app to receive their campaign's events. */
export function ConnectSteps({
  destination,
}: Readonly<{ destination: string }>) {
  return (
    <ol className='grid list-decimal gap-3 rounded-2xl border border-border bg-card p-5 pl-10 text-sm text-text-secondary marker:text-text-primary sm:p-6 sm:pl-11'>
      <li>
        Install the Sending Stone module, version 0.3.0 or later, in your game
        on The Forge.
      </li>
      <li>
        In <em>Configure Connection</em>, set the destination to
        <span className='my-2 block'>
          <CopyField value={destination} label='destination' />
        </span>
        and the secret to your campaign&apos;s secret.
      </li>
      <li>
        In <em>Manage Campaigns</em>, add a campaign with the same title as
        here, and tick its characters.
      </li>
      <li>
        Switch on <em>Send Chat Events</em> and <em>Send Combat Events</em>.
        Once Foundry connects, the campaign&apos;s characters appear here and
        your players can choose them.
      </li>
    </ol>
  )
}
