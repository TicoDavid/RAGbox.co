import React from 'react'

function ReactMarkdown({ children }: { children: string }) {
  return <div data-testid="react-markdown">{children}</div>
}

export default ReactMarkdown
