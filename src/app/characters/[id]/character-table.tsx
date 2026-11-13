import {
  chooseActor,
  deleteCharacterAndLeave,
  makeCookbookCode,
  markChatReadUpTo,
  revokeCookbookCode,
  setManualDice,
} from '../actions'
import { getCampaignChoice } from '@/db/campaigns'
import { playerSeat } from '@/db/seats'
import { getTableView } from '@/db/table'
import { GameTable } from '@/features/table/components/game-table/game-table'
import type { Character } from '@/types/character'

/**
 * A player's character's table (v0.48.0: read once the page has found the character theirs, the
 * loading stone showing until then).
 */
export async function CharacterTable({
  character,
  userId,
}: Readonly<{ character: Character; userId: string }>) {
  // A character in a campaign but not yet one of its characters chooses which it is.
  const { campaignId, actorId } = character
  const [view, choice] = await Promise.all([
    getTableView(playerSeat(character, userId)),
    campaignId && !actorId
      ? getCampaignChoice(campaignId, userId, character.id)
      : undefined,
  ])
  return (
    <GameTable
      character={character}
      initialView={view}
      choice={choice}
      chooseActor={chooseActor.bind(undefined, character.id)}
      deleteCharacter={deleteCharacterAndLeave.bind(undefined, character.id)}
      markChatRead={markChatReadUpTo.bind(undefined, character.id)}
      setManualDice={setManualDice.bind(undefined, character.id)}
      makeCookbookCode={makeCookbookCode.bind(undefined, character.id)}
      revokeCookbookCode={revokeCookbookCode.bind(undefined, character.id)}
    />
  )
}
