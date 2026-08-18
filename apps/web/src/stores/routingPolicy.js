export const VIDEO_SQUAD_ID = 10;

// Video Squad owns the complete video-production deliverable, including
// research, captions, thumbnails/covers, metadata, verification, and optional
// YouTube/TikTok upload. Supporting assets must not turn one video request into
// a multi-squad campaign.
export const getDeterministicRoutingChoice = (taskText = '') => {
  const text = String(taskText || '').toLowerCase();
  const requestsVideoProduction =
    /\b(create|generate|produce|render|assemble|make)\b[\s\S]{0,100}\b(video|mp4|explainer|shorts?|tiktok|youtube)\b/.test(text) ||
    /\b(higgsfield|video squad|video explainer|animated explainer)\b/.test(text);
  const explicitlyBroadCampaign =
    /\b(complete|full|comprehensive|multi[- ]channel)\b[\s\S]{0,80}\b(campaign|launch|strategy|marketing plan)\b/.test(text) ||
    /\bacross all channels\b/.test(text);

  if (requestsVideoProduction && !explicitlyBroadCampaign) {
    return {
      team_id: VIDEO_SQUAD_ID,
      label: 'Video Squad',
      reason: 'The primary deliverable is one video; Team 10 owns its supporting assets and metadata.',
      deterministic: true,
    };
  }

  return null;
};
