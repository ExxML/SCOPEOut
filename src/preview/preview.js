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
 * and renders header + body + footer across multiple pages if needed.
 */
function loadCoverLetter() {
  // Data is stored in chrome.storage.session by the background worker
  chrome.storage.session.get(['coverLetterData'], (result) => {
    const data = result.coverLetterData;
    if (!data) {
      createSinglePage('No cover letter data found. Please generate a cover letter from the extension popup.');
      return;
    }

    const { coverLetterBody, companyName, jobTitle } = data;
    renderMultiPageLetter(companyName, jobTitle, coverLetterBody);
  });
}

/**
 * Creates a single page with error or placeholder content.
 */
function createSinglePage(message) {
  const container = document.getElementById('pages-container');
  const page = document.createElement('div');
  page.className = 'page';
  
  const body = document.createElement('section');
  body.className = 'cl-body';
  body.textContent = message;
  
  page.appendChild(body);
  container.appendChild(page);
}

/**
 * Renders the complete letter with automatic pagination.
 */
function renderMultiPageLetter(companyName, jobTitle, bodyText) {
  const container = document.getElementById('pages-container');
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create header HTML
  const headerHTML = [
    `<div>${companyName}</div>`,
    `<div>${dateStr}</div>`,
    `<div>Re: ${jobTitle}</div>`
  ].join('');

  // Parse body into paragraphs
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const content = p.replace(/\n/g, '<br>');
      return `<p>${content}</p>`;
    });

  // Create first page with header
  let currentPage = createPage();
  const header = document.createElement('header');
  header.className = 'cl-header';
  header.contentEditable = 'true';
  header.innerHTML = headerHTML;
  currentPage.appendChild(header);

  const body = document.createElement('section');
  body.className = 'cl-body';
  body.contentEditable = 'true';
  currentPage.appendChild(body);

  container.appendChild(currentPage);

  // Add paragraphs, creating new pages as needed
  for (const paraHTML of paragraphs) {
    const tempP = document.createElement('div');
    tempP.innerHTML = paraHTML;
    const para = tempP.firstChild;
    body.appendChild(para);

    // Check if content overflows current page
    if (currentPage.scrollHeight > currentPage.clientHeight) {
      // Remove the paragraph that caused overflow
      body.removeChild(para);

      // Add footer to current page
      addFooter(currentPage);

      // Create new page
      currentPage = createPage();
      const newBody = document.createElement('section');
      newBody.className = 'cl-body';
      newBody.contentEditable = 'true';
      currentPage.appendChild(newBody);
      container.appendChild(currentPage);

      // Add the paragraph to new page
      newBody.appendChild(para);
      body = newBody;
    }
  }

  // Add footer to last page
  addFooter(currentPage);
}

/**
 * Creates a new page element.
 */
function createPage() {
  const page = document.createElement('div');
  page.className = 'page';
  return page;
}

/**
 * Adds footer with logo to a page.
 */
function addFooter(page) {
  const footer = document.createElement('footer');
  footer.className = 'cl-footer';
  const logo = document.createElement('img');
  logo.src = chrome.runtime.getURL('assets/science_coop_footer.png');
  logo.alt = 'UBC Science Co-op';
  footer.appendChild(logo);
  page.appendChild(footer);
}

/**
 * Downloads the cover letter as a PDF using the browser's print dialog.
 */
function downloadPDF() {
  window.print();
}
