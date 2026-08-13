import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { NavTabs } from './nav'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'journal.',
  description: 'personal journal',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-surface text-text-primary font-mono">
        <NavTabs />
        {children}
      </body>
    </html>
  )
}
