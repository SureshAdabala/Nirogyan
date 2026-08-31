import ReactMarkdown from 'react-markdown';
import React from 'react';
import remarkGfm from 'remark-gfm';

export function safeContentUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function SafeMarkdown({ markdown }: { readonly markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={(url) => safeContentUrl(url) ?? ''}
      components={{
        h1: ({ children }) => <h2>{children}</h2>,
        a: ({ children, href, title }) => {
          const safeHref = safeContentUrl(href);
          if (!safeHref) return <span>{children}</span>;
          const external = /^https?:/i.test(safeHref);
          return (
            <a href={safeHref} title={title} rel={external ? 'noopener noreferrer' : undefined}>
              {children}
            </a>
          );
        },
        img: ({ alt }) => (
          <span role="img" aria-label={alt || 'Authored image omitted'}>
            [Managed image required]
          </span>
        ),
        table: ({ children }) => (
          <div
            className="content-table-scroll"
            role="region"
            aria-label="Scrollable table"
            tabIndex={0}
          >
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
