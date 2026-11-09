import { BRIDGE_TIMEOUT } from '@/constants/sending-stone'

/** Is a Gamemaster's game sending, judging by when its campaign last heard anything? */
export function isLive(lastSeenAt: Date | null | undefined, now = Date.now()) {
  return !!lastSeenAt && now - lastSeenAt.getTime() < BRIDGE_TIMEOUT
}
