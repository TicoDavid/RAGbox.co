// THEME-EXEMPT: Landing V3 — Pure black, Three.js orb, premium
// Landing-only design tokens (not in design-tokens.css — see BRANDING_GUIDELINES.md §0)
// --bg-void: #000000    --accent-glow: #F59E0B (amber)
// --accent-warm: #D4A853  --text-muted: #4A5568
'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { AuthModal } from '@/components/AuthModal'
import {
  Upload,
  MessageSquare,
  FileCheck,
  Lock,
  Users,
  FileText,
  Mic,
  Briefcase,
  BarChart3,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Settings,
  Eye,
  Search,
  BookOpen,
  Sparkles,
  Monitor,
  Table,
  ClipboardCheck,
  Image,
  GitBranch,
  Headphones,
  Video,
  Mail,
  MessageCircle,
  Check,
  ArrowRight,
  Shield,
} from 'lucide-react'

// Lazy-load the Three.js orb — hero text renders first
const VaultOrb = dynamic(
  () => import('@/components/landing/VaultOrb').then((m) => m.VaultOrb),
  { ssr: false }
)

type AuthContext = 'signin' | 'signup' | 'upload'

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Sign-in was interrupted. Please try again.',
  OAuthCreateAccount: 'Could not create your account. Please try again.',
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  AccessDenied: 'Access was denied. Please accept the permissions to continue.',
  default: 'Something went wrong during sign-in. Please try again.',
}

/* ─── Persona data (Lucide icons, NO emoji) ─── */
const PERSONAS = [
  { label: 'CEO', icon: Briefcase },
  { label: 'CFO', icon: BarChart3 },
  { label: 'Legal', icon: Scale },
  { label: 'Compliance', icon: ShieldCheck },
  { label: 'Risk', icon: AlertTriangle },
  { label: 'Ops', icon: Settings },
  { label: 'Whistleblower', icon: Eye },
  { label: 'Auditor', icon: Search },
  { label: 'Research', icon: BookOpen },
  { label: 'Custom', icon: Sparkles },
]

/* ─── Studio output types ─── */
const STUDIO_OUTPUTS = [
  { label: 'Report .docx', icon: FileText },
  { label: 'Deck .pptx', icon: Monitor },
  { label: 'Evidence .xlsx', icon: Table },
  { label: 'Audit .pdf', icon: ClipboardCheck },
  { label: 'Infographic', icon: Image },
  { label: 'Mind Map', icon: GitBranch },
  { label: 'Audio Brief', icon: Headphones },
  { label: 'Video Brief', icon: Video },
]

/* ─── Pricing (TWO tiers only per spec) ─── */
const PRICING = [
  {
    name: 'Starter',
    price: '$99',
    period: '/mo',
    features: ['1 vault', '100 documents', '5 personas', 'Studio basic'],
    cta: 'Start Free',
    gold: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Unlimited vaults',
      'Unlimited documents',
      'Custom personas',
      'Studio + API',
      'Mercury + Voice',
      'VERITAS audit trail',
    ],
    cta: 'Contact Sales',
    gold: true,
  },
]

/* ─── Typewriter prompts ─── */
const TYPEWRITER_PROMPTS = [
  'Conduct a forensic audit on the Q3 Report...',
  'Extract all liability clauses from these contracts...',
  'Synthesize a briefing for the Board of Directors...',
  'Find every reference to indemnification across 400 pages...',
]

function useTypewriter(strings: string[]) {
  const [display, setDisplay] = useState('')
  const indexRef = useRef(0)
  const phaseRef = useRef<'typing' | 'paused' | 'erasing' | 'gap'>('typing')
  const charRef = useRef(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const current = strings[indexRef.current]
      const phase = phaseRef.current

      if (phase === 'typing') {
        charRef.current++
        setDisplay(current.slice(0, charRef.current))
        if (charRef.current >= current.length) {
          phaseRef.current = 'paused'
          timer = setTimeout(tick, 2000)
        } else {
          timer = setTimeout(tick, 50)
        }
      } else if (phase === 'paused') {
        phaseRef.current = 'erasing'
        timer = setTimeout(tick, 30)
      } else if (phase === 'erasing') {
        charRef.current--
        setDisplay(current.slice(0, charRef.current))
        if (charRef.current <= 0) {
          phaseRef.current = 'gap'
          timer = setTimeout(tick, 500)
        } else {
          timer = setTimeout(tick, 30)
        }
      } else {
        indexRef.current = (indexRef.current + 1) % strings.length
        charRef.current = 0
        phaseRef.current = 'typing'
        timer = setTimeout(tick, 50)
      }
    }

    timer = setTimeout(tick, 50)
    return () => clearTimeout(timer)
  }, [strings])

  return display
}

