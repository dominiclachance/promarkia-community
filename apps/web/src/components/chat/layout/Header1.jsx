import { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Hidden from '@mui/material/Hidden';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CampaignIcon from '@mui/icons-material/Campaign';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import MenuIcon from '@mui/icons-material/Menu';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { t } from 'i18next';
import wpLogo from './wisdomprompt_logo.png';
import { ThemeContext } from './ThemeContext.jsx';
import NotificationBell from './NotificationBell';
import { useBoundStore } from '../../../stores';

function Header1({ onDrawerToggle, onOpenLaunchpad, user }) {
  const { darkMode, toggleTheme } = useContext(ThemeContext);
  const [timeCounter, setTimeCounter] = useState(0);

  useEffect(() => {
    const updateCounter = () => {
      const value = Number(sessionStorage.getItem('TimeCounter')) || 0;
      setTimeCounter(Math.round((value + Number.EPSILON) * 100) / 100);
    };
    updateCounter();
    const intervalId = setInterval(updateCounter, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const subscribeNotifications = useBoundStore((state) => state.subscribeNotifications);
  useEffect(() => {
    const unsubscribe = subscribeNotifications();
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [subscribeNotifications]);

  const identity = user?.displayName || user?.email || 'Local Owner';

  return (
    <AppBar
      color="transparent"
      sx={{
        height: '72px',
        bgcolor: 'background.default',
        backgroundImage: 'none',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
      position="sticky"
      elevation={0}
    >
      <Toolbar sx={{ height: '72px', py: 0 }}>
        <Grid container spacing={1} alignItems="center">
          <Hidden smDown>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '40%', color: '#fff' }}>
              <DoubleArrowIcon />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {sessionStorage.getItem('squadName')}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, ml: 2.5, mt: 0.5 }}>
                {t('reasoned_for', { time: timeCounter })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '60%', color: '#fff' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">{t('light_mode')}</Typography>
                <Switch
                  checked={darkMode}
                  onChange={toggleTheme}
                  size="small"
                  inputProps={{ 'aria-label': darkMode ? 'Use light theme' : 'Use dark theme' }}
                />
                <Typography variant="body2">{t('dark_mode')}</Typography>
                <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.7)' }} />
                {onOpenLaunchpad ? (
                  <Button
                    onClick={onOpenLaunchpad}
                    startIcon={<RocketLaunchRoundedIcon />}
                    sx={{ color: '#fff', fontWeight: 800, fontSize: '0.75rem' }}
                  >
                    Launchpad
                  </Button>
                ) : null}
                <Link href="https://blog.promarkia.com" target="_blank" rel="noopener" sx={{ color: '#fff', fontSize: 12 }}>
                  {t('blog')}
                </Link>
                <NotificationBell />
                <IconButton size="large" aria-label="Local owner profile">
                  <AccountCircleIcon sx={{ color: '#fff' }} />
                </IconButton>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {identity}
                </Typography>
              </Stack>
            </Box>
          </Hidden>
          <Hidden smUp>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <IconButton color="inherit" aria-label="open drawer" onClick={onDrawerToggle} edge="start">
                <MenuIcon />
              </IconButton>
              <Typography variant="body1" sx={{ flexGrow: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sessionStorage.getItem('squadName')}
              </Typography>
              {onOpenLaunchpad ? (
                <IconButton color="inherit" aria-label="Open Launchpad" onClick={onOpenLaunchpad}>
                  <RocketLaunchRoundedIcon />
                </IconButton>
              ) : null}
              <CampaignIcon sx={{ fontSize: 30 }} />
              <img src={wpLogo} alt="Promarkia logo" style={{ width: 120 }} />
            </Box>
          </Hidden>
        </Grid>
      </Toolbar>
    </AppBar>
  );
}

Header1.propTypes = {
  onDrawerToggle: PropTypes.func.isRequired,
  onOpenLaunchpad: PropTypes.func,
  user: PropTypes.shape({
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
    email: PropTypes.string,
  }),
};

export default Header1;
