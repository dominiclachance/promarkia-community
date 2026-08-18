import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CampaignIcon from '@mui/icons-material/Campaign';
import CloseIcon from '@mui/icons-material/Close';
import Fade from '@mui/material/Fade';
import { useTheme } from '@mui/material';
import { t } from 'i18next';
import { useBoundStore } from '../../../stores';

// Friendly display names for agents
const agentDisplayName = (name) => {
  if (!name) return 'Agent';
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// Determine step type icon + label
const StepIcon = ({ type }) => {
  const theme = useTheme();
  const iconSx = { fontSize: 18, mr: 0.5 };
  switch (type) {
    case 'tool_call':
      return <BuildIcon sx={{ ...iconSx, color: theme.palette.warning.main }} />;
    case 'tool_result':
      return <CheckCircleIcon sx={{ ...iconSx, color: theme.palette.success.main }} />;
    case 'thinking':
      return <PsychologyIcon sx={{ ...iconSx, color: theme.palette.info.main }} />;
    case 'error':
      return <ErrorOutlineIcon sx={{ ...iconSx, color: theme.palette.error.main }} />;
    case 'complete':
      return <CheckCircleIcon sx={{ ...iconSx, color: theme.palette.success.main }} />;
    default:
      return <SmartToyIcon sx={{ ...iconSx, color: theme.palette.primary.main }} />;
  }
};

// Format elapsed time
const formatElapsed = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    const fraction = Math.floor((ms % 1000) / 100);
    return `${totalSeconds}.${fraction}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const AgentActivityPanel = () => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const scrollRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const pendingResponse = useBoundStore((s) => s.pendingResponse);
  const agentActivities = useBoundStore((s) => s.agentActivities);
  const lastError = useBoundStore((s) => s.lastError);

  // Reset dismissed state when a new task starts
  useEffect(() => {
    if (pendingResponse) {
      setDismissed(false);
      setExpanded(true);
    }
  }, [pendingResponse]);

  // Elapsed timer
  useEffect(() => {
    if (!pendingResponse) {
      return;
    }
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
    return () => clearInterval(timer);
  }, [pendingResponse]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentActivities, expanded]);

  const visible = (pendingResponse || (lastError && agentActivities?.length > 0)) && !dismissed;

  if (!visible) return null;

  const lastActivity = agentActivities[agentActivities.length - 1];

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={() => setDismissed(true)}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1399,
        }}
      />
      <Fade in={visible}>
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1400,
          width: { xs: '90vw', sm: '70vw', md: '50vw' },
          maxHeight: '70vh',
          borderRadius: 3,
          overflow: 'hidden',
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[16],
        }}
      >
        {/* Header bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            backgroundColor: theme.palette.action.hover,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CampaignIcon
              className="spin"
              sx={{ fontSize: 32, color: theme.palette.primary.main }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {t('agent_activity', 'Agent Activity')}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {formatElapsed(elapsed)} — {agentActivities.length} {agentActivities.length === 1 ? 'step' : 'steps'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {lastError ? (
              <ErrorOutlineIcon sx={{ fontSize: 20, color: theme.palette.error.main, mr: 1 }} />
            ) : (
              <CircularProgress size={18} thickness={5} sx={{ color: theme.palette.primary.main, mr: 1 }} />
            )}
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={() => setDismissed(true)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Current speaker bar */}
        {!lastActivity && (
          <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={16} thickness={5} sx={{ color: theme.palette.primary.main }} />
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {t('task_processing', 'Processing your request...')}
            </Typography>
          </Box>
        )}
        {lastActivity && (
          <Box
            sx={{
              px: 2,
              py: 0.8,
              backgroundColor: theme.palette.primary.main + '15',
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <StepIcon type={lastActivity.type} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {agentDisplayName(lastActivity.agent)}
            </Typography>
            {lastActivity.type === 'tool_call' && lastActivity.toolName && (
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.warning.dark,
                  backgroundColor: theme.palette.warning.main + '20',
                  px: 1,
                  py: 0.2,
                  borderRadius: 1,
                  fontWeight: 500,
                }}
              >
                {lastActivity.toolName}
              </Typography>
            )}
          </Box>
        )}

        {/* Activity feed */}
        <Collapse in={expanded}>
          <Box
            ref={scrollRef}
            sx={{
              maxHeight: '50vh',
              overflowY: 'auto',
              px: 2,
              py: 1,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.divider,
                borderRadius: 2,
              },
            }}
          >
            {agentActivities.map((activity, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  py: 0.6,
                  borderBottom: idx < agentActivities.length - 1 ? `1px solid ${theme.palette.divider}22` : 'none',
                  opacity: idx === agentActivities.length - 1 ? 1 : 0.6,
                  transition: 'opacity 0.3s',
                }}
              >
                <Box sx={{ mt: 0.3, mr: 0.5, flexShrink: 0 }}>
                  <StepIcon type={activity.type} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        fontSize: '0.75rem',
                      }}
                    >
                      {agentDisplayName(activity.agent)}
                    </Typography>
                    {activity.type === 'tool_call' && activity.toolName && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.warning.dark,
                          fontSize: '0.7rem',
                          backgroundColor: theme.palette.action.hover,
                          px: 0.5,
                          borderRadius: 0.5,
                        }}
                      >
                        {activity.toolName}
                      </Typography>
                    )}
                    {activity.tokens > 0 && (
                      <Typography variant="caption" sx={{ color: theme.palette.text.disabled, fontSize: '0.65rem' }}>
                        {activity.tokens.toLocaleString()} tokens
                      </Typography>
                    )}
                  </Box>
                  {activity.snippet && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.72rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3,
                        mt: 0.2,
                      }}
                    >
                      {activity.snippet}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Box>
    </Fade>
    </>
  );
};

StepIcon.propTypes = {
  type: PropTypes.string,
};

export default AgentActivityPanel;
