import { CopyField } from '@/components/copy-button'

/** What a Gamemaster sets up in Foundry for this app to receive their campaigns' events. */
export function ConnectSteps({
  destination,
}: Readonly<{ destination: string }>) {
  return (
    <ol className='grid list-decimal gap-3 pl-5 text-sm text-text-secondary marker:text-text-primary'>
      <li>
        Install the Sending Stone module, version 0.4.0 or later, in your game
        on The Forge, and open the game as Gamemaster.
      </li>
      <li>
        In <em>Configure Settings</em>, open Sending Stone&apos;s{' '}
        <em>Manage Campaigns</em> and set the Sending Stone address to
        <span className='my-2 block'>
          <CopyField value={destination} label='address' />
        </span>
      </li>
      <li>
        Add each campaign with the same title as here, enter its secret, and
        tick its characters. <em>Test</em> checks a campaign before you save.
      </li>
      <li>
        Switch on <em>Send Chat Events</em> and <em>Send Combat Events</em>.
        Once Foundry connects, each campaign&apos;s characters appear here and
        your players can choose them from its invite link.
      </li>
    </ol>
  )
}
