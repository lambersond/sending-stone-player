/**
 * Was a message posted before its campaign's chat was last cleared (v0.44)? A change to one such,
 * no longer held, brings nothing back: the module sends a message it changes as a whole, as a dish
 * card from the Magical Recipe Book is once its Gamemaster serves it or sets it aside. Never where
 * the chat was never cleared.
 * @param timestamp - When it was posted, as the module says, in milliseconds.
 * @param clearedAt - When the chat was last cleared, if it ever was.
 */
export function postedBeforeClear(
  timestamp: number,
  clearedAt?: Date | null,
): boolean {
  return !!clearedAt && timestamp <= clearedAt.getTime()
}
