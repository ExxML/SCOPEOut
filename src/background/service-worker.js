/**
 * background/service-worker.js — Extension background service worker.
 *
 * Handles messages from the popup:
 *   - "generateCoverLetter" → calls Gemini API
 *   - "openPreview"         → stores data & opens the preview tab
 */

import { generateCoverLetter } from '../api/gemini.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'startGeneration') {
    handleStartGeneration(message);
    sendResponse({ started: true });
    return false;
  }

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
 * Runs the full generation workflow in the background:
 * scrapes job data, calls Gemini, and opens the preview tab.
 * Progress is stored in session storage so the popup can track it.
 */
async function handleStartGeneration({ tabId, model, apiKey }) {
  try {
    await chrome.storage.session.set({
      generationState: { status: 'generating', message: 'Extracting job details…' }
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scraper.js']
    });

    const jobData = result.result;
    if (!jobData || !jobData.jobDescription) {
      throw new Error('Could not extract job details. Make sure you are on a job posting page.');
    }

    await chrome.storage.session.set({
      generationState: {
        status: 'generating',
        message: `Found job: ${jobData.jobTitle} at ${jobData.companyName}.\nGenerating cover letter…`
      }
    });

    const coverLetterBody = await generateCoverLetter({ apiKey, model, jobData });

    await chrome.storage.session.set({
      generationState: { status: 'complete', message: 'Cover letter generated successfully.' }
    });

    // Store data and open the preview page
    await chrome.storage.session.set({
      coverLetterData: { coverLetterBody, companyName: jobData.companyName, jobTitle: jobData.jobTitle }
    });
    const previewUrl = chrome.runtime.getURL('preview/preview.html');
    await chrome.tabs.create({ url: previewUrl });
  } catch (err) {
    await chrome.storage.session.set({
      generationState: { status: 'error', message: err.message }
    });
  }
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
