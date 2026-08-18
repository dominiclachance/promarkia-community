import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import { localClient } from '../../../services/localClient';

export default function ApprovalQueue({ open, onClose }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { setRows(await localClient.approvals()); setError(''); }
    catch (reason) { setError(reason.message); }
  }, []);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const decide = async (row, approved) => {
    try {
      if (approved) await localClient.approve(row.id, 'Approved locally');
      else await localClient.reject(row.id, 'Rejected locally');
      await refresh();
    } catch (reason) { setError(reason.message); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box><Typography variant="h6">Approval queue</Typography><Typography variant="caption">External writes never execute without your review.</Typography></Box>
        <IconButton onClick={onClose} aria-label="Close approval queue"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!rows.length && <Alert severity="info">No external actions are waiting for review.</Alert>}
        <Stack spacing={1.5}>
          {rows.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={800}>{row.action}</Typography><Chip size="small" label={row.status} color={row.status === 'pending' ? 'warning' : row.status === 'executed' ? 'success' : 'default'} /></Stack>
                  <Typography variant="body2" color="text.secondary">Provider: {row.provider}</Typography>
                  <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(row.preview?.arguments || row.payload, null, 2)}</Box>
                </Box>
                {row.status === 'pending' && <Stack direction="row" spacing={1} alignSelf="flex-start"><Button color="error" startIcon={<BlockIcon />} onClick={() => decide(row, false)}>Reject</Button><Button variant="contained" startIcon={<CheckIcon />} onClick={() => decide(row, true)}>Approve once</Button></Stack>}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={refresh}>Refresh</Button><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

ApprovalQueue.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired };
