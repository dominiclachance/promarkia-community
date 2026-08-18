import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, Divider, FormControl,
  FormControlLabel, Grid, InputLabel, LinearProgress, MenuItem, Paper, Select, Stack,
  Step, StepLabel, Stepper, Switch, TextField, Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import {
  analyzeWebsite, executePlan, listIntegrations, loadActivationState,
  persistActivationState, requestIntake,
} from './api.js';
import {
  createExecutionPlan, getMissingRequiredFields, integrationsReady, normalizeWebsiteUrl,
  prefillAnswers, validateAnswers, validatePublicWebsite,
} from './intakeEngine.js';
import { getWorkflow, WORKFLOW_CATALOG } from './workflowCatalog.js';
import { initialActivationState, normalizeActivationState } from './storage.js';
import { useBoundStore } from '../../stores/index.js';
import ArticlePreview from './ArticlePreview.jsx';
import { normalizeArticleContent } from './articleContent.js';
import './activation.css';

const ONBOARDING_STEPS = ['Website', 'Brand profile', 'First outcome', 'Connect', 'Brief', 'Approve'];
const STEP_INDEX = { website: 0, profile: 1, goal: 2, integrations: 3, intake: 4, plan: 5, running: 5, completed: 5 };

function Surface({ children, sx = {} }) {
  return <Paper elevation={0} className="activation-surface" sx={sx}>{children}</Paper>;
}
Surface.propTypes = { children: PropTypes.node, sx: PropTypes.object };

