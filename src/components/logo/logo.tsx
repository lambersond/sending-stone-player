import clsx from 'clsx'

/**
 * The Sending Stone stone, as its design draws it: the mark alone, or the app icon on its night
 * tile. Each is drawn from the design at one, two and three times its size, so the stone's grain
 * and its carved rune stay sharp on any screen.
 */
const LOGOS = {
  mark: { name: 'stone-mark', size: 20 },
  icon: { name: 'stone-icon', size: 72 },
} as const

export function Logo({
  variant,
  className,
}: Readonly<{ variant: keyof typeof LOGOS; className?: string }>) {
  const { name, size } = LOGOS[variant]
  const path = (scale: number) => `/brand/${name}-${size * scale}.png`
  return (
    // A fixed image already at each size it's shown at, which Next's image optimizer would only
    // compress again. It says nothing the words beside it don't.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={path(1)}
      srcSet={`${path(1)} 1x, ${path(2)} 2x, ${path(3)} 3x`}
      width={size}
      height={size}
      alt=''
      className={clsx('shrink-0 select-none', className)}
      draggable={false}
    />
  )
}
