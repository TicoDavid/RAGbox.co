import type { Metadata } from 'next'

/**
 * Landing V2 layout — forces pure black body/html via SSR-injected style.
 *
 * The root layout sets body bg to --bg-primary (#0A192F cobalt) with
 * transition-colors, which causes a visible color bleed during hydration.
 * This route-level layout injects a <style> tag server-side so the
 * browser paints black from the very first frame.
 */

export const metadata: Metadata = {
  title: 'RAGböx — Sovereign Knowledge for Professionals',
  description:
    'AI-powered document intelligence with sovereign control. Upload, query, and audit your documents with military-grade encryption and full citation trails.',
  openGraph: {
    title: 'RAGböx — Your Files Speak. We Make Them Testify.',
    description:
      'Sovereign knowledge management for legal, financial, and compliance professionals. Starting at $99/mo.',
    url: 'https://app.ragbox.co/landing-v2',
    siteName: 'RAGböx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RAGböx — Sovereign Knowledge',
    description:
      'AI document intelligence with citation trails and privilege mode.',
  },
}

export default function LandingV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background-color: #000000 !important;
          background: #000000 !important;
          border: none !important;
          outline: none !important;
          transition: none !important;
        }
      `}</style>
      {children}
    </>
  )
}
