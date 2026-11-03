'use client'

import {
  use,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import { PawPrint } from 'lucide-react'
import { reasons } from '../../../../utils/roll-reasons'
import { WildShapeContext } from './use-wild-shape-row'
import { ReturnPopover } from './wild-shape'
import { PLAIN, SOLID, Spinner } from './wild-shape-row-controls'
import { Modal } from '@/components/modal/modal'
import { SearchField } from '@/components/search-field/search-field'
import { matchesSearch } from '@/utils/search'
import { articled } from '@/utils/wild-shape'
import {
  attackWords,
  badgeOf,
  sizeCrWords,
  ONLY_IN_FOUNDRY,
  badgeName,
  noFormsWords,
  chipWords,
  knownCountWords,
  wildShapeReasons,
  changeRefusedWords,
  usesNoteWords,
  NONE_OFFERED,
  swapWords,
  managerLineWords,
  listFailedWords,
  beastCountWords,
  learnRefusedWords,
  learnWords,
} from '@/utils/wild-shape-words'
import type { WildShapeValue, View, Op } from './use-wild-shape'
import type { SeatRole } from '@/types/seats'
import type { KnownForm } from '@/types/sending-stone'

/**
 * What the rows, tabs and ribbon inside know of the character's Wild Shape; and the pane's one
 * Wild Shape dialog and Return's confirm, drawn here once, never inside a row, so that a row drawn
 * afresh as a new sheet arrives never closes either.
 */
export function WildShaping({
  value,
  children,
}: Readonly<{ value: WildShapeValue; children: ReactNode }>) {
  return (
    <WildShapeContext value={value}>
      {children}
      {value.block && <WildShapeDialog />}
      {value.returnAnchor && value.form && (
        <ReturnPopover anchor={value.returnAnchor} />
      )}
    </WildShapeContext>
  )
}

/** The dialog's title for each view. */
function titleOf(view: View | undefined): string {
  switch (view?.kind) {
    case 'known': {
      return 'Known forms'
    }
    case 'learn': {
      return view.replace
        ? `Replace ${articled(view.replace.name)}`
        : 'Learn a form'
    }
    default: {
      return 'Wild Shape'
    }
  }
}

/**
 * The pane's one Wild Shape dialog (round 0.40.0 §5.3, §5.8): a sheet from the bottom of a phone's
 * screen, a dialog on a wide one, its views the form picker, the Known forms manager and a Beast
 * to learn, Back between them; its note and its button kept in view under what scrolls.
 */
function WildShapeDialog() {
  const ws = use(WildShapeContext)
  const first = useRef<HTMLElement>(null)
  const { view } = ws
  let back: { label: string; onClick: () => void } | undefined
  if (view?.kind === 'learn') {
    back = { label: 'Back to known forms', onClick: ws.back }
  } else if (view?.kind === 'known' && ws.fromPicker) {
    back = { label: 'Back to Wild Shape', onClick: ws.back }
  }
  let footer: ReactNode
  // No footer where the druid knows no forms yet, as there's no Become: only Choose forms….
  if (view?.kind === 'picker' && (ws.block?.known.length ?? 0) > 0) {
    footer = <PickerFooter />
  }
  if (view?.kind === 'learn') footer = <LearnFooter replace={view.replace} />
  return (
    <Modal
      open={view !== undefined}
      onClose={ws.close}
      title={titleOf(view)}
      placement='sheet'
      initialFocus={first}
      back={back}
      footer={footer}
    >
      <div ref={ws.body} className='flex flex-col gap-4'>
        {view?.kind === 'picker' && <FormPicker first={first} />}
        {view?.kind === 'known' && <KnownForms />}
        {view?.kind === 'learn' && <BeastList />}
      </div>
    </Modal>
  )
}

/** The badge of a card not offered, or the current form's. */
function Badge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className='shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-text-secondary'>
      {children}
    </span>
  )
}

/** A form's paw, where its art would be. */
function Paw() {
  return (
    <span
      aria-hidden
      className='flex size-8 shrink-0 items-center justify-center rounded-full bg-wild-bg text-wild'
    >
      <PawPrint className='size-4' />
    </span>
  )
}

/** A known form's statistics: its AC, at the Moon's floor where higher, speeds and attack. */
function formStats(
  known: KnownForm,
  acFloor: number | null,
): { ac?: string; speeds?: string; attack?: string } {
  const ac =
    typeof known.ac === 'number'
      ? `AC ${Math.max(known.ac, acFloor ?? Number.NEGATIVE_INFINITY)}`
      : undefined
  return {
    ac,
    speeds: known.speeds?.length ? known.speeds.join(', ') : undefined,
    attack: known.attack ? attackWords(known.attack) : undefined,
  }
}

