// THEME-EXEMPT: Public landing page, locked to Cobalt palette
"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import Footer from '@/components/Footer';
import {
  Shield, Upload, MessageSquareText, FileCheck,
  Mic, Mail, MessageCircle, MessagesSquare,
  FileText, Presentation, Sheet, FileDown,
  Image, GitBranch, Headphones, Video,
  Check, ArrowRight,
} from 'lucide-react';

type AuthContext = 'signin' | 'signup' | 'upload';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Sign-in was interrupted. Please try again.',
  OAuthCreateAccount: 'Could not create your account. Please try again.',
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  AccessDenied: 'Access was denied. Please accept the permissions to continue.',
  default: 'Something went wrong during sign-in. Please try again.',
};

/* ─── Persona data ─── */
const PERSONAS = [
  { label: 'CEO', emoji: '👔' },
  { label: 'CFO', emoji: '📊' },
  { label: 'Legal', emoji: '⚖️' },
  { label: 'Compliance', emoji: '📋' },
  { label: 'Risk', emoji: '🎯' },
  { label: 'Ops', emoji: '⚙️' },
  { label: 'Whistleblower', emoji: '🔍' },
  { label: 'Auditor', emoji: '🔎' },
  { label: 'Research', emoji: '🧪' },
  { label: 'Custom', emoji: '✨' },
];

/* ─── Studio outputs ─── */
const STUDIO_OUTPUTS = [
  { label: 'Report .docx', icon: FileText },
  { label: 'Deck .pptx', icon: Presentation },
  { label: 'Evidence .xlsx', icon: Sheet },
  { label: 'Audit .pdf', icon: FileDown },
  { label: 'Infographic', icon: Image },
  { label: 'Mind Map', icon: GitBranch },
  { label: 'Audio Brief', icon: Headphones },
  { label: 'Video Brief', icon: Video },
];

