export const initialActivationState = {
  version: 3,
  step: 'website',
  onboardingComplete: false,
  profile: null,
  workflowId: '',
  connectedIntegrations: { website: false, linkedin: false, reddit: false, wordpress: false },
  answers: {},
  intakeMeta: null,
  plan: null,
  approved: false,
  activeRun: null,
};

export function normalizeActivationState(value) {
  return {
    ...initialActivationState,
    ...(value || {}),
    version: 3,
    approved: false,
    activeRun: null,
  };
}

export function persistedActivationState(value = {}) {
  const normalized = normalizeActivationState(value);
  const persistedStep = ['running', 'completed'].includes(normalized.step)
    ? (normalized.onboardingComplete ? 'launchpad' : 'goal')
    : normalized.step;
  return {
    version: 3,
    step: persistedStep,
    onboardingComplete: Boolean(normalized.onboardingComplete),
    profile: normalized.profile,
    workflowId: normalized.workflowId,
    answers: normalized.answers,
    intakeMeta: normalized.intakeMeta,
    plan: normalized.plan,
    analysisNotice: normalized.analysisNotice || '',
  };
}
