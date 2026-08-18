import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeArticleContent } from './articleContent.js';

export default function ArticlePreview({ content }) {
  return (
    <article className="article-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
        }}
      >
        {normalizeArticleContent(content)}
      </ReactMarkdown>
    </article>
  );
}

ArticlePreview.propTypes = { content: PropTypes.string };

