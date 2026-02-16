/**
 * popup.js — SCOPEOut extension popup controller.
 *
 * Handles UI interactions: settings, model selection, and triggering
 * cover letter generation via the background service worker.
 */

document.addEventListener('DOMContentLoaded', init);

/* ── DOM References ──────────────────────────────── */
const $ = (id) => document.getElementById(id);

/* ── Initialisation ──────────────────────────────── */
async function init() {
  // Restore persisted state
  const stored = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'apiKeyValid']);
  if (stored.geminiApiKey) {
    $('api-key-input').value = stored.geminiApiKey;
    if (stored.apiKeyValid) {
      showApiKeyStatus('API key saved.', 'success');
    }
  }
  if (stored.geminiModel) {
    $('model-select').value = stored.geminiModel;
  }

  // Update generate button state based on API key validity
  updateGenerateButtonState(stored.apiKeyValid);

  // Bind events
  $('settings-toggle').addEventListener('click', toggleSettings);
  $('toggle-password').addEventListener('click', togglePasswordVisibility);
  $('save-api-key').addEventListener('click', saveApiKey);
  $('model-select').addEventListener('change', saveModel);
  $('generate-btn').addEventListener('click', handleGenerate);
  $('api-info-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://aistudio.google.com/welcome' });
  });
}

/* ── Settings Panel ──────────────────────────────── */
function toggleSettings() {
  const panel = $('settings-panel');
  const arrow = $('settings-arrow');
  panel.classList.toggle('hidden');
  arrow.classList.toggle('open');
}

/* ── Password Toggle ─────────────────────────────── */
function togglePasswordVisibility() {
  const input = $('api-key-input');
  const eyeIcon = $('eye-icon');
  const eyeOffIcon = $('eye-off-icon');
  
  if (input.type === 'password') {
    input.type = 'text';
    eyeIcon.style.display = 'none';
    eyeOffIcon.style.display = 'block';
  } else {
    input.type = 'password';
    eyeIcon.style.display = 'block';
    eyeOffIcon.style.display = 'none';
  }
}

/* ── API Key ─────────────────────────────────────── */
let statusTimeout = null;

async function saveApiKey() {
  const key = $('api-key-input').value.trim();
  if (!key) {
    showApiKeyStatus('Please enter an API key.', 'error');
    return;
  }
  
  // Show validating message
  showApiKeyStatus('Validating API key...', '');
  
  // Validate API key with all models
  const validationResult = await validateApiKey(key);
  
  if (validationResult.allValid) {
    // All models accessible - save key and show success
    await chrome.storage.local.set({ geminiApiKey: key, apiKeyValid: true });
    showApiKeyStatus('API key saved.', 'success');
    updateGenerateButtonState(true);
    
    // Clear message after 3 seconds
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      $('api-key-status').textContent = '';
    }, 3000);
  } else {
    // Some models inaccessible - show error and disable button
    await chrome.storage.local.set({ geminiApiKey: key, apiKeyValid: false });
    const errorMsg = 'Inaccessible models: ' + validationResult.inaccessibleModels.join(', ');
    showApiKeyStatus(errorMsg, 'error');
    updateGenerateButtonState(false);
  }
}

function showApiKeyStatus(message, type) {
  const el = $('api-key-status');
  el.textContent = message;
  el.className = `status-text ${type}`;
}

/* ── API Key Validation ──────────────────────────── */
async function validateApiKey(apiKey) {
  const models = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3-flash-preview'
  ];
  
  const results = await Promise.all(
    models.map(async (model) => {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`;
        const response = await fetch(url);
        return { model, accessible: response.ok };
      } catch (error) {
        return { model, accessible: false };
      }
    })
  );
  
  const inaccessibleModels = results
    .filter(r => !r.accessible)
    .map(r => r.model);
  
  return {
    allValid: inaccessibleModels.length === 0,
    inaccessibleModels
  };
}

/* ── Generate Button State ───────────────────────── */
function updateGenerateButtonState(isValid) {
  const btn = $('generate-btn');
  btn.disabled = !isValid;
  
  // Set title attribute for native tooltip when disabled
  if (!isValid) {
    btn.setAttribute('title', 'Please enter a valid API key.');
  } else {
    btn.removeAttribute('title');
  }
}

/* ── Model Selection ─────────────────────────────── */
async function saveModel() {
  await chrome.storage.local.set({ geminiModel: $('model-select').value });
}

/* ── Generate Cover Letter ───────────────────────── */
async function handleGenerate() {
  const btn = $('generate-btn');
  const spinner = $('btn-spinner');
  const btnText = $('btn-text');

  // Validate API key
  const { geminiApiKey, apiKeyValid } = await chrome.storage.local.get(['geminiApiKey', 'apiKeyValid']);
  if (!geminiApiKey || !apiKeyValid) {
    showStatus('Please save a valid Gemini API key in Settings first.', 'error');
    return;
  }

  // Disable button, show spinner
  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Generating…';
  showStatus('Scraping job details from SCOPE…');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    // Validate we're on a SCOPE page
    if (!tab.url || !tab.url.includes('scope.sciencecoop.ubc.ca')) {
      throw new Error('Please navigate to a SCOPE job posting page first.');
    }

    // Inject content script and scrape job details
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/scraper.js']
    });

    const jobData = result.result;
    if (!jobData || !jobData.jobDescription) {
      throw new Error('Could not extract job details. Make sure you are on a job posting page.');
    }

    showStatus(`Found: ${jobData.jobTitle} at ${jobData.companyName}. Calling Gemini…`);

    // Send to background worker for Gemini API call
    const model = $('model-select').value;
    const response = await chrome.runtime.sendMessage({
      action: 'generateCoverLetter',
      jobData,
      model,
      apiKey: geminiApiKey
    });

    if (response.error) {
      throw new Error(response.error);
    }

    showStatus('Cover letter generated! Opening preview…', 'success');

    // Open preview tab via background worker
    await chrome.runtime.sendMessage({
      action: 'openPreview',
      coverLetterBody: response.coverLetterBody,
      companyName: jobData.companyName,
      jobTitle: jobData.jobTitle
    });
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Generate Cover Letter';
  }
}

/* ── Status Helpers ──────────────────────────────── */
function showStatus(message, type = '') {
  const area = $('status-area');
  const msg = $('status-message');
  area.classList.remove('hidden');
  msg.textContent = message;
  msg.className = `status-text ${type}`;
}
