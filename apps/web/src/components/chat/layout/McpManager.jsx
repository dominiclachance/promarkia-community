import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { localClient } from '../../../services/localClient';

export default function McpManager({ open, onClose }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', transport: 'streamable-http', command: '', args: '', url: '', env: '' });
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { try { setRows(await localClient.mcpServers()); setError(''); } catch (reason) { setError(reason.message); } }, []);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const save = async () => {
    try {
      const env_secrets = {};
      for (const line of form.env.split('\n')) {
        const index = line.indexOf('=');
        if (index > 0) env_secrets[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      }
      await localClient.addMcpServer({ name: form.name, transport: form.transport, command: form.command || null, args: form.args.split(/\s+/).filter(Boolean), url: form.url || null, env_secrets, enabled: true });
      setForm({ name: '', transport: 'streamable-http', command: '', args: '', url: '', env: '' });
      await refresh();
    } catch (reason) { setError(reason.message); }
  };

  const remove = async (id) => { try { await localClient.deleteMcpServer(id); await refresh(); } catch (reason) { setError(reason.message); } };

  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth><DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h6">MCP servers</Typography><Typography variant="caption">Connect local stdio or remote HTTP MCP tools. Environment secrets are encrypted.</Typography></Box><IconButton onClick={onClose}><CloseIcon /></IconButton></DialogTitle><DialogContent dividers>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 3 }}>{rows.map((row) => <Chip key={row.id} label={`${row.name} · ${row.transport}`} color="success" onDelete={() => remove(row.id)} deleteIcon={<DeleteIcon />} />)}{!rows.length && <Typography color="text.secondary">No MCP servers configured.</Typography>}</Stack><Stack spacing={2}><TextField label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><FormControl fullWidth><InputLabel>Transport</InputLabel><Select label="Transport" value={form.transport} onChange={(event) => setForm((current) => ({ ...current, transport: event.target.value }))}><MenuItem value="streamable-http">Streamable HTTP</MenuItem><MenuItem value="sse">SSE</MenuItem><MenuItem value="stdio">stdio</MenuItem></Select></FormControl>{form.transport === 'stdio' ? <><TextField label="Command" value={form.command} onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))} /><TextField label="Arguments (space separated)" value={form.args} onChange={(event) => setForm((current) => ({ ...current, args: event.target.value }))} /></> : <TextField label="Server URL" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} />}<TextField label="Environment secrets (NAME=value, one per line)" multiline minRows={3} type="password" value={form.env} onChange={(event) => setForm((current) => ({ ...current, env: event.target.value }))} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Close</Button><Button variant="contained" startIcon={<SaveIcon />} disabled={!form.name.trim()} onClick={save}>Save MCP server</Button></DialogActions></Dialog>;
}

McpManager.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired };
