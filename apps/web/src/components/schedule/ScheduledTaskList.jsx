import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useBoundStore } from '../../stores';
import { useTranslation } from 'react-i18next';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CircularProgress from '@mui/material/CircularProgress';
import { Box, Button, Chip, Paper, Stack, Typography, useTheme } from '@mui/material';
import ScheduleTaskDialog from './ScheduleTaskDialog';

const formatDate = (value) => {
  if (!value) return '—';
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

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

const statusColors = {
  active: '#4ade80',
  running: '#facc15',
  completed: '#93c5fd',
  error: '#f87171',
  paused: '#c4b5fd',
};

// Extract readable result text from a run
const extractRunResult = (run) => {
  if (!run) return '';
  const messages = run.task_result?.messages || run.messages || [];
  // Get the last non-user TextMessage with content
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'TextMessage' && msg.source !== 'user' && msg.content) {
      return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    }
  }
  return '';
};

// Count tokens in a run
const countRunTokens = (run) => {
  if (!run) return 0;
  const messages = run.task_result?.messages || run.messages || [];
  let total = 0;
  messages.forEach((msg) => {
    if (msg.models_usage) {
      total += (msg.models_usage.prompt_tokens || 0) + (msg.models_usage.completion_tokens || 0);
    }
  });
  return total;
};

// Determine run status from content
const getRunStatus = (run) => {
  if (!run) return 'unknown';
  const result = run.task_result;
  if (!result) return 'error';
  if (result.stop_reason) return 'success';
  const messages = result.messages || run.messages || [];
  if (messages.length > 0) return 'success';
  return 'unknown';
};

