// The looks of the campaigns page's buttons (round 0.39.0), shared by what the server draws and its
// controls: none a client module's, which the server would see only as a reference.

import { ICON_TARGET } from '@/constants/buttons'

/** Its quiet buttons, at least 40 px tall. */
export const QUIET_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/** Its quiet buttons for what can't be undone. */
export const DANGER_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'

/** Its icon buttons, 36 px square on a phone, 44 from `sm`. */
export const ICON_BUTTON = `${ICON_TARGET} size-9 rounded-lg text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger`

/** How long a toast shows, in milliseconds, as the design has it. */
export const TOAST_FOR = 1800
