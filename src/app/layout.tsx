/* eslint-disable camelcase */
import { Geist, Geist_Mono } from 'next/font/google'
import { FullscreenGuard } from '@/components/game-table/fullscreen-guard'
import { SiteHeader } from '@/components/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: { default: 'Sending Stone', template: '%s · Sending Stone' },
  description: 'Follow your Foundry VTT game from any device.',
  // Its name on a phone's Home Screen, where it opens without the browser's bars, as the manifest
  // says. The default status bar keeps the page below it, so the header needs no inset.
  appleWebApp: { title: 'Sending Stone', statusBarStyle: 'default' },
}

/** The browser's bars take the page's colour, light or dark as the device is. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d14' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang='en'
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes sets the theme class on <html> before React hydrates
      suppressHydrationWarning
    >
      <body className='min-h-full flex flex-col font-sans'>
        <ThemeProvider>
          <FullscreenGuard />
          <SiteHeader />
          <main className='flex flex-1 flex-col'>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
