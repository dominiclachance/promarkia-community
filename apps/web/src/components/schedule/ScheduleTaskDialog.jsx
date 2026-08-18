import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Alert } from '@mui/material';
import { useBoundStore } from '../../stores';
import { RECURRENCE, computeNextRun } from '../../utils/schedule';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { t } from 'i18next';

const defaultForm = {
  name: '',
  prompt: '',
  squadId: '',
  firstRunAt: '',
  recurrence: { type: RECURRENCE.ONCE, every: 1 },
};

const disallowedRecurrences = new Set([RECURRENCE.CUSTOM_CRON, RECURRENCE.RANDOM_N_WEEKS]);

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ScheduleTaskDialog = ({
  open,
  onClose,
  initialPrompt = '',
  mode = 'create', // 'create' | 'edit'
  initialTask = null, // task object when editing
}) => {
  const {
    scheduleTask,
    updateScheduledTask,
    activeConversationId,
  } = useBoundStore((state) => ({
    scheduleTask: state.scheduleTask,
    updateScheduledTask: state.updateScheduledTask,
    activeConversationId: state.activeConversationId,
  }));

  const isEdit = mode === 'edit';

  const currentSquadId = sessionStorage.getItem('squad') || '';
  const fallbackConversationId = sessionStorage.getItem('conversation_id') || '';

  const [form, setForm] = useState({ ...defaultForm, squadId: currentSquadId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');

    if (isEdit && initialTask) {
      setForm({
        name: initialTask.name || '',
        prompt: initialTask.prompt || '',
        squadId: initialTask.squadId ?? currentSquadId,
        firstRunAt: toDateTimeLocalValue(initialTask.firstRunAt || initialTask.nextRunAt || ''),
        recurrence: initialTask.recurrence || { type: RECURRENCE.ONCE, every: 1 },
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      squadId: currentSquadId,
      prompt: initialPrompt || prev.prompt || '',
    }));
  }, [open, isEdit, initialTask, currentSquadId, initialPrompt]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;

    try {
      setSaving(true);
      setError('');

      const conversationId = activeConversationId || fallbackConversationId;
      if (!conversationId) throw new Error('Missing conversation_id; cannot save task.');

      const firstRunAtIso = form.firstRunAt ? new Date(form.firstRunAt).toISOString() : null;

      if (isEdit) {
        if (!initialTask?.id) throw new Error('Missing task id; cannot update task.');
        if (!updateScheduledTask) throw new Error('updateScheduledTask action is unavailable.');

        await updateScheduledTask({
          id: initialTask.id,
          name: form.name,
          prompt: form.prompt,
          squadId: form.squadId,
          conversationId,
          firstRunAt: firstRunAtIso,
          recurrence: form.recurrence,
        });

        onClose();
        return;
      }

      if (!scheduleTask) throw new Error('scheduleTask action is unavailable.');

      await scheduleTask({
        name: form.name,
        squadId: currentSquadId,
        conversationId,
        prompt: form.prompt,
        firstRunAt: firstRunAtIso,
        recurrence: form.recurrence,
      });

      setForm({ ...defaultForm, squadId: currentSquadId, prompt: initialPrompt || '' });
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to save task.');
    } finally {
      setSaving(false);
    }
  };

  const nextRun =
    form.firstRunAt &&
    computeNextRun({
      firstRunAt: form.firstRunAt,
      recurrence: form.recurrence,
    });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      BackdropProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' } }}
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isEdit ? 'Edit Task' : 'Schedule Task'}
        <IconButton aria-label="close" onClick={onClose} edge="end" disabled={saving}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box component="form" id="schedule-task-form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label={t('field_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField label={t('field_squad')} value={form.squadId} InputProps={{ readOnly: true }} helperText={`Current squad ID from session: ${currentSquadId}`} />
          <TextField label={t('field_prompt')} multiline minRows={4} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required />
          <TextField label={t('field_first_run')} type="datetime-local" value={form.firstRunAt} onChange={(e) => setForm({ ...form, firstRunAt: e.target.value })} InputLabelProps={{ shrink: true }} required />

          <TextField
            select
            label={t('field_recurrence')}
            value={form.recurrence.type}
            onChange={(e) => setForm({ ...form, recurrence: { ...form.recurrence, type: e.target.value } })}
          >
            {Object.values(RECURRENCE)
              .filter((value) => !disallowedRecurrences.has(value))
              .map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
          </TextField>

          {nextRun && <small>Next run preview: {new Date(nextRun).toLocaleString()}</small>}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Close</Button>
        <Button form="schedule-task-form" type="submit" variant="contained" disabled={saving}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleTaskDialog;
ScheduleTaskDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialPrompt: PropTypes.string,
  mode: PropTypes.oneOf(['create', 'edit']),
  initialTask: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    prompt: PropTypes.string,
    squadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    firstRunAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
    nextRunAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    recurrence: PropTypes.shape({
      type: PropTypes.string,
      every: PropTypes.number,
    }),
  }),
};
