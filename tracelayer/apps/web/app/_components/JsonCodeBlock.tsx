'use client';

import { useMemo, useState } from 'react';
import { formatJsonForCodeBlock, tokenizeJson } from './JsonCodeBlock.helpers.js';

type JsonCodeBlockProps = {
  value: unknown;
  label: string;
  defaultCollapsed?: boolean;
};

export function JsonCodeBlock({ value, label, defaultCollapsed = false }: JsonCodeBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const text = useMemo(() => formatJsonForCodeBlock(value), [value]);
  const tokens = useMemo(() => tokenizeJson(text), [text]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1_400);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1_800);
    }
  }

  return (
    <div className={`json-code-block${collapsed ? ' collapsed' : ''}`}>
      <div className="json-code-toolbar">
        <span className="json-code-label">{label}</span>
        <div className="actions">
          <button className="copy" type="button" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label} JSON`} onClick={() => setCollapsed((current) => !current)}>
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button className="copy" type="button" aria-label={`Copy ${label} JSON`} onClick={() => void copyJson()}>
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </button>
        </div>
      </div>
      {collapsed ? null : (
        <pre className="json-code-scroll mono" aria-label={`${label} JSON output`}>
          <code>
            {tokens.map((token, index) => (
              <span key={`${index}-${token.kind}`} className={`json-token json-token-${token.kind}`}>
                {token.value}
              </span>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}