function VideoProductionPlan({ brief }) {
  if (!brief) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 3 }} />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <AutoAwesomeRoundedIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Generated production plan</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Promarkia expanded your answers into the script, storyboard, production, audio, caption, cost, and verification contract.
      </Typography>
      <Grid container spacing={1.5}>
        {Object.entries(brief.summary || {}).map(([label, value]) => (
          <Grid item xs={12} sm={6} key={label}>
            <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>{label.replace(/([A-Z])/g, ' $1')}</Typography>
              <Typography sx={{ mt: 0.4 }}>{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Accordion disableGutters elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px !important' }}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography sx={{ fontWeight: 800 }}>Advanced: inspect the full production specification</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box component="pre" sx={{ m: 0, p: 2, bgcolor: 'action.hover', borderRadius: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 12, maxHeight: 420, overflowY: 'auto' }}>
            {brief.prompt}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
VideoProductionPlan.propTypes = { brief: PropTypes.object };

function BrandMark() {
  return <Stack direction="row" spacing={1.1} alignItems="center" className="activation-brand"><CampaignRoundedIcon className="activation-brand-icon" /><Typography className="activation-wordmark">Promarkia</Typography></Stack>;
}

function WorkflowCard({ compact = false, workflow, onSelect }) {
  return (
    <Paper component="button" type="button" onClick={() => onSelect(workflow.id)} className={`workflow-card${compact ? ' compact' : ''}`} elevation={0} sx={{ '--workflow-accent': workflow.accent || 'var(--activation-primary)', minHeight: compact ? 140 : 190 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box className="workflow-icon">{workflow.icon}</Box><ArrowForwardRoundedIcon className="workflow-arrow" /></Stack>
      <Typography className="workflow-eyebrow">{workflow.eyebrow}</Typography>
      <Typography variant={compact ? 'h6' : 'h5'} sx={{ fontWeight: 900, letterSpacing: '-0.035em', mt: compact ? 0.35 : 0.8 }}>{workflow.title}</Typography>
      <Typography sx={{ color: 'text.secondary', lineHeight: 1.65, mt: 1.2, fontSize: 14 }}>{workflow.description}</Typography>
      <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 'auto', pt: 2.2 }}><Chip size="small" label={workflow.estimate} /><Chip size="small" label={workflow.outputType} /></Stack>
    </Paper>
  );
}
WorkflowCard.propTypes = { compact: PropTypes.bool, workflow: PropTypes.object.isRequired, onSelect: PropTypes.func.isRequired };

function Field({ field, value, error, onChange }) {
  if (field.type === 'select') {
    return <FormControl fullWidth error={Boolean(error)}><InputLabel>{field.label}</InputLabel><Select value={value || ''} label={field.label} onChange={(event) => onChange(event.target.value)}>{field.options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select>{error ? <Typography className="field-error">{error}</Typography> : null}</FormControl>;
  }
  return <TextField fullWidth type={field.type === 'url' ? 'url' : undefined} multiline={field.type === 'textarea'} minRows={field.type === 'textarea' ? 3 : undefined} label={field.label} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} error={Boolean(error)} helperText={error || (field.required ? 'Required' : 'Optional')} />;
}
Field.propTypes = { field: PropTypes.object.isRequired, value: PropTypes.string, error: PropTypes.string, onChange: PropTypes.func.isRequired };

function finalArtifact(runResult) {
  const explicitArtifact = runResult?.task_result?.artifact || runResult?.taskResult?.artifact;
  const messages = runResult?.task_result?.messages || runResult?.taskResult?.messages || [];
  const message = [...messages].reverse().find((item) => item?.content && item.source !== 'user');
  const messageContent = Array.isArray(message?.content)
    ? message.content.map((item) => typeof item === 'string' ? item : item?.content || item?.text || '').filter(Boolean).join('\n')
    : String(message?.content || '');
  const content = String(explicitArtifact || messageContent);
  return normalizeArticleContent(content)
    .replace(/^(?:FINAL_ARTICLE_START|FINAL_ARTICLE_END|SEO_PACKAGE_START|SEO_PACKAGE_END|FEATURE_IMAGE_PROMPT_START|FEATURE_IMAGE_PROMPT_END|LOCAL_DRAFT_COMPLETE|LOCAL_RESEARCH_COMPLETE|TEST_STATUS:.*|STATUS:.*|TERMINATE)\s*$/gim, '')
    .replace(/\uFFFD/g, '-')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function messageText(message) {
  const value = message?.message;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item?.content || item?.text || '').filter(Boolean).join('\n');
  return value?.content || value?.text || '';
}

function latestRunArtifact(messages, startIndex = 0) {
  const result = [...messages.slice(startIndex)].reverse().find((message) => message.msg_from !== 'user' && !message.hidden && messageText(message).trim());
  return result ? finalArtifact({ task_result: { artifact: messageText(result) } }) : '';
}

export default function ActivationExperience({ darkMode, embedded = false, toggleTheme, user, onLogout, onOpenChat }) {
  const theme = useTheme();
  const [state, setState] = useState(initialActivationState);
  const [hydrated, setHydrated] = useState(false);
  const [websiteInput, setWebsiteInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const persistenceErrorShown = useRef(false);
  const persistedSnapshot = useRef('');
  const legacyResearchStarted = useRef(false);
  const chatMessages = useBoundStore((store) => store.chatMessages);
  const pendingResponse = useBoundStore((store) => store.pendingResponse);
  const productionRunError = useBoundStore((store) => store.lastError);
  const lastCompletedRunId = useBoundStore((store) => store.lastCompletedRunId);

  const workflow = getWorkflow(state.workflowId);
  const activeStep = STEP_INDEX[state.step] ?? 0;
  const profileReady = ['brandName', 'websiteUrl', 'audience', 'offer', 'voice', 'differentiator'].every((field) => String(state.profile?.[field] || '').trim());
  const themeVariables = {
    '--activation-bg': theme.palette.background.default, '--activation-surface': theme.palette.background.paper,
    '--activation-ink': theme.palette.text.primary, '--activation-muted': theme.palette.text.secondary,
    '--activation-primary': theme.palette.primary.main, '--activation-primary-contrast': theme.palette.primary.contrastText || theme.palette.background.default,
    '--activation-accent': darkMode ? '#dbb8ff' : theme.palette.secondary.main, '--activation-border': theme.palette.divider,
    '--activation-header': darkMode ? 'rgba(18, 18, 18, 0.92)' : 'rgba(37, 17, 55, 0.92)',
    '--activation-card': darkMode ? 'rgba(30, 30, 30, 0.96)' : 'rgba(44, 21, 63, 0.96)',
    '--activation-card-soft': darkMode ? '#262626' : '#341a48', '--activation-glow': darkMode ? 'rgba(219, 184, 255, 0.10)' : 'rgba(219, 184, 255, 0.15)',
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadActivationState(), listIntegrations()]).then(([saved, integrations]) => {
      if (!active) return;
      const restored = normalizeActivationState(saved);
      const statuses = { ...restored.connectedIntegrations, website: Boolean(restored.profile?.websiteUrl) };
      integrations.forEach((item) => { statuses[item.provider] = item.status === 'active'; });
      const nextState = { ...restored, connectedIntegrations: statuses };
      persistedSnapshot.current = JSON.stringify(nextState);
      setState(nextState);
      setWebsiteInput(restored.profile?.websiteUrl || '');
      setHydrated(true);
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError.message);
      setHydrated(true);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('integration_error')) setError(`Integration failed: ${params.get('integration_error')}`);
    if (params.has('integration_connected') || params.has('integration_error')) {
      params.delete('integration_connected'); params.delete('integration_error');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const snapshot = JSON.stringify(state);
    if (snapshot === persistedSnapshot.current) return undefined;
    const timer = window.setTimeout(() => {
      persistActivationState(state)
        .then(() => { persistedSnapshot.current = snapshot; })
        .catch((saveError) => {
          if (!persistenceErrorShown.current) { persistenceErrorShown.current = true; setError(`State could not be saved: ${saveError.message}`); }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hydrated, state]);

  useEffect(() => {
    const legacyMetadataProfile = /metadata|blank fields/i.test(state.analysisNotice || '');
    if (!hydrated || state.step !== 'profile' || profileReady || !legacyMetadataProfile || !state.profile?.websiteUrl || legacyResearchStarted.current) return undefined;
    legacyResearchStarted.current = true;
    let cancelled = false;
    setBusy(true);
    setError('');
    analyzeWebsite(state.profile.websiteUrl)
      .then((result) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          profile: result.profile,
          connectedIntegrations: { ...current.connectedIntegrations, website: true },
          analysisNotice: result.notice,
        }));
        setWebsiteInput(result.profile.websiteUrl);
      })
      .catch((researchError) => { if (!cancelled) setError(researchError.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [hydrated, profileReady, state.analysisNotice, state.profile?.websiteUrl, state.step]);

  useEffect(() => {
    if (!hydrated || state.step !== 'running' || !state.activeRun?.id) return;
    if (productionRunError && !pendingResponse) {
      setState((current) => ({ ...current, step: 'plan', activeRun: null }));
      setError(productionRunError);
      setBusy(false);
      return;
    }
    if (pendingResponse || lastCompletedRunId !== state.activeRun.id) return;
    const artifact = latestRunArtifact(chatMessages, state.activeRun.messageStartIndex);
    if (!artifact) return;
    setState((current) => ({
      ...current,
      step: 'completed',
      onboardingComplete: true,
      activeRun: { ...current.activeRun, status: 'completed', artifact },
    }));
    setBusy(false);
  }, [chatMessages, hydrated, lastCompletedRunId, pendingResponse, productionRunError, state.activeRun?.id, state.activeRun?.messageStartIndex, state.step]);

  const progress = useMemo(() => state.onboardingComplete ? 100 : Math.round(((activeStep + 1) / ONBOARDING_STEPS.length) * 100), [activeStep, state.onboardingComplete]);
  const update = (patch) => setState((current) => ({ ...current, ...patch }));

  const handleAnalyze = async () => {
    setError('');
    const validationError = validatePublicWebsite(websiteInput);
    if (validationError) return setError(validationError);
    setBusy(true);
    try {
      const result = await analyzeWebsite(normalizeWebsiteUrl(websiteInput));
      update({ profile: result.profile, connectedIntegrations: { ...state.connectedIntegrations, website: true }, step: 'profile', analysisNotice: result.notice });
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };

  const startWorkflow = (workflowId) => {
    update({ workflowId, answers: prefillAnswers(workflowId, state.profile || {}), intakeMeta: null, plan: null, approved: false, activeRun: null, step: 'integrations' });
    setError(''); setFieldErrors({});
  };

  const refreshIntegrations = async () => {
    setBusy(true); setError('');
    try {
      const integrations = await listIntegrations();
      const statuses = { website: Boolean(state.profile?.websiteUrl) };
      integrations.forEach((item) => { statuses[item.provider] = item.status === 'active'; });
      update({ connectedIntegrations: statuses });
    } catch (connectError) { setError(connectError.message); } finally { setBusy(false); }
  };

  const openExistingIntegrations = () => {
    onOpenChat();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('promarkia:open-integrations')), 0);
  };

  const prepareIntake = async () => {
    if (!integrationsReady(state.workflowId, state.connectedIntegrations)) return setError('Connect the required integrations to continue.');
    setBusy(true); setError('');
    try {
      const missingFields = getMissingRequiredFields(state.workflowId, state.answers);
      update({ intakeMeta: await requestIntake({ workflowId: state.workflowId, profile: state.profile, answers: state.answers, missingFields }), step: 'intake' });
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };

  const buildPlan = () => {
    const errors = validateAnswers(state.workflowId, state.answers);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try { update({ plan: { ...createExecutionPlan({ workflowId: state.workflowId, profile: state.profile, answers: state.answers, connectedIntegrations: state.connectedIntegrations }), rawAnswers: state.answers }, approved: false, step: 'plan' }); }
    catch (planError) { setError(planError.message); }
  };

  const runPlan = async () => {
    if (!state.approved) return setError('Review the plan and record your approval first.');
    setBusy(true); setError('');
    const approvedAt = new Date().toISOString();
    try {
      const result = await executePlan({ ...state.plan, approved: true, approvedAt });
      update({ step: 'running', activeRun: result.run, plan: { ...state.plan, approvedAt } });
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  };

  const goLaunchpad = () => update({ step: 'launchpad', workflowId: '', answers: {}, intakeMeta: null, plan: null, approved: false, activeRun: null });

  if (!hydrated) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const renderWebsite = () => <Grid container spacing={{ xs: 3, md: 7 }} alignItems="center"><Grid item xs={12} md={6}><Chip label="About 60 seconds" className="eyebrow-chip" /><Typography variant="h2" className="activation-title">Start with what Promarkia should understand.</Typography><Typography className="activation-lead">Share your website and Promarkia will research its public pages, then build a complete, editable brand brief with AI.</Typography><Stack direction="row" spacing={1.2} sx={{ mt: 3 }}><LockRoundedIcon color="primary" fontSize="small" /><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Private-network addresses are blocked. Promarkia uses public page evidence and asks you to review the result before any squad uses it.</Typography></Stack></Grid><Grid item xs={12} md={6}><Surface sx={{ p: { xs: 2.5, md: 4 } }}><Stack spacing={2.5}><Box className="input-icon"><LanguageRoundedIcon /></Box><Typography variant="h5" sx={{ fontWeight: 900 }}>Your website</Typography><TextField autoFocus fullWidth label="Website URL" placeholder="https://yourcompany.com" value={websiteInput} onChange={(event) => setWebsiteInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleAnalyze(); }} /><Button variant="contained" size="large" endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRoundedIcon />} disabled={busy} onClick={handleAnalyze}>{busy ? 'Researching your website…' : 'Build my brand brief'}</Button></Stack></Surface></Grid></Grid>;

  const renderProfile = () => <Box><Chip label="Review before squads use it" className="eyebrow-chip" /><Typography variant="h2" className="activation-title compact">Does this sound like your brand?</Typography>{state.analysisNotice ? <Alert severity="info" sx={{ mt: 3 }}>{state.analysisNotice}</Alert> : null}<Surface sx={{ p: { xs: 2.5, md: 4 }, mt: 3 }}><Grid container spacing={2.5}>{[['brandName', 'Brand name'], ['websiteUrl', 'Website URL'], ['audience', 'Primary audience'], ['offer', 'Core offer'], ['voice', 'Brand voice'], ['differentiator', 'What makes you different']].map(([key, label]) => <Grid item xs={12} md={key === 'differentiator' ? 12 : 6} key={key}><TextField fullWidth multiline={key === 'differentiator'} label={label} value={state.profile?.[key] || ''} onChange={(event) => update({ profile: { ...state.profile, [key]: event.target.value } })} /></Grid>)}</Grid><Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mt: 3 }}><Button startIcon={<ArrowBackRoundedIcon />} onClick={() => update({ step: 'website' })}>Change website</Button><Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5}><Button startIcon={busy ? <CircularProgress size={18} /> : <AutoAwesomeRoundedIcon />} disabled={busy} onClick={handleAnalyze}>{busy ? 'Researching…' : 'Research website again'}</Button><Button variant="contained" disabled={!profileReady || busy} onClick={() => update({ step: 'goal' })}>Choose a goal</Button></Stack></Stack></Surface></Box>;

  const renderGoal = (launchpad = false) => <Box className={embedded ? 'activation-goal-view' : undefined}><Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'flex-start' }} justifyContent="space-between" gap={embedded ? 1 : 2}><Box><Chip label={launchpad ? `Ready for ${state.profile?.brandName}` : 'Choose your first win'} className="eyebrow-chip" /><Typography variant="h2" className="activation-title compact">What do you want to do today?</Typography><Typography className="activation-lead compact">Choose from 50 outcomes across 11 production squads. Promarkia sends the approved brief to the right squad.</Typography></Box>{launchpad ? <Button variant="contained" size={embedded ? 'small' : 'medium'} startIcon={<ChatBubbleRoundedIcon />} onClick={onOpenChat} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'center' } }}>Open chat</Button> : null}</Stack><Box className={`workflow-grid${embedded ? ' compact workflow-outcomes-scroll' : ''}`} role="list" aria-label="Promarkia outcomes" sx={{ mt: embedded ? 0.8 : 2 }}>{WORKFLOW_CATALOG.map((item) => <WorkflowCard key={item.id} compact={embedded} workflow={item} onSelect={startWorkflow} />)}</Box></Box>;

  const renderIntegrations = () => (
    <Box>
      <Chip label="Only what this goal needs" className="eyebrow-chip" />
      <Typography variant="h2" className="activation-title compact">Connect the path, not everything.</Typography>
      <Typography className="activation-lead compact">Connections are marked active only after the provider verifies them.</Typography>
      <Stack spacing={1.5} sx={{ mt: 3 }}>
        {workflow?.integrations.map((integration) => {
          const connected = Boolean(state.connectedIntegrations[integration.id]);
          return (
            <Surface key={integration.id} sx={{ p: 2.3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Stack direction="row" spacing={1.7} alignItems="center">
                  <Box className={`integration-icon ${connected ? 'connected' : ''}`}>{connected ? <CheckCircleRoundedIcon /> : <LinkRoundedIcon />}</Box>
                  <Box>
                    <Typography component="div" sx={{ fontWeight: 900 }}>{integration.label} <Chip size="small" label={integration.required ? 'Required' : 'Optional'} /></Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{integration.reason}</Typography>
                  </Box>
                </Stack>
                {integration.id === 'website'
                  ? <Chip label="Verified from researched website" color="success" />
                  : <Chip label={connected ? 'Connected' : 'Not connected'} color={connected ? 'success' : 'default'} />}
              </Stack>
            </Surface>
          );
        })}
      </Stack>
      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mt: 3 }}>
        <Button onClick={() => update({ step: state.onboardingComplete ? 'launchpad' : 'goal' })}>Choose another goal</Button>
        <Stack direction="row" spacing={1.5}>
          <Button disabled={busy} onClick={refreshIntegrations}>Refresh connections</Button>
          {!integrationsReady(state.workflowId, state.connectedIntegrations) ? <Button variant="outlined" onClick={openExistingIntegrations}>Manage integrations</Button> : null}
          <Button variant="contained" disabled={busy || !integrationsReady(state.workflowId, state.connectedIntegrations)} onClick={prepareIntake}>Continue to the brief</Button>
        </Stack>
      </Stack>
    </Box>
  );

  const renderIntake = () => {
    const questionLabels = new Map(
      (state.intakeMeta?.questions || []).map((question) => [question.id || question.fieldId, question]),
    );
    return (
      <Box className="activation-brief-view">
        <Box className="activation-brief-heading">
          <Chip icon={<AutoAwesomeRoundedIcon />} label={state.intakeMeta?.source || 'Task intake'} className="eyebrow-chip" />
          <Typography variant="h2" className="activation-title compact">A few questions, specific to the task.</Typography>
          <Typography className="activation-lead compact">{state.intakeMeta?.summary}</Typography>
        </Box>
        <Box
          className="activation-brief-scroll"
          role="region"
          aria-label="Launchpad brief questions"
          tabIndex={0}
        >
          <Surface sx={{ p: { xs: 2.5, md: 4 }, mt: 3 }}>
            <Stack spacing={2.5}>
              {workflow?.fields.map((field) => {
                const question = questionLabels.get(field.id);
                return (
                  <Box key={field.id}>
                    <Field
                      field={question ? { ...field, label: question.label || question.question } : field}
                      value={state.answers[field.id] || ''}
                      error={fieldErrors[field.id]}
                      onChange={(value) => update({ answers: { ...state.answers, [field.id]: value } })}
                    />
                    {question?.why ? <Typography sx={{ mt: 0.7, fontSize: 12, color: 'text.secondary' }}>{question.why}</Typography> : null}
                  </Box>
                );
              })}
            </Stack>
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
              <Button onClick={() => update({ step: 'integrations' })}>Back</Button>
              <Button variant="contained" onClick={buildPlan}>Review the plan</Button>
            </Stack>
          </Surface>
        </Box>
      </Box>
    );
  };

  const renderPlan = () => <Box><Chip icon={<TaskAltRoundedIcon />} label="Human approval gate" className="eyebrow-chip" /><Typography variant="h2" className="activation-title compact">Here’s exactly what Promarkia will do.</Typography><Grid container spacing={2.5} sx={{ mt: 1 }}><Grid item xs={12} md={8}><Surface sx={{ p: 4 }}><Typography variant="h5" sx={{ fontWeight: 900 }}>{state.plan?.title}</Typography><Typography color="text.secondary">{state.plan?.objective}</Typography><Divider sx={{ my: 3 }} />{Object.entries(state.plan?.answers || {}).map(([label, value]) => <Box key={label} sx={{ mb: 1.5 }}><Typography variant="caption">{label}</Typography><Typography>{value}</Typography></Box>)}<VideoProductionPlan brief={state.plan?.productionBrief} /></Surface></Grid><Grid item xs={12} md={4}><Surface sx={{ p: 3 }}><Stack spacing={2}><Alert severity="info" icon={<LockRoundedIcon />}>This run creates a reviewable draft. It does not publish.</Alert>{state.plan?.productionBrief ? <Alert severity="success">Script, storyboard, production mode, cost policy, audio, captions, and quality gates are compiled before the Video Squad starts.</Alert> : null}<FormControlLabel control={<Checkbox checked={state.approved} onChange={(event) => update({ approved: event.target.checked })} />} label="I approve this exact run" /><Button variant="contained" startIcon={<PlayArrowRoundedIcon />} disabled={!state.approved || busy} onClick={runPlan}>Approve and run</Button></Stack></Surface></Grid></Grid><Button sx={{ mt: 2 }} onClick={() => update({ step: 'intake' })}>Edit the brief</Button></Box>;

  const renderRunning = () => <Surface sx={{ p: 6, textAlign: 'center', maxWidth: 720, mx: 'auto' }}><Box className="run-orb"><AutoAwesomeRoundedIcon /></Box><Typography variant="h3" sx={{ fontWeight: 950, mt: 3 }}>Your squad is working.</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Run {state.activeRun?.id} is using the current {state.activeRun?.teamName} through Promarkia’s production AutoGen bridge.</Typography><LinearProgress sx={{ mt: 4 }} /><Button sx={{ mt: 2 }} onClick={onOpenChat}>Follow in chat</Button></Surface>;

  const renderCompleted = () => <Box><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"><Box><Chip icon={<CheckCircleRoundedIcon />} label="Run complete" color="success" /><Typography variant="h2" className="activation-title compact">Your first outcome is ready.</Typography></Box><Button variant="contained" onClick={goLaunchpad}>Back to Launchpad</Button></Stack><Grid container spacing={2.5} sx={{ mt: 1 }}><Grid item xs={12} md={8}><Surface sx={{ p: 4 }}><Typography className="plan-label">{workflow?.outputType}</Typography>{['content.blog.create', 'seo.site.analyze'].includes(workflow?.id) ? <ArticlePreview content={state.activeRun?.artifact} /> : <Typography component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mt: 2 }}>{state.activeRun?.artifact}</Typography>}</Surface></Grid><Grid item xs={12} md={4}><Surface sx={{ p: 3 }}><Typography variant="h6" sx={{ fontWeight: 900 }}>Promarkia run</Typography><Divider sx={{ my: 2 }} /><Typography color="text.secondary">This result came from your local squads, provider connections, run history, and artifact pipeline.</Typography><Typography variant="caption" sx={{ mt: 2, display: 'block' }}>Run ID</Typography><Typography sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{state.activeRun?.id}</Typography><Chip sx={{ mt: 2 }} label="Approval required before publishing" color="success" /><Button fullWidth sx={{ mt: 1 }} onClick={onOpenChat}>Open in chat</Button></Surface></Grid></Grid></Box>;

  const content = state.step === 'website' ? renderWebsite() : state.step === 'profile' ? renderProfile() : state.step === 'goal' ? renderGoal() : state.step === 'launchpad' ? renderGoal(true) : state.step === 'integrations' ? renderIntegrations() : state.step === 'intake' ? renderIntake() : state.step === 'plan' ? renderPlan() : state.step === 'running' ? renderRunning() : renderCompleted();

  return (
    <Box className={`activation-shell${embedded ? ' activation-embedded' : ''}`} data-color-mode={darkMode ? 'dark' : 'light'} data-step={state.step} sx={themeVariables}>
      {!embedded ? <Box component="header" className="activation-header"><Container maxWidth="lg"><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ minHeight: 76 }}><BrandMark /><Stack direction="row" spacing={1} alignItems="center"><Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' } }}>{user.email}</Typography>{state.onboardingComplete ? <Button onClick={goLaunchpad}>Launchpad</Button> : null}{state.onboardingComplete ? <Button startIcon={<ChatBubbleRoundedIcon />} onClick={onOpenChat}>Chat</Button> : null}<Button startIcon={<LogoutRoundedIcon />} onClick={onLogout}>Log Out</Button><Stack direction="row" alignItems="center"><LightModeRoundedIcon fontSize="small" /><Switch checked={darkMode} onChange={toggleTheme} /><DarkModeRoundedIcon fontSize="small" /></Stack></Stack></Stack></Container></Box> : null}
      {!state.onboardingComplete && state.step !== 'launchpad' ? <Container maxWidth="lg" sx={{ pt: 2.5 }}><Stepper activeStep={activeStep} alternativeLabel className="activation-stepper">{ONBOARDING_STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper><LinearProgress variant="determinate" value={progress} className="mobile-progress" /></Container> : null}
      <Container component="main" className="activation-main" maxWidth={embedded ? 'xl' : 'lg'} sx={{ py: embedded ? { xs: 2, md: 2.5 } : { xs: 4, md: 7 } }}>{error ? <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>{error}</Alert> : null}{content}</Container>
      {!embedded ? <Container maxWidth="lg" component="footer" sx={{ pb: 4 }}><Divider /><Typography variant="caption" color="text.secondary" sx={{ pt: 2, display: 'block' }}>Promarkia Launchpad · Local squads, integrations, runs, approvals, and artifacts</Typography></Container> : null}
    </Box>
  );
}

ActivationExperience.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  embedded: PropTypes.bool,
  toggleTheme: PropTypes.func.isRequired,
  user: PropTypes.shape({ email: PropTypes.string }).isRequired,
  onLogout: PropTypes.func.isRequired,
  onOpenChat: PropTypes.func.isRequired,
};
