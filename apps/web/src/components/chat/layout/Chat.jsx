import { useEffect, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Navigator from './Navigator';
import Header1 from './Header1';
import ChatDialog from './ChatDialog';
import { useBoundStore } from '../../../stores';
import PropTypes from 'prop-types';

const drawerWidth = 256;

export default function Chat({ onOpenLaunchpad }) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const clearChatMessages = useBoundStore((state) => state.clearChatMessages);

  useEffect(() => {
    clearChatMessages();
  }, [clearChatMessages]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navigatorProps = {
    PaperProps: { style: { width: drawerWidth } },
    onListItemClick: handleDrawerToggle,
    ...(isSmUp 
      ? { sx: { display: { sm: 'block', xs: 'none' } } } 
      : { variant: 'temporary', open: mobileOpen, onClose: handleDrawerToggle, ModalProps: { keepMounted: true } })
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', minWidth: 0, minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Navigator {...navigatorProps} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Header1 
          onDrawerToggle={handleDrawerToggle} 
          user={{ photoURL: sessionStorage.getItem('user_image') }} // added user prop to satisfy Header1.propTypes
          onOpenLaunchpad={onOpenLaunchpad}
        />
        <ChatDialog />
      </Box>
    </Box>
  );
}

Chat.propTypes = { onOpenLaunchpad: PropTypes.func };
