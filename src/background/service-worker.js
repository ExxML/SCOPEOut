/**
 * background/service-worker.js — Extension background service worker.
 *
 * Handles messages from the popup:
 *   - "generateCoverLetter" → calls Gemini API
 *   - "openPreview"         → stores data & opens the preview tab
 */

import { generateCoverLetter } from '../api/gemini.js';

let generationAbortController = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'startGeneration') {
    handleStartGeneration(message);
    sendResponse({ started: true });
    return false;
  }

  if (message.action === 'cancelGeneration') {
    handleCancelGeneration();
    sendResponse({ cancelled: true });
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
  // Abort any existing generation
  if (generationAbortController) {
    generationAbortController.abort();
  }
  generationAbortController = new AbortController();
  const { signal } = generationAbortController;

  try {
    await chrome.storage.session.set({
      generationState: { status: 'generating', message: 'Extracting job details…' }
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scraper.js']
    });

    if (signal.aborted) return;

    const jobData = result.result;
    if (!jobData || !jobData.jobDescription) {
      throw new Error('Could not extract all necessary job details. Make sure you are on a valid UBC Co-op job posting page.');
    }

    await chrome.storage.session.set({
      generationState: {
        status: 'generating',
        message: `Found job: ${jobData.jobTitle} at ${jobData.companyName}.\nGenerating cover letter…`
      }
    });

    const coverLetterBody = await generateCoverLetter({ apiKey, model, jobData, signal });

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
    if (err.name === 'AbortError' || signal.aborted) return;
    await chrome.storage.session.set({
      generationState: { status: 'error', message: err.message }
    });
  } finally {
    if (generationAbortController?.signal === signal) {
      generationAbortController = null;
    }
  }
}

/**
 * Cancels any in-progress generation.
 */
async function handleCancelGeneration() {
  if (generationAbortController) {
    generationAbortController.abort();
    generationAbortController = null;
  }
  await chrome.storage.session.set({
    generationState: { status: 'idle' }
  });
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
