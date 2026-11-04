import { DamageCard } from './damage-card'
import { RollCard } from './roll-card'
import type { TableMessage } from '@/types/table'

/** A roll message's body: a card for each roll, then its damage rolls, a card for each section. */
export function RollBody({
  message,
  mine,
}: Readonly<{ message: TableMessage; mine: boolean }>) {
  const { whisper, label, rolls, attackRoll, targets, summary } = message
  return (
    <>
      {rolls.map((roll, index) => (
        <RollCard
          key={index}
          roll={roll}
          label={label}
          // Only its attack is marked: its damage cards carry their own marks.
          action={attackRoll?.index === index ? attackRoll.action : undefined}
          // Who it was aimed at, called out once, on the first card.
          targets={index === 0 ? targets : []}
          summary={index === 0 ? summary : undefined}
          whisper={whisper}
          mine={mine}
        />
      ))}
      {/* By its section, so an open card stays open as Midi-QOL adds the other. */}
      {message.damage?.map((damage, index) => (
        <DamageCard
          key={damage.section}
          damage={damage}
          // Under its attack's card, the item's name isn't said again.
          label={attackRoll ? undefined : label}
          targets={rolls.length === 0 && index === 0 ? targets : []}
          summary={rolls.length === 0 && index === 0 ? summary : undefined}
          whisper={whisper}
          mine={mine}
        />
      ))}
    </>
  )
}
