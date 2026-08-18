import { lazy, Suspense, useContext, useEffect, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { ThemeContext } from './components/chat/layout/ThemeContext.jsx';
import './App.css';

const Chat = lazy(() => import('./components/chat/layout/Chat'));
const LaunchpadDialog = lazy(() => import('./features/activation/LaunchpadDialog.jsx'));

const localUser = {
  uid: 'local',
  email: 'local@promarkia.local',
  displayName: 'Local Owner',
  photoURL: window.defaultAvatar,
  async getIdToken() { return 'local'; },
  async getIdTokenResult() { return { claims: { admin: true, local: true } }; },
};

export default function App() {
  const theme = useTheme();
  const themeContext = useContext(ThemeContext);
  const [launchpadOpen, setLaunchpadOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('uid', localUser.uid);
    sessionStorage.setItem('auth_uid', localUser.uid);
    sessionStorage.setItem('email', localUser.email);
    sessionStorage.setItem('displayName', localUser.displayName);
    document.body.style.backgroundColor = theme.palette.background.default;
    document.documentElement.style.backgroundColor = theme.palette.background.default;
  }, [theme]);

  if (!themeContext) return null;

  return (
    <HelmetProvider>
      <Helmet>
        <title>Promarkia Community — Local Workspace</title>
        <meta name="description" content="The complete local, approval-first Promarkia workspace." />
      </Helmet>
      <div className="container" style={{ width: '100%', minHeight: '100vh' }}>
        <ThemeProvider theme={theme}>
          <Suspense fallback={<div role="status" style={{ padding: 32 }}>Loading your local workspace…</div>}>
            <Chat onOpenLaunchpad={() => setLaunchpadOpen(true)} />
            <LaunchpadDialog
              open={launchpadOpen}
              onClose={() => setLaunchpadOpen(false)}
              darkMode={themeContext.darkMode}
              toggleTheme={themeContext.toggleTheme}
              user={localUser}
              onLogout={() => {}}
            />
          </Suspense>
        </ThemeProvider>
      </div>
    </HelmetProvider>
  );
}
