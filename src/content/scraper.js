/**
 * content/scraper.js — Content script injected into UBC Co-op job posting pages.
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
   * parseJobDetails — Extracts structured job data from a UBC Co-op posting page.
   */
  function parseJobDetails() {
    // Company Name
    const rawCompanyName =
      getValueFromPanel('ORGANIZATION INFORMATION', 'Organization') ||
      getValueFromPanel('ORGANIZATION INFORMATION', 'Company');
    // Remove parenthetical content and dash-separated suffixes
    const cleanCompanyName = rawCompanyName
      ? rawCompanyName.replace(/\s*\([^)]*\)/g, '').replace(/\s+-\s.*$/, '').trim()
      : null;

    // Job Title
    const rawJobTitle = getValueFromPanel('JOB POSTING INFORMATION', 'Job Title');
    // Remove parenthetical content and words containing numbers
    const cleanJobTitle = rawJobTitle
      ? rawJobTitle
          .replace(/\s*\([^)]*\)/g, '')
          .split(' ')
          .filter(w => !/\d/.test(w))
          .join(' ')
          .trim()
      : null;

    // Job Description
    const jobDescription = getValueFromPanel('JOB POSTING INFORMATION', 'Job Description');

    return {
      companyName: cleanCompanyName || 'Unknown Company',
      jobTitle: cleanJobTitle || 'Unknown Job Title',
      jobDescription: jobDescription || 'Unknown Job Description'
    };
  }

  // Execute and return the result to the caller
  return parseJobDetails();
})();
