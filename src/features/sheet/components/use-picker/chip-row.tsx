'use client'

/**
 * A row of choices, of which one is made: as narrow as the picker, so a chip that cuts its name
 * short does, a fieldset being otherwise as wide as what's in it.
 */
export function ChipRow({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <fieldset className='min-w-0'>
      <legend className='mb-1.5 text-xs font-semibold text-text-secondary'>
        {label}
      </legend>
      <div className='flex flex-wrap gap-1.5'>{children}</div>
    </fieldset>
  )
}
