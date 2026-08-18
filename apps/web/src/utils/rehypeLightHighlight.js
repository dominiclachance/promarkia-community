import { toText } from 'hast-util-to-text';
import { fromHtml } from 'hast-util-from-html';
import highlighter from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { visit } from 'unist-util-visit';

const languages = {
  bash,
  css,
  html: xml,
  javascript,
  json,
  markdown,
  plaintext,
  python,
  shell: bash,
  sql,
  typescript,
  xml,
  yaml,
};

Object.entries(languages).forEach(([name, grammar]) => {
  highlighter.registerLanguage(name, grammar);
});

/**
 * Lightweight fenced-code highlighter for the languages Promarkia commonly
 * returns. Unlike rehype-highlight's default registry, this does not ship
 * every Highlight.js grammar in the authenticated application bundle.
 */
export default function rehypeLightHighlight() {
  return (tree) => {
    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'code' || parent?.tagName !== 'pre') return;
      const classes = Array.isArray(node.properties?.className)
        ? node.properties.className
        : [];
      const languageClass = classes.find((value) => /^lang(?:uage)?-/.test(String(value)));
      const language = String(languageClass || '').replace(/^lang(?:uage)?-/, '');
      if (!language || !highlighter.getLanguage(language)) return;

      const result = highlighter.highlight(toText(node), {
        language,
        ignoreIllegals: true,
      });
      node.children = fromHtml(result.value, { fragment: true }).children;
      node.properties = {
        ...node.properties,
        className: [...new Set([...classes, 'hljs'])],
      };
    });
  };
}
