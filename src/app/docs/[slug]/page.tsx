import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Shield, Book, Zap } from 'lucide-react'
import { getDocBySlug, getAllDocSlugs } from '@/lib/docs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Generate static params for all docs
export async function generateStaticParams() {
  const slugs = getAllDocSlugs()
  return slugs.map((slug) => ({ slug }))
}

// Metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = getDocBySlug(slug)

  if (!doc) {
    return { title: 'Not Found | RAGbox Docs' }
  }

  return {
    title: `${doc.title} | RAGbox Docs`,
    description: doc.description,
  }
}

// Icon mapping for sidebar
const DOC_ICONS: Record<string, React.ReactNode> = {
  'getting-started': <Zap className="w-4 h-4" />,
  'api-reference': <FileText className="w-4 h-4" />,
  'security-compliance': <Shield className="w-4 h-4" />,
  'best-practices': <Book className="w-4 h-4" />,
}

const DOC_ORDER = ['getting-started', 'api-reference', 'security-compliance', 'best-practices']

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = getDocBySlug(slug)

  if (!doc) {
    notFound()
  }

  const allSlugs = getAllDocSlugs()
  const orderedSlugs = DOC_ORDER.filter((s) => allSlugs.includes(s))

  return (
    <div className="min-h-screen bg-[#0A192F] text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#0A192F]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-sm font-semibold text-white">Sovereign Protocols</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-white/10 p-6">
          <nav className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Documentation
            </p>
            {orderedSlugs.map((docSlug) => {
              const docMeta = getDocBySlug(docSlug)
              const isActive = docSlug === slug

              return (
                <Link
                  key={docSlug}
                  href={`/docs/${docSlug}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>
                    {DOC_ICONS[docSlug] || <FileText className="w-4 h-4" />}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {docMeta?.title?.split(':')[0] || docSlug}
                  </span>
                </Link>
              )
            })}
          </nav>

          {/* Quick Links */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Resources
            </p>
            <a
              href="mailto:support@ragbox.co"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Contact Support
            </a>
            <a
              href="https://github.com/ragbox"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/docs/getting-started" className="hover:text-white transition-colors">
              Docs
            </Link>
            <span>/</span>
            <span className="text-cyan-400">{doc.title.split(':')[0]}</span>
          </div>

          {/* Document Content */}
          <article className="prose prose-invert prose-blue max-w-none
            prose-headings:font-semibold
            prose-h1:text-3xl prose-h1:text-transparent prose-h1:bg-clip-text prose-h1:bg-gradient-to-r prose-h1:from-white prose-h1:to-slate-400 prose-h1:mb-4
            prose-h2:text-xl prose-h2:text-white prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/10
            prose-h3:text-lg prose-h3:text-cyan-400 prose-h3:mt-8
            prose-p:text-slate-300 prose-p:leading-relaxed
            prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white prose-strong:font-semibold
            prose-code:text-cyan-300 prose-code:bg-slate-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-[#0d2137] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:shadow-lg
            prose-blockquote:border-l-cyan-500 prose-blockquote:bg-cyan-500/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-400
            prose-ul:text-slate-300
            prose-ol:text-slate-300
            prose-li:marker:text-cyan-500
            prose-table:border-collapse
            prose-th:bg-slate-800/50 prose-th:border prose-th:border-white/10 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:text-white
            prose-td:border prose-td:border-white/10 prose-td:px-4 prose-td:py-2
            prose-hr:border-white/10
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content}
            </ReactMarkdown>
          </article>

          {/* Navigation Footer */}
          <div className="mt-16 pt-8 border-t border-white/10">
            <div className="flex justify-between">
              {/* Previous */}
              {orderedSlugs.indexOf(slug) > 0 && (
                <Link
                  href={`/docs/${orderedSlugs[orderedSlugs.indexOf(slug) - 1]}`}
                  className="group flex flex-col"
                >
                  <span className="text-xs text-slate-500 mb-1">Previous</span>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-cyan-400 transition-colors">
                    ← {getDocBySlug(orderedSlugs[orderedSlugs.indexOf(slug) - 1])?.title.split(':')[0]}
                  </span>
                </Link>
              )}

              {/* Next */}
              {orderedSlugs.indexOf(slug) < orderedSlugs.length - 1 && (
                <Link
                  href={`/docs/${orderedSlugs[orderedSlugs.indexOf(slug) + 1]}`}
                  className="group flex flex-col items-end ml-auto"
                >
                  <span className="text-xs text-slate-500 mb-1">Next</span>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-cyan-400 transition-colors">
                    {getDocBySlug(orderedSlugs[orderedSlugs.indexOf(slug) + 1])?.title.split(':')[0]} →
                  </span>
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
