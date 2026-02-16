/**
 * prompt-editor/prompt-editor.js — Prompt editor controller.
 *
 * Allows users to edit the AI prompt with placeholders like
 * {companyName}, {jobTitle}, and {jobDescription}.
 */

import { DEFAULT_PROMPT } from '../api/default-prompt.js';

document.addEventListener('DOMContentLoaded', init);

function init() {
  loadPrompt();
  document.getElementById('save-btn').addEventListener('click', savePrompt);
  document.getElementById('restore-btn').addEventListener('click', restoreDefaultPrompt);
}

/**
 * Loads the saved prompt from storage or uses the default.
 */
async function loadPrompt() {
  const textarea = document.getElementById('prompt-textarea');
  
  const { prompt } = await chrome.storage.local.get('prompt');
  
  if (prompt) {
    textarea.value = prompt;
  } else {
    // Set default prompt
    textarea.value = DEFAULT_PROMPT;
  }
}

/**
 * Saves the current prompt to storage.
 */
async function savePrompt() {
  const textarea = document.getElementById('prompt-textarea');
  const saveBtn = document.getElementById('save-btn');
  const promptText = textarea.value.trim();
  
  if (!promptText) {
    alert('Prompt cannot be empty.');
    return;
  }
  
  await chrome.storage.local.set({ prompt: promptText });
  
  // Visual feedback
  saveBtn.textContent = '✓ Prompt Saved';
  saveBtn.classList.add('saved');
  
  setTimeout(() => {
    saveBtn.textContent = 'Save Prompt';
    saveBtn.classList.remove('saved');
  }, 2000);
}

/**
 * Restores the default prompt.
 */
function restoreDefaultPrompt() {
  if (confirm('Are you sure you want to restore the default prompt? This will overwrite your current prompt.')) {
    const textarea = document.getElementById('prompt-textarea');
    textarea.value = DEFAULT_PROMPT;
  }
}
