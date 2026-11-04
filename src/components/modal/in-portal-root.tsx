'use client'

import { PortalRoot } from './use-portal-root'
import type { ReactNode } from 'react'

/** Has the menus and tooltips opened inside it go in this element: a modal dialog's. */
export function InPortalRoot({
  root,
  children,
}: Readonly<{ root: HTMLElement | null; children: ReactNode }>) {
  return <PortalRoot value={root}>{children}</PortalRoot>
}
