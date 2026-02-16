/**
 * api/gemini.js — Gemini API client for cover letter generation.
 *
 * Builds the prompt from the user-editable prompt and job data, then
 * calls the Gemini generateContent endpoint.
 */

import { DEFAULT_PROMPT } from './default-prompt.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Calls the Gemini API to generate a cover letter.
 *
 * @param {Object} params
 * @param {string} params.apiKey   — Gemini API key.
 * @param {string} params.model    — Model ID (e.g. "gemini-2.5-flash").
 * @param {Object} params.jobData  — { companyName, jobTitle, jobDescription }.
 * @returns {Promise<string>}      — The generated cover letter body text.
 */
export async function generateCoverLetter({ apiKey, model, jobData }) {
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
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const message =
      errBody?.error?.message || `Gemini API error: ${res.status} ${res.statusText}`;
    throw new Error(message);
  }

  const data = await res.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
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
