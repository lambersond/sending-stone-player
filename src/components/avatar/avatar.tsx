import clsx from 'clsx'

type Props = {
  name: string
  image?: string | null
  className?: string
}

export function Avatar({ name, image, className }: Readonly<Props>) {
  const classes = clsx(
    'shrink-0 rounded-full bg-primary/15 object-cover',
    className ?? 'size-8',
  )

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- any provider's avatar host
      <img
        src={image}
        alt=''
        referrerPolicy='no-referrer'
        className={classes}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={clsx(
        classes,
        'inline-flex items-center justify-center font-semibold text-primary',
      )}
    >
      {initial(name)}
    </span>
  )
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'
