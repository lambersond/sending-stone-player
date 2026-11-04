'use client'

/** What deleting a character means for its player. */
export function DeleteCharacterWarning({ name }: Readonly<{ name: string }>) {
  return (
    <p>
      You stop following your campaign as {name}. Someone else can then choose{' '}
      {name} from the campaign&apos;s invite link, and so can you.
    </p>
  )
}
