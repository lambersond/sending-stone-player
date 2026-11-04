import {
  Sword,
  Wand,
  FlaskConical,
  Shield,
  type LucideIcon,
} from 'lucide-react'

/** Icons for actions without one of their own, by the item's type. */
export const FALLBACKS: Record<string, LucideIcon> = {
  weapon: Sword,
  spell: Wand,
  consumable: FlaskConical,
  equipment: Shield,
}
