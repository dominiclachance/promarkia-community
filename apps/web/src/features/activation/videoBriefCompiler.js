const LENGTH_SECONDS = Object.freeze({
  '30–45 seconds': { min: 30, max: 45, target: 40 },
  '60–90 seconds': { min: 60, max: 90, target: 85 },
  '3–5 minutes': { min: 180, max: 300, target: 240 },
  '6–10 minutes': { min: 360, max: 600, target: 480 },
});

const FORMAT_SPECS = Object.freeze({
  '9:16 vertical': '1080×1920 vertical, with all essential content inside mobile-safe zones',
  '16:9 landscape': '1920×1080 landscape, with all essential content inside title-safe zones',
  Both: 'a 1920×1080 master plus a composition-aware 1080×1920 vertical version',
});

const MODE_RULES = Object.freeze({
  'Motion graphics': 'Use HyperFrames for the complete visual presentation. Do not call Veo.',
  Cinematic: 'Use Veo for the minimum number of cinematic clips required, then assemble, caption, and brand the result deterministically.',
  Hybrid: 'Use HyperFrames for information, typography, diagrams, and captions. Use Veo only for supporting footage that materially improves the explanation.',
  Auto: 'Choose Motion graphics for abstract mechanisms and frameworks, Cinematic for visual real-world stories, or Hybrid when both are necessary. State the choice before paid generation.',
});

const DEFAULTS = Object.freeze({
  example: 'Use one concrete, recognizable business example throughout.',
  takeaway: 'End with one concise practical insight the viewer can remember.',
  visualStyle: 'Clean business motion graphics',
  productionMode: 'Auto',
  platform: 'LinkedIn / Instagram / TikTok',
  costCeiling: 'No automatic paid regenerations',
});

function value(answers, key, fallback = '') {
  return String(answers?.[key] || fallback).trim();
}

function narrationTarget(seconds) {
  return {
    minWords: Math.round(seconds * 1.9),
    maxWords: Math.round(seconds * 2.25),
  };
}

