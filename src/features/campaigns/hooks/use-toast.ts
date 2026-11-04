import { createContext, use } from 'react'
import type { Toast } from '@/features/campaigns/types'

/** No toast, as anywhere outside a page that shows them. */
const NO_TOAST: Toast = () => {}

export const ToastContext = createContext<Toast>(NO_TOAST)

/** Shows a toast on the page, where the page shows them. */
export function useToast(): Toast {
  return use(ToastContext)
}
