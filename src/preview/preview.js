/**
 * preview/preview.js — Cover letter preview & edit page controller.
 *
 * Reads cover letter data from sessionStorage (set by the background worker),
 * renders the formatted letter, and handles PDF download via window.print().
 */

document.addEventListener('DOMContentLoaded', init);

function init() {
  loadCoverLetter();
  document.getElementById('download-btn').addEventListener('click', downloadPDF);
}

/**
 * Loads cover letter data from URL search params (passed from background worker)
 * and renders header + body + footer.
 */
function loadCoverLetter() {
  // Data is stored in chrome.storage.session by the background worker
  chrome.storage.session.get(['coverLetterData'], (result) => {
    const data = result.coverLetterData;
    if (!data) {
      document.getElementById('cl-body').textContent =
        'No cover letter data found. Please generate a cover letter from the extension popup.';
      return;
    }

    const { coverLetterBody, companyName, jobTitle } = data;

    renderHeader(companyName, jobTitle);
    renderBody(coverLetterBody);
    renderFooter();
  });
}

/**
 * Renders the letter header with company name, date, and job title.
 */
function renderHeader(companyName, jobTitle) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const header = document.getElementById('cl-header');
  header.innerHTML = [
    `<div>${companyName}</div>`,
    `<div>${dateStr}</div>`,
    `<div>Re: ${jobTitle}</div>`
  ].join('');
}

/**
 * Converts the AI-generated text (with line breaks) into formatted HTML paragraphs.
 */
function renderBody(bodyText) {
  const bodyEl = document.getElementById('cl-body');

  // Split on double line breaks to get paragraphs
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Build HTML paragraphs
  const html = paragraphs
    .map((p) => {
      // Preserve single line breaks within a paragraph
      const content = p.replace(/\n/g, '<br>');
      return `<p>${content}</p>`;
    })
    .join('');

  bodyEl.innerHTML = html;
}

/**
 * Sets the footer logo image source.
 */
function renderFooter() {
  const logo = document.getElementById('cl-footer-logo');
  logo.src = chrome.runtime.getURL('assets/science_coop_footer.png');
}

/**
 * Downloads the cover letter as a PDF using the browser's print dialog.
 */
function downloadPDF() {
  window.print();
}
