/**
 * background/service-worker.js — Extension background service worker.
 *
 * Handles messages from the popup:
 *   - "generateCoverLetter" → calls Gemini API
 *   - "openPreview"         → stores data & opens the preview tab
 */

import { generateCoverLetter } from '../api/gemini.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'generateCoverLetter') {
    handleGenerate(message)
      .then((coverLetterBody) => sendResponse({ coverLetterBody }))
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.action === 'openPreview') {
    handleOpenPreview(message)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

/**
 * Calls Gemini to generate a cover letter from job data.
 */
async function handleGenerate({ apiKey, model, jobData }) {
  return generateCoverLetter({ apiKey, model, jobData });
}

/**
 * Stores the cover letter data and opens the preview page in a new tab.
 */
async function handleOpenPreview({ coverLetterBody, companyName, jobTitle }) {
  // Store data in session storage for the preview page to read
  await chrome.storage.session.set({
    coverLetterData: { coverLetterBody, companyName, jobTitle }
  });

  // Open the preview page
  const previewUrl = chrome.runtime.getURL('preview/preview.html');
  await chrome.tabs.create({ url: previewUrl });
}
