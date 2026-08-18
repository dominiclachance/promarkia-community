import { useBoundStore } from '../../stores/index.js';
import { buildApprovedPlanTask, teamForWorkflow } from './launchpadPlan.js';

export async function executeApprovedPlan(plan) {
  const team = teamForWorkflow(plan?.workflowId);
  const store = useBoundStore.getState();
  if (store.pendingResponse) throw new Error('Another Promarkia run is already in progress.');
  sessionStorage.setItem('squad', team.id);
  sessionStorage.setItem('squadName', team.name);
  useBoundStore.setState({ lastError: null, lastCompletedRunId: null });
  const messageStartIndex = store.chatMessages.length;

  await store.sendChatMessageAsync(buildApprovedPlanTask(plan), {
    skipRouting: true,
    skipMemory: true,
    preserveTeamModels: true,
  });

  const next = useBoundStore.getState();
  if (next.lastError) throw new Error(next.lastError);
  if (!next.lastRunId) throw new Error('Promarkia did not return a production run ID.');
  return {
    run: {
      id: next.lastRunId,
      status: 'running',
      messageStartIndex,
      teamId: team.id,
      teamName: team.name,
    },
  };
}
