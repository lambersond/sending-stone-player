import { joinParts } from '../../utils/join-parts'
import type { SheetItem, SheetContainer } from '@/types/sending-stone'

/**
 * What an item's row says of it: under its name, whether it's equipped or attuned, its weight and
 * its price; in full once open, as that line may be cut short, a container's capacity, its weight
 * and its price; and over those, what it is, such as its rarity and whether it needs attuning.
 */
export function itemWords(item: SheetItem | SheetContainer): {
  detail: string | undefined
  facts: { label: string; value: string }[]
  meta: string | undefined
} {
  const container = 'contents' in item ? item : undefined
  const { weight } = item
  const capacity = container?.capacity
  const heft =
    weight && `${weight.value.toLocaleString()} ${weight.units}`.trim()
  const detail = joinParts(
    item.equipped && 'Equipped',
    item.attuned && 'Attuned',
    heft,
    item.price,
  )
  // In full when open, as the line under its name may be cut short.
  const facts: { label: string; value: string }[] = []
  if (capacity) {
    facts.push({
      label: 'Capacity',
      value: `${capacity.value.toLocaleString()} / ${capacity.max.toLocaleString()} ${capacity.units}`,
    })
  }
  if (heft) facts.push({ label: 'Weight', value: heft })
  if (item.price) facts.push({ label: 'Price', value: item.price })
  const meta = joinParts(
    !item.identified && 'Not identified',
    item.rarity,
    item.attunement === 'required' && 'Requires attunement',
    item.attunement === 'optional' && 'Attunement optional',
    ...item.properties,
  )
  return { detail, facts, meta }
}
