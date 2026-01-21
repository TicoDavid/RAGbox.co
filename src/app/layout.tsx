import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'RAGbox - Sovereign Document Intelligence',
  description:
    'A Digital Fort Knox for private knowledge. Interrogate your documents with confidence.',
  keywords: ['RAG', 'document intelligence', 'legal tech', 'AI', 'secure'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
