const form = document.querySelector('#campaign-form');
const result = document.querySelector('#result');
const statusEl = document.querySelector('#status');
const titleEl = document.querySelector('#campaign-title');
const errorEl = document.querySelector('#error');
const artifactsEl = document.querySelector('#artifacts');
const createButton = document.querySelector('#create-button');
const approveButton = document.querySelector('#approve-button');
const retryButton = document.querySelector('#retry-button');
let campaignId = null;
let pollTimer = null;

const terminalStatuses = new Set(['awaiting_approval', 'approved', 'failed']);

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.toggle('hidden', !message);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Request failed (${response.status})`);
  return payload;
}

function renderCampaign(campaign) {
  statusEl.textContent = campaign.status.replaceAll('_', ' ');
  statusEl.dataset.status = campaign.status;
  titleEl.textContent = campaign.goal;
  showError(campaign.error || '');
  const artifactLinks = campaign.artifacts.map((artifact) => {
    const link = document.createElement('a');
    link.className = 'artifact';
    link.href = artifact.url;
    link.target = '_blank';
    link.rel = 'noopener';
    const name = document.createElement('span');
    name.textContent = artifact.name;
    const details = document.createElement('small');
    details.textContent = `${artifact.bytes.toLocaleString()} bytes · ${artifact.sha256.slice(0, 10)}`;
    link.append(name, details);
    return link;
  });
  artifactsEl.replaceChildren(...artifactLinks);
  approveButton.classList.toggle('hidden', campaign.status !== 'awaiting_approval');
  retryButton.classList.toggle('hidden', campaign.status !== 'failed');
  if (terminalStatuses.has(campaign.status) && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    createButton.disabled = false;
    createButton.textContent = 'Build another campaign';
  }
}

async function loadCampaign() {
  if (!campaignId) return;
  try {
    renderCampaign(await request(`/api/campaigns/${campaignId}`));
  } catch (error) {
    showError(error.message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  createButton.disabled = true;
  createButton.textContent = 'Starting…';
  try {
    const payload = {
      company_url: document.querySelector('#company-url').value,
      goal: document.querySelector('#goal').value,
      audience: document.querySelector('#audience').value,
      offer: document.querySelector('#offer').value,
    };
    const campaign = await request('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) });
    campaignId = campaign.id;
    result.classList.remove('hidden');
    statusEl.textContent = campaign.status;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await loadCampaign();
    pollTimer = setInterval(loadCampaign, 1000);
  } catch (error) {
    showError(error.message);
    result.classList.remove('hidden');
    createButton.disabled = false;
    createButton.textContent = 'Build campaign';
  }
});

approveButton.addEventListener('click', async () => {
  try {
    renderCampaign(await request(`/api/campaigns/${campaignId}/approve`, { method: 'POST' }));
  } catch (error) { showError(error.message); }
});

retryButton.addEventListener('click', async () => {
  try {
    await request(`/api/campaigns/${campaignId}/retry`, { method: 'POST' });
    retryButton.classList.add('hidden');
    pollTimer = setInterval(loadCampaign, 1000);
    await loadCampaign();
  } catch (error) { showError(error.message); }
});
