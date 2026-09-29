/**
 * popup.js — SCOPEOut extension popup controller.
 *
 * Handles UI interactions: settings, model selection, and triggering
 * cover letter generation via the background service worker.
 */

import { listTextModels } from '../api/gemini.js';

document.addEventListener('DOMContentLoaded', init);

/* ── DOM References ──────────────────────────────── */
const $ = (id) => document.getElementById(id);

/* ── Initialisation ──────────────────────────────── */
async function init() {
  // Restore persisted state
  const stored = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'geminiModels', 'apiKeyValid', 'coopFooterType', 'includeCoopFooter']);
  if (stored.geminiApiKey) {
    $('api-key-input').value = stored.geminiApiKey;
  }
  populateModelSelect(stored.geminiModels || [], stored.geminiModel);
  // Migrate legacy includeCoopFooter boolean to coopFooterType string
  if (stored.coopFooterType) {
    $('coop-footer-select').value = stored.coopFooterType;
  } else if (stored.includeCoopFooter === false) {
    $('coop-footer-select').value = 'none';
  } else {
    $('coop-footer-select').value = 'science';
  }

  // Update generate button state based on API key validity
  updateGenerateButtonState(stored.apiKeyValid);

  // Refresh the cached model list in the background
  if (stored.geminiApiKey && stored.apiKeyValid) {
    refreshModels(stored.geminiApiKey);
  }

  // Bind events
  $('settings-toggle').addEventListener('click', toggleSettings);
  $('toggle-password').addEventListener('click', togglePasswordVisibility);
  $('save-api-key').addEventListener('click', saveApiKey);
  $('edit-prompt-btn').addEventListener('click', openPromptEditor);
  $('model-select').addEventListener('change', saveModel);
  $('coop-footer-select').addEventListener('change', () => {
    chrome.storage.local.set({ coopFooterType: $('coop-footer-select').value });
  });
  $('generate-btn').addEventListener('click', handleGenerate);
  $('confirm-continue-btn').addEventListener('click', handleConfirmContinue);
  $('confirm-cancel-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'cancelGeneration' });
  });
  $('api-info-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://aistudio.google.com/welcome' });
  });

  // Restore generation state from background and listen for changes
  await restoreGenerationState();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.generationState && 'newValue' in changes.generationState) {
      handleGenerationStateChange(changes.generationState.newValue);
    }
  });
}

/* ── Settings Panel ──────────────────────────────── */
function toggleSettings() {
  const panel = $('settings-panel');
  const arrow = $('settings-arrow');
  const isClosed = panel.classList.contains('closed');
  
  if (isClosed) {
    // Opening: remove closed class to trigger slide-in animation
    panel.classList.remove('closed');
    arrow.classList.add('open');
  } else {
    // Closing: add closed class to trigger slide-out animation
    panel.classList.add('closed');
    arrow.classList.remove('open');
  }
}

/* ── Prompt Editor ───────────────────────────────── */
function openPromptEditor() {
  chrome.tabs.create({ url: chrome.runtime.getURL('prompt-editor/prompt-editor.html') });
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
  
  // Validate API key by fetching its available models
  try {
    const models = await listTextModels(key);

    // Key valid - save key and models, then show success
    await chrome.storage.local.set({ geminiApiKey: key, apiKeyValid: true, geminiModels: models });
    populateModelSelect(models, $('model-select').value);
    showApiKeyStatus('API key saved.', 'success');
    updateGenerateButtonState(true);
    
    // Clear message after a delay
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      $('api-key-status').textContent = '';
    }, 2000);
  } catch (err) {
    // Key invalid - show error and disable button
    await chrome.storage.local.set({ geminiApiKey: key, apiKeyValid: false });
    showApiKeyStatus(err.message, 'error');
    updateGenerateButtonState(false);
  }
}

