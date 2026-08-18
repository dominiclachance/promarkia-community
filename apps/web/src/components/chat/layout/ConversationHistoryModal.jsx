import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useTheme } from '@mui/material/styles';
import { fetchConversationsByEmail, fetchConversationMessages, deleteConversationSession } from '../../../services/conversations';
import CodeBlock from '../CopyCodeBlock';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeLightHighlight from '../../../utils/rehypeLightHighlight';
import rehypeExternalLinks from 'rehype-external-links';
import ListItem from '@mui/material/ListItem';
import Tooltip from '@mui/material/Tooltip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';

const squadIdToKey = (id) => {
  switch (String(id)) {
    case '1':  return 'assistant_squad';
    case '9':  return 'image_creator_squad';
    case '10': return 'video_squad';
    case '11': return 'social_media_squad';
    case '12': return 'copywriting_squad';
    case '13': return 'presentation_squad';
    case '14': return 'seo_expert_squad';
    case '15': return 'campaign_planner_squad';
    case '16': return 'digital_ads_squad';
    case '19': return 'coders_squad';
    case '20': return 'data_scientist_squad';
    case '21': return 'lead_generation_squad';
    default:   return null;
  }
};

// Strip internal payload junk from user messages
const cleanUserMessage = (text) => {
  if (!text || typeof text !== 'string') return text;
  // Remove everything after ". entity_id:" or ". Do not request approval"
  return text
    .replace(/\.\s*entity_id:.*$/s, '')
    .replace(/\.\s*Do not request approval.*$/s, '')
    .trim();
};

// Relative time formatting
const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

