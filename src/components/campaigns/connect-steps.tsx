import { CopyField } from '@/components/copy-button'

/** What a Gamemaster sets up in Foundry for this app to receive their campaigns' events. */
export function ConnectSteps({
  destination,
}: Readonly<{ destination: string }>) {
  return (
    <ol className='grid list-decimal gap-3 pl-5 text-sm text-text-secondary marker:text-text-primary'>
      <li>
        Install the Sending Stone module, version 0.24.0 or later, in your game
        on The Forge, and open the game as Gamemaster. From 0.37.0, Foundry
        lists it as <em>illagria/sending-stone</em>.
      </li>
      <li>
        In <em>Configure Settings</em>, choose <em>Open Settings</em> under
        Sending Stone, and under <em>General</em> set the <em>App address</em>{' '}
        to
        <span className='my-2 block'>
          <CopyField value={destination} label='address' />
        </span>
      </li>
      <li>
        Add each campaign with <em>New campaign</em>: on its <em>Connection</em>{' '}
        tab give it the same title as here and enter its secret, and on its{' '}
        <em>Players</em> tab add its characters. <em>Test</em> checks a campaign
        before you save.
      </li>
      <li>
        Under <em>General</em>, tick <em>Chat messages</em> and{' '}
        <em>Combat tracker</em>, then <em>Save Changes</em>. Once Foundry
        connects, each campaign&apos;s characters appear here and your players
        can choose them from its invite link.
      </li>
    </ol>
  )
}