export function compileFacelessExplainerBrief({ answers = {}, brandProfile = {}, brand = 'Your brand', websiteUrl = '' } = {}) {
  const lesson = value(answers, 'lesson');
  const audience = value(answers, 'audience', brandProfile.audience);
  const length = value(answers, 'length', '60–90 seconds');
  const format = value(answers, 'format', '9:16 vertical');
  const example = value(answers, 'example', DEFAULTS.example);
  const takeaway = value(answers, 'takeaway', DEFAULTS.takeaway);
  const visualStyle = value(answers, 'visualStyle', DEFAULTS.visualStyle);
  const productionMode = value(answers, 'productionMode', DEFAULTS.productionMode);
  const platform = value(answers, 'platform', DEFAULTS.platform);
  const costCeiling = value(answers, 'costCeiling', DEFAULTS.costCeiling);
  const timing = LENGTH_SECONDS[length] || LENGTH_SECONDS['60–90 seconds'];
  const words = narrationTarget(timing.target);
  const modeRule = MODE_RULES[productionMode] || MODE_RULES.Auto;
  const formatSpec = FORMAT_SPECS[format] || FORMAT_SPECS['9:16 vertical'];

  const summary = {
    concept: lesson,
    audience,
    example,
    takeaway,
    runtime: `${timing.min}–${timing.max} seconds (target ${timing.target})`,
    format,
    visualStyle,
    productionMode,
    platform,
    costCeiling,
  };

  const prompt = [
    `Create a polished educational explainer video for ${brand}.`,
    '',
    'OBJECTIVE',
    lesson,
    '',
    'AUDIENCE',
    audience,
    '',
    'CORE EXAMPLE',
    example,
    '',
    'CLOSING TAKEAWAY',
    takeaway,
    '',
    'BRAND CONTEXT',
    `Brand: ${brand}`,
    `Website: ${websiteUrl}`,
    `Offer: ${brandProfile.offer || ''}`,
    `Voice: ${brandProfile.voice || 'Clear, credible, educational, and direct'}`,
    `Differentiator: ${brandProfile.differentiator || ''}`,
    '',
    'DELIVERY SPECIFICATION',
    `Runtime: ${timing.min}–${timing.max} seconds; target ${timing.target} seconds.`,
    `Format: ${formatSpec}.`,
    `Primary destination: ${platform}.`,
    `Visual style: ${visualStyle}.`,
    `Production mode: ${productionMode}. ${modeRule}`,
    '',
    'SCRIPT CONTRACT',
    `Write approximately ${words.minWords}–${words.maxWords} spoken words so the narration naturally fills the target runtime.`,
    'Use a strong opening hook, a logical explanation, the approved example, a meaningful distinction or decision, and the approved closing takeaway.',
    'Create the complete narration before rendering. Read it at a natural conversational pace.',
    'Never slow, stretch, pitch-shift, splice, or silence-pad narration to reach the requested duration.',
    'Distribute narration across every scene. Do not front-load speech and leave dead sections later.',
    'Use one consistent narrator for the entire video.',
    '',
    'STORYBOARD CONTRACT',
    'Create a timed scene plan whose durations add up to the target runtime.',
    'For every scene specify: time range, narration, learning purpose, visual composition, animation beats, on-screen text, and transition.',
    'Introduce a meaningful visual change every 2–4 seconds.',
    'Keep the visuals synchronized with the idea currently being narrated.',
    'All readable text must be rendered deterministically, never baked into generated imagery or generated footage.',
    '',
    'MOTION-DESIGN CONTRACT',
    'The result must feel like a designed motion piece, not a static slideshow.',
    'Use purposeful movement such as progressive reveals, diagram paths, staggered cards, kinetic typography, camera pushes, masks, highlights, and visual transformations.',
    'Use natural easing and continuous low-level motion where appropriate. Avoid decorative spinning, excessive bouncing, and movement without explanatory purpose.',
    '',
    'VEO AND COST CONTRACT',
    modeRule,
    `Cost policy: ${costCeiling}.`,
    'Show the planned number of paid generations and maximum estimated cost before execution.',
    'Never regenerate a successful paid asset automatically. Reuse completed assets after any downstream failure.',
    'Generated clips must not contain words, captions, logos, or user-interface text.',
    '',
    'AUDIO CONTRACT',
    'Use one natural, consistent narrator and real instrumental background music appropriate for an educational business video.',
    'Music must remain audible but restrained, with automatic ducking beneath speech and a clean beginning and ending.',
    'Do not use placeholder tones, hums, drones, or synthetic test audio.',
    'Do not leave unexplained narration gaps longer than three seconds.',
    '',
    'CAPTION CONTRACT',
    'Burn accurate, phrase-timed captions into the final video.',
    'Use no more than two lines at once, maintain strong contrast, respect safe zones, and highlight selected key terms using the brand accent color.',
    'Verify captions from rendered pixels, not merely from the existence of a subtitle file.',
    '',
    'APPROVAL AND QUALITY GATES',
    'Before paid generation, return the narration, storyboard, production-mode choice, asset count, and maximum estimated cost for approval.',
    `Reject the final result unless its runtime is between ${timing.min} and ${timing.max} seconds and its format is ${formatSpec}.`,
    'Reject it if narration is missing, stretched, inconsistent, or contains unexplained dead sections.',
    'Reject it if music is absent, inaudible, noisy, or competes with narration.',
    'Reject it if captions are absent, mistimed, misspelled, unsafe, or not visibly burned into the rendered frames.',
    'Reject it if long scenes are nearly static, frames are blank, or generated footage contains malformed text.',
    'Probe and inspect the complete final MP4, including listening to the full audio track.',
    'Do not mark the run complete until every required gate passes.',
    '',
    'PUBLISHING',
    'Create a reviewable final MP4. Do not publish without a separate explicit approval.',
  ].join('\n').trim();

  return { summary, prompt, estimatedNarrationWords: words, timing };
}

export function shouldCompileVideoBrief(workflowId) {
  return workflowId === 'video.faceless.explainer';
}
