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
    images: [
      {
        url: 'https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png',
        width: 1200,
        height: 630,
        alt: 'RAGböx Pricing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RAGböx Pricing',
    description: 'Sovereign knowledge management starting at $99/mo.',
    images: ['https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png'],
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
