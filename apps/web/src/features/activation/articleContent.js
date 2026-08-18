function decodeEscapedText(value) {
  return String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\u([0-9a-f]{4})/gi, (_, codePoint) => String.fromCharCode(Number.parseInt(codePoint, 16)));
}

function readableLinkLabel(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownLink(href, label) {
  try {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol)) return label;
    return `[${label.replace(/(\[|\])/g, '\\$1')}](${url.href})`;
  } catch {
    return label;
  }
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

  // ReactMarkdown intentionally does not execute model-authored HTML. Preserve
  // the useful link semantics by translating anchors to Markdown first.
  content = content.replace(
    /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_, _quote, href, label) => markdownLink(href, readableLinkLabel(label)),
  );

  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
