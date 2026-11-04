import {
  Droplet,
  HeartPulse,
  Sparkles,
  Swords,
  type LucideIcon,
} from 'lucide-react'
import type { TableAction } from '@/types/table'

/**
 * How each kind of combat roll is marked: a chip naming it, and an accent down the card's edge.
 * Each chip's text is its colour's text token, deep enough to read at WCAG AA on its tint over
 * every bubble, the player's own and a whisper's too.
 */
export const ACTIONS: Record<
  TableAction,
  { label: string; icon: LucideIcon; chip: string; accent: string }
> = {
  attack: {
    label: 'Attack',
    icon: Swords,
    chip: 'bg-attack/15 text-attack-text',
    accent: 'border-l-attack',
  },
  'spell-attack': {
    label: 'Spell attack',
    icon: Sparkles,
    chip: 'bg-spell/15 text-spell-text',
    accent: 'border-l-spell',
  },
  damage: {
    label: 'Damage',
    icon: Droplet,
    chip: 'bg-damage/15 text-damage-text',
    accent: 'border-l-damage',
  },
  healing: {
    label: 'Healing',
    icon: HeartPulse,
    chip: 'bg-primary/10 text-primary-text',
    accent: 'border-l-primary',
  },
  spell: {
    label: 'Spell',
    icon: Sparkles,
    chip: 'bg-spell/15 text-spell-text',
    accent: 'border-l-spell',
  },
}

/** The caption style of a card's small heading, such as "Used". */
export const CAPTION =
  'text-[11px] font-semibold tracking-wider text-text-secondary uppercase'