/** A known form's card's face: its name, size and CR, its statistics, and its badge. */
function FormFace({
  known,
  acFloor,
  now,
  nameFocus,
}: Readonly<{
  known: KnownForm
  acFloor: number | null
  now: boolean
  /** Its name takes focus, as the manager's card does once it's learned. */
  nameFocus?: boolean
}>) {
  const badge = badgeOf(known)
  const stats = known.pool ? formStats(known, acFloor) : {}
  const line = known.pool ? sizeCrWords(known.size, known.cr) : ''
  return (
    <>
      <span className='flex items-center gap-2.5'>
        <Paw />
        <span className='min-w-0 flex-1'>
          <span
            {...(nameFocus && {
              tabIndex: -1,
              'data-ws-focus': `form:${known.id}`,
            })}
            className='block font-semibold outline-none'
          >
            {known.name}
          </span>
          {line && (
            <span className='block text-xs text-text-secondary'>{line}</span>
          )}
        </span>
        {now && <Badge>Now</Badge>}
        {!now && badge && <Badge>{badge}</Badge>}
      </span>
      {(stats.ac || stats.speeds || stats.attack) && (
        <span className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
          {stats.ac && (
            <span className='font-semibold text-text-primary'>{stats.ac}</span>
          )}
          {stats.speeds && <span>{stats.speeds}</span>}
          {stats.attack && <span>{stats.attack}</span>}
        </span>
      )}
      {!now && badge && (
        <span className='text-xs text-text-secondary'>{ONLY_IN_FOUNDRY}</span>
      )}
    </>
  )
}

/** A known form's card's accessible name: what its face says, and why it isn't offered. */
function cardName(
  known: KnownForm,
  acFloor: number | null,
  now: boolean,
): string {
  const stats = known.pool ? formStats(known, acFloor) : {}
  const cr = known.pool ? sizeCrWords(undefined, known.cr) : ''
  const badge = badgeOf(known)
  let end = ''
  if (now) end = ', now'
  else if (badge) end = badgeName(badge)
  return [
    known.name,
    known.pool ? known.size : undefined,
    cr,
    stats.ac,
    stats.speeds,
    stats.attack,
  ]
    .filter(Boolean)
    .join(', ')
    .concat(end)
}

/** Which way each arrow key moves through a roving radiogroup. */
const STEPS: Record<string, 1 | -1> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

/** The card a roving radiogroup's arrow lands on: the next offered, wrapping, either way. */
function nextOffered(
  ids: string[],
  from: string | undefined,
  key: string,
): string | undefined {
  const step = STEPS[key]
  if (ids.length === 0 || step === undefined) return undefined
  const at = from === undefined ? -1 : ids.indexOf(from)
  if (at === -1) return step > 0 ? ids[0] : ids.at(-1)
  return ids[(at + step + ids.length) % ids.length]
}

/** Arrow keys on a roving radiogroup: the next offered card checked, and focused. */
function arrows(
  event: KeyboardEvent<HTMLElement>,
  ids: string[],
  from: string | undefined,
  choose: (id: string) => void,
  attribute: string,
) {
  const next = nextOffered(ids, from, event.key)
  if (next === undefined) return
  event.preventDefault()
  choose(next)
  event.currentTarget
    .querySelector<HTMLElement>(
      `[${CSS.escape(attribute)}="${CSS.escape(next)}"]`,
    )
    ?.focus()
}

/**
 * The form picker (round 0.40.0 §5.3): what a change gives, the known forms as radios, those not
 * offered skipped by the arrows, and the count with Known forms…; or, where the druid knows none,
 * Choose forms….
 */
