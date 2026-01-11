'use client';

import { Highlight, themes } from 'prism-react-renderer';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
  streaming?: boolean;
}

/**
 * Syntax-highlighted code block component
 * Uses prism-react-renderer for highlighting
 */
export function CodeBlock({
  code,
  language = 'typescript',
  showLineNumbers = false,
  maxHeight = '300px',
  className,
  streaming = false,
}: CodeBlockProps) {
  // Detect language from code content if not specified
  const detectedLanguage = detectLanguage(code, language);

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      <Highlight
        theme={themes.nightOwl}
        code={code.trim()}
        language={detectedLanguage}
      >
        {({ className: highlightClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              highlightClass,
              'text-xs p-3 overflow-auto font-mono'
            )}
            style={{
              ...style,
              maxHeight,
              margin: 0,
              backgroundColor: 'rgba(30, 30, 46, 0.95)',
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                {showLineNumbers && (
                  <span className="table-cell text-right pr-4 select-none opacity-50 text-[10px]">
                    {i + 1}
                  </span>
                )}
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
            {streaming && (
              <span className="animate-pulse text-cyan-400">|</span>
            )}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/**
 * Detect language from code content
 */
function detectLanguage(code: string, fallback: string): string {
  // Check for common patterns
  if (code.includes('import React') || code.includes('from \'react\'')) {
    return 'tsx';
  }
  if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) {
    return 'typescript';
  }
  if (code.includes('function ') || code.includes('const ') || code.includes('let ')) {
    return 'javascript';
  }
  if (code.includes('def ') || code.includes('import ') && code.includes(':')) {
    return 'python';
  }
  if (code.includes('func ') || code.includes('package ')) {
    return 'go';
  }
  return fallback;
}

/**
 * Compact code preview for cards
 */
export function CodePreview({
  code,
  maxLines = 8,
  streaming = false,
}: {
  code: string;
  maxLines?: number;
  streaming?: boolean;
}) {
  // Truncate to max lines
  const lines = code.split('\n');
  const truncated = lines.length > maxLines;
  const displayCode = truncated
    ? lines.slice(0, maxLines).join('\n') + '\n// ...'
    : code;

  return (
    <CodeBlock
      code={displayCode}
      maxHeight="200px"
      showLineNumbers={false}
      streaming={streaming}
    />
  );
}

export default CodeBlock;
