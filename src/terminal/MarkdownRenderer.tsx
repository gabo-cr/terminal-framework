import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'

// Mantener el filtro de la biblioteca y limitar los enlaces a web, correo y
// referencias relativas. Una URL bloqueada se presenta como texto sin enlace.
function safeUrl(url: string): string | undefined {
  const safe = defaultUrlTransform(url)
  if (!safe || /[\\\u0000-\u0020\u007f]/.test(safe)) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(safe) && !/^(https?|mailto):/i.test(safe)) return undefined
  return safe
}

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  return (
    <div className="terminal-markdown">
      <ReactMarkdown
        skipHtml
        urlTransform={safeUrl}
        components={{
          pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
          a: ({ href, children, title }) => {
            if (!href) return <span>{children}</span>
            const web = /^(https?:)?\/\//i.test(href)
            return <a href={href} title={title} target={web ? '_blank' : undefined} rel={web ? 'noopener noreferrer' : undefined}>{children}</a>
          },
          // Las imágenes no forman parte del MVP; mostrar su alternativa sin
          // iniciar solicitudes implícitas del navegador.
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
