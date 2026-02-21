import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — RAGböx | Sovereign Knowledge for Professionals',
  description:
    'RAGböx Sovereign $99/mo — unlimited vault, AEGIS intelligence, Studio. Add Mercury for $99/mo — voice AI, omnichannel, 24/7 digital hire.',
  openGraph: {
    title: 'RAGböx Pricing — Plans Starting at $99/mo',
    description:
      'Sovereign knowledge management with AEGIS intelligence. Add Mercury AI for complete omnichannel automation.',
    url: 'https://app.ragbox.co/pricing',
    siteName: 'RAGböx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RAGböx Pricing',
    description: 'Sovereign knowledge management starting at $99/mo.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