function showApiKeyStatus(message, type) {
  const el = $('api-key-status');
  el.textContent = message;
  el.className = `status-text ${type}`;
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
function populateModelSelect(models, selectedId) {
  if (models.length === 0) return;

  const select = $('model-select');
  select.replaceChildren(...models.map(({ id, displayName }) => new Option(displayName, id)));
  // Fall back to the first model if the selected one is no longer available
  select.value = models.some(({ id }) => id === selectedId) ? selectedId : models[0].id;
}

async function refreshModels(apiKey) {
  try {
    const models = await listTextModels(apiKey);
    await chrome.storage.local.set({ geminiModels: models });
    populateModelSelect(models, $('model-select').value);
  } catch {
    // Keep the cached list if the refresh fails
  }
}

async function saveModel() {
  await chrome.storage.local.set({ geminiModel: $('model-select').value });
}

/* ── Generation State Persistence ────────────────── */
async function restoreGenerationState() {
  const { generationState } = await chrome.storage.session.get('generationState');
  if (generationState) {
    handleGenerationStateChange(generationState);
  }
}

async function handleGenerationStateChange(state) {
  const btn = $('generate-btn');
  const spinner = $('btn-spinner');
  const btnText = $('btn-text');
  $('confirm-actions').classList.toggle('hidden', state?.status !== 'confirm');

  if (!state || state.status === 'idle') {
    isGenerating = false;
    const { apiKeyValid } = await chrome.storage.local.get('apiKeyValid');
    updateGenerateButtonState(apiKeyValid);
    spinner.classList.add('hidden');
    btnText.textContent = 'Generate cover letter';
    $('status-area').classList.add('hidden');
    return;
  }

  if (state.status === 'generating') {
    isGenerating = true;
    btn.disabled = false;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Cancel';
    showStatus(state.message);
    return;
  }

  // Awaiting confirmation: keep state so it persists across popup reopens
  if (state.status === 'confirm') {
    isGenerating = false;
    btn.disabled = true;
    spinner.classList.add('hidden');
    btnText.textContent = 'Generate cover letter';
    showStatus(state.message, 'warning');
    return;
  }

  // Complete or error: show message and reset button
  isGenerating = false;
  if (state.status === 'complete') {
    showStatus(state.message, 'success');
  } else if (state.status === 'error') {
    showStatus(state.message, 'error');
  }

  const { apiKeyValid } = await chrome.storage.local.get('apiKeyValid');
  updateGenerateButtonState(apiKeyValid);
  spinner.classList.add('hidden');
  btnText.textContent = 'Generate cover letter';
  await chrome.storage.session.remove('generationState');
}

/* ── Cover Letter Generation ───────────────────────── */
let isGenerating = false;

async function handleGenerate() {
  // If currently generating, cancel instead
  if (isGenerating) {
    chrome.runtime.sendMessage({ action: 'cancelGeneration' });
    return;
  }

  const btn = $('generate-btn');
  const spinner = $('btn-spinner');
  const btnText = $('btn-text');

  // Validate API key
  const { geminiApiKey, apiKeyValid } = await chrome.storage.local.get(['geminiApiKey', 'apiKeyValid']);
  if (!geminiApiKey || !apiKeyValid) {
    showStatus('Please save a valid Gemini API key in Settings first.', 'error');
    return;
  }

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    // Show generating state
    isGenerating = true;
    btn.disabled = false;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Cancel';
    showStatus('Extracting job details…');

    // Hand off to background service worker (fire-and-forget)
    const model = $('model-select').value;
    chrome.runtime.sendMessage({
      action: 'startGeneration',
      tabId: tab.id,
      model,
      apiKey: geminiApiKey
    });
  } catch (err) {
    showStatus(err.message, 'error');
    isGenerating = false;
  }
}

// Resumes a paused generation with the already-scraped job data
async function handleConfirmContinue() {
  const { generationState } = await chrome.storage.session.get('generationState');
  if (generationState?.status !== 'confirm') return;

  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const { jobData, model } = generationState;
  chrome.runtime.sendMessage({ action: 'startGeneration', model, apiKey: geminiApiKey, jobData });
}

/* ── Status Helpers ──────────────────────────────── */
function showStatus(message, type = '') {
  const area = $('status-area');
  const msg = $('status-message');
  area.classList.remove('hidden');
  msg.textContent = message;
  msg.className = `status-text ${type}`;
}
