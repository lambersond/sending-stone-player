import { useState } from 'react'

/**
 * What makes the tray show its rolls whichever tab is open, Effects and Biography among them
 * (`triggered`): the player answered what the game asked (`setPrompted`), or rolled from a
 * description (`setDescribed`); or ended a concentration or an enchantment, spent a counter's
 * charges, or used or gained Heroic Inspiration, which they may from Effects too, a favorite's
 * among them, or gave an item or coin, as that rolls nothing (`setActed`).
 */
export function useTrayTriggers() {
  const [prompted, setPrompted] = useState(false)
  const [described, setDescribed] = useState(false)
  const [acted, setActed] = useState(false)
  return {
    triggered: prompted || described || acted,
    setPrompted,
    setDescribed,
    setActed,
  }
}
