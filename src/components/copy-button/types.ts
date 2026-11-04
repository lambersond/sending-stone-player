export type CopyFieldProps = {
  value: string
  /** What is copied, for its accessible name: "Copy {label}". */
  label: string
  /**
   * Shown whole over as many lines as it takes, rather than cut to one: for a value that must be
   * read or copied by hand on a phone, such as a link code.
   */
  wrap?: boolean
  /** Called once the value is copied, such as for a toast saying so (round 0.39.0). */
  onCopied?: () => void
  /**
   * The button shows its word beside its icon, Copy, then Copied once it has copied, rather than
   * the icon alone (round 0.39.0).
   */
  word?: boolean
}
