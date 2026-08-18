import { getRequiredIntegrations, getWorkflow } from './workflowCatalog.js';
import { compileFacelessExplainerBrief, shouldCompileVideoBrief } from './videoBriefCompiler.js';

const URL_PATTERN = /^https?:\/\//i;

export function normalizeWebsiteUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return URL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function validatePublicWebsite(value) {
  try {
    const url = new URL(normalizeWebsiteUrl(value));
    const host = url.hostname.toLowerCase();
    const privateHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
    if (!['http:', 'https:'].includes(url.protocol) || privateHost || !host.includes('.')) {
      return 'Enter a public website URL, such as https://example.com.';
    }
    return '';
  } catch {
    return 'Enter a valid website URL.';
  }
}

export function prefillAnswers(workflowId, profile = {}) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return {};
  return workflow.fields.reduce((answers, field) => {
    if (field.profileFallback && profile[field.profileFallback]) {
      answers[field.id] = profile[field.profileFallback];
    } else if (field.type === 'select' && field.options?.length) {
      answers[field.id] = field.options[0];
    }
    return answers;
  }, {});
}

export function validateAnswers(workflowId, answers = {}) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return { workflowId: 'Choose a valid workflow.' };
  return workflow.fields.reduce((errors, field) => {
    const value = String(answers[field.id] || '').trim();
    if (field.required && !value) errors[field.id] = 'This answer is required.';
    if (field.type === 'select' && value && !field.options.includes(value)) errors[field.id] = 'Choose one of the available options.';
    if (field.type === 'url' && value && validatePublicWebsite(value)) errors[field.id] = validatePublicWebsite(value);
    return errors;
  }, {});
}

export function getMissingRequiredFields(workflowId, answers = {}) {
  return Object.keys(validateAnswers(workflowId, answers)).filter((fieldId) => fieldId !== 'workflowId');
}

export function integrationsReady(workflowId, connected = {}) {
  return getRequiredIntegrations(workflowId).every((integration) => connected[integration.id]);
}

export function createExecutionPlan({ workflowId, profile, answers, connectedIntegrations }) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new Error('Unknown workflow.');
  const errors = validateAnswers(workflowId, answers);
  if (Object.keys(errors).length) throw new Error('Complete the required task questions before reviewing the plan.');
  if (!integrationsReady(workflowId, connectedIntegrations)) throw new Error('Connect the required integrations before reviewing the plan.');

  const plan = {
    workflowId,
    title: workflow.title,
    objective: workflow.outcome,
    brand: profile?.brandName || 'Your brand',
    websiteUrl: profile?.websiteUrl || '',
    brandProfile: {
      audience: profile?.audience || '',
      offer: profile?.offer || '',
      voice: profile?.voice || '',
      differentiator: profile?.differentiator || '',
      evidence: Array.isArray(profile?.evidence) ? profile.evidence.slice(0, 6) : [],
    },
    answers: workflow.fields.reduce((result, field) => {
      const value = String(answers[field.id] || '').trim();
      if (value) result[field.label] = value;
      return result;
    }, {}),
    integrations: workflow.integrations.filter((item) => connectedIntegrations[item.id]).map((item) => item.label),
    connectedIntegrationIds: workflow.integrations.filter((item) => connectedIntegrations[item.id]).map((item) => item.id),
    approvalRequired: true,
    publishedByDefault: false,
    estimate: workflow.estimate,
    outputType: workflow.outputType,
  };
  if (shouldCompileVideoBrief(workflowId)) {
    plan.productionBrief = compileFacelessExplainerBrief({
      answers,
      brand: plan.brand,
      brandProfile: plan.brandProfile,
      websiteUrl: plan.websiteUrl,
    });
  }
  return plan;
}

export function filterAiQuestions(workflowId, questions = []) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return [];
  const allowed = new Map(workflow.fields.map((field) => [field.id, field]));
  return questions
    .filter((question) => allowed.has(question.fieldId))
    .map((question) => ({
      ...allowed.get(question.fieldId),
      label: String(question.question || allowed.get(question.fieldId).label).slice(0, 180),
      why: String(question.why || '').slice(0, 180),
    }));
}
