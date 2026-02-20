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
  document.getElementById('prompt-textarea').addEventListener('input', handlePromptChange);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      savePrompt();
    }
  });
}

/**
 * Handles changes to the prompt textarea.
 */
function handlePromptChange() {
  const textarea = document.getElementById('prompt-textarea');
  const currentContent = textarea.value;
  
  hasUnsavedChanges = currentContent !== savedPromptContent;
  updateTabTitle();
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
