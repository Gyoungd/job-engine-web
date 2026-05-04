import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Job Engine',
  description: 'Personal job application dashboard',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Job Engine',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e3a5f',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
