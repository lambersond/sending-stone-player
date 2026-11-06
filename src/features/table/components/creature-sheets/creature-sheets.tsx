'use client'

import clsx from 'clsx'
import { NoSheet } from '../no-sheet/no-sheet'
import { CompanionAskNotice } from '@/features/companions/components/companion-ask-notice/companion-ask-notice'
import { CompanionPane } from '@/features/companions/components/companion-pane/companion-pane'
import { CreatureSwitcher } from '@/features/companions/components/creature-switcher/creature-switcher'
import { CharacterPane } from '@/features/sheet/components/character-pane/character-pane'
import { switcherCreatures } from '@/features/table/utils/creatures'
import type { NotesPlace } from '@/features/notes/types'
import type {
  CompanionRow,
  CookbookEntry,
  DiceSwitch,
} from '@/features/table/types'
import type { Character, TableSeat } from '@/types/character'
import type { CookbookPlace } from '@/types/cookbook'
import type { TableGroup } from '@/types/party'
import type { SeatWords } from '@/types/seats'
import type { TableView } from '@/types/table'
import type { ReactNode } from 'react'

/**
 * The character's own pane, and the companions' mounted, in the row's order, with the row of tabs
 * that switches between them above, from module 0.36.0, where the character has companions.
 * @param companions - The row of companions, as `useCompanionRow` keeps it.
 * @param asking - Whether the game asks a save of the character that still waits.
 * @param header - The table's header, which the sheets' roll toasts start below.
 * @param parties - The party sheets the character may open, where there are any.
 * @param playing - Whether the character plays one of its campaign's characters.
 * @param entry - The Magical Recipe Book's button and dialog with no sheet, as `useCookbookEntry`
 *   has them.
 */
export function CreatureSheets({
  character,
  seat,
  view,
  companions,
  words,
  asking,
  header,
  diceSwitch,
  notes,
  cookbook,
  entry,
  parties,
  onOpenParty,
  playing,
}: Readonly<{
  character: Character
  seat: TableSeat
  view: TableView
  companions: CompanionRow
  words: SeatWords
  asking: boolean
  header: HTMLElement | null
  diceSwitch?: DiceSwitch
  notes: NotesPlace
  cookbook?: CookbookPlace
  entry: CookbookEntry
  parties?: TableGroup[]
  onOpenParty: (id: string) => void
  playing: boolean
}>) {
  const {
    row,
    names,
    numbers,
    generations,
    waiting,
    waitingKeys,
    chosen,
    choose,
    paneMarks,
    reportersOf,
    panes,
    openCompanion,
  } = companions
  // From module 0.36.0, the character's companions, each with a tab above the sheet.
  const switching = row.length > 0
  const creatures = switcherCreatures({
    character: character.name,
    view,
    asking,
    asksForRoll: words.asksForRoll,
    row,
    numbers,
    waitingKeys,
    paneMarks,
  })
  const selfShown = chosen === 'self'
  return (
    <>
      {switching && (
        <CreatureSwitcher
          creatures={creatures}
          chosen={chosen}
          onChoose={choose}
          mounted={new Set(panes)}
          character={character.name}
          role={seat.role}
        />
      )}
      <div
        id='creature-panel-self'
        {...(switching && {
          role: 'tabpanel',
          'aria-labelledby': 'creature-tab-self',
        })}
        hidden={switching && !selfShown}
        className={clsx(
          'min-h-0 min-w-0 flex-1 flex-col',
          switching && !selfShown ? 'hidden' : 'flex',
        )}
      >
        {view.sheet ? (
          <OwnSheet
            shown={selfShown}
            seat={seat}
            character={character}
            view={view}
            sheet={view.sheet}
            header={header}
            onOpenParty={onOpenParty}
            diceSwitch={diceSwitch}
            notes={notes}
            cookbook={cookbook}
            companionNotice={
              waiting.length > 0 && (
                <CompanionAskNotice asked={waiting} onShow={openCompanion} />
              )
            }
          />
        ) : (
          <NoSheet
            name={character.name}
            withheld={view.sheetWithheld}
            words={words}
            parties={parties}
            onOpenParty={onOpenParty}
            playing={playing}
            notes={notes}
            cookbook={cookbook}
            entry={entry}
          />
        )}
      </div>
      {row
        .filter(({ key }) => panes.includes(key))
        .map(companion => (
          <CompanionPane
            // Mounted afresh when it comes back after it had gone, as its view stops for good.
            key={`${companion.key}:${generations.get(companion.key) ?? 0}`}
            seat={seat}
            companion={companion}
            name={names.get(companion.key) ?? companion.name}
            character={character.name}
            shown={chosen === companion.key}
            gone={companion.gone === true}
            {...reportersOf(companion.key)}
            header={header}
            manualDice={diceSwitch}
          />
        ))}
    </>
  )
}

/**
 * The character's own sheet, its rolls shared with its companions' on the table's one renderer;
 * what the game takes from it only while the character is in its campaign's game.
 * @param sheet - Its sheet, as the view has it.
 */
function OwnSheet({
  shown,
  seat,
  character,
  view,
  sheet,
  header,
  onOpenParty,
  diceSwitch,
  notes,
  cookbook,
  companionNotice,
}: Readonly<{
  shown: boolean
  seat: TableSeat
  character: Character
  view: TableView
  sheet: NonNullable<TableView['sheet']>
  header: HTMLElement | null
  onOpenParty: (id: string) => void
  diceSwitch?: DiceSwitch
  notes: NotesPlace
  cookbook?: CookbookPlace
  companionNotice: ReactNode
}>) {
  return (
    <CharacterPane
      shown={shown}
      sharedDice
      characterId={seat.key}
      name={character.name}
      sheet={sheet}
      combat={view.combat}
      // A character no longer in the campaign's game has no rolls made there.
      rollsToTable={view.connected ? view.rollsToTable : undefined}
      rollFeatures={view.connected ? view.rollFeatures : undefined}
      prompts={view.connected ? view.prompts : undefined}
      gmRolls={view.gmRolls}
      header={header}
      // Nor its items and coins moved there (module 0.31.0), by either seat.
      moves={view.connected ? view.moves : undefined}
      // Nor its items removed there (module 0.33.0), by either seat.
      removes={view.connected && view.removes === true}
      favorites={view.connected && view.favorites === true}
      // Its own effects turned off, on and deleted (module 0.39.0): the player's alone, at the
      // character's own pane, never a companion's.
      effects={view.effects}
      // Wild Shape from here (module 0.40.0): the player's alone, at the character's own
      // pane, never a companion's.
      wildShape={view.wildShape}
      // Its hit points set from here (module 0.44.0): the player's alone, whatever the rolls, its
      // form's while shaped.
      hitPoints={view.connected ? view.hitPoints : undefined}
      actorId={character.actorId ?? undefined}
      // The party sheets it may open, on its Inventory tab (module 0.30.0).
      parties={view.groups && { groups: view.groups, onOpen: onOpenParty }}
      manualDice={diceSwitch}
      notes={notes}
      cookbook={cookbook}
      // Which of its companions the game asks a save of, from module 0.41.0.
      companionNotice={companionNotice}
    />
  )
}