// Agent display name
const agentDisplayName = (name) => {
  if (!name) return 'Agent';
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const normalizeConversationMessages = (msgs, email) => {
  const normalized = [];
  for (const m of msgs || []) {
    let parsedRaw = null;
    let rawSource = m.raw ?? m.config ?? null;

    if (rawSource && typeof rawSource === 'object') {
      parsedRaw = rawSource;
    } else if (rawSource && typeof rawSource === 'string') {
      try {
        parsedRaw = JSON.parse(rawSource);
      } catch {
        parsedRaw = null;
      }
    }

    const typeLabel = (parsedRaw?.type || m.type || '').toLowerCase();
    const sourceLabel = (parsedRaw?.source || parsedRaw?.role || m.msg_from || '').toLowerCase();
    const userLabel = (m.user_id || '').toLowerCase();
    if (
      typeLabel === 'llmcall' ||
      sourceLabel.includes('llm_call') ||
      sourceLabel.includes('research_assistant') ||
      userLabel.includes('research_assistant')
    ) {
      continue;
    }

    let content = parsedRaw?.content || parsedRaw?.message || parsedRaw?.text;
    if (!content && parsedRaw) {
      content = JSON.stringify(parsedRaw);
    }
    if (!content) {
      content = m.content || m.config || '';
    }
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    const from = m.msg_from || m.user_id || 'assistant';
    const isUser = from === 'user' || from === email;

    normalized.push({
      id: m.id,
      created_at: m.created_at,
      from,
      isUser,
      text: isUser ? cleanUserMessage(content) : content,
    });
  }
  return normalized;
};

export default function ConversationHistoryModal({ open, onClose }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const email = sessionStorage.getItem('email') || '';
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sessionPreviews, setSessionPreviews] = useState({});
  const sessionPreviewsRef = useRef(sessionPreviews);
  sessionPreviewsRef.current = sessionPreviews;
  const [selected, setSelected] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoadingSessions(true);
    setSessions([]);
    setSessionPreviews({});
    setSelected(null);
    setMessages([]);
    (async () => {
      try {
        const items = await fetchConversationsByEmail(email);
        const filtered = (items || []).filter(
          (s) => !String(s?.name || '').toLowerCase().includes('routing squad')
        );
        setSessions(filtered);
      } catch (e) {
        console.error('[ConversationHistoryModal] fetchConversations error', e);
        setError('Failed to load sessions');
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [open, email]);

  // Extract the user's first prompt from a session for preview
  const getSessionPreview = useCallback((s) => {
    const fromCache = sessionPreviewsRef.current[s.id];
    if (fromCache) return fromCache;

    const candidates = [
      s.initial_message,
      s.initialMessage,
      s.first_user_message,
      s.firstUserMessage,
      s.user_message,
      s.userMessage,
      s.prompt,
      s.task,
      s.summary,
    ];

    const first = candidates.find((v) => typeof v === 'string' && v.trim());
    if (!first) return '';

    const cleaned = cleanUserMessage(first.trim());
    return cleaned.length > 120 ? `${cleaned.slice(0, 120)}…` : cleaned;
  }, []);

  useEffect(() => {
    if (!open || sessions.length === 0) return;

    let cancelled = false;

    (async () => {
      const next = {};
      const targets = sessions.slice(0, 20);
      for (const s of targets) {
        if (cancelled) return;
        const existing = getSessionPreview(s);
        if (existing) {
          next[s.id] = existing;
          continue;
        }
        try {
          const msgs = await fetchConversationMessages(s.id);
          const normalized = normalizeConversationMessages(msgs, email)
            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
          const firstUser = normalized.find((m) => m.isUser && typeof m.text === 'string' && m.text.trim());
          if (firstUser?.text) {
            const preview = firstUser.text.length > 120 ? `${firstUser.text.slice(0, 120)}…` : firstUser.text;
            next[s.id] = preview;
          }
        } catch {
          // ignore preview fetch errors
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setSessionPreviews((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => { cancelled = true; };
  }, [email, getSessionPreview, open, sessions]);

  const openSession = async (s) => {
    setSelected(s.id);
    setMessages([]);
    setError(null);
    setLoadingMessages(true);
    try {
      const msgs = await fetchConversationMessages(s.id);
      const normalized = normalizeConversationMessages(msgs, email);
      setMessages(normalized);

      const firstUser = normalized
        .slice()
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
        .find((m) => m.isUser && typeof m.text === 'string' && m.text.trim());
      if (firstUser?.text) {
        const preview = firstUser.text.length > 120 ? `${firstUser.text.slice(0, 120)}…` : firstUser.text;
        setSessionPreviews((prev) => ({ ...prev, [s.id]: preview }));
      }
    } catch (e) {
      console.error('[ConversationHistoryModal] fetchConversationMessages error', e);
      setError('Failed to load messages for session');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteSession = async (event, sessionId) => {
    event.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    setDeleting(sessionId);
    setError(null);
    try {
      const ok = await deleteConversationSession(sessionId);
      if (!ok) throw new Error('Request failed');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selected === sessionId) {
        setSelected(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[ConversationHistoryModal] delete error', err);
      setError('Unable to delete session');
    } finally {
      setDeleting(null);
    }
  };

  const ThemedLink = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main }}>
      {children}
    </a>
  );

  ThemedLink.propTypes = {
    href: PropTypes.string,
    children: PropTypes.node,
  };

  const customRenderers = {
    img: ({ src, alt }) => (
      <img src={src} alt={alt || 'Image'} style={{ display: 'block', width: '95%', maxWidth: '95%', borderRadius: 8 }} />
    ),
    a: ({ href, children }) => {
      const hrefString = typeof href === 'string' ? href : '';
      if (hrefString.match(/\.(jpeg|jpg|png|webp)$/i)) {
        return <img src={hrefString} alt={children?.[0] || 'Image'} style={{ display: 'block', width: '95%', borderRadius: 8 }} />;
      }
      if (hrefString.match(/\.(mp4)$/i)) {
        return (
          <video controls style={{ display: 'block', width: '95%', borderRadius: 8 }}>
            <source src={hrefString} type="video/mp4" />
          </video>
        );
      }
      return <ThemedLink href={href}>{children}</ThemedLink>;
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      BackdropProps={{ sx: { backdropFilter: 'blur(4px)' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <span>{t('conversation_history')}</span>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 28,
            top: 16,
            color: theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', height: '68vh' }}>
          {/* Session list — left panel */}
          <Box sx={{
            width: 320,
            borderRight: `1px solid ${theme.palette.divider}`,
            overflowY: 'auto',
            backgroundColor: theme.palette.background.default,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}>
            {loadingSessions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List dense disablePadding>
                {sessions.length === 0 && !error && (
                  <Typography sx={{ p: 3, textAlign: 'center' }} color="text.secondary">
                    {t('no_sessions_found')}
                  </Typography>
                )}
                {error && <Typography sx={{ p: 2 }} color="error">{error}</Typography>}
                {sessions.map(s => {
                  const rawTeamId =
                    s.team_id ||
                    s.teamId ||
                    (typeof s.name === 'string' && s.name.split(' - ').at(-1)) ||
                    null;

                  const squadKey = squadIdToKey(rawTeamId);
                  const squadLabel = squadKey ? t(squadKey) : rawTeamId || 'Unknown';
                  const isActive = selected === s.id;
                  const preview = getSessionPreview(s);

                  return (
                    <Fragment key={s.id}>
                      <ListItem
                        disablePadding
                        secondaryAction={
                          <Tooltip title={t('delete_session')}>
                            <span>
                              <IconButton
                                edge="end"
                                size="small"
                                disabled={deleting === s.id}
                                onClick={(evt) => handleDeleteSession(evt, s.id)}
                                sx={{
                                  color: deleting === s.id ? 'text.disabled' : 'text.secondary',
                                  opacity: 0.5,
                                  '&:hover': { opacity: 1 },
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        }
                      >
                        <ListItemButton
                          selected={isActive}
                          onClick={() => openSession(s)}
                          sx={{
                            py: 1.5,
                            px: 2,
                            borderLeft: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography
                                component="div"
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: theme.palette.text.primary,
                                  lineHeight: 1.2,
                                  textAlign: 'left',
                                }}
                              >
                                {squadLabel}
                              </Typography>
                            }
                            secondary={(
                              <Box sx={{ mt: 0.25 }}>
                                <Typography component="div" sx={{ fontSize: 11, color: 'text.secondary' }}>
                                  {relativeTime(s.updated_at)}
                                </Typography>
                                {preview ? (
                                  <Typography
                                    component="div"
                                    sx={{
                                      fontSize: 11,
                                      color: 'text.secondary',
                                      opacity: 0.9,
                                      mt: 0.2,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={preview}
                                  >
                                    {preview}
                                  </Typography>
                                ) : null}
                              </Box>
                            )}
                            primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                          />
                        </ListItemButton>
                      </ListItem>
                    </Fragment>
                  );
                })}
              </List>
            )}
          </Box>

          {/* Messages — right panel */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'hidden',
            backgroundColor: theme.palette.background.paper,
            p: 0,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}>
            {selected === null && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                  Select a session to preview messages
                </Typography>
              </Box>
            )}
            {selected !== null && loadingMessages && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {selected !== null && !loadingMessages && messages.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography color="text.secondary">{t('no_messages_session')}</Typography>
              </Box>
            )}

            {/* Chat-style messages */}
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {messages.map(m => (
                <Box
                  key={m.id}
                  sx={{
                    display: 'flex',
                    flexDirection: m.isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: '85%',
                    alignSelf: m.isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Avatar */}
                  <Box sx={{ flexShrink: 0, mt: 0.5 }}>
                    {m.isUser ? (
                      <AccountCircleIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
                    ) : (
                      <SmartToyIcon sx={{ fontSize: 28, color: theme.palette.success.main }} />
                    )}
                  </Box>

                  {/* Message bubble */}
                  <Box sx={{
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {/* Agent name chip + time */}
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.8,
                      mb: 0.3,
                      flexDirection: m.isUser ? 'row-reverse' : 'row',
                    }}>
                      {!m.isUser && (
                        <Chip
                          size="small"
                          label={agentDisplayName(m.from)}
                          sx={{
                            fontSize: '0.6rem',
                            height: 18,
                            backgroundColor: theme.palette.success.main + '20',
                            color: theme.palette.success.dark,
                          }}
                        />
                      )}
                      <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontSize: '0.6rem' }}>
                        {relativeTime(m.created_at)}
                      </Typography>
                    </Box>

                    {/* Content */}
                    <Box sx={{
                      px: 2,
                      py: 1.2,
                      borderRadius: m.isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      backgroundColor: m.isUser
                        ? theme.palette.primary.main + '18'
                        : theme.palette.action.hover,
                      border: `1px solid ${m.isUser ? theme.palette.primary.main + '30' : theme.palette.divider}`,
                      fontSize: '0.82rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      lineHeight: 1.5,
                      '& p': { m: 0, mb: 0.5 },
                      '& p:last-child': { mb: 0 },
                      '& img': { maxWidth: '100%', borderRadius: 1 },
                      '& pre': {
                        backgroundColor: theme.palette.background.default,
                        p: 1.5,
                        borderRadius: 1,
                        overflow: 'auto',
                        fontSize: '0.78rem',
                      },
                    }}>
                      <CodeBlock>
                        <Markdown
                          components={customRenderers}
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[
                            [rehypeRaw],
                            [rehypeLightHighlight],
                            [rehypeExternalLinks, { target: '_blank', rel: 'noopener noreferrer' }]
                          ]}
                        >
                          {typeof m.text === 'string' ? m.text : JSON.stringify(m.text)}
                        </Markdown>
                      </CodeBlock>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

ConversationHistoryModal.propTypes = {
  open: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
  onClose: PropTypes.func,
};
