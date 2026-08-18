import { useEffect, useState, useRef, useCallback } from 'react';
import Drawer from '@mui/material/Drawer';
import { Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Hidden from '@mui/material/Hidden';
import { httpsCallable } from 'firebase/functions';
import CampaignIcon from '@mui/icons-material/Campaign';
import Box from '@mui/material/Box';
import ConnectSocial from './connectSocial';
import { useTheme } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { useBoundStore } from '../../../stores';
import ConversationHistoryModal from './ConversationHistoryModal';
import ArtifactsModal from './ArtifactsModal';
import HistoryIcon from '@mui/icons-material/History';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ScheduleTaskDialog from '../../schedule/ScheduleTaskDialog';
import ScheduledTasksPanel from '../../schedule/ScheduledTasksPanel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CloseIcon from '@mui/icons-material/Close';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ApiKeyManager from './ApiKeyManager';
import ApprovalQueue from './ApprovalQueue';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import McpManager from './McpManager';
import HubIcon from '@mui/icons-material/Hub';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BrushIcon from '@mui/icons-material/Brush';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { scheduledTasksToCsv, parseScheduledTasksCsv } from '../../../utils/scheduledTasksCsv';
import { auth, functions } from '../../../firebase/client';
import { squads, squadGroups } from '../../../data/squads';


const generateSessionId = () => Math.floor(Math.random() * 1_000_000).toString();

// Find which group a teamId belongs to
const getGroupForTeamId = (teamId) => {
  const squad = squads.find((s) => s.teamId === teamId);
  return squad?.group || null;
};

export default function Navigator(props) {
  const { t, i18n } = useTranslation();
  const { onListItemClick, ...other } = props;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledListOpen, setScheduledListOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);

  const [selectedSquad, setSelectedSquad] = useState(sessionStorage.getItem('squad') || '1');

  // Accordion expansion state — only one group open at a time, persisted in localStorage
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('nav_expanded');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    const group = getGroupForTeamId(sessionStorage.getItem('squad') || '1');
    return group || 'general_group';
  });

  const handleAccordionChange = (groupId) => (_event, isExpanded) => {
    const next = isExpanded ? groupId : false;
    setExpanded(next);
    localStorage.setItem('nav_expanded', JSON.stringify(next));
  };

  // Auto-expand group when squad changes
  useEffect(() => {
    const group = getGroupForTeamId(selectedSquad);
    if (group && expanded !== group) {
      setExpanded(group);
      localStorage.setItem('nav_expanded', JSON.stringify(group));
    }
  }, [expanded, selectedSquad]);

  // Listen for squad changes in sessionStorage
  useEffect(() => {
    const interval = setInterval(() => {
      const squad = sessionStorage.getItem('squad') || '1';
      setSelectedSquad(squad);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const theme = useTheme();
  const textColor = theme.palette.text.primary;

  const modalPaperSx = {
    borderRadius: '12px',
    backgroundImage: 'none',
    backgroundColor: theme.palette.background.paper,
  };

  useEffect(() => {
    if (!currentUser) return;

    const providerUid = currentUser.providerData?.[0]?.uid ?? '';
    const authUid = currentUser.uid ?? '';

    sessionStorage.setItem('email', currentUser.email ?? '');
    sessionStorage.setItem('user_image', currentUser.photoURL ?? '');
    sessionStorage.setItem('uid', providerUid || authUid);
    sessionStorage.setItem('provider_uid', providerUid);
    sessionStorage.setItem('auth_uid', authUid);

    window.dispatchEvent(new Event('session-user-updated'));

    (async () => {
      try {
        const { data } = await httpsCallable(functions, 'ensureUserProfile')({});
        if (data?.uid) sessionStorage.setItem('uid', data.uid);
      } catch (error) {
        console.error('Unable to initialize the user profile:', error);
      }
    })();

    return undefined;
  }, [currentUser]);

  const handleLogout = async () => {
    const keysToClear = [
      'email', 'user_image', 'uid', 'squad', 'squadName',
      'session_id', 'conversation_id', 'TimeCounter', 'reloaded',
    ];
    try {
      await auth.signOut();
    } finally {
      keysToClear.forEach((key) => sessionStorage.removeItem(key));
      window.location.reload();
    }
  };

  // Handle squad selection
  const handleSquadSelect = useCallback((squad) => {
    sessionStorage.setItem('squadName', t(squad.titleKey));
    sessionStorage.setItem('squad', squad.teamId);
    sessionStorage.setItem('session_id', generateSessionId());
    if (squad.id === 'copywriting') {
      sessionStorage.setItem('fileCopywriting', '');
    }
    setSelectedSquad(squad.teamId);
    onListItemClick();
  }, [t, onListItemClick]);

  // --- Scheduled tasks export/import ---
  const {
    scheduledTasks,
    loadScheduledTasks,
    scheduleTask,
    activeConversationId,
  } = useBoundStore((state) => ({
    scheduledTasks: state.scheduledTasks,
    loadScheduledTasks: state.loadScheduledTasks,
    scheduleTask: state.scheduleTask,
    activeConversationId: state.activeConversationId,
  }));

  const importInputRef = useRef(null);

  const downloadTextFile = (text, filename, mime = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportTasks = async () => {
    try {
      if (typeof loadScheduledTasks === 'function') await loadScheduledTasks();
      const tasks = useBoundStore.getState().scheduledTasks || scheduledTasks || [];
      const csv = scheduledTasksToCsv(tasks);
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(csv, `scheduled_tasks_${date}.csv`);
    } catch (err) {
      console.error('Export tasks failed:', err);
    }
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (typeof scheduleTask !== 'function') throw new Error('scheduleTask is not available.');
      const text = await file.text();
      const imported = parseScheduledTasksCsv(text);
      const fallbackConversationId = activeConversationId || sessionStorage.getItem('conversation_id') || '';
      const currentSquadId = sessionStorage.getItem('squad') || '';
      for (const row of imported) {
        const conversationId = row.conversationId || fallbackConversationId;
        if (!conversationId) throw new Error('Import requires conversationId.');
        await scheduleTask({
          name: row.name || 'Imported task',
          squadId: row.squadId || currentSquadId,
          conversationId,
          prompt: row.prompt,
          firstRunAt: row.firstRunAt || new Date().toISOString(),
          recurrence: row.recurrence,
        });
      }
      if (typeof loadScheduledTasks === 'function') await loadScheduledTasks();
    } catch (err) {
      console.error('Import tasks failed:', err);
    }
  };

  const handleLanguageChange = async (event) => {
    const lang = event?.target?.value;
    if (!lang) return;
    try {
      await i18n.changeLanguage(lang);
      localStorage.setItem('i18nextLng', lang);
      sessionStorage.setItem('lang', lang);
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };

  const primarySidebarButtonSx = {
    ...theme.typography.body3,
    justifyContent: 'flex-start',
    textTransform: 'none',
    fontWeight: '800',
    mt: 1,
  };

  // ============================================================
  // Render a single squad list item
  // ============================================================
  const renderSquadItem = (squad) => (
    <Tooltip key={squad.id} placement="right-start" title={t(squad.descriptionKey)}>
      <ListItem
        button
        selected={selectedSquad === squad.teamId}
        onClick={() => handleSquadSelect(squad)}
        sx={{
          ...theme.typography.body3,
          color: theme.palette.primary.main,
          py: 0.3,
          pl: 3,
          bgcolor: selectedSquad === squad.teamId ? theme.palette.action.selected : undefined,
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <squad.icon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
        </ListItemIcon>
        <ListItemText
          primary={t(squad.titleKey)}
          primaryTypographyProps={{ variant: 'body3', noWrap: true }}
        />
      </ListItem>
    </Tooltip>
  );

  // Map group icon names to components
  const groupIcons = {
    DashboardIcon: DashboardIcon,
    BrushIcon: BrushIcon,
    RocketLaunchIcon: RocketLaunchIcon,
    ShowChartIcon: ShowChartIcon,
  };

  // ============================================================
  // Render accordion group
  // ============================================================
  const renderGroup = (group) => {
    const groupSquads = squads.filter((s) => s.group === group.id);
    if (!groupSquads.length) return null;
    const GroupIcon = groupIcons[group.iconName];

    return (
      <Accordion
        key={group.id}
        expanded={expanded === group.id}
        onChange={handleAccordionChange(group.id)}
        disableGutters
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          mb: 0.5,
          '&:before': { display: 'none' },
          '& .MuiAccordionSummary-root': {
            minHeight: 36,
            px: 2,
            py: 0.25,
          },
          '& .MuiAccordionSummary-content': {
            my: 0.5,
          },
          '& .MuiAccordionDetails-root': {
            p: 0,
          },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {GroupIcon && <GroupIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t(group.labelKey, group.defaultLabel)}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <List disablePadding>
            {groupSquads.map(renderSquadItem)}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Drawer variant="permanent" {...other}>
      <List disablePadding>
        {/* Header */}
        <Hidden smDown>
          <ListItem sx={{ ...theme.typography.h1, fontWeight: 700, color: theme.palette.primary.main }}>
            <CampaignIcon style={{ fontSize: theme.typography.h3.fontSize, color: theme.palette.primary.main }} />
            <Typography variant="h2" sx={{ ml: 1, color: theme.palette.primary.main, textTransform: 'none' }}>
              Promarkia
            </Typography>
          </ListItem>
        </Hidden>

        <ListItem sx={{ ...theme.typography.h4, fontWeight: 700, color: theme.palette.primary.main, pb: 1 }}>
          {t('squads')}
        </ListItem>

        {/* Accordion groups */}
        {squadGroups.map(renderGroup)}

        {/* Action buttons */}
        <ListItem sx={{ color: textColor }}>
          <Tooltip placement="right" title={t('conversation_history')}>
            <Button
              onClick={() => setHistoryOpen(true)}
              variant="contained"
              color="primary"
              startIcon={<HistoryIcon />}
              fullWidth
              sx={{ ...primarySidebarButtonSx, marginTop: '10px' }}
            >
              {t('conversation_history')}
            </Button>
          </Tooltip>
        </ListItem>

        <ListItem sx={{ color: textColor }}>
          <Tooltip placement="right" title={t('view_scheduled_tasks')}>
            <Button
              onClick={() => setScheduledListOpen(true)}
              variant="contained"
              color="primary"
              startIcon={<CalendarMonthIcon />}
              fullWidth
              sx={primarySidebarButtonSx}
            >
              {t('scheduled_tasks')}
            </Button>
          </Tooltip>
        </ListItem>

        <ListItem sx={{ color: textColor }}>
          <Tooltip placement="right" title="View files produced by your squads">
            <Button
              onClick={() => setArtifactsOpen(true)}
              variant="contained"
              color="primary"
              startIcon={<FolderOpenIcon />}
              fullWidth
              sx={primarySidebarButtonSx}
            >
              My Artifacts
            </Button>
          </Tooltip>
        </ListItem>

        <ListItem sx={{ color: textColor }}>
          <ConnectSocial
            buttonSx={primarySidebarButtonSx}
            buttonText={t('connect_integrations')}
          />
        </ListItem>

        <ListItem sx={{ color: textColor }}>
          <Tooltip placement="right" title="Review external publishing and send actions">
            <Button
              onClick={() => setApprovalsOpen(true)}
              variant="contained"
              color="primary"
              startIcon={<FactCheckIcon />}
              fullWidth
              sx={primarySidebarButtonSx}
            >
              Approvals
            </Button>
          </Tooltip>
        </ListItem>

        {(
          <ListItem sx={{ color: textColor }}>
            <Tooltip placement="right" title={t('manage_api_keys_tooltip')}>
              <Button
                onClick={() => setApiKeysOpen(true)}
                variant="contained"
                color="primary"
                startIcon={<VpnKeyIcon />}
                fullWidth
                sx={primarySidebarButtonSx}
              >
                {t('api_keys', 'API Keys')}
              </Button>
            </Tooltip>
          </ListItem>
        )}

        <ListItem sx={{ color: textColor }}>
          <Tooltip placement="right" title="Manage local and remote MCP servers">
            <Button onClick={() => setMcpOpen(true)} variant="contained" color="primary" startIcon={<HubIcon />} fullWidth sx={primarySidebarButtonSx}>MCP Servers</Button>
          </Tooltip>
        </ListItem>

        <ListItem sx={{ ...theme.typography.body3, color: theme.palette.primary.main }}>
          <Typography
            variant="body1"
            component="div"
            sx={{
              textAlign: 'left',
              marginTop: '10px',
              fontSize: { xs: '0.875rem', sm: '1rem' },
              fontWeight: 700,
            }}
          >
            Local mode · usage tracked
          </Typography>
        </ListItem>

        <ListItem sx={{ ...theme.typography.body3, color: theme.palette.primary.main }}>
          <Hidden smUp>
            <Typography
              variant="body1"
              component="div"
              sx={{ textAlign: 'left', fontSize: '0.875rem', fontWeight: 700 }}
            >
              {sessionStorage.getItem('email')}
            </Typography>
          </Hidden>
        </ListItem>

        <ListItem sx={{ color: textColor }}>
          <Tooltip placement="right" title={t('log_out_tooltip')}>
            <Button
              onClick={handleLogout}
              variant="contained"
              color="primary"
              startIcon={<LogoutIcon />}
              fullWidth
              sx={{
                ...theme.typography.body3,
                justifyContent: 'flex-start',
                textTransform: 'none',
                fontWeight: 'normal',
              }}
            >
              {t('log_out')}
            </Button>
          </Tooltip>
        </ListItem>

        <ListItem sx={{ color: textColor }}>
          <FormControl variant="outlined" style={{ width: '100%', height: '50' }}>
            <InputLabel id="language-select-label">{t('language')}</InputLabel>
            <Select
              labelId="language-select-label"
              value={i18n.language}
              onChange={handleLanguageChange}
              label={t('language')}
              MenuProps={{
                anchorOrigin: { vertical: 'top', horizontal: 'left' },
                transformOrigin: { vertical: 'bottom', horizontal: 'left' },
              }}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="fr">Français</MenuItem>
              <MenuItem value="zh">Chinese</MenuItem>
              <MenuItem value="es">Spanish</MenuItem>
              <MenuItem value="hi">Hindi</MenuItem>
              <MenuItem value="ar">Arabic</MenuItem>
              <MenuItem value="pt">Portuguese</MenuItem>
              <MenuItem value="ja">Japanese</MenuItem>
              <MenuItem value="de">German</MenuItem>
              <MenuItem value="tr">Turkish</MenuItem>
              <MenuItem value="ko">Korean</MenuItem>
            </Select>
          </FormControl>
        </ListItem>
      </List>

      <ConversationHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <ScheduleTaskDialog open={showScheduleDialog} onClose={() => setShowScheduleDialog(false)} />
      <ApiKeyManager open={apiKeysOpen} onClose={() => setApiKeysOpen(false)} />
      <ArtifactsModal open={artifactsOpen} onClose={() => setArtifactsOpen(false)} />
      <ApprovalQueue open={approvalsOpen} onClose={() => setApprovalsOpen(false)} />
      <McpManager open={mcpOpen} onClose={() => setMcpOpen(false)} />
      <Dialog
        open={scheduledListOpen}
        onClose={() => setScheduledListOpen(false)}
        maxWidth={false}
        PaperProps={{ sx: { ...modalPaperSx, width: '75vw', maxWidth: '75vw' } }}
        BackdropProps={{
          sx: { backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {t('scheduled_tasks')}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={t('export_tasks_csv')}>
              <IconButton onClick={handleExportTasks} aria-label="export tasks">
                <FileDownloadIcon sx={{ color: '#fff' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('import_tasks_csv')}>
              <IconButton onClick={handleImportClick} aria-label="import tasks">
                <UploadFileIcon sx={{ color: '#fff' }} />
              </IconButton>
            </Tooltip>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <IconButton
              edge="end"
              onClick={() => setScheduledListOpen(false)}
              aria-label="close"
              sx={{ ml: 1 }}
            >
              <CloseIcon sx={{ color: '#fff' }} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, overflow: 'hidden', height: '68vh' }}>
          <ScheduledTasksPanel />
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}

Navigator.propTypes = {
  onListItemClick: PropTypes.func,
};
