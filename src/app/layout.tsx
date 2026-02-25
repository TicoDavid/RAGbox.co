import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Space_Grotesk, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { Toaster } from 'sonner'
import './globals.css'

// 1. Authority (Headers)
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
})

// 2. Readability (Body)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// 3. Truth (Code/Logs)
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

// 4. Dashboard body font (v2.0)
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'RAGböx — Sovereign Knowledge for Professionals',
    template: '%s | RAGböx',
  },
  description: 'AI-powered document intelligence with sovereign control. Transform unstructured documents into a queryable knowledge base with verified citations and attorney-client privilege protection.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'RAGböx — Sovereign Knowledge for Professionals',
    description: 'AI-powered document intelligence with sovereign control. Verified citations, privilege protection, and immutable audit trails.',
    url: 'https://app.ragbox.co',
    siteName: 'RAGböx',
    type: 'website',
    images: [
      {
        url: 'https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png',
        width: 1200,
        height: 630,
        alt: 'RAGböx — Sovereign Knowledge',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RAGböx — Sovereign Knowledge for Professionals',
    description: 'AI-powered document intelligence with sovereign control.',
    images: ['https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png'],
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // STORY-207: Read CSP nonce from middleware for inline script/style tags
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') || ''

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable} ${jakarta.variable} font-sans bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased overflow-x-hidden overflow-y-auto transition-colors duration-300`} nonce={nonce}>
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
            >
              {children}
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#112240',
              border: '1px solid #233554',
              color: '#E5E7EB',
            },
          }}
        />
      </body>
    </html>
  )
}
