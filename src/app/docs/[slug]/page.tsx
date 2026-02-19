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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-blue)]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[var(--brand-blue)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">Sovereign Protocols</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-[var(--border-default)] p-6">
          <nav className="space-y-1">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
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
                      ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border-l-2 border-[var(--brand-blue)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <span className={isActive ? 'text-[var(--brand-blue)]' : 'text-[var(--text-muted)]'}>
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
          <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Resources
            </p>
            <a
              href="mailto:support@ragbox.co"
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Contact Support
            </a>
            <a
              href="https://github.com/ragbox"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              GitHub
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/dashboard" className="hover:text-[var(--text-primary)] transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/docs/getting-started" className="hover:text-[var(--text-primary)] transition-colors">
              Docs
            </Link>
            <span>/</span>
            <span className="text-[var(--brand-blue)]">{doc.title.split(':')[0]}</span>
          </div>

          {/* Document Content */}
          <article className="prose prose-invert prose-blue max-w-none
            prose-headings:font-semibold
            prose-h1:text-3xl prose-h1:text-[var(--text-primary)] prose-h1:mb-4
            prose-h2:text-xl prose-h2:text-[var(--text-primary)] prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--border-default)]
            prose-h3:text-lg prose-h3:text-[var(--brand-blue)] prose-h3:mt-8
            prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed
            prose-a:text-[var(--brand-blue)] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
            prose-code:text-[var(--brand-blue-hover)] prose-code:bg-[var(--bg-tertiary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-[var(--bg-secondary)] prose-pre:border prose-pre:border-[var(--border-default)] prose-pre:rounded-xl prose-pre:shadow-lg
            prose-blockquote:border-l-[var(--brand-blue)] prose-blockquote:bg-[var(--brand-blue)]/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-[var(--text-tertiary)]
            prose-ul:text-[var(--text-secondary)]
            prose-ol:text-[var(--text-secondary)]
            prose-li:marker:text-[var(--brand-blue)]
            prose-table:border-collapse
            prose-th:bg-[var(--bg-tertiary)] prose-th:border prose-th:border-[var(--border-default)] prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:text-[var(--text-primary)]
            prose-td:border prose-td:border-[var(--border-default)] prose-td:px-4 prose-td:py-2
            prose-hr:border-[var(--border-default)]
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content}
            </ReactMarkdown>
          </article>

          {/* Navigation Footer */}
          <div className="mt-16 pt-8 border-t border-[var(--border-default)]">
            <div className="flex justify-between">
              {/* Previous */}
              {orderedSlugs.indexOf(slug) > 0 && (
                <Link
                  href={`/docs/${orderedSlugs[orderedSlugs.indexOf(slug) - 1]}`}
                  className="group flex flex-col"
                >
                  <span className="text-xs text-[var(--text-muted)] mb-1">Previous</span>
                  <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--brand-blue)] transition-colors">
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
                  <span className="text-xs text-[var(--text-muted)] mb-1">Next</span>
                  <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--brand-blue)] transition-colors">
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
