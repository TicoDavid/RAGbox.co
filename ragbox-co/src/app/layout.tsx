import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Font configurations
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RAGbox | Your Files Speak. We Make Them Testify.",
  description:
    "Secure, compliance-ready document intelligence for legal, financial, and healthcare professionals. SEC 17a-4 ready. HIPAA aware. Audit-ready from day one.",
  keywords: [
    "RAG",
    "document intelligence",
    "legal tech",
    "compliance",
    "SEC 17a-4",
    "HIPAA",
    "AI document analysis",
    "attorney-client privilege",
  ],
  authors: [{ name: "ConnexUS AI" }],
  creator: "ConnexUS AI",
  publisher: "ConnexUS AI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ragbox.co"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ragbox.co",
    siteName: "RAGbox",
    title: "RAGbox | Your Files Speak. We Make Them Testify.",
    description:
      "Secure, compliance-ready document intelligence for legal, financial, and healthcare professionals.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RAGbox - Document Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RAGbox | Your Files Speak. We Make Them Testify.",
    description:
      "Secure, compliance-ready document intelligence for legal, financial, and healthcare professionals.",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {/* Main content */}
        {children}
        
        {/* Trust badge for security (always visible) */}
        <div className="fixed bottom-4 right-4 z-50 hidden sm:block">
          <div className="flex items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 text-xs text-muted backdrop-blur-sm border border-border">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>AES-256 Encrypted</span>
          </div>
        </div>
      </body>
    </html>
  );
}
