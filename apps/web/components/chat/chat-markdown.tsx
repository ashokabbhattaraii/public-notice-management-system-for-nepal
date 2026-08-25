import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Shared Markdown renderer for AI answers — the floating chatbot and the
 * per-notice "Ask AI" panel both get responses that may contain bullet
 * lists, bold labels, or a comparison table (per the backend's answer
 * prompt), so both render through this instead of a plain `<p>` that
 * flattens everything into one unreadable wall of text. `break-words` on
 * text and `break-all` on links/code keeps a long unbroken URL (notice
 * source links, attachment URLs) from forcing horizontal scroll in the
 * narrow chat bubble.
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-1.5 break-words last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="break-words leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
            {children}
          </a>
        ),
        h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        code: ({ children }) => (
          <code className="break-all rounded bg-foreground/10 px-1 py-0.5 font-mono text-[10px]">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-1.5 border-l-2 border-border pl-2 opacity-80 last:mb-0">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-1.5 -mx-1 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-[11px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-border/70">{children}</thead>,
        tr: ({ children }) => <tr className="border-b border-border/40 last:border-0">{children}</tr>,
        th: ({ children }) => <th className="px-1.5 py-1 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-1.5 py-1 align-top">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
