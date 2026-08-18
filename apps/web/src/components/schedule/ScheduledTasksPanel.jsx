import { useState } from 'react';
import { Box } from '@mui/material';
import ScheduledTaskList from './ScheduledTaskList';
import ScheduleCalendar from './ScheduleCalendar';

const ScheduledTasksPanel = () => {
  const [openIds, setOpenIds] = useState(() => new Set());

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleTaskClick = (taskId) => {
    // Open the accordion
    setOpenIds((prev) => {
      if (prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    // Scroll to the task after the accordion opens
    setTimeout(() => {
      document.getElementById(`st-${taskId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 80);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Left: scrollable task list */}
      <Box
        sx={{
          flex: '1 1 0',
          minWidth: 0,
          overflowY: 'auto',
          p: 2,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 3,
          },
        }}
      >
        <ScheduledTaskList openIds={openIds} onToggle={toggle} />
      </Box>

      {/* Right: calendar */}
      <ScheduleCalendar onTaskClick={handleTaskClick} />
    </Box>
  );
};

export default ScheduledTasksPanel;
