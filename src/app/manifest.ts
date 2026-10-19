/* eslint-disable camelcase -- the Web App Manifest's own names */
import type { MetadataRoute } from 'next'

/**
 * The app as a phone or computer installs it: from the Home Screen, it opens on the characters,
 * without the browser's bars. Not `fullscreen`, which Safari doesn't support and which on Android
 * would hide the status bar on every page, signing in included.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Sending Stone',
    short_name: 'Sending Stone',
    description: 'Follow your Foundry VTT game from any device.',
    start_url: '/characters',
    scope: '/',
    display: 'standalone',
    background_color: '#0d0d14',
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
