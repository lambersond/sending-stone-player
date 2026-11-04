import { createContext, use } from 'react'
import { NO_TRANSFERS } from '@/features/transfers/constants'
import type { TransferControls } from '@/features/transfers/types'

export const Controls = createContext<TransferControls>(NO_TRANSFERS)

/** The controls the sheet's items and coins are given, as it's given them. */
export function useTransferring(): TransferControls {
  return use(Controls)
}
