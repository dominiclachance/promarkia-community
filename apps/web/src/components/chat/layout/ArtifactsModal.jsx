import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, List, ListItem, ListItemText, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { localClient } from '../../../services/localClient';

const API_BASE = (import.meta.env.VITE_LOCAL_API_BASE || '/api').replace(/\/$/, '');
const formatBytes = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export default function ArtifactsModal({ open, onClose }) {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setArtifacts(await localClient.artifacts()); setError(''); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const remove = async (id) => {
    const response = await fetch(`${API_BASE}/local/artifacts/${id}`, { method: 'DELETE' });
    if (!response.ok) setError(await response.text());
    else refresh();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Typography variant="h6">My Artifacts</Typography><Chip label={artifacts.length} size="small" /></Box>
        <Box><Tooltip title="Refresh"><IconButton aria-label="Refresh artifacts" onClick={refresh}><RefreshIcon /></IconButton></Tooltip><IconButton aria-label="Close artifacts" onClick={onClose}><CloseIcon /></IconButton></Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box> : !artifacts.length ? <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>No artifacts yet.</Typography> : (
          <List>{artifacts.map((artifact) => <ListItem key={artifact.id} secondaryAction={<Box><Button component="a" href={`/files/${artifact.relative_path}`} target="_blank" startIcon={<OpenInNewIcon />}>Open</Button><IconButton color="error" onClick={() => remove(artifact.id)}><DeleteOutlineIcon /></IconButton></Box>}><ListItemText primary={artifact.name} secondary={`${artifact.media_type} · ${formatBytes(artifact.size_bytes)} · ${new Date(artifact.created_at).toLocaleString()}`} /></ListItem>)}</List>
        )}
      </DialogContent>
    </Dialog>
  );
}

ArtifactsModal.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, runId: PropTypes.string };
