import { readFileSync } from 'node:fs'
import path from 'node:path'
import { launchDocument } from '@/features/launch/utils'

// Built once, with the app: the same document for everyone, signed in or not.
export const dynamic = 'force-static'

/**
 * The installed app's launch page (ROADMAP item 56), where the manifest opens it: the stone
 * lighting until the first page takes over. It isn't a page of the layout's: it reads no session
 * and carries nobody's data, so the launch worker may keep it.
 */
export function GET(): Response {
  // The image's name is written out here, so that whatever packs the app can see it's read.
  const stone = readFileSync(
    path.join(process.cwd(), 'public', 'brand', 'stone-icon-288.png'),
  )
  const page = launchDocument(
    `data:image/png;base64,${stone.toString('base64')}`,
  )
  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
