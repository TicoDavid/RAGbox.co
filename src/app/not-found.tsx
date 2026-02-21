import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-white/[0.06] shadow-2xl shadow-black/50">
        {/* Gold accent line */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-70" />

        <div className="p-8 pt-10 text-center">
          {/* Logo wordmark */}
          <p className="text-2xl font-bold tracking-tight mb-2">
            <span className="text-[var(--text-primary)]">RAG</span>
            <span className="text-amber-500">b{'\u00F6'}x</span>
            <span className="text-[var(--text-tertiary)] text-lg font-normal">.co</span>
          </p>

          {/* 404 */}
          <p className="text-7xl font-bold text-amber-500/20 font-mono mt-6 mb-2 select-none">404</p>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Page not found</h1>
          <p className="text-sm text-[var(--text-tertiary)] mb-8">
            The page you requested doesn{'\u2019'}t exist or has been moved.
          </p>

          {/* CTA */}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-lg shadow-amber-900/20"
          >
            Return to Dashboard
          </Link>
        </div>

        {/* Footer */}
        <div className="bg-white/[0.02] px-8 py-4 text-center border-t border-white/[0.06]">
          <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">
            Sovereign Intelligence Platform
          </p>
        </div>
      </div>
    </div>
  )
}
