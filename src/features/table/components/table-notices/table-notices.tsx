'use client'

import { GmNote } from '../gm-note/gm-note'
import { NotConnected } from '../not-connected/not-connected'
import { WildShapeEnded } from '@/features/sheet/components/wild-shape/wild-shape-ended'
import type { Character } from '@/types/character'
import type { TableView } from '@/types/table'

/**
 * What the table says under its header: at the Gamemaster's seat (#156), where their rolls go; for
 * a character no longer in its campaign's game, that only public messages show; and a Wild Shape
 * the game ended.
 * @param playing - Whether the character plays one of its campaign's characters.
 * @param seatKey - The seat's key, as its table page has it.
 * @param addBack - How the seat's words say the character is added back to the game.
 */
export function TableNotices({
  gm,
  playing,
  view,
  character,
  seatKey,
  addBack,
}: Readonly<{
  gm: boolean
  playing: boolean
  view: TableView
  character: Character
  seatKey: string
  addBack: string
}>) {
  return (
    <>
      {gm && <GmNote name={character.name} rolls={view.gm?.rolls ?? 'off'} />}
      {playing && view.campaign && !view.connected && (
        <NotConnected
          name={character.name}
          campaign={view.campaign.title}
          addBack={addBack}
        />
      )}
      {/* The game ended a Wild Shape (module 0.40.0): why, until dismissed. */}
      {playing && (
        <WildShapeEnded
          sheet={view.sheet}
          name={character.name}
          seat={seatKey}
        />
      )}
    </>
  )
}
