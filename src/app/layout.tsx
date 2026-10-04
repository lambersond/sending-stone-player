/* eslint-disable camelcase */
import { Geist, Geist_Mono } from 'next/font/google'
import { SiteHeader } from '@/components/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import type { Metadata } from 'next'
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
          <SiteHeader />
          <main className='flex flex-1 flex-col'>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
