import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputAdornment, InputLabel, MenuItem,
  Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { localClient } from '../../../services/localClient';

const API_BASE = (import.meta.env.VITE_LOCAL_API_BASE || '/api').replace(/\/$/, '');
const PROVIDERS = [
  ['OPENAI_API_KEY', 'OpenAI API key'],
  ['ANTHROPIC_API_KEY', 'Anthropic API key'],
  ['GEMINI_API_KEY', 'Google Gemini API key'],
  ['COMPOSIO_API_KEY', 'Composio API key'],
  ['FAL_KEY', 'fal.ai image/video key'],
  ['HEYGEN_API_KEY', 'HeyGen API key'],
  ['HIGGSFIELD_API_KEY', 'Higgsfield API key'],
  ['SERPER_API_KEY', 'Serper search API key'],
  ['FMCSA_WEB_KEY', 'FMCSA WebKey'],
];

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}/local${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

const defaultProvider = {
  provider: 'ollama', model: 'qwen2.5:7b-instruct', base_url: 'http://127.0.0.1:11434/v1',
  input_cost_per_million: 0, output_cost_per_million: 0,
};

export default function ApiKeyManager({ open, onClose }) {
  const [configured, setConfigured] = useState(new Set());
  const [values, setValues] = useState({});
  const [visible, setVisible] = useState({});
  const [provider, setProvider] = useState(defaultProvider);
  const [usage, setUsage] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const [rows, providerRow, usageRow] = await Promise.all([api('/secrets'), localClient.provider(), localClient.usage()]);
      setConfigured(new Set(rows.map((row) => row.name)));
      setProvider({ ...defaultProvider, ...providerRow });
      setUsage(usageRow);
      setError('');
    } catch (reason) { setError(reason.message); }
  };

  useEffect(() => { if (open) refresh(); }, [open]);
  const configuredCount = useMemo(() => PROVIDERS.filter(([name]) => configured.has(name)).length, [configured]);

  const saveSecret = async (name) => {
    const value = values[name]?.trim();
    if (!value) return;
    try {
      await api(`/secrets/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ name, value }) });
      setValues((current) => ({ ...current, [name]: '' }));
      setMessage(`${name} saved securely`); await refresh();
    } catch (reason) { setError(reason.message); }
  };

  const remove = async (name) => {
    try { await api(`/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' }); setMessage(`${name} removed`); await refresh(); }
    catch (reason) { setError(reason.message); }
  };

  const saveProvider = async () => {
    try { setProvider(await localClient.saveProvider(provider)); setMessage('Model provider saved'); }
    catch (reason) { setError(reason.message); }
  };

  const testProvider = async () => {
    try { await localClient.testProvider(provider); setMessage(`${provider.provider} connection passed`); }
    catch (reason) { setError(reason.message); }
  };

  const updateBudget = async (key, value) => {
    const next = { ...usage.budget, [key]: value };
    try { await localClient.updateBudget(next); setUsage(await localClient.usage()); }
    catch (reason) { setError(reason.message); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box><Typography variant="h6">Local providers and keys</Typography><Typography variant="caption">{configuredCount} keys configured · encrypted on this device</Typography></Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
        <Typography variant="subtitle1" fontWeight={800}>Primary chat model</Typography>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <FormControl fullWidth size="small"><InputLabel>Provider</InputLabel><Select label="Provider" value={provider.provider} onChange={(event) => setProvider((current) => ({ ...current, provider: event.target.value }))}><MenuItem value="ollama">Ollama (local)</MenuItem><MenuItem value="openai">OpenAI</MenuItem><MenuItem value="openai-compatible">OpenAI-compatible endpoint</MenuItem></Select></FormControl>
          <TextField size="small" label="Model" value={provider.model} onChange={(event) => setProvider((current) => ({ ...current, model: event.target.value }))} />
          <TextField size="small" label="Base URL" value={provider.base_url} onChange={(event) => setProvider((current) => ({ ...current, base_url: event.target.value }))} />
          <Stack direction="row" spacing={1}><Button variant="outlined" onClick={testProvider}>Test connection</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={saveProvider}>Save provider</Button></Stack>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1" fontWeight={800}>Provider and integration keys</Typography>
        <Stack spacing={2} sx={{ mt: 1.5 }}>
          {PROVIDERS.map(([name, label]) => <Box key={name}><TextField fullWidth size="small" label={label} placeholder={configured.has(name) ? 'Configured — enter a new value to replace' : ''} type={visible[name] ? 'text' : 'password'} value={values[name] || ''} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}>{visible[name] ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment> }} /><Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 0.75 }}>{configured.has(name) && <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => remove(name)}>Remove</Button>}<Button size="small" variant="contained" startIcon={<SaveIcon />} disabled={!values[name]?.trim()} onClick={() => saveSecret(name)}>Save</Button></Stack></Box>)}
        </Stack>
        {usage && <><Divider sx={{ my: 3 }} /><Typography variant="subtitle1" fontWeight={800}>Local usage safety</Typography><Typography variant="body2" color="text.secondary">This month: ${Number(usage.estimated_cost_usd || 0).toFixed(4)} estimated. No credits and no billing.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}><TextField size="small" type="number" label="Monthly warning/cap (USD)" value={usage.budget.monthly_limit_usd} onChange={(event) => setUsage((current) => ({ ...current, budget: { ...current.budget, monthly_limit_usd: Number(event.target.value) } }))} onBlur={() => updateBudget('monthly_limit_usd', Number(usage.budget.monthly_limit_usd))} /><Stack direction="row" alignItems="center"><Switch checked={usage.budget.hard_cap_enabled} onChange={(event) => updateBudget('hard_cap_enabled', event.target.checked)} /><Typography variant="body2">Stop new runs at cap</Typography></Stack></Stack></>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

ApiKeyManager.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired };
