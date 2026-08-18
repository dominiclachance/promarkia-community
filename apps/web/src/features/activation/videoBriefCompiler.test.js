import assert from 'node:assert/strict';
import test from 'node:test';
import { createExecutionPlan } from './intakeEngine.js';
import { buildApprovedPlanTask } from './launchpadPlan.js';
import { compileFacelessExplainerBrief } from './videoBriefCompiler.js';

const answers = {
  lesson: 'Explain how an AI agent completes business work.',
  audience: 'Business leaders with limited AI knowledge',
  example: 'Qualifying and following up with a new sales lead',
  takeaway: 'Reliable agents need goals, tools, and boundaries.',
  length: '60–90 seconds',
  format: '9:16 vertical',
  visualStyle: 'Clean business motion graphics',
  productionMode: 'Motion graphics',
  platform: 'LinkedIn / Instagram / TikTok',
  costCeiling: 'Motion graphics only — no paid footage',
};

test('compiles a complete production contract from a simple brief', () => {
  const brief = compileFacelessExplainerBrief({
    answers,
    brand: 'Agentix Labs',
    websiteUrl: 'https://agentixlabs.com',
    brandProfile: { voice: 'Clear and authoritative', offer: 'AI implementation' },
  });

  assert.equal(brief.summary.productionMode, 'Motion graphics');
  assert.equal(brief.timing.target, 85);
  assert.match(brief.prompt, /SCRIPT CONTRACT/);
  assert.match(brief.prompt, /STORYBOARD CONTRACT/);
  assert.match(brief.prompt, /MOTION-DESIGN CONTRACT/);
  assert.match(brief.prompt, /AUDIO CONTRACT/);
  assert.match(brief.prompt, /CAPTION CONTRACT/);
  assert.match(brief.prompt, /Do not call Veo/);
  assert.match(brief.prompt, /Do not mark the run complete/);
});

test('execution plan includes the generated brief and passes it to Team 10', () => {
  const plan = createExecutionPlan({
    workflowId: 'video.faceless.explainer',
    profile: {
      brandName: 'Agentix Labs',
      websiteUrl: 'https://agentixlabs.com',
      audience: answers.audience,
      offer: 'AI implementation',
      voice: 'Clear and authoritative',
    },
    answers,
    connectedIntegrations: { website: true },
  });

  assert.ok(plan.productionBrief?.prompt.length > 3000);
  const task = buildApprovedPlanTask({ ...plan, approvedAt: '2026-07-31T22:00:00Z' });
  assert.match(task, /Target squad: Video Squad \(Team 10\)/);
  assert.match(task, /APPROVED PRODUCTION SPECIFICATION/);
  assert.match(task, /Motion graphics only — no paid footage/);
});

test('non-video Launchpad workflows remain unchanged', () => {
  const plan = createExecutionPlan({
    workflowId: 'assistant.email.draft',
    profile: { brandName: 'Example', websiteUrl: 'https://example.com' },
    answers: {
      context: 'Follow up after a discovery call',
      recipient: 'Prospect',
      goal: 'Confirm next meeting',
      tone: 'Direct and professional',
    },
    connectedIntegrations: { website: true },
  });
  assert.equal(plan.productionBrief, undefined);
});