function FormPicker({
  first,
}: Readonly<{ first: RefObject<HTMLElement | null> }>) {
  const ws = use(WildShapeContext)
  const { block, form, name } = ws
  if (!block) return
  const ids = ws.offered.map(({ id }) => id)
  if (block.known.length === 0) {
    return (
      <div className='flex flex-col items-start gap-3'>
        <p className='text-sm'>{noFormsWords(name)}</p>
        <button
          ref={first as RefObject<HTMLButtonElement | null>}
          type='button'
          data-ws-focus='choose'
          onClick={() => ws.showKnown('choose')}
          className={PLAIN}
        >
          Choose forms…
        </button>
      </div>
    )
  }
  return (
    <>
      <ul aria-label='What happens' className='flex flex-wrap gap-1.5'>
        {chipWords(block).map(chip => (
          <li
            key={chip}
            className='rounded-full bg-page px-2.5 py-1 text-xs text-text-secondary'
          >
            {chip}
          </li>
        ))}
      </ul>
      <div
        role='radiogroup'
        aria-label='Known forms'
        onKeyDown={event =>
          arrows(event, ids, ws.checked, ws.pick, 'data-ws-card')
        }
        className='grid gap-2 md:grid-cols-2'
      >
        {block.known.map(known => {
          const now = known.id === form?.profile
          const offered = ids.includes(known.id)
          const checked = offered && known.id === ws.checked
          return (
            <button
              key={known.id}
              ref={
                checked
                  ? (first as RefObject<HTMLButtonElement | null>)
                  : undefined
              }
              type='button'
              role='radio'
              aria-checked={checked}
              aria-disabled={!offered || undefined}
              aria-label={cardName(known, block.acFloor, now)}
              tabIndex={checked ? 0 : -1}
              data-ws-card={known.id}
              onClick={() => ws.pick(known.id)}
              className={clsx(
                'flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
                checked
                  ? 'border-wild bg-wild-bg/60 ring-1 ring-wild'
                  : 'border-border bg-card',
                offered ? 'hover:border-wild/50' : 'cursor-not-allowed',
              )}
            >
              <FormFace known={known} acFloor={block.acFloor} now={now} />
            </button>
          )
        })}
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-text-secondary'>
          {knownCountWords(block.known.length, block.limits.count)}
        </p>
        <button
          type='button'
          data-ws-focus='known'
          onClick={() => ws.showKnown('known')}
          className='inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-wild hover:bg-wild/10 sm:min-h-9'
        >
          Known forms…
        </button>
      </div>
    </>
  )
}

/** The words for why a command wasn't made, as the seat reads them. */
function reasonWords(role: SeatRole, op: Op, key: string): string | undefined {
  return wildShapeReasons(role, op)[key] ?? reasons(role)[key]
}

/**
 * The picker's footer: the uses left, or why no card is offered, or why the last change wasn't
 * made; and Become {aForm}, "Changing…" while it's on its way, focus kept on it.
 */
function PickerFooter() {
  const ws = use(WildShapeContext)
  const { block } = ws
  if (!block || block.known.length === 0) return
  const known = block.known.find(({ id }) => id === ws.checked)
  const changing = ws.waiting === 'transform'
  const refused = ws.refusal?.op === 'transform' ? ws.refusal : undefined
  const note = refused ? (
    <p role='alert' className='min-w-0 flex-1 text-sm text-warning'>
      {changeRefusedWords(
        ws.name,
        refused.key,
        reasonWords(ws.role, 'transform', refused.key),
      )}
    </p>
  ) : (
    <p className='min-w-0 flex-1 text-sm text-text-secondary'>
      {known ? usesNoteWords(block.uses) : NONE_OFFERED}
    </p>
  )
  const blocked = changing || !known
  return (
    <>
      {note}
      <button
        type='button'
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (!blocked) ws.change()
        }}
        className={clsx(SOLID, 'ml-auto')}
      >
        {changing ? <Spinner /> : <PawPrint aria-hidden className='size-4' />}
        {changing && 'Changing…'}
        {!changing && (known ? `Become ${articled(known.name)}` : 'Become')}
      </button>
    </>
  )
}

/**
 * The Known forms manager (round 0.40.0 §5.8): what the druid knows of how many, each known form
 * with Replace… where a replacement is free, each empty place with Learn a form…, and when a
 * replacement comes.
 */
function KnownForms() {
  const ws = use(WildShapeContext)
  const { block, form, name } = ws
  if (!block) return
  const empty = Math.max(0, block.limits.count - block.known.length)
  const swap = swapWords(block, name)
  return (
    <>
      <p className='text-sm'>{managerLineWords(block, name)}</p>
      <ul className='grid gap-2 md:grid-cols-2'>
        {block.known.map(known => {
          const now = known.id === form?.profile
          return (
            <li
              key={known.id}
              className='flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3'
            >
              <FormFace
                known={known}
                acFloor={block.acFloor}
                now={now}
                nameFocus
              />
              {block.swap && !now && (
                <button
                  type='button'
                  aria-label={`Replace ${known.name}`}
                  data-ws-focus={`replace:${known.id}`}
                  onClick={() => ws.showLearn(`replace:${known.id}`, known)}
                  className={clsx(PLAIN, 'self-start')}
                >
                  Replace…
                </button>
              )}
            </li>
          )
        })}
        {Array.from({ length: empty }, (_, index) => (
          <li
            key={`empty-${index}`}
            className='flex flex-col gap-2 rounded-xl border border-dashed border-border p-3'
          >
            <span className='text-sm text-text-secondary'>An empty place</span>
            <button
              type='button'
              data-ws-focus={`learn:${index}`}
              onClick={() => ws.showLearn(`learn:${index}`)}
              className={clsx(PLAIN, 'self-start')}
            >
              Learn a form…
            </button>
          </li>
        ))}
      </ul>
      {swap && <p className='text-sm text-text-secondary'>{swap}</p>}
    </>
  )
}

