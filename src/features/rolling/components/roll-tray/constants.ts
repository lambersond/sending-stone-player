import {
  BellRing,
  Dices,
  EyeOff,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { RollBrief } from '../../types'

/** Each kind of total's colours, in the tray and the toasts alike. */
export const BADGES: Record<RollBrief['badge'], string> = {
  critical: 'bg-gold text-on-gold',
  fumble: 'bg-ruby text-on-ruby',
  plain: 'bg-primary/10 text-primary',
  damage: 'bg-damage/15 text-damage',
  healing: 'bg-primary/10 text-primary',
  use: 'bg-primary/10 text-primary',
  ask: 'bg-primary/10 text-primary',
  hidden: 'bg-primary/10 text-primary',
  dice: 'bg-primary/10 text-primary',
}

/** A badge's icon, for one that shows no total. */
export const BADGE_ICONS: Partial<Record<RollBrief['badge'], LucideIcon>> = {
  use: Sparkles,
  ask: BellRing,
  hidden: EyeOff,
  dice: Dices,
}
