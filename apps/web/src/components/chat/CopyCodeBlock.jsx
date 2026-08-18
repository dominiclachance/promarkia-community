import { useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function CopyCodeBlock({ children }) {
  const rootRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = rootRef.current?.innerText || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy response"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          zIndex: 2,
          border: '1px solid rgba(127,127,127,0.35)',
          borderRadius: 6,
          padding: '4px 8px',
          background: 'rgba(20,20,24,0.82)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {children}
    </div>
  );
}

CopyCodeBlock.propTypes = {
  children: PropTypes.node,
};
