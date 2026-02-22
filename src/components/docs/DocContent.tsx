import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CopyButton } from './CopyButton'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const text = String(children).replace(/\n$/, '')
  return (
    <div className="relative group">
      <CopyButton text={text} />
      <pre className={className}>
        <code>{text}</code>
      </pre>
    </div>
  )
}

export function DocContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => {
          const id = slugify(String(children))
          return (
            <h2 id={id}>
              <a href={`#${id}`} className="no-underline hover:underline">
                {children}
              </a>
            </h2>
          )
        },
        h3: ({ children }) => {
          const id = slugify(String(children))
          return (
            <h3 id={id}>
              <a href={`#${id}`} className="no-underline hover:underline">
                {children}
              </a>
            </h3>
          )
        },
        pre: ({ children }) => {
          return <>{children}</>
        },
        code: ({ children, className }) => {
          const isBlock = className || String(children).includes('\n')
          if (isBlock) {
            return <CodeBlock className={className}>{String(children)}</CodeBlock>
          }
          return <code className={className}>{children}</code>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
