import { useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepConnector from '@mui/material/StepConnector';
import { styled, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useBoundStore } from '../../../stores';
import { squads } from '../../../data/squads';

// --- Pipeline Stepper ---

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  '&.MuiStepConnector-root': { top: 22 },
  '& .MuiStepConnector-line': {
    backgroundColor: theme.palette.divider,
    height: 3,
    border: 0,
    borderRadius: 1,
  },
  '&.MuiStepConnector-active .MuiStepConnector-line': {
    backgroundColor: theme.palette.primary.main,
  },
  '&.MuiStepConnector-completed .MuiStepConnector-line': {
    backgroundColor: theme.palette.success.main,
  },
}));

const ColorlibStepIconRoot = styled('div', {
  shouldForwardProp: (prop) => prop !== 'ownerState',
})(({ theme, ownerState }) => ({
  backgroundColor: ownerState?.completed
    ? theme.palette.success.main
    : ownerState?.active
    ? theme.palette.primary.main
    : theme.palette.divider,
  zIndex: 1,
  color: '#fff',
  width: 46,
  height: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  fontSize: '1.1rem',
  fontWeight: 700,
  transition: 'all 0.3s ease',
  boxShadow: ownerState?.active ? `0 0 0 4px ${theme.palette.primary.main}33` : 'none',
}));

function ColorlibStepIcon({ active, completed, icon }) {
  const icons = { 1: '📋', 2: '🔍', 3: '✍️', 4: '✅', 5: '🚀', 6: '📊', 7: '🎯' };
  return (
    <ColorlibStepIconRoot ownerState={{ active, completed }}>
      {completed ? (
        <CheckCircleIcon sx={{ fontSize: 24 }} />
      ) : (
        icons[String(icon)] || icon
      )}
    </ColorlibStepIconRoot>
  );
}

