const TEAM_BY_PREFIX = Object.freeze({
  assistant: { id: '1', name: 'Assistant Squad' },
  image: { id: '9', name: 'Image Creator Squad' },
  video: { id: '10', name: 'Video Squad' },
  social: { id: '11', name: 'Social Media Squad' },
  content: { id: '12', name: 'Copywriting Squad' },
  seo: { id: '16', name: 'SEO Expert Squad' },
  campaign: { id: '17', name: 'Campaign Planner Squad' },
  ads: { id: '18', name: 'Digital Ads Squad' },
  code: { id: '19', name: 'Coders Squad' },
  data: { id: '20', name: 'Data Scientist Squad' },
  leads: { id: '21', name: 'Lead Generation Squad' },
});

export function teamForWorkflow(workflowId) {
  const team = TEAM_BY_PREFIX[String(workflowId || '').split('.')[0]];
  if (!team) throw new Error('This Launchpad workflow is not mapped to a production squad.');
  return team;
}

export function buildApprovedPlanTask(plan) {
  const team = teamForWorkflow(plan?.workflowId);
  const productionBrief = String(plan?.productionBrief?.prompt || '').trim();
  return [
    'APPROVED LAUNCHPAD PLAN',
    `Target squad: ${team.name} (Team ${team.id})`,
    'Run mode: DRY_RUN_ONLY',
    'Do not publish, post, email, or modify an external account. Return a reviewable draft and any normal Promarkia artifacts.',
    '',
    `Objective: ${plan?.objective || plan?.title || ''}`,
    `Brand: ${plan?.brand || ''}`,
    `Website: ${plan?.websiteUrl || ''}`,
    `Audience: ${plan?.brandProfile?.audience || ''}`,
    `Offer: ${plan?.brandProfile?.offer || ''}`,
    `Voice: ${plan?.brandProfile?.voice || ''}`,
    `Differentiator: ${plan?.brandProfile?.differentiator || ''}`,
    '',
    'Approved brief:',
    JSON.stringify(plan?.answers || {}, null, 2),
    ...(productionBrief ? [
      '',
      'APPROVED PRODUCTION SPECIFICATION',
      'The Launchpad compiled this specification from the approved user brief and brand profile. Follow it as the execution contract.',
      productionBrief,
    ] : []),
    '',
    `Approval timestamp: ${plan?.approvedAt || ''}`,
  ].join('\n').trim();
}
