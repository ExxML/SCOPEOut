/**
 * api/gemini.js — Gemini API client for cover letter generation.
 *
 * Builds the prompt from the cover letter template and job data, then
 * calls the Gemini generateContent endpoint.
 */

import { COVER_LETTER_TEMPLATE } from './cover-letter-template.js';

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

  const prompt = buildPrompt(companyName, jobTitle, jobDescription);

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
 * Builds the full prompt sent to Gemini.
 */
function buildPrompt(companyName, jobTitle, jobDescription) {
  return [
    `Based on the following job description for ${companyName} as a ${jobTitle}, fill in the blanks for my cover letter. For the second body paragraph, choose one of the "Data/Research/R", "Python/Developer", "Fullstack/Web/Javascript", "Java/OOD/TDD", or "IT" paragraphs that best fits this role.`,
    '',
    '--- COVER LETTER TEMPLATE ---',
    COVER_LETTER_TEMPLATE,
    '',
    '--- JOB DESCRIPTION ---',
    jobDescription,
    '',
    'IMPORTANT INSTRUCTIONS:',
    '- Fill in ALL blanks indicated by angle brackets (< >) with appropriate content based on the job description.',
    '- Choose exactly ONE of the five skill paragraphs (Data/Research/R, Python/Developer, Fullstack/Web/Javascript, Java/OOD/TDD, or IT) for the second body paragraph that best matches this role.',
    '- Remove the paragraph labels (e.g., "Data/Research/R", "Python/Developer", etc.) from the output.',
    '- Remove ALL the other skill paragraphs that were not chosen.',
    '- Output ONLY the final cover letter text with line breaks between paragraphs. Do NOT include any markdown formatting, labels, or extra commentary.'
  ].join('\n');
}