const PipelineProgress = ({ currentStage }) => {
  const theme = useTheme();
  const teamId = sessionStorage.getItem('squad') || '1';
  const squad = squads.find((s) => s.teamId === teamId);
  const stages = squad?.stages || [];
  const campaignMode = sessionStorage.getItem('campaignMode') === 'true';
  const campaignIndex = parseInt(sessionStorage.getItem('campaignIndex') || '0', 10);
  const campaignTeams = JSON.parse(sessionStorage.getItem('campaignTeams') || '[]');
  const campaignLabels = JSON.parse(sessionStorage.getItem('campaignLabels') || '[]');

  if (!stages.length && !campaignMode) return null;

  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {campaignMode && campaignTeams.length > 0 ? (
          <>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.warning.main, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}
            >
              Campaign
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}
            >
              — {campaignLabels[campaignIndex] || campaignTeams[campaignIndex] || 'Squad'} ({campaignIndex + 1}/{campaignTeams.length})
            </Typography>
            {campaignLabels.length > 1 && (
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.disabled, fontSize: '0.65rem', ml: 0.5 }}
              >
                → {campaignLabels.slice(campaignIndex + 1).join(' → ')}
              </Typography>
            )}
          </>
        ) : (
          <>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}
            >
              Pipeline
            </Typography>
            {currentStage >= 0 && currentStage < stages.length && (
              <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 700 }}>
                — {stages[currentStage]}
              </Typography>
            )}
          </>
        )}
      </Box>
      <Stepper activeStep={currentStage} alternativeLabel connector={<ColorlibConnector />}>
        {stages.map((label) => (
          <Step key={label}>
            <StepLabel StepIconComponent={ColorlibStepIcon}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color:
                    currentStage < 0
                      ? theme.palette.text.disabled
                      : stages.indexOf(label) === currentStage
                      ? theme.palette.primary.main
                      : stages.indexOf(label) < currentStage
                      ? theme.palette.success.main
                      : theme.palette.text.disabled,
                  fontWeight: stages.indexOf(label) === currentStage ? 700 : 400,
                  mt: 0.5,
                  display: 'block',
                }}
              >
                {label}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

// --- Agent Thinking Cards ---

const agentDisplayName = (name) => {
  if (!name) return 'Agent';
  return String(name).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const StepIcon = ({ type }) => {
  const theme = useTheme();
  const iconSx = { fontSize: 16, mr: 0.5 };
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

const AgentThinkingCards = () => {
  const theme = useTheme();
  const agentActivities = useBoundStore((s) => s.agentActivities);
  const pendingResponse = useBoundStore((s) => s.pendingResponse);

  const guessStageFromActivity = (activity) => {
    const agent = String(activity.agent || '').toLowerCase();
    const type = activity.type;
    if (type === 'error') return -1;
    if (agent.includes('research') || agent.includes('scanner') || agent.includes('collector')) return 0;
    if (agent.includes('write') || agent.includes('copy') || agent.includes('creator') || agent.includes('coder')) return 1;
    if (agent.includes('verify') || agent.includes('checker')) return 2;
    if (
      agent.includes('summary') ||
      agent.includes('report') ||
      agent.includes('sender') ||
      agent.includes('posting') ||
      agent.includes('publish') ||
      type === 'complete'
    )
      return 3;
    return -1;
  };

  const currentStage = useMemo(() => {
    if (!agentActivities || agentActivities.length === 0) return -1;
    for (let i = agentActivities.length - 1; i >= 0; i--) {
      const stage = guessStageFromActivity(agentActivities[i]);
      if (stage >= 0) return stage;
    }
    return -1;
  }, [agentActivities]);

  const recentActivities = useMemo(() => {
    if (!agentActivities || agentActivities.length === 0) return [];
    const seen = new Set();
    const result = [];
    for (let i = agentActivities.length - 1; i >= 0; i--) {
      const a = agentActivities[i];
      const key = `${a.agent}:${a.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.unshift(a);
      }
      if (result.length >= 4) break;
    }
    return result;
  }, [agentActivities]);

  // Early return AFTER all hooks (React rules of hooks)
  if (!pendingResponse && (!agentActivities || agentActivities.length === 0)) return null;

  if (recentActivities.length === 0) {
    return <PipelineProgress currentStage={-1} />;
  }

  return (
    <>
      <PipelineProgress currentStage={currentStage >= 0 ? currentStage : -1} />
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {recentActivities.map((activity, idx) => {
          const snippet = typeof activity.snippet === 'string' ? activity.snippet : '';
          const toolName = typeof activity.toolName === 'string' ? activity.toolName : '';
          const agentName = agentDisplayName(activity.agent);
          const isLast = idx === recentActivities.length - 1;

          return (
            <Box
              key={`${activity.agent}-${activity.type}-${idx}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                px: 1.5,
                py: 1,
                borderLeft: `3px solid ${
                  activity.type === 'error'
                    ? theme.palette.error.main
                    : activity.type === 'complete'
                    ? theme.palette.success.main
                    : activity.type === 'tool_call'
                    ? theme.palette.warning.main
                    : theme.palette.info.main
                }`,
              }}
            >
              <StepIcon type={activity.type} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.78rem' }}>
                {agentName}
              </Typography>
              {toolName && (
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.warning.dark,
                    backgroundColor: theme.palette.warning.main + '18',
                    px: 0.8,
                    py: 0.1,
                    borderRadius: 1,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                  }}
                >
                  {toolName}
                </Typography>
              )}
              {snippet && (
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: '0.72rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '80%',
                  }}
                >
                  — {snippet}
                </Typography>
              )}
              {isLast && pendingResponse && (
                <CircularProgress
                  size={10}
                  thickness={5}
                  sx={{ ml: 'auto', color: theme.palette.primary.main, flexShrink: 0 }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </>
  );
};

ColorlibStepIcon.propTypes = {
  active: PropTypes.bool,
  completed: PropTypes.bool,
  icon: PropTypes.node,
};

PipelineProgress.propTypes = {
  currentStage: PropTypes.number.isRequired,
};

StepIcon.propTypes = {
  type: PropTypes.string,
};

export { PipelineProgress, AgentThinkingCards };
export default AgentThinkingCards;
