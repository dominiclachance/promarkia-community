import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import { localClient } from '../../../services/localClient';

const PROVIDERS = [
  'linkedin', 'facebook', 'instagram', 'x', 'reddit', 'youtube', 'tiktok',
  'gmail', 'outlook', 'google-calendar', 'wordpress', 'hubspot', 'salesforce',
  'apollo', 'slack', 'discord', 'microsoft-teams', 'notion', 'google-drive',
];

export default function ConnectSocial({ buttonSx, buttonText = 'Connect Integrations' }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [provider, setProvider] = useState('wordpress');
  const [label, setLabel] = useState('default');
  const [endpoint, setEndpoint] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try { setRows(await localClient.integrations()); } catch (reason) { setError(reason.message); }
  };
  useEffect(() => { if (open) refresh(); }, [open]);
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('promarkia:open-integrations', handler);
    return () => window.removeEventListener('promarkia:open-integrations', handler);
  }, []);

  const save = async () => {
    try {
      await localClient.addIntegration({
        provider, account_label: label || 'default', kind: 'local-credentials', enabled: true,
        settings: { endpoint, username },
        secrets: secret ? { token_or_password: secret } : {},
      });
      setSecret('');
      await refresh();
    } catch (reason) { setError(reason.message); }
  };

  const remove = async (id) => {
    try { await localClient.deleteIntegration(id); await refresh(); }
    catch (reason) { setError(reason.message); }
  };

  return (
    <>
      <Tooltip title="Connect services with your own OAuth app or API credentials">
        <Button fullWidth variant="contained" color="primary" startIcon={<ConnectWithoutContactIcon />} sx={buttonSx} onClick={() => setOpen(true)}>
          {buttonText}
        </Button>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box><Typography variant="h6">Local integrations</Typography><Typography variant="caption">Credentials stay encrypted on this device. Publishing always requires approval.</Typography></Box>
          <IconButton onClick={() => setOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 3 }}>
            {rows.map((row) => <Chip key={row.id} color="success" label={`${row.provider}: ${row.account_label}`} onDelete={() => remove(row.id)} deleteIcon={<DeleteIcon />} />)}
            {!rows.length && <Typography color="text.secondary">No integrations configured yet.</Typography>}
          </Stack>
          <Stack spacing={2}>
            <FormControl fullWidth size="small"><InputLabel>Provider</InputLabel><Select label="Provider" value={provider} onChange={(event) => setProvider(event.target.value)}>{PROVIDERS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
            <TextField label="Account label" value={label} onChange={(event) => setLabel(event.target.value)} />
            <TextField label="API or site URL" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
            <TextField label="Username (when required)" value={username} onChange={(event) => setUsername(event.target.value)} />
            <TextField label="Access token, API key, or app password" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Close</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={save}>Save locally</Button></DialogActions>
      </Dialog>
    </>
  );
}

ConnectSocial.propTypes = { buttonSx: PropTypes.object, buttonText: PropTypes.string };
