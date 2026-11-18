import { LAUNCH_COLORS, LAUNCH_PATH } from '@/features/launch/constants'
import type { MetadataRoute } from 'next'

/**
 * The app as a phone or computer installs it: from the Home Screen, it opens on its launch page,
 * which hands over to the characters (ROADMAP item 56), without the browser's bars. Its background
 * is the launch page's own, so that the phone's launch screen and the page read as one. Not
 * `fullscreen`, which Safari doesn't support and which on Android would hide the status bar on
 * every page, signing in included.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Sending Stone',
    short_name: 'Sending Stone',
    description: 'Follow your Foundry VTT game from any device.',
    start_url: LAUNCH_PATH,
    scope: '/',
    display: 'standalone',
    background_color: LAUNCH_COLORS.background,
    theme_color: '#0d0d14',
    icons: [
      {
        src: '/brand/stone-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/stone-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/stone-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
