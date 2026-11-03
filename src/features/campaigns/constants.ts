// The looks of the campaigns page's buttons (round 0.39.0), shared by what the server draws and its
// controls: none a client module's, which the server would see only as a reference.

/** Its quiet buttons, at least 40 px tall. */
export const QUIET_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/** Its quiet buttons for what can't be undone. */
export const DANGER_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'

/** Its icon buttons, 36 px square. */
export const ICON_BUTTON =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'
