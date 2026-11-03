import { ConditionsReference } from './conditions-reference'
import { SidePanel } from '@/components/side-panel/side-panel'
import type { SheetCondition } from '@/types/sending-stone'

/** The conditions panel, open at a condition (`open.at`) or at the top; closed without `open`. */
export function ConditionsPanel({
  open,
  onClose,
  conditions,
}: Readonly<{
  open?: { at?: string }
  onClose: () => void
  conditions: SheetCondition[]
}>) {
  return (
    <SidePanel
      open={open !== undefined}
      onClose={onClose}
      title='Conditions'
      subtitle='Every condition in the 2024 rules (5.5e)'
    >
      <ConditionsReference conditions={conditions} at={open?.at} />
    </SidePanel>
  )
}
