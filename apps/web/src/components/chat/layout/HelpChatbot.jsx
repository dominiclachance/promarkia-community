import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Fab,
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Slide,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { t } from 'i18next';
import { env } from '../../../config/env';
import { auth } from '../../../firebase/client';
import { secureRandomInt } from '../../../utils/secureRandom';

const HELP_TEAM_ID = 21;

const getAutogenAuthHeaders = async (extraHeaders = {}) => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const HelpChatbot = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 300);
    }
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    // New session each time panel opens
    setSessionId(secureRandomInt(100000, 1000000));
    setMessages([
      { role: 'bot', text: t('help_bot_welcome') },
    ]);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setMessages([]);
    setInput('');
    setLoading(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const getUserId = () => env.autogenServiceUserId;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const userId = getUserId();
      // Use the Promarkia bridge for all AutoGen Studio calls
      const apiBase = env.serverBase;

      // 1. Create session via bridge
      const sessionRes = await fetch(`${apiBase}/api/autogen/sessions`, {
        method: 'POST',
        headers: await getAutogenAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: sessionId,
          user_id: userId,
          team_id: HELP_TEAM_ID,
          name: 'Help Bot Session',
        }),
      });

      if (!sessionRes.ok) {
        // Session might already exist, that's fine
        const errData = await sessionRes.json().catch(() => ({}));
        if (!errData?.detail?.includes?.('already exists') && sessionRes.status !== 409) {
          throw new Error(`Session creation failed: ${sessionRes.status}`);
        }
      }

      // 2. Create run via bridge
      const runRes = await fetch(`${apiBase}/api/autogen/runs`, {
        method: 'POST',
        headers: await getAutogenAuthHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        }),
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
        }),
      });

      if (!runRes.ok) {
        throw new Error(`Run creation failed: ${runRes.status}`);
      }

      const runData = await runRes.json();
      const runId = runData.data?.run_id || runData.run_id || runData.id;
      if (!runId) throw new Error('Run ID not found in response');

      // 3. Fetch team config from API (via bridge)
      const teamRes = await fetch(`${apiBase}/api/autogen/teams/${HELP_TEAM_ID}`, {
        method: 'GET',
        headers: await getAutogenAuthHeaders({ accept: 'application/json' }),
      });
      if (!teamRes.ok) {
        throw new Error(`Failed to fetch help bot team config: ${teamRes.status}`);
      }
      const teamRaw = await teamRes.json();
      const teamConfig = teamRaw.data?.component ?? teamRaw.component ?? teamRaw;

      // 4. Open WebSocket using bridge-issued token
      const wsUrlResp = await fetch(`${apiBase}/api/autogen/ws-url/${runId}`, {
        headers: await getAutogenAuthHeaders(),
      });
      if (!wsUrlResp.ok) throw new Error(`WS URL fetch failed: ${wsUrlResp.status}`);
      const { ws_url } = await wsUrlResp.json();
      const ws = new WebSocket(ws_url);
      wsRef.current = ws;

      let botResponse = '';

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start', task: text, team_config: teamConfig }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);


          // Capture agent messages from "message" events (type=TextMessage, source=help_bot_agent)
          if (data.type === 'message') {
            const d = data.data || {};
            if (d.type === 'TextMessage' && d.source && d.source !== 'user' && d.source !== 'user_proxy') {
              const content = typeof d.content === 'string' ? d.content : '';
              // Skip raw JSON payloads (LLM call dumps) — only capture natural language
              if (content && !content.trimStart().startsWith('{') && !content.trimStart().startsWith('[')) {
                botResponse = content;

              }
            }
          }

          // On "result" event, finalize and display
          if (data.type === 'result') {
            // Also try extracting from task_result.messages as fallback
            if (!botResponse && data.data?.task_result?.messages) {
              const resultMessages = data.data.task_result.messages;
              for (let i = resultMessages.length - 1; i >= 0; i--) {
                const msg = resultMessages[i];
                if (!msg.content) continue;
                if (msg.source === 'user' || msg.source === 'user_proxy') continue;
                // Accept TextMessage or StopMessage with content
                const content = typeof msg.content === 'string' ? msg.content : '';
                if (content && !content.startsWith('Text ')) {
                  botResponse = content;
                  break;
                }
              }
            }

            // Strip HELPBOT_DONE and TERMINATE markers
            if (botResponse) {
              botResponse = botResponse.replace(/\b(HELPBOT_DONE|TERMINATE)\b/gi, '').trim();
            }



            if (botResponse) {
              setMessages((prev) => [...prev, { role: 'bot', text: botResponse }]);
            } else {
              setMessages((prev) => [...prev, { role: 'bot', text: t('help_bot_error') }]);
            }
            setLoading(false);
            ws.close();
            wsRef.current = null;
          }

          if (data.type === 'error') {
            setMessages((prev) => [...prev, { role: 'bot', text: t('help_bot_error') }]);
            setLoading(false);
            ws.close();
            wsRef.current = null;
          }
        } catch (e) {
          console.error('[HelpBot WS] parse error', e);
        }
      };

      ws.onerror = () => {
        setMessages((prev) => [...prev, { role: 'bot', text: t('help_bot_error') }]);
        setLoading(false);
        wsRef.current = null;
      };

      ws.onclose = () => {
        if (loading) {
          // If WS closed without result, check if we got a response
          if (botResponse) {
            setMessages((prev) => [...prev, { role: 'bot', text: botResponse }]);
          }
          setLoading(false);
        }
        wsRef.current = null;
      };
    } catch (err) {
      console.error('HelpChatbot error:', err);
      setMessages((prev) => [...prev, { role: 'bot', text: t('help_bot_error') }]);
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!open && (
        <Tooltip title={t('help_bot_tooltip')} placement="right">
          <Fab
            color="primary"
            onClick={handleOpen}
            sx={{
              position: 'fixed',
              left: 24,
              bottom: 24,
              zIndex: 1300,
              boxShadow: theme.shadows[6],
              animation: 'helpPulse 2s ease-in-out 3',
              '@keyframes helpPulse': {
                '0%': { boxShadow: `0 0 0 0 ${theme.palette.primary.main}80` },
                '70%': { boxShadow: `0 0 0 12px ${theme.palette.primary.main}00` },
                '100%': { boxShadow: `0 0 0 0 ${theme.palette.primary.main}00` },
              },
            }}
          >
            <HelpOutlineIcon />
          </Fab>
        </Tooltip>
      )}

      {/* Chat Panel */}
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: 4,
            bottom: 24,
            width: 380,
            height: 500,
            zIndex: 1300,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: theme.palette.background.paper,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              bgcolor: theme.palette.primary.dark,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              {t('help_bot_title')}
            </Typography>
            <IconButton size="small" onClick={handleClose} sx={{ color: 'inherit' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2,
              py: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: theme.palette.divider,
                borderRadius: 3,
              },
            }}
          >
            {messages.map((msg, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor:
                      msg.role === 'user'
                        ? theme.palette.primary.dark
                        : theme.palette.mode === 'dark'
                          ? theme.palette.grey[800]
                          : theme.palette.grey[300],
                    color:
                      msg.role === 'user'
                        ? '#fff'
                        : theme.palette.mode === 'dark'
                          ? theme.palette.text.primary
                          : theme.palette.grey[900],
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.text}
                </Box>
              </Box>
            ))}

            {/* Typing indicator */}
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <CircularProgress size={16} thickness={5} />
                <Typography variant="caption" color="text.secondary">
                  {t('help_bot_thinking')}
                </Typography>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderTop: `1px solid ${theme.palette.divider}`,
              flexShrink: 0,
            }}
          >
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              placeholder={t('help_bot_placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '0.875rem',
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              size="small"
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </Slide>
    </>
  );
};

export default HelpChatbot;