/**
 * The Beasts to learn (round 0.40.0 §5.8), as the game lists them now, from the campaign's
 * compendiums: "Finding Beasts…" while it does, why not and Try again where it couldn't; then a
 * search, their count, and each as a radio, those known already not offered.
 */
function BeastList() {
  const ws = use(WildShapeContext)
  const [query, setQuery] = useState('')
  const { beasts } = ws
  if (!beasts || beasts.status === 'loading') {
    return (
      <p
        role='status'
        className='flex items-center gap-2 text-sm text-text-secondary'
      >
        <Spinner />
        Finding Beasts…
      </p>
    )
  }
  if (beasts.status === 'failed') {
    const reason =
      reasonWords(ws.role, 'learn', beasts.reason) ?? 'something went wrong'
    return (
      <div className='flex flex-col items-start gap-3'>
        <p role='alert' className='text-sm text-warning'>
          {listFailedWords(ws.role, reason)}
        </p>
        <button type='button' onClick={ws.loadBeasts} className={PLAIN}>
          Try again
        </button>
      </div>
    )
  }
  const shown = beasts.forms.filter(each => matchesSearch([each.name], query))
  const ids = shown.filter(each => !each.known).map(({ uuid }) => uuid)
  const chosen = ids.includes(ws.beast ?? '') ? ws.beast : undefined
  // The first offered takes the group's tab stop while none is chosen.
  const stop = chosen ?? ids[0]
  return (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        label='Search Beasts'
        placeholder='Search Beasts'
      />
      {/* Read where it stands, never announced (round 0.40.0 §9.5): this view's live words are
          its "Finding Beasts…" and its refusals alone. */}
      <p className='text-sm text-text-secondary'>
        {beastCountWords(shown.length, beasts.forms.length, beasts.more)}
      </p>
      <div
        role='radiogroup'
        aria-label='Beasts'
        onKeyDown={event =>
          arrows(event, ids, chosen, ws.pickBeast, 'data-ws-beast')
        }
        className='grid gap-2 md:grid-cols-2'
      >
        {shown.map(each => {
          const checked = each.uuid === chosen
          const line = sizeCrWords(each.size, each.cr)
          const facts = [
            typeof each.ac === 'number' ? `AC ${each.ac}` : undefined,
            each.speeds.length > 0 ? each.speeds.join(', ') : undefined,
          ].filter(Boolean)
          return (
            <button
              key={each.uuid}
              type='button'
              role='radio'
              aria-checked={checked}
              aria-disabled={each.known || undefined}
              aria-label={[each.name, line, ...facts]
                .filter(Boolean)
                .join(', ')
                .concat(each.known ? ', known' : '')}
              tabIndex={each.uuid === stop ? 0 : -1}
              data-ws-beast={each.uuid}
              onClick={() => {
                if (!each.known) ws.pickBeast(each.uuid)
              }}
              className={clsx(
                'flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
                checked
                  ? 'border-wild bg-wild-bg/60 ring-1 ring-wild'
                  : 'border-border bg-card',
                each.known ? 'cursor-not-allowed' : 'hover:border-wild/50',
              )}
            >
              <span className='flex items-center gap-2.5'>
                <Paw />
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold'>{each.name}</span>
                  {line && (
                    <span className='block text-xs text-text-secondary'>
                      {line}
                    </span>
                  )}
                </span>
                {each.known && <Badge>Known</Badge>}
              </span>
              {facts.length > 0 && (
                <span className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
                  {facts.map(fact => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** A Beast to learn's footer: why it wasn't learned, and Learn {aForm}, "Learning…" on its way. */
function LearnFooter({ replace }: Readonly<{ replace?: KnownForm }>) {
  const ws = use(WildShapeContext)
  const { beasts } = ws
  const chosen =
    beasts?.status === 'done'
      ? beasts.forms.find(each => each.uuid === ws.beast && !each.known)
      : undefined
  const learning = ws.waiting === 'learn'
  const refused = ws.refusal?.op === 'learn' ? ws.refusal : undefined
  const blocked = learning || !chosen
  return (
    <>
      {refused && (
        <p role='alert' className='min-w-0 flex-1 text-sm text-warning'>
          {learnRefusedWords(
            ws.name,
            reasonWords(ws.role, 'learn', refused.key),
          )}
        </p>
      )}
      <button
        type='button'
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (chosen && !learning) ws.learn(chosen, replace)
        }}
        className={clsx(SOLID, 'ml-auto')}
      >
        {learning ? <Spinner /> : <PawPrint aria-hidden className='size-4' />}
        {learning && 'Learning…'}
        {!learning &&
          (chosen ? learnWords(chosen.name, replace?.name) : 'Learn')}
      </button>
    </>
  )
}
