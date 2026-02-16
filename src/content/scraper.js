/**
 * content/scraper.js — Content script injected into SCOPE job posting pages.
 *
 * Uses the parseJobDetails() logic from job_details_parser.js to extract
 * company name, job title, and job description from the DOM.
 *
 * This file is executed via chrome.scripting.executeScript() and returns
 * the extracted data as the script's result.
 */

(() => {
  /**
   * Finds a specific panel by its header text and extracts the value
   * from a row matching the given label.
   */
  function getValueFromPanel(panelHeaderText, rowLabelText) {
    const headings = Array.from(document.querySelectorAll('.panel-heading'));

    const targetHeading = headings.find(
      (el) => el.innerText.trim().toUpperCase() === panelHeaderText.toUpperCase()
    );

    if (!targetHeading) return null;

    const panel = targetHeading.closest('.panel');
    if (!panel) return null;

    const rows = Array.from(panel.querySelectorAll('tr'));
    const targetRow = rows.find((row) => {
      const labelCell = row.querySelector('td:first-child');
      return labelCell && labelCell.innerText.includes(rowLabelText);
    });

    if (!targetRow) return null;

    const valueCell = targetRow.querySelector('td:nth-child(2)');
    if (!valueCell) return null;

    return valueCell.innerText.trim();
  }

  /**
   * parseJobDetails — Extracts structured job data from a SCOPE posting page.
   * Mirrors the logic from job_details_parser.js.
   */
  function parseJobDetails() {
    // Company Name
    const companyName = getValueFromPanel('ORGANIZATION INFORMATION', 'Organization');

    // Job Title (cleaned: alphabetic words only)
    const rawJobTitle = getValueFromPanel('JOB POSTING INFORMATION', 'Job Title');
    let cleanJobTitle = '';
    if (rawJobTitle) {
      cleanJobTitle = rawJobTitle
        .split(/\s+/)
        .filter((word) => /^[a-zA-Z]+$/.test(word))
        .join(' ');
    }

    // Job Description
    const jobDescription = getValueFromPanel('JOB POSTING INFORMATION', 'Job Description');

    return {
      companyName: companyName || 'Unknown Company',
      jobTitle: cleanJobTitle || 'Unknown Title',
      jobDescription: jobDescription || ''
    };
  }

  // Execute and return the result to the caller
  return parseJobDetails();
})();
