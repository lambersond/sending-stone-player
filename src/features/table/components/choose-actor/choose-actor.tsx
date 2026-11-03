'use client'

import { CharacterChooser } from '@/features/characters/components/character-chooser/character-chooser'
import type { GameTableProps } from '@/features/table/types'
import type { CampaignChoice } from '@/types/campaign'

/** For a character in a campaign that has yet to choose which of its characters it is. */
export function ChooseActor({
  choice,
  action,
}: Readonly<{
  choice: CampaignChoice
  action: NonNullable<GameTableProps['chooseActor']>
}>) {
  return (
    <div className='mx-auto w-full max-w-xl px-4 py-10'>
      <h2 className='text-lg font-semibold'>
        Choose your character in {choice.title}
      </h2>
      <p className='mt-1 mb-6 text-sm text-text-secondary'>
        Each character is played by one player. Choose yours to see its whispers
        and turns.
      </p>
      <CharacterChooser choice={choice} action={action} />
    </div>
  )
}
