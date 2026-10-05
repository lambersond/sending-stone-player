/** A modifier as a sheet shows it: always signed, with a true minus sign, as in +5 or −1. */
export function formatModifier(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`
}
