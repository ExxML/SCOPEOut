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
  $('edit-prompt-btn').addEventListener('click', openPromptEditor);
  $('model-select').addEventListener('change', saveModel);
  $('generate-btn').addEventListener('click', handleGenerate);
  $('api-info-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://aistudio.google.com/welcome' });
  });

  // Restore generation state from background and listen for changes
  await restoreGenerationState();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.generationState) {
      handleGenerationStateChange(changes.generationState.newValue);
    }
  });
}

/* ── Settings Panel ──────────────────────────────── */
function toggleSettings() {
  const panel = $('settings-panel');
  const arrow = $('settings-arrow');
  panel.classList.toggle('hidden');
  arrow.classList.toggle('open');
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
  
  // Validate API key with all models
  const validationResult = await validateApiKey(key);
  
  if (validationResult.allValid) {
    // All models accessible - save key and show success
    await chrome.storage.local.set({ geminiApiKey: key, apiKeyValid: true });
    showApiKeyStatus('API key saved.', 'success');
    updateGenerateButtonState(true);
    
    // Clear message after a delay
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      $('api-key-status').textContent = '';
    }, 2000);
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
  const modelSelect = $('model-select');
  const models = Array.from(modelSelect.options).map(option => option.value);
  
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

  if (!state || state.status === 'idle') {
    const { apiKeyValid } = await chrome.storage.local.get('apiKeyValid');
    updateGenerateButtonState(apiKeyValid);
    spinner.classList.add('hidden');
    btnText.textContent = 'Generate Cover Letter';
    return;
  }

  if (state.status === 'generating') {
    btn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Generating…';
    showStatus(state.message);
    return;
  }

  // Complete or error: show message and reset button
  if (state.status === 'complete') {
    showStatus(state.message, 'success');
  } else if (state.status === 'error') {
    showStatus(state.message, 'error');
  }

  const { apiKeyValid } = await chrome.storage.local.get('apiKeyValid');
  updateGenerateButtonState(apiKeyValid);
  spinner.classList.add('hidden');
  btnText.textContent = 'Generate Cover Letter';
  await chrome.storage.session.remove('generationState');
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

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    // Validate we're on a SCOPE page
    // if (!tab.url || !tab.url.includes('scope.sciencecoop.ubc.ca')) {
    //   throw new Error('Please navigate to a SCOPE job posting page first.');
    // }

    // Disable button, show spinner
    btn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Generating…';
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
