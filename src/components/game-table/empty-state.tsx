import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  icon: LucideIcon
  title: string
  children: ReactNode
}

export function EmptyState({ icon: Icon, title, children }: Readonly<Props>) {
  return (
    <div className='mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center'>
      <Icon aria-hidden className='size-8 text-primary' />
      <h2 className='mt-4 font-semibold'>{title}</h2>
      <div className='mt-1 text-sm text-text-secondary'>{children}</div>
    </div>
  )
}
