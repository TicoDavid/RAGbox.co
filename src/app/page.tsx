'use client'

import { useState } from 'react'

/**
 * US-001: Landing Page
 *
 * Acceptance Criteria:
 * - Page loads in dark mode by default
 * - Headline and subhead are visible without scrolling
 * - Primary CTA "Feed the Box" is present
 * - No upload or query actions are available (unauthenticated)
 * - Clear value proposition displayed
 */
export default function LandingPage() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <main className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="text-xl font-semibold text-white">RAGbox</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-white transition-colors px-4 py-2">
              Sign In
            </button>
            <button className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg transition-colors font-medium">
              Request Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 pt-24 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 mb-8">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-slate-300">
              Zero Data Exfiltration Guarantee
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight text-balance">
            Document Interrogation
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
              in a Sovereign Environment
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto text-balance">
            A Digital Fort Knox for your confidential documents.
            <br />
            AI-powered answers grounded in your data, with verifiable citations.
          </p>

          {/* Primary CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={`
                relative px-8 py-4 rounded-xl font-semibold text-lg
                bg-gradient-to-r from-sky-600 to-blue-600
                hover:from-sky-500 hover:to-blue-500
                text-white shadow-lg shadow-sky-500/25
                transition-all duration-300
                ${isHovered ? 'vault-glow scale-105' : ''}
              `}
            >
              Feed the Box
              <span className="ml-2">→</span>
            </button>
            <button className="px-8 py-4 rounded-xl font-semibold text-lg text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors">
              See How It Works
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <TrustCard
              icon="🔒"
              title="Sovereign Stack"
              description="Your data never leaves your VPC. Self-hosted LLM and embeddings."
            />
            <TrustCard
              icon="📋"
              title="Verifiable Citations"
              description="Every answer traces back to your documents. No hallucinations."
            />
            <TrustCard
              icon="🛡️"
              title="Audit Everything"
              description="Immutable logs under the Veritas Protocol. 7-year retention."
            />
          </div>
        </div>
      </section>

      {/* Feature Preview Section */}
      <section className="px-6 py-24 bg-slate-900/50 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Built for High-Stakes Professionals
          </h2>
          <p className="text-lg text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Attorneys, compliance officers, and financial analysts trust RAGbox
            to interrogate their most sensitive documents.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FeatureCard
              title="Confidence Gate"
              description="If RAGbox can't answer with 85%+ confidence, it refuses rather than speculates. Silence is safer than speculation."
              highlight="≥ 0.85 threshold"
            />
            <FeatureCard
              title="Role-Based Access"
              description="Partners, Associates, and Auditors each see exactly what they need. Zero-trust by default."
              highlight="3 distinct roles"
            />
            <FeatureCard
              title="Document Vault"
              description="Upload up to 1,000 documents per vault. Query across all of them simultaneously."
              highlight="1,000 docs / 50GB"
            />
            <FeatureCard
              title="Graceful Refusal"
              description="When the system can't help, it says so clearly and calmly. No alarming error messages."
              highlight="Trust-first UX"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="text-slate-400">RAGbox.co</span>
          </div>
          <p className="text-sm text-slate-500">
            Sovereign document intelligence for professionals who can't afford to compromise.
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function TrustCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  )
}

function FeatureCard({
  title,
  description,
  highlight,
}: {
  title: string
  description: string
  highlight: string
}) {
  return (
    <div className="p-8 rounded-xl bg-slate-800/30 border border-slate-700 hover:border-sky-500/50 transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
          {highlight}
        </span>
      </div>
      <p className="text-slate-400">{description}</p>
    </div>
  )
}
