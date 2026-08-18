import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material';
import { t } from 'i18next';
import { useBoundStore } from '../../../stores';

const formatDate = (value) => {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const NotificationBell = () => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const notifications = useBoundStore((s) => s.notifications);
  const markNotificationRead = useBoundStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useBoundStore((s) => s.markAllNotificationsRead);
  const clearReadNotifications = useBoundStore((s) => s.clearReadNotifications);

  const unreadCount = (notifications || []).filter((n) => !n.read).length;
  const open = Boolean(anchorEl);

  const handleClick = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markNotificationRead(notification.id);
    }
  };

  return (
    <>
      <IconButton
        size="large"
        onClick={handleClick}
        sx={{ position: 'relative' }}
      >
        <NotificationsIcon sx={{ color: unreadCount > 0 ? theme.palette.error.main : '#fff' }} />
        {unreadCount > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: theme.palette.error.main,
              color: '#fff',
              fontSize: '0.6rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Box>
        )}
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 400,
            backgroundColor: theme.palette.background.paper,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {t('notifications', 'Notifications')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={() => markAllNotificationsRead()}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('mark_all_read', 'Mark all read')}
              </Button>
            )}
            {notifications && notifications.length > 0 && (
              <Button
                size="small"
                color="error"
                onClick={() => clearReadNotifications()}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('clear_read', 'Clear read')}
              </Button>
            )}
          </Box>
        </Box>

        {/* Notification list */}
        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {(!notifications || notifications.length === 0) ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            notifications.map((n) => (
              <Box
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                sx={{
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.palette.divider}22`,
                  backgroundColor: n.read ? 'transparent' : theme.palette.action.hover,
                  '&:hover': { backgroundColor: theme.palette.action.selected },
                  transition: 'background-color 0.2s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {n.type === 'task_error' ? (
                    <ErrorOutlineIcon sx={{ fontSize: 20, color: theme.palette.error.main, mt: 0.2 }} />
                  ) : n.type === 'task_partial' ? (
                    <WarningAmberIcon sx={{ fontSize: 20, color: theme.palette.warning.main, mt: 0.2 }} />
                  ) : (
                    <CheckCircleIcon sx={{ fontSize: 20, color: theme.palette.success.main, mt: 0.2 }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={n.read ? 400 : 600} noWrap>
                      {n.taskName || 'Scheduled Task'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                      {n.message || (n.type === 'task_error' ? 'Task failed' : 'Task completed successfully')}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.3, fontSize: '0.65rem', color: theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.primary.main, fontWeight: 600 }}>
                      {formatDate(n.createdAt)}
                    </Typography>
                  </Box>
                  {!n.read && (
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: theme.palette.error.main,
                      mt: 0.8,
                      flexShrink: 0,
                    }} />
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBell;
