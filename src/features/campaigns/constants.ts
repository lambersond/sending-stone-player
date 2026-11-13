// The looks of the campaigns page's buttons (round 0.39.0), shared by what the server draws and its
// controls: none a client module's, which the server would see only as a reference. And its head's
// words and boxes, which its skeleton shows too while the page reads (v0.48.0).

import { ICON_TARGET } from '@/constants/buttons'

/** Its quiet buttons, at least 40 px tall. */
export const QUIET_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/** Its quiet buttons for what can't be undone. */
export const DANGER_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'

/** Its icon buttons, 36 px square on a phone, 44 from `sm`. */
export const ICON_BUTTON = `${ICON_TARGET} size-9 rounded-lg text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger`

/** The page's head: its heading and what it's for, then its buttons, wrapping beneath them. */
export const CAMPAIGNS_HEAD = 'flex flex-wrap items-end justify-between gap-3'

/** The style of the page's heading. */
export const CAMPAIGNS_TITLE_STYLE = 'text-2xl font-semibold tracking-tight'

/** The style of what the page is for, under its heading. */
export const CAMPAIGNS_LEAD_STYLE = 'mt-1 max-w-[46ch] text-text-secondary'

/** A campaign's row in the list: its title and line, its chip beside them, then its seats. */
export const CAMPAIGN_ROW =
  'grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 rounded-[14px] border bg-card p-3'

/** A campaign's page, beside the list or in its place, as its skeleton draws it too. */
export const CAMPAIGN_CARD =
  'grid min-w-0 gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6'

/** The page's heading. */
export const CAMPAIGNS_HEADING = 'Your campaigns'

/** What the page is for, under its heading. */
export const CAMPAIGNS_LEAD =
  'Set up each campaign you run as Gamemaster, then share its invite link with your players.'

/** How long a toast shows, in milliseconds, as the design has it. */
export const TOAST_FOR = 1800
