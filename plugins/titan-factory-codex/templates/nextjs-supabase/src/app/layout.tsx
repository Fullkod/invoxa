import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Titan Codex App',
  description: 'Built with Titan Factory Codex',
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
