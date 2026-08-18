function decodeEscapedText(value) {
  return String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\u([0-9a-f]{4})/gi, (_, codePoint) => String.fromCharCode(Number.parseInt(codePoint, 16)));
}

function readableLinkLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function markdownLink(href, label) {
  try {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol)) return label;
    const escapedLabel = label
      .replaceAll('\\', '\\\\')
      .replaceAll('[', '\\[')
      .replaceAll(']', '\\]');
    const escapedHref = url.href.replaceAll('(', '%28').replaceAll(')', '%29');
    return `[${escapedLabel}](${escapedHref})`;
  } catch {
    return label;
  }
}

function htmlToMarkdown(value) {
  if (!value.includes('<') || typeof DOMParser === 'undefined') return value;
  const document = new DOMParser().parseFromString(value, 'text/html');
  const blockElements = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'UL']);

  const renderNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.tagName === 'BR') return '\n';
    if (node.tagName === 'A') {
      return markdownLink(node.getAttribute('href') || '', readableLinkLabel(node.textContent));
    }
    const children = Array.from(node.childNodes, renderNode).join('');
    return blockElements.has(node.tagName) ? `\n${children}\n` : children;
  };

  return Array.from(document.body.childNodes, renderNode).join('');
}

export function normalizeArticleContent(value) {
  let content = decodeEscapedText(value);

  // AutoGen may return a complete JSON string as the artifact. Unwrap only that
  // well-defined case; ordinary quotation marks in an article are untouched.
  const trimmed = content.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') content = decodeEscapedText(parsed);
    } catch {
      // It is article copy rather than a JSON string, so leave it unchanged.
    }
  }

  // Convert model-authored HTML to text/Markdown through the browser parser.
  // ReactMarkdown then renders the result without enabling raw HTML execution.
  content = htmlToMarkdown(content);

  return content
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
