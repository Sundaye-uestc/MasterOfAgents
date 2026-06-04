import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { DiffBlock } from "./DiffBlock.js";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-3 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-2 mb-1">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2 mb-1">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 mb-1">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-1 mb-1">{children}</h6>
  ),
  p: ({ children }) => (
    <p className="my-1 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700 dark:text-gray-200">{children}</em>
  ),
  del: ({ children }) => (
    <del className="line-through text-gray-400 dark:text-gray-500">{children}</del>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-700 dark:text-gray-200">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-500 pl-3 my-2 text-gray-500 dark:text-gray-400 italic">{children}</blockquote>
  ),
  code: ({ className, children, ...props }) => {
    // Inline code: no node info → inline; fenced code blocks pass className
    const _inline = !className;
    if (_inline) {
      return (
        <code className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-1 py-0.5 rounded text-xs font-mono" {...props}>
          {children}
        </code>
      );
    }
    // Diff code blocks: render with DiffBlock
    if (className?.includes("language-diff")) {
      const content = String(children).replace(/\n$/, "");
      return <DiffBlock diff={content} />;
    }
    return (
      <code className={`text-xs font-mono ${className ?? ""}`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200 rounded-xl p-3 my-2 overflow-x-auto text-xs font-mono border border-gray-200 dark:border-gray-700/50">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700 text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-200 dark:bg-gray-700">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left font-semibold text-gray-900 dark:text-gray-100">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-700 dark:text-gray-200">{children}</td>
  ),
  hr: () => (
    <hr className="border-gray-200 dark:border-gray-700 my-3" />
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="max-w-full rounded-md my-2" />
  ),
};

export function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