// --- Run History Row ---
const RunHistoryRow = ({ run }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const status = getRunStatus(run);
  const tokens = countRunTokens(run);
  const resultText = extractRunResult(run);

  return (
    <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}33` }}>
      <Box
        onClick={() => resultText && setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1,
          px: 1.5,
          cursor: resultText ? 'pointer' : 'default',
          '&:hover': resultText ? { backgroundColor: theme.palette.action.hover } : {},
          borderRadius: 1,
        }}
      >
        {status === 'success' ? (
          <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
        ) : status === 'error' ? (
          <ErrorOutlineIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />
        ) : (
          <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.grey[500] }} />
        )}
        <Typography variant="caption" sx={{ color: theme.palette.text.primary, fontWeight: 500, minWidth: 140 }}>
          {formatDate(run.createdAt)}
        </Typography>
        {tokens > 0 && (
          <Chip
            size="small"
            label={`${tokens.toLocaleString()} tokens`}
            sx={{ fontSize: '0.65rem', height: 20, backgroundColor: theme.palette.action.selected }}
          />
        )}
        {tokens > 0 && (
          <Chip
            size="small"
            label={`${tokens.toLocaleString()} tokens`}
            sx={{ fontSize: '0.65rem', height: 20, backgroundColor: theme.palette.warning.main + '30', color: theme.palette.warning.dark }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {resultText && (
          <IconButton size="small" sx={{ p: 0.3 }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>
      <Collapse in={expanded}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            mx: 1.5,
            mb: 1,
            backgroundColor: theme.palette.background.default,
            borderRadius: 1,
            maxHeight: 200,
            overflowY: 'auto',
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: theme.palette.text.secondary,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}
        >
          {resultText || 'No result content available.'}
        </Box>
      </Collapse>
    </Box>
  );
};

const ScheduledTaskList = ({ openIds: controlledOpenIds, onToggle: controlledToggle } = {}) => {
  const {
    scheduledTasks = [],
    scheduledTasksLoading,
    loadScheduledTasks,
    runTaskNow,
    cancelScheduledTask,
    updateScheduledTask,
    taskRuns = {},
    taskRunsLoading = {},
    loadTaskRuns,
  } = useBoundStore((state) => ({
    scheduledTasks: state.scheduledTasks,
    scheduledTasksLoading: state.scheduledTasksLoading,
    loadScheduledTasks: state.loadScheduledTasks,
    runTaskNow: state.runTaskNow,
    cancelScheduledTask: state.cancelScheduledTask,
    updateScheduledTask: state.updateScheduledTask,
    taskRuns: state.taskRuns,
    taskRunsLoading: state.taskRunsLoading,
    loadTaskRuns: state.loadTaskRuns,
  }));

  const { t } = useTranslation();
  const theme = useTheme();

  const [internalOpenIds, setInternalOpenIds] = useState(() => new Set());
  const [historyOpenIds, setHistoryOpenIds] = useState(() => new Set());

  const isControlled = controlledOpenIds !== undefined && controlledToggle !== undefined;
  const openIds = isControlled ? controlledOpenIds : internalOpenIds;

  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const toggle = (id) => {
    if (isControlled) {
      controlledToggle(id);
    } else {
      setInternalOpenIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  };

  const toggleHistory = (taskId) => {
    setHistoryOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
        // Load runs if not already loaded
        if (!taskRuns[taskId] && typeof loadTaskRuns === 'function') {
          loadTaskRuns(taskId);
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof loadScheduledTasks === 'function') loadScheduledTasks();
  }, [loadScheduledTasks]);

  const handleEdit = (task) => {
    setEditTask(task);
    setEditOpen(true);
  };

  const handleDelete = async (task) => {
    const ok = window.confirm(`Delete scheduled task "${task?.name || 'Untitled task'}"?`);
    if (!ok) return;
    await cancelScheduledTask(task.id);
    if (typeof loadScheduledTasks === 'function') loadScheduledTasks();
  };

  const handleUpdate = async (updatedTask) => {
    await updateScheduledTask(updatedTask);
    setEditOpen(false);
    setEditTask(null);
  };

  if (scheduledTasksLoading) return <p>Loading scheduled tasks…</p>;
  if (!scheduledTasks.length) return <p>No scheduled tasks yet.</p>;

  return (
    <>
      <Stack spacing={2}>
        {scheduledTasks.map((task) => {
          const isOpen = openIds.has(task.id);
          const isHistoryOpen = historyOpenIds.has(task.id);
          const squadKey = squadIdToKey(task.squadId);
          const squadLabel = squadKey ? t(squadKey) : task.squadId || '—';
          const runs = taskRuns[task.id] || [];
          const runsLoading = taskRunsLoading[task.id] || false;

          return (
            <Paper key={task.id} id={`st-${task.id}`} sx={{ p: 2, backgroundColor: theme.palette.background.paper }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} color={theme.palette.text.primary}>
                    {task.name || 'Untitled task'}
                  </Typography>

                  <Chip
                    size="small"
                    label={task.status ?? 'active'}
                    sx={{
                      backgroundColor: statusColors[task.status] || '#9ca3af',
                      color: '#111',
                    }}
                  />
                </Box>

                <IconButton size="small" onClick={() => toggle(task.id)}>
                  {isOpen ? (
                    <KeyboardArrowUpIcon sx={{ color: theme.palette.text.primary }} />
                  ) : (
                    <KeyboardArrowDownIcon sx={{ color: theme.palette.text.primary }} />
                  )}
                </IconButton>
              </Box>

              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 1.5, display: 'grid', rowGap: 0.5 }}>
                  <Typography variant="body2" color={theme.palette.text.primary}>
                    Next run: {formatDate(task.nextRunAt)}
                  </Typography>
                  <Typography variant="body2" color={theme.palette.text.primary}>
                    Last run: {task.lastRunAt ? formatDate(task.lastRunAt) : '—'}
                  </Typography>
                  <Typography variant="body2" color={theme.palette.text.primary}>
                    Squad: {squadLabel}
                  </Typography>
                  <Box sx={{ mt: 1, p: 1.5, backgroundColor: theme.palette.action.hover, borderRadius: 1, borderLeft: `3px solid ${theme.palette.primary.main}` }}>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, display: 'block', mb: 0.5, letterSpacing: '0.06em' }}>
                      PROMPT
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: theme.palette.text.primary, fontSize: '0.9rem', lineHeight: 1.65 }}>
                      {task.prompt || '—'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button size="small" variant="contained" onClick={() => runTaskNow(task.id)}>
                    Run now
                  </Button>

                  <Button size="small" variant="outlined" onClick={() => handleEdit(task)}>
                    Edit
                  </Button>

                  <Button size="small" color="error" variant="outlined" onClick={() => handleDelete(task)}>
                    Delete
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<HistoryIcon />}
                    onClick={() => toggleHistory(task.id)}
                    sx={{ ml: 'auto' }}
                  >
                    {isHistoryOpen ? 'Hide History' : 'Run History'}
                  </Button>
                </Box>

                {/* Run History Panel */}
                <Collapse in={isHistoryOpen} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{
                      px: 2,
                      py: 1,
                      backgroundColor: theme.palette.action.hover,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}>
                      <HistoryIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Run History
                      </Typography>
                      {runs.length > 0 && (
                        <Chip size="small" label={`${runs.length} runs`} sx={{ fontSize: '0.65rem', height: 20 }} />
                      )}
                    </Box>

                    {runsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : runs.length === 0 ? (
                      <Box sx={{ px: 2, py: 2 }}>
                        <Typography variant="body2" color={theme.palette.text.secondary}>
                          No runs recorded yet.
                        </Typography>
                      </Box>
                    ) : (
                      runs.map((run) => (
                        <RunHistoryRow key={run.id} run={run} />
                      ))
                    )}
                  </Box>
                </Collapse>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>

      <ScheduleTaskDialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTask(null);
        }}
        mode="edit"
        initialTask={editTask}
        onUpdate={handleUpdate}
      />
    </>
  );
};

RunHistoryRow.propTypes = {
  run: PropTypes.shape({
    createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    task_result: PropTypes.object,
    messages: PropTypes.array,
  }).isRequired,
};

ScheduledTaskList.propTypes = {
  openIds: PropTypes.instanceOf(Set),
  onToggle: PropTypes.func,
};

export default ScheduledTaskList;
