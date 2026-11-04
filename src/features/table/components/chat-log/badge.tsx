import clsx from 'clsx'

/** A card's badge, such as "Critical" or "Advantage". */
export function Badge({
  className,
  children,
}: Readonly<{ className: string; children: string }>) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}
