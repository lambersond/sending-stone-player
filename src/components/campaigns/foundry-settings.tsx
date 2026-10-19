import clsx from 'clsx'
import { Eye, EyeOff, Settings2 } from 'lucide-react'
import { LocalTime } from '@/components/game-table/local-time'
import type { OwnedCampaign } from '@/types/campaign'
import type { FoundrySettings, FoundrySnapshot } from '@/types/foundry-settings'

/** The card's quiet buttons' look, as its Change secret has. */
const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/** What a version Foundry didn't say reads as. */
const UNKNOWN = '—'

/**
 * What Foundry last said of itself for a campaign, for its Gamemaster to check when something in
 * the app isn't as they expect (decision 8): its versions, and from module 0.30.0 what players see
 * in chat, and each setting that decides it, as Foundry labels it. Closed until opened; the page
 * doesn't refresh it, so it says when Foundry sent it. Players never receive any of it.
 */
export function FoundrySettingsSection({
  campaign,
}: Readonly<{ campaign: Pick<OwnedCampaign, 'foundry'> }>) {
  const { foundry } = campaign
  return (
    <details className='min-w-0'>
      <summary className={clsx(QUIET_BUTTON, '-ml-2.5 cursor-pointer')}>
        <Settings2 aria-hidden className='size-4' />
        Foundry settings
      </summary>
      <div className='mt-3 grid min-w-0 gap-4 text-sm'>
        {foundry ? (
          <Snapshot foundry={foundry} />
        ) : (
          <p className='text-text-secondary'>
            Foundry hasn&apos;t sent its settings yet. They arrive the next time
            your game connects.
          </p>
        )}
      </div>
    </details>
  )
}

function Snapshot({ foundry }: Readonly<{ foundry: FoundrySnapshot }>) {
  const { settings } = foundry
  return (
    <>
      <p className='text-xs text-text-secondary'>
        As Foundry sent them at <LocalTime value={foundry.receivedAt} />
      </p>
      <section className='grid min-w-0 gap-1.5'>
        <h5 className='font-medium'>Versions</h5>
        <dl className='grid min-w-0 gap-1'>
          <Row label='Foundry' text={foundry.foundry?.version ?? UNKNOWN} />
          {foundry.system && (
            <Row
              label={foundry.system.title}
              text={foundry.system.version || UNKNOWN}
            />
          )}
          <Row
            label='Sending Stone'
            text={foundry.module?.version ?? UNKNOWN}
          />
          {settings?.modules.map(({ id, title, version, active }) => (
            <Row
              key={id}
              label={title}
              text={`${version ?? UNKNOWN}${active ? '' : ' (not enabled)'}`}
            />
          ))}
        </dl>
      </section>
      {settings ? (
        <Settings settings={settings} />
      ) : (
        <p className='text-text-secondary wrap-anywhere'>
          {foundry.module?.version
            ? `Sending Stone ${foundry.module.version} in Foundry`
            : 'Your Sending Stone module in Foundry'}{' '}
          doesn&apos;t report its settings. Update it to 0.30.0 or later to see
          them here.
        </p>
      )}
    </>
  )
}

/** What players see in chat, then each section of settings, as the module sent them. */
function Settings({ settings }: Readonly<{ settings: FoundrySettings }>) {
  return (
    <>
      <section className='grid min-w-0 gap-1.5'>
        <h5 className='font-medium'>What players see in chat</h5>
        <ul className='grid min-w-0 gap-1.5'>
          {settings.results.map(({ id, state, text }) => (
            <li key={id} data-state={state} className='flex min-w-0 gap-2'>
              <StateIcon state={state} />
              <span className='min-w-0 wrap-anywhere'>{text}</span>
            </li>
          ))}
        </ul>
      </section>
      {settings.sections.map(section => (
        <section key={section.id} className='grid min-w-0 gap-1.5'>
          <h5 className='font-medium wrap-anywhere'>{section.title}</h5>
          <dl className='grid min-w-0 gap-1'>
            {section.rows.map(({ id, label, text, note }) => (
              <Row key={id} label={label} text={text} note={note} />
            ))}
          </dl>
        </section>
      ))}
    </>
  )
}

/**
 * A setting or a version: its label, then its value beside it while they fit, else under it, and
 * a note under both. Nothing is laid out in fixed columns, so a phone's width never overflows.
 */
function Row({
  label,
  text,
  note,
}: Readonly<{ label: string; text: string; note?: string }>) {
  return (
    <div className='flex min-w-0 flex-wrap gap-x-2'>
      <dt className='min-w-0 text-text-secondary wrap-anywhere'>{label}</dt>{' '}
      <dd className='min-w-0 font-medium wrap-anywhere'>{text}</dd>
      {note && (
        <dd className='min-w-0 basis-full text-xs text-text-secondary wrap-anywhere'>
          {note}
        </dd>
      )}
    </div>
  )
}

/** Whether players see a result: an open eye, amber where only in some cases, or a shut one. */
function StateIcon({ state }: Readonly<{ state: string }>) {
  const className = 'mt-0.5 size-4 shrink-0'
  if (state === 'hidden') {
    return (
      <EyeOff aria-hidden className={clsx(className, 'text-text-secondary')} />
    )
  }
  return (
    <Eye
      aria-hidden
      className={clsx(
        className,
        state === 'partial' ? 'text-warning' : 'text-primary',
      )}
    />
  )
}