/* ─── Pricing tiers ─── */
const PRICING = [
  {
    name: 'Starter',
    price: '$99',
    period: '/mo',
    features: ['1 vault', '100 documents', '5 personas', 'Studio basic', '—', '—'],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Team',
    price: '$499',
    period: '/mo',
    features: ['5 vaults', '1,000 documents', '10 personas', 'Studio full', 'Mercury', '—'],
    cta: 'Start Team',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited vaults', 'Unlimited documents', 'Custom personas', 'Studio + API', 'Mercury + Voice', 'VERITAS audit trail'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const TRUST_ITEMS = [
  { label: 'SOC 2 Ready', icon: '🛡️' },
  { label: 'HIPAA Compliant', icon: '🏥' },
  { label: 'AES-256-GCM', icon: '🔐' },
  { label: 'SEC 17a-4 Audit Trail', icon: '📊' },
  { label: 'Zero Data Retention', icon: '🚫' },
];

/* ═══════════════════════════════════════════
   LANDING PAGE V2
   ═══════════════════════════════════════════ */
function LandingV2Content() {
  const searchParams = useSearchParams();
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authContext, setAuthContext] = useState<AuthContext>('signin');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      window.history.replaceState({}, '', '/landing-v2');
      const authInitiated = typeof window !== 'undefined' && sessionStorage.getItem('ragbox_auth_initiated');
      if (authInitiated) {
        sessionStorage.removeItem('ragbox_auth_initiated');
        setAuthError(OAUTH_ERROR_MESSAGES[error] || OAUTH_ERROR_MESSAGES.default);
        setAuthOpen(true);
      }
    }
  }, [searchParams]);

  const openAuth = (context: AuthContext) => {
    setAuthContext(context);
    setAuthError(null);
    setAuthOpen(true);
  };

  return (
    <main className="min-h-screen bg-white dark:bg-[#020408] transition-colors duration-300">
      {/* OAuth error banner */}
      {authError && !isAuthOpen && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-center py-3 px-4 text-sm font-medium">
          {authError}
          <button onClick={() => openAuth('signin')} className="ml-3 underline hover:no-underline">Try Again</button>
          <button onClick={() => setAuthError(null)} className="ml-3 opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <Navbar onOpenAuth={() => openAuth('signin')} />

      {/* ━━━ SECTION 1: HERO ━━━ */}
      <section className="relative pt-28 md:pt-36 pb-20 flex flex-col items-center text-center px-4 overflow-hidden bg-white dark:bg-transparent">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:48px_48px] opacity-0 dark:opacity-100 pointer-events-none" />
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none hidden dark:block" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 35%, transparent 70%)', filter: 'blur(80px)' }} />

        <div className="relative z-10 max-w-5xl mx-auto space-y-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-slate-900 dark:text-white leading-[1.1]">
            Your Documents.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FDE68A] via-[#FBBF24] to-[#D97706] drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]">
              Interrogated.
            </span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Upload anything. Ask everything. Get answers with the exact source, page, and paragraph.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => openAuth('signup')}
              className="px-8 py-3.5 rounded-full bg-gradient-to-b from-[#4040FF] to-[#0000FF] hover:from-[#5050FF] hover:to-[#0000DD] text-white font-bold tracking-wide shadow-[0_0_30px_rgba(0,0,255,0.5)] hover:shadow-[0_0_50px_rgba(0,0,255,0.7)] transition-all duration-300 hover:-translate-y-0.5"
            >
              Start Free
            </button>
            <a
              href="https://storage.googleapis.com/connexusai-assets/RAGbox.co.mp4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Watch Demo &rarr;
            </a>
          </div>
        </div>

        {/* Product Screenshot Placeholder */}
        <div className="relative z-10 mt-16 w-full max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl dark:shadow-[0_0_60px_rgba(0,0,0,0.5)]">
            {/* Dark gradient placeholder simulating a dashboard screenshot */}
            <div className="aspect-[16/9] bg-gradient-to-br from-[#0A192F] via-[#112240] to-[#1B2D4B] relative">
              {/* Simulated UI chrome */}
              <div className="absolute inset-x-0 top-0 h-10 bg-[#0A192F] border-b border-white/5 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-4 text-xs text-slate-500 font-mono">app.ragbox.co/dashboard</span>
              </div>
              {/* 3-panel layout hint */}
              <div className="absolute inset-0 top-10 flex">
                <div className="w-1/4 border-r border-white/5 p-4">
                  <div className="h-3 w-20 bg-white/10 rounded mb-3" />
                  <div className="space-y-2">
                    {[1,2,3,4].map(i => <div key={i} className="h-8 bg-white/5 rounded" />)}
                  </div>
                </div>
                <div className="flex-1 p-4 flex flex-col">
                  <div className="flex-1 space-y-3 pt-4">
                    <div className="h-4 w-3/4 bg-white/8 rounded" />
                    <div className="h-4 w-1/2 bg-white/5 rounded" />
                    <div className="h-20 bg-blue-500/10 rounded-lg border border-blue-500/20 mt-4" />
                  </div>
                  <div className="h-10 bg-white/5 rounded-lg mt-4" />
                </div>
                <div className="w-1/4 border-l border-white/5 p-4">
                  <div className="h-3 w-16 bg-amber-500/20 rounded mb-3" />
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-6 bg-white/5 rounded" />)}
                  </div>
                </div>
              </div>
              {/* Glow overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020408] via-transparent to-transparent opacity-60" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 2: HOW IT WORKS ━━━ */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs uppercase tracking-widest text-slate-500 mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-16">
            Three steps. Total clarity.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <StepCard
              step={1}
              icon={<Upload className="w-7 h-7" />}
              title="Upload"
              desc="Drop any document — .pdf, .docx, .md, .xlsx — into your encrypted vault."
            />
            <StepCard
              step={2}
              icon={<MessageSquareText className="w-7 h-7" />}
              title="Ask"
              desc="Ask anything in plain English. Our AI reads every page so you don't have to."
            />
            <StepCard
              step={3}
              icon={<FileCheck className="w-7 h-7" />}
              title="Get Proof"
              desc="Every answer comes with the exact source document, page, and paragraph cited."
            />
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 3: FEATURE CARDS (existing concepts, refreshed) ━━━ */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px] opacity-0 dark:opacity-100 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-slate-900 dark:text-white">
              Your Files Speak.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2463EB] via-[#00a8ff] to-[#00d4ff]">
                We Make Them Testify.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Sovereign Knowledge"
              desc="AES-256-GCM encrypted vault with zero-retention architecture. Your documents stay yours — we never train on your data."
              tag="VAULT + ENCRYPTION"
            />
            <FeatureCard
              icon={<MessageSquareText className="w-6 h-6" />}
              title="10 AI Personas"
              desc="From CEO strategic briefs to Whistleblower evidence logs — choose the lens that fits your analysis."
              tag="CEO TO WHISTLEBLOWER"
            />
            <FeatureCard
              icon={<FileText className="w-6 h-6" />}
              title="Sovereign Studio"
              desc="Generate compliance reports, executive decks, evidence timelines — all grounded in your actual documents."
              tag="REPORTS + DECKS"
            />
            <FeatureCard
              icon={<Mic className="w-6 h-6" />}
              title="Mercury Assistant"
              desc="Talk, type, or email your questions. Mercury works across every channel — voice, chat, WhatsApp, SMS."
              tag="VOICE + CHAT + EMAIL"
            />
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 4: 10 EXPERT PERSONAS ━━━ */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">
            10 Expert Lenses.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2463EB] to-[#00d4ff]">One Vault.</span>
          </h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
            Same document. Different intelligence. The CEO sees strategy. Legal sees liability.
            Compliance sees gaps. The Whistleblower sees everything.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 max-w-3xl mx-auto">
            {PERSONAS.map((p) => (
              <div
                key={p.label}
                className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-amber-500/40 hover:-translate-y-0.5 transition-all duration-300 cursor-default"
              >
                <span className="text-lg">{p.emoji}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 5: SOVEREIGN STUDIO ━━━ */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Sovereign Studio</p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">
            From Documents to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FDE68A] via-[#FBBF24] to-[#D97706]">
              Deliverables
            </span>
          </h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mb-12 max-w-xl mx-auto">
            Generate professional outputs from your vault. One click. Real documents. Cited sources.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {STUDIO_OUTPUTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-500/30 dark:hover:border-amber-500/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Icon className="w-6 h-6 text-[#2463EB] dark:text-blue-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 6: MERCURY PREMIUM ━━━ */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none hidden dark:block" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-amber-500 mb-3">Premium Feature</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">
              Meet{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FDE68A] via-[#FBBF24] to-[#D97706]">
                Mercury
              </span>
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Your AI assistant that talks, emails, and texts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ChannelCard icon={<Mic className="w-6 h-6" />} title="Voice" desc="Talk to your documents — literally." />
            <ChannelCard icon={<Mail className="w-6 h-6" />} title="Email" desc="Mercury reads and responds to your inbox." />
            <ChannelCard icon={<MessageCircle className="w-6 h-6" />} title="SMS" desc="Instant answers via text message." />
            <ChannelCard icon={<MessagesSquare className="w-6 h-6" />} title="Chat" desc="Always-on in your dashboard." />
          </div>

          <p className="text-center text-sm text-slate-400 mt-8">
            Available with Team plans and above.{' '}
            <button onClick={() => openAuth('signup')} className="text-[#2463EB] hover:underline font-medium">
              Upgrade to Team &rarr;
            </button>
          </p>
        </div>
      </section>

      {/* ━━━ SECTION 7: PRICING ━━━ */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs uppercase tracking-widest text-slate-500 mb-3">Simple Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-16">
            Choose your plan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  tier.highlighted
                    ? 'bg-gradient-to-b from-[#0A192F] to-[#112240] border-2 border-[#2463EB] shadow-[0_0_40px_rgba(36,99,235,0.2)]'
                    : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#2463EB] text-white text-xs font-bold tracking-wide">
                    MOST POPULAR
                  </span>
                )}
                <h3 className={`text-lg font-bold mb-2 ${tier.highlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {tier.name}
                </h3>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {tier.price}
                  </span>
                  <span className={`text-sm ${tier.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>
                    {tier.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className={`flex items-center gap-2 text-sm ${
                      f === '—'
                        ? 'text-slate-300 dark:text-slate-600'
                        : tier.highlighted ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {f === '—' ? (
                        <span className="w-4 h-4 flex items-center justify-center text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <Check className={`w-4 h-4 flex-shrink-0 ${tier.highlighted ? 'text-[#2463EB]' : 'text-emerald-500'}`} />
                      )}
                      {f === '—' ? 'Not included' : f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openAuth('signup')}
                  className={`w-full py-3 rounded-full font-bold text-sm tracking-wide transition-all duration-300 ${
                    tier.highlighted
                      ? 'bg-gradient-to-b from-[#4040FF] to-[#0000FF] text-white shadow-[0_0_20px_rgba(0,0,255,0.4)] hover:shadow-[0_0_40px_rgba(0,0,255,0.6)] hover:-translate-y-0.5'
                      : 'bg-slate-900 dark:bg-white/10 text-white hover:bg-slate-800 dark:hover:bg-white/20'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 8: TRUST BAR ━━━ */}
      <section className="py-16 border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs uppercase tracking-widest text-slate-500 mb-3">
            Enterprise-Grade Security
          </p>
          <p className="text-center text-sm text-slate-400 mb-8">
            Your data never leaves your vault.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SECTION 9: SOCIAL PROOF ━━━ */}
      <section className="py-16 bg-white dark:bg-transparent border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">
            38+{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2463EB] to-[#00d4ff]">
              AI agents
            </span>{' '}
            deployed
          </p>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            across 14 organizations — powered by ConnexUS AI
          </p>
        </div>
      </section>

      <Footer />

      <AnimatePresence>
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => { setAuthOpen(false); setAuthError(null); }}
            context={authContext}
            errorMessage={authError}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

export default function LandingV2() {
  return (
    <Suspense>
      <LandingV2Content />
    </Suspense>
  );
}

/* ─────────────── Sub-components ─────────────── */

function StepCard({ step, icon, title, desc }: { step: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center text-center group">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 dark:bg-white/5 text-[#2463EB] dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <span className="text-xs font-bold text-[#2463EB] dark:text-blue-400 uppercase tracking-widest mb-2">
        Step {step}
      </span>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc, tag }: { icon: React.ReactNode; title: string; desc: string; tag: string }) {
  return (
    <div className="group relative p-8 md:p-10 rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:bg-gray-900/80 dark:backdrop-blur-xl dark:border-white/5 dark:border-t-white/10 hover:-translate-y-1 transition-all duration-300 dark:hover:border-amber-500/40 dark:hover:shadow-[inset_0_0_40px_-10px_rgba(245,158,11,0.15),0_0_40px_-10px_rgba(245,158,11,0.2)]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none dark:from-amber-500/5 dark:via-amber-900/5 dark:to-transparent" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 text-[#0000FF] dark:bg-white/5 dark:text-blue-400 group-hover:scale-110 transition-all duration-300 dark:group-hover:text-amber-400 dark:group-hover:bg-amber-500/10">
            {icon}
          </div>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10">
            {tag}
          </span>
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-3 group-hover:text-[#0000FF] dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-base">{desc}</p>
      </div>
    </div>
  );
}

function ChannelCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-amber-500/30 dark:hover:border-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 text-left">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{title}</h4>
      <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
  );
}
