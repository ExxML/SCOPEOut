/**
 * prompt-editor/prompt-editor.js — Prompt editor controller.
 *
 * Allows users to edit the AI prompt with placeholders like
 * {companyName}, {jobTitle}, and {jobDescription}.
 */

import { DEFAULT_PROMPT } from '../api/default-prompt.js';

// Track unsaved changes
let hasUnsavedChanges = false;
let savedPromptContent = '';

document.addEventListener('DOMContentLoaded', init);

function init() {
  loadPrompt();
  document.getElementById('save-btn').addEventListener('click', savePrompt);
  document.getElementById('restore-btn').addEventListener('click', restoreDefaultPrompt);
  const textarea = document.getElementById('prompt-textarea');
  textarea.addEventListener('input', handlePromptChange);
  textarea.addEventListener('scroll', () => {
    document.getElementById('prompt-highlight').scrollTop = textarea.scrollTop;
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      savePrompt();
    }
  });
}

const KNOWN_PLACEHOLDERS = new Set(['companyName', 'jobTitle', 'jobDescription']);

function updateWarning(text) {
  const unusedPlaceholders = [...KNOWN_PLACEHOLDERS].filter(p => !text.includes(`{${p}}`));
  const warning = document.getElementById('placeholder-warning');
  const span = document.getElementById('unused-placeholders');
  if (unusedPlaceholders.length) {
    span.innerHTML = unusedPlaceholders.map(p => `- {${p}}`).join('<br>');
    warning.hidden = false;
  } else {
    warning.hidden = true;
  }
}

function updateHighlight() {
  const textarea = document.getElementById('prompt-textarea');
  const highlight = document.getElementById('prompt-highlight');
  const escaped = textarea.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = escaped.replace(/\{(\w+)\}/g, (match, name) =>
    KNOWN_PLACEHOLDERS.has(name) ? `<mark>${match}</mark>` : match
  );
  highlight.innerHTML = html + '\n';
  highlight.scrollTop = textarea.scrollTop;
  updateWarning(textarea.value);
}

/**
 * Handles changes to the prompt textarea.
 */
function handlePromptChange() {
  const textarea = document.getElementById('prompt-textarea');
  const currentContent = textarea.value;

  hasUnsavedChanges = currentContent !== savedPromptContent;
  updateTabTitle();
  updateHighlight();
}

/**
 * Updates the tab title based on unsaved changes.
 */
function updateTabTitle() {
  if (hasUnsavedChanges) {
    document.title = 'Prompt Editor (*)';
  } else {
    document.title = 'Prompt Editor';
  }
}

/**
 * Loads the saved prompt from storage or uses the default.
 */
async function loadPrompt() {
  const textarea = document.getElementById('prompt-textarea');
  
  const { prompt } = await chrome.storage.local.get('prompt');
  
  if (prompt) {
    textarea.value = prompt;
    savedPromptContent = prompt;
  } else {
    // Set default prompt
    textarea.value = DEFAULT_PROMPT;
    savedPromptContent = DEFAULT_PROMPT;
  }
  
  hasUnsavedChanges = false;
  updateTabTitle();
  updateHighlight();
}

/**
 * Saves the current prompt to storage.
 */
let savePromptTimeout = null;

async function savePrompt() {
  const textarea = document.getElementById('prompt-textarea');
  const saveBtn = document.getElementById('save-btn');
  const promptText = textarea.value.trim();
  
  if (!promptText) {
    alert('Prompt cannot be empty.');
    return;
  }
  
  await chrome.storage.local.set({ prompt: promptText });
  
  // Update saved content and reset unsaved changes flag
  savedPromptContent = promptText;
  hasUnsavedChanges = false;
  updateTabTitle();
  
  // Visual feedback - restart timeout if already running
  saveBtn.textContent = '✓ Prompt Saved';
  saveBtn.classList.add('saved');
  
  clearTimeout(savePromptTimeout);
  savePromptTimeout = setTimeout(() => {
    saveBtn.textContent = 'Save Prompt';
    saveBtn.classList.remove('saved');
    savePromptTimeout = null;
  }, 2000);
}

/**
 * Restores the default prompt.
 */
function restoreDefaultPrompt() {
  if (confirm('Are you sure you want to restore the default prompt? This will overwrite your current prompt.')) {
    const textarea = document.getElementById('prompt-textarea');
    textarea.value = DEFAULT_PROMPT;
    
    // Trigger change detection
    handlePromptChange();
  }
}

/**
 * Warns the user before closing if there are unsaved changes.
 */
window.addEventListener('beforeunload', (event) => {
  if (hasUnsavedChanges) {
    event.preventDefault();
    event.returnValue = ''; // Chrome requires a returnValue
  }
});