/* ─── Fade-in helper ─── */
function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════
   LANDING V3 — "The Vault Orb"
   ═══════════════════════════════════════════════════════════ */
function LandingV3Content() {
  const searchParams = useSearchParams()
  const [isAuthOpen, setAuthOpen] = useState(false)
  const [authContext, setAuthContext] = useState<AuthContext>('signin')
  const [authError, setAuthError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const typewriterText = useTypewriter(TYPEWRITER_PROMPTS)

  // OAuth error detection
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      window.history.replaceState({}, '', '/landing-v2')
      const authInitiated = sessionStorage.getItem('ragbox_auth_initiated')
      if (authInitiated) {
        sessionStorage.removeItem('ragbox_auth_initiated')
        setAuthError(OAUTH_ERROR_MESSAGES[error] || OAUTH_ERROR_MESSAGES.default)
        setAuthOpen(true)
      }
    }
  }, [searchParams])

  // Navbar scroll effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openAuth = (context: AuthContext) => {
    setAuthContext(context)
    setAuthError(null)
    setAuthOpen(true)
  }

  return (
    <main
      className="min-h-screen bg-black text-[#E6F1FF] border-0"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        scrollBehavior: 'smooth',
        // Landing-only tokens (BRANDING_GUIDELINES.md §0)
        '--bg-void': '#000000',
        '--accent-glow': '#F59E0B',
        '--accent-warm': '#D4A853',
        '--text-muted': '#4A5568',
      } as React.CSSProperties}
    >

      {/* ━━━ NAVBAR (Floating, transparent → dark on scroll) ━━━ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-4 border-0 transition-all duration-500 ${
          scrolled ? 'bg-black/80 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <img
            src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
            alt="RAGbox"
            className="h-14 w-auto"
          />
          <div className="flex items-center gap-4">
            <button
              onClick={() => openAuth('signin')}
              className="hidden sm:block text-sm text-[#8892B0] hover:text-[#E6F1FF] transition-colors"
            >
              Sign In
            </button>
            <a
              href="mailto:david@theconnexus.ai?subject=RAGb%C3%B6x%20Demo%20Request"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-white/10 text-[#8892B0] hover:text-[#E6F1FF] hover:border-white/20 transition-all"
            >
              Request Demo
            </a>
          </div>
        </div>
      </nav>

      {/* ━━━ SECTION 1: HERO — The Vault Orb ━━━ */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden border-0">
        {/* Three.js Orb (includes ambient glow + pulse internally) */}
        <div className="relative z-10 mb-10 pointer-events-none">
          <VaultOrb />
        </div>

        {/* Text content below orb */}
        <div className="relative z-20 text-center max-w-2xl mx-auto space-y-5">
          <FadeIn delay={0.2}>
            <h1 className="text-[32px] sm:text-[40px] md:text-[56px] font-bold tracking-[-0.02em] leading-[1.1]">
              Your Documents.{' '}
              <span
                style={{
                  background: 'linear-gradient(to right, #FBBF24, #CA8A04)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Interrogated.
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.35}>
            <p className="text-base md:text-lg text-[#8892B0]">
              Every answer cited. Every source verified.
            </p>
          </FadeIn>

          {/* Search bar */}
          <FadeIn delay={0.5}>
            <div
              onClick={() => openAuth('signup')}
              className="mx-auto max-w-[560px] flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:border-amber-500/40 transition-colors"
            >
              <span className="flex-1 text-sm text-[#4A5568] text-left">
                {typewriterText}<span className="inline-block w-[2px] h-[14px] bg-amber-400/70 ml-0.5 animate-pulse align-middle" />
              </span>
              <Mic className="w-5 h-5 text-[#8892B0]" strokeWidth={1.5} />
            </div>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.65}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => openAuth('signup')}
                className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                style={{ backgroundColor: '#F59E0B', color: '#000000' }}
              >
                Start Free
              </button>
              <a
                href="https://storage.googleapis.com/connexusai-assets/RAGbox.co.mp4"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-6 py-3 rounded-lg border border-amber-500/30 text-sm text-amber-400/80 hover:text-amber-300 hover:border-amber-500/50 transition-all"
              >
                Watch Demo
                <ArrowRight className="w-3.5 h-3.5 inline ml-1.5" strokeWidth={1.5} />
              </a>
            </div>
          </FadeIn>

          {/* Trust strip */}
          <FadeIn delay={0.8}>
            <p className="text-xs tracking-[0.3em] font-mono text-[var(--text-tertiary)] opacity-50 mt-8 text-center">
              SOC2 READY &middot; ZERO RETENTION &middot; AES-256 ENCRYPTED &middot; HIPAA COMPLIANT
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━ SECTION 2: HOW IT WORKS ━━━ */}
      <section id="how-it-works" className="py-[120px] px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <SectionHeadline>Three steps. Total clarity.</SectionHeadline>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-12 mt-16">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-[20px] left-[16.6%] right-[16.6%] h-px bg-white/[0.06]" />

            <StepItem icon={Upload} step={1} title="Upload" desc="Drop any document into your encrypted vault." />
            <StepItem icon={MessageSquare} step={2} title="Ask" desc="Ask anything in plain English." />
            <StepItem icon={FileCheck} step={3} title="Get Proof" desc="Every answer cited with source and page." />
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 3: FEATURES ━━━ */}
      <section id="capabilities" className="py-[120px] px-6 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <SectionLabel>CAPABILITIES</SectionLabel>
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] text-center mb-16">
            Your Files Speak.{' '}
            <span className="text-[#D4A853]">We Make Them Testify.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              icon={Lock}
              badge="VAULT + ENCRYPTION"
              title="Sovereign Knowledge"
              desc="AES-256-GCM encrypted. Zero retention. Your documents stay yours."
            />
            <FeatureCard
              icon={Users}
              badge="CEO TO WHISTLEBLOWER"
              title="10 Expert Lenses"
              desc="Same document, different intelligence. Each persona finds what others miss."
            />
            <FeatureCard
              icon={FileText}
              badge="REPORTS + EVIDENCE"
              title="Sovereign Studio"
              desc="Generate reports, decks, evidence timelines. All cited. One click."
            />
            <FeatureCard
              icon={Mic}
              badge="VOICE + CHAT + EMAIL"
              title="Mercury Assistant"
              desc="Talk, type, or email your questions. Mercury works every channel."
              gold
            />
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 4: PERSONAS ━━━ */}
      <section id="personas" className="py-[120px] px-6 scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] mb-3">
            10 Expert Lenses. <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600">One Vault.</span>
          </h2>
          <p className="text-lg text-[#8892B0] mb-14">
            Same document. Different intelligence.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {PERSONAS.map((p) => {
              const Icon = p.icon
              return (
                <div
                  key={p.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/[0.08] hover:border-amber-500/30 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)] transition-all cursor-default"
                >
                  <Icon className="w-4 h-4 text-[#8892B0]" strokeWidth={1.5} />
                  <span className="text-sm font-medium">{p.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 5: STUDIO ━━━ */}
      <section id="studio" className="py-[120px] px-6 scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <SectionLabel>SOVEREIGN STUDIO</SectionLabel>
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] text-center mb-3">
            From Documents to <span className="text-[#D4A853]">Deliverables</span>
          </h2>
          <p className="text-lg text-[#8892B0] mb-14">
            One click. Real documents. Cited sources.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {STUDIO_OUTPUTS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 hover:scale-[1.02] transition-all"
                >
                  <Icon className="w-8 h-8 text-[#8892B0]" strokeWidth={1.5} />
                  <span className="text-[13px] font-medium text-[#8892B0]">{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 6: MERCURY ━━━ */}
      <section id="mercury" className="py-[120px] px-6 border-t border-[rgba(212,168,83,0.1)] scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#D4A853] mb-4">
              PREMIUM FEATURE
            </span>
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] mb-3">
              Meet <span className="text-[#D4A853]">Mercury</span>
            </h2>
            <p className="text-lg text-[#8892B0]">
              Your AI assistant that talks, emails, and texts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ChannelCard icon={Mic} title="Voice" desc="Talk to your documents — literally." />
            <ChannelCard icon={Mail} title="Email" desc="Mercury reads and responds to your inbox." />
            <ChannelCard icon={MessageCircle} title="SMS" desc="Instant answers via text message." />
            <ChannelCard icon={Monitor} title="Chat" desc="Always-on in your dashboard." />
          </div>

          <p className="text-center text-sm text-[#8892B0] mt-10">
            Available with Team plans and above.{' '}
            <button onClick={() => openAuth('signup')} className="text-[#D4A853] hover:underline font-medium">
              Upgrade to Team
              <ArrowRight className="w-3 h-3 inline ml-1" strokeWidth={1.5} />
            </button>
          </p>
        </div>
      </section>

      {/* ━━━ SECTION 7: PRICING ━━━ */}
      <section id="pricing" className="py-[120px] px-6 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <SectionLabel>SIMPLE PRICING</SectionLabel>
          <SectionHeadline>Choose your plan</SectionHeadline>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 max-w-3xl mx-auto">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 flex flex-col bg-white/[0.03] border ${
                  tier.gold ? 'border-[rgba(212,168,83,0.2)]' : 'border-white/[0.06]'
                }`}
              >
                <h3 className="text-lg font-bold mb-2">{tier.name}</h3>
                <div className="mb-8">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-sm text-[#8892B0]">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-[#8892B0]">
                      <Check className="w-4 h-4 text-amber-500 shrink-0" strokeWidth={1.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openAuth('signup')}
                  className="w-full py-3 rounded-lg text-sm font-semibold border border-white/10 text-[#8892B0] hover:text-[#E6F1FF] hover:border-white/20 transition-all"
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 8: SECURITY BAR ━━━ */}
      <section id="security" className="py-[80px] px-6 scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <SectionLabel>ENTERPRISE-GRADE SECURITY</SectionLabel>
          <p className="text-sm text-[#8892B0] mt-6">
            SOC 2 Ready &middot; HIPAA Compliant &middot; AES-256-GCM &middot; SEC 17a-4 Audit Trail &middot; Zero Data Retention
          </p>
          <p className="text-sm text-[#4A5568] mt-3">
            Your data never leaves your vault.
          </p>
        </div>
      </section>

      {/* ━━━ SECTION 9: SOCIAL PROOF ━━━ */}
      <section id="proof" className="py-[80px] px-6 scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-5xl font-bold">
            <span className="text-amber-500">38+</span>{' '}
            <span className="text-[#8892B0] text-2xl font-normal">AI agents deployed</span>
          </p>
          <p className="text-lg text-[#8892B0] mt-2">
            across 14 organizations — powered by ConnexUS AI
          </p>
        </div>
      </section>

      {/* ━━━ SECTION 10: FOOTER ━━━ */}
      <footer className="border-t border-white/[0.06] pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1 space-y-4">
              <img
                src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
                alt="RAGbox"
                className="h-16 w-auto"
              />
              <p className="text-sm text-[#8892B0] leading-relaxed">
                Sovereign Document Intelligence for the Enterprise. SOC2 Ready. Zero Retention.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-bold mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-[#8892B0]">
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Intelligence Engine</a></li>
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Security Architecture</a></li>
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Enterprise Connectors</a></li>
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Pricing</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-bold mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-[#8892B0]">
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Legal</a></li>
                <li><a href="#" className="hover:text-[#E6F1FF] transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* ConnexUS */}
            <div>
              <img
                src="https://storage.googleapis.com/connexusai-assets/2026_ConnexUS%20Logo.png"
                alt="ConnexUS AI"
                className="h-10 w-auto mb-3"
              />
              <p className="text-sm text-[#8892B0]">A ConnexUS AI Product</p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#4A5568]">
            <p>&copy; 2026 ConnexUS AI Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-[#E6F1FF] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#E6F1FF] transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-[#E6F1FF] transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => { setAuthOpen(false); setAuthError(null) }}
            context={authContext}
            errorMessage={authError}
          />
        )}
      </AnimatePresence>

    </main>
  )
}

export default function LandingV3() {
  return (
    <Suspense>
      <LandingV3Content />
    </Suspense>
  )
}

/* ─────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-amber-500 mb-4">
      {children}
    </p>
  )
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] text-center">
      {children}
    </h2>
  )
}

function StepItem({
  icon: Icon,
  step,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  step: number
  title: string
  desc: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <Icon className="w-10 h-10 text-[#8892B0] mb-4" strokeWidth={1.5} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-amber-500 mb-2">
        STEP {step}
      </span>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[#8892B0] max-w-[280px]">{desc}</p>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  badge,
  title,
  desc,
  gold,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  badge: string
  title: string
  desc: string
  gold?: boolean
}) {
  return (
    <div
      className={`p-8 rounded-2xl bg-white/[0.03] border transition-colors ${
        gold
          ? 'border-[rgba(212,168,83,0.2)] hover:border-[rgba(212,168,83,0.4)]'
          : 'border-white/[0.06] hover:border-[rgba(245,158,11,0.2)]'
      }`}
    >
      <div className="flex items-start justify-between mb-5">
        <Icon className="w-6 h-6 text-[#8892B0]" strokeWidth={1.5} />
        <span className="px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-[0.05em] bg-amber-500/15 text-amber-400">
          {badge}
        </span>
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[#8892B0] leading-relaxed">{desc}</p>
    </div>
  )
}

function ChannelCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string
}) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-[rgba(212,168,83,0.2)] transition-colors text-left">
      <Icon className="w-6 h-6 text-[#D4A853] mb-3" strokeWidth={1.5} />
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-[#8892B0]">{desc}</p>
    </div>
  )
}
