import type { ReactNode, RefObject } from 'react'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Under the title, such as where its content comes from. */
  subtitle?: string
  /** On a phone, as wide as the screen, as the side panel is: for content that needs the room. */
  fullOnPhone?: boolean
  /**
   * What takes focus as it opens, such as a confirm's Cancel (round 0.39.0): without it, the
   * browser gives focus to the first control in it, the header's Close.
   */
  initialFocus?: RefObject<HTMLElement | null>
  /**
   * Where it sits (round 0.40.0): centred, as ever; or as a sheet, which on a phone rises from the
   * bottom of the screen, as wide as it, its top corners rounded, at most 92% of its height, and
   * from `sm` up is a centred dialog up to 640 pixels wide.
   */
  placement?: 'center' | 'sheet'
  /**
   * What stays under its content, outside what scrolls, such as a picker's note and its button
   * (round 0.40.0); above the screen's own inset at the bottom, as a sheet.
   */
  footer?: ReactNode
  /** A way back, before its title, for a dialog with views one inside another (round 0.40.0). */
  back?: { label: string; onClick: () => void }
  children: ReactNode
}

export type Asked = {
  title: string
  /** What will happen. */
  children: ReactNode
  confirmLabel: string
  /** What the button that keeps things as they are says. */
  cancelLabel?: string
  onConfirm: () => Promise<void>
  danger?: boolean
  /**
   * Has Cancel take focus as it opens, rather than the browser's first control, its Close: the
   * campaign page's dialogs (round 0.39.0), so Enter keeps things as they are.
   */
  focusCancel?: boolean
}

export type ConfirmDialogProps = Asked & {
  /** What the button that opens it shows. */
  trigger: ReactNode
  /** The button's accessible name, when it shows only an icon. */
  triggerLabel?: string
  triggerClassName: string
}
