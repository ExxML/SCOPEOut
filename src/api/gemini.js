/**
 * api/gemini.js — Gemini API client for model listing and cover letter generation.
 *
 * Lists the text generation models available to an API key, and builds the
 * prompt from the user-editable prompt and job data, then calls the Gemini
 * generateContent endpoint.
 */

import { DEFAULT_PROMPT } from './default-prompt.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Models that aren't general-purpose text-in, text-out (media, speech, realtime, agentic, robotics)
const NON_TEXT_MODEL_PATTERN = /image|tts|audio|live|transcribe|omni|computer-use|customtools|robotics/;
// Dated snapshots (e.g. "-001", "-09-2025") of models already listed under their base ID
const SNAPSHOT_MODEL_PATTERN = /-\d{2,4}(-\d{2,4})?$/;

/**
 * Fetches the text-in, text-out Gemini models available to the API key.
 * Also serves as API key validation, since an invalid key throws.
 *
 * @param {string} apiKey — Gemini API key.
 * @returns {Promise<Array<{ id: string, displayName: string }>>} — Sorted newest first.
 */
export async function listTextModels(apiKey) {
  const models = [];
  let pageToken;

  do {
    const params = new URLSearchParams({ key: apiKey, pageSize: 1000 });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${GEMINI_API_BASE}?${params}`);
    if (!res.ok) throw await apiError(res);

    const data = await res.json();
    models.push(...(data.models || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return { id, displayName: m.displayName || id };
    })
    .filter(({ id }) =>
      id.startsWith('gemini-') && !NON_TEXT_MODEL_PATTERN.test(id) && !SNAPSHOT_MODEL_PATTERN.test(id)
    )
    .sort((a, b) => modelVersion(b.id) - modelVersion(a.id) || a.displayName.localeCompare(b.displayName));
}

/**
 * Extracts the version number from a model ID (e.g. "gemini-2.5-flash" → 2.5).
 * Unversioned aliases (e.g. "gemini-flash-latest") return 0 so they sort last.
 */
function modelVersion(id) {
  const match = id.match(/^gemini-(\d+(?:\.\d+)?)-/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Calls the Gemini API to generate a cover letter.
 *
 * @param {Object} params
 * @param {string} params.apiKey   — Gemini API key.
 * @param {string} params.model    — Model ID (e.g. "gemini-2.5-flash").
 * @param {Object} params.jobData  — { companyName, jobTitle, jobDescription }.
 * @param {AbortSignal} [params.signal] — Optional signal to abort the request.
 * @returns {Promise<string>}      — The generated cover letter body text.
 */
export async function generateCoverLetter({ apiKey, model, jobData, signal }) {
  const { companyName, jobTitle, jobDescription } = jobData;

  const prompt = await buildPrompt(companyName, jobTitle, jobDescription);

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) throw await apiError(res);

  const data = await res.json();

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Cover letter generation was cut off because the response was too long. Try simplifying your prompt.');
  }

  return text;
}

/**
 * Builds the full prompt sent to Gemini from the stored prompt.
 */
async function buildPrompt(companyName, jobTitle, jobDescription) {
  // Load the prompt from storage
  const { prompt } = await chrome.storage.local.get('prompt');
  
  // If no prompt is saved, use the default
  const promptText = prompt || DEFAULT_PROMPT;
  
  // Replace placeholders with actual values
  return promptText
    .replace(/{companyName}/g, companyName)
    .replace(/{jobTitle}/g, jobTitle)
    .replace(/{jobDescription}/g, jobDescription);
}

/**
 * Builds an Error from a failed Gemini API response.
 */
async function apiError(res) {
  const errBody = await res.json().catch(() => ({}));
  return new Error(errBody?.error?.message || `Gemini API error: ${res.status} ${res.statusText}`);
}
