import PropTypes from 'prop-types';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ActivationExperience from './ActivationExperience.jsx';

const CHAT_DRAWER_WIDTH = 256;

export default function LaunchpadDialog({ darkMode, onClose, onLogout, open, toggleTheme, user }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xl"
      aria-labelledby="launchpad-dialog-title"
      sx={{
        '& .MuiBackdrop-root': {
          left: { sm: `${CHAT_DRAWER_WIDTH}px` },
        },
        '& .MuiDialog-container': {
          ml: { sm: `${CHAT_DRAWER_WIDTH}px` },
          width: { sm: `calc(100% - ${CHAT_DRAWER_WIDTH}px)` },
        },
      }}
      PaperProps={{
        sx: {
          height: fullScreen ? '100%' : '75dvh',
          maxHeight: fullScreen ? '100%' : '75dvh',
          backgroundImage: 'none',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle id="launchpad-dialog-title" sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <RocketLaunchRoundedIcon color="primary" />
            <Typography component="span" variant="h6" sx={{ fontWeight: 900 }}>Launchpad</Typography>
          </Stack>
          <IconButton aria-label="Close Launchpad" onClick={onClose} edge="end">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent className="launchpad-dialog-content" sx={{ p: 0, overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        <ActivationExperience
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          user={user}
          onLogout={onLogout}
          onOpenChat={onClose}
          embedded
        />
      </DialogContent>
    </Dialog>
  );
}

LaunchpadDialog.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  toggleTheme: PropTypes.func.isRequired,
  user: PropTypes.shape({ email: PropTypes.string, uid: PropTypes.string }).isRequired,
};
