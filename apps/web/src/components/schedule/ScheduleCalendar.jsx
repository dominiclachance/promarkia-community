import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useBoundStore } from '../../stores';

const STATUS_COLORS = {
  active:    '#4ade80',
  running:   '#facc15',
  completed: '#93c5fd',
  error:     '#f87171',
  paused:    '#c4b5fd',
};

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseTaskDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

// Stable day-key
function dayKey(year, month, day) {
  return `${year}-${month}-${day}`;
}

// Returns an array of day numbers (1-N) prefixed with nulls for the leading offset
function buildDays(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// Build a map of dayKey → [task, ...] for the given month,
// extrapolating recurring tasks across the full month.
function getMonthOccurrences(tasks, viewYear, viewMonth) {
  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999);
  const byDay = {};

  const addOccurrence = (task, date) => {
    const k = dayKey(date.getFullYear(), date.getMonth(), date.getDate());
    if (!byDay[k]) byDay[k] = [];
    if (!byDay[k].some((t) => t.id === task.id)) byDay[k].push(task);
  };

  tasks.forEach((task) => {
    if (!task || task.status === 'completed') return;

    const nra = parseTaskDate(task.nextRunAt);
    if (!nra) return;

    const recType = task.recurrence?.type;
    const every = task.recurrence?.every || 1;

    // Non-recurring or unsupported recurrence type: only show nextRunAt
    if (!recType || recType === 'once' || (recType !== 'hourly' && recType !== 'daily' && recType !== 'weekly')) {
      if (nra >= monthStart && nra <= monthEnd) addOccurrence(task, nra);
      return;
    }

    let intervalMs;
    switch (recType) {
      case 'hourly':  intervalMs = every * 60 * 60 * 1000; break;
      case 'daily':   intervalMs = every * 24 * 60 * 60 * 1000; break;
      case 'weekly':  intervalMs = every * 7 * 24 * 60 * 60 * 1000; break;
      default: return;
    }

    // Walk cursor from nextRunAt into the view month
    let cursor = new Date(nra.getTime());
    if (cursor < monthStart) {
      const diff = monthStart.getTime() - cursor.getTime();
      const steps = Math.floor(diff / intervalMs);
      cursor = new Date(cursor.getTime() + steps * intervalMs);
      if (cursor < monthStart) cursor = new Date(cursor.getTime() + intervalMs);
    }

    let iters = 0;
    while (cursor <= monthEnd && iters < 200) {
      if (cursor >= monthStart) addOccurrence(task, new Date(cursor));
      cursor = new Date(cursor.getTime() + intervalMs);
      iters++;
    }
  });

  return byDay;
}

const ScheduleCalendar = ({ onTaskClick }) => {
  const scheduledTasks = useBoundStore((state) => state.scheduledTasks ?? []);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const tasksByDay = getMonthOccurrences(scheduledTasks, viewYear, viewMonth);
  const todayKey = dayKey(now.getFullYear(), now.getMonth(), now.getDate());
  const cells = buildDays(viewYear, viewMonth);

  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 280,
        pl: 2,
        borderLeft: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Month navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <IconButton size="small" onClick={prevMonth} aria-label="previous month">
          <ChevronLeftIcon sx={{ color: '#fff' }} />
        </IconButton>
        <Typography variant="subtitle2" fontWeight={700} color="#fff">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Typography>
        <IconButton size="small" onClick={nextMonth} aria-label="next month">
          <ChevronRightIcon sx={{ color: '#fff' }} />
        </IconButton>
      </Box>

      {/* Day-of-week headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DAY_HEADERS.map((h) => (
          <Typography
            key={h}
            variant="caption"
            align="center"
            sx={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.65rem' }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {/* Day cells — flex: 1 so the grid fills all remaining vertical space */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', rowGap: '2px' }}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <Box key={`pad-${idx}`} />;
          }
          const k = dayKey(viewYear, viewMonth, day);
          const tasks = tasksByDay[k] ?? [];
          const isToday = k === todayKey;

          return (
            <Box
              key={k}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                backgroundColor: isToday ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#fff' : '#d1d5db',
                  lineHeight: 1.2,
                }}
              >
                {day}
              </Typography>

              {/* Task dots */}
              {tasks.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center', mt: '2px' }}>
                  {tasks.slice(0, 5).map((task) => (
                    <Tooltip
                      key={task.id}
                      title={`${task.name || 'Untitled'} · ${task.status ?? 'active'}`}
                      placement="top"
                      arrow
                    >
                      <Box
                        onClick={() => onTaskClick?.(task.id)}
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: STATUS_COLORS[task.status] ?? '#9ca3af',
                          cursor: onTaskClick ? 'pointer' : 'default',
                          flexShrink: 0,
                          '&:hover': onTaskClick ? { transform: 'scale(1.5)', transition: 'transform 0.1s' } : {},
                        }}
                      />
                    </Tooltip>
                  ))}
                  {tasks.length > 5 && (
                    <Tooltip title={tasks.slice(5).map((t) => t.name || 'Untitled').join(', ')} placement="top" arrow>
                      <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#9ca3af', lineHeight: 1 }}>
                        +{tasks.length - 5}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Legend */}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mb: 0.75 }}>
          Legend
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: '#d1d5db', fontSize: '0.65rem' }}>
                {status}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

ScheduleCalendar.propTypes = {
  onTaskClick: PropTypes.func,
};

export default ScheduleCalendar;
