/**
 * preview/preview.js — Cover letter preview & edit page controller.
 *
 * Reads cover letter data from sessionStorage (set by the background worker),
 * renders the formatted letter, and handles PDF download via window.print().
 */

document.addEventListener('DOMContentLoaded', init);

let currentFooterType = 'none';

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
    document.title = `${companyName} Cover Letter`;
    chrome.storage.local.get(['coopFooterType', 'includeCoopFooter'], (localResult) => {
      // Migrate legacy includeCoopFooter boolean to coopFooterType string
      const footerType = localResult.coopFooterType
        ?? (localResult.includeCoopFooter === false ? 'none' : 'science');
      currentFooterType = footerType;
      renderMultiPageLetter(companyName, jobTitle, coverLetterBody, footerType);
    });
  });
}

/**
 * Creates a single page with error or placeholder content.
 */
function createSinglePage(message) {
  const container = document.getElementById('pages-container');
  const { wrapper, page } = createPage();

  const body = document.createElement('section');
  body.className = 'cl-body';
  body.textContent = message;

  page.appendChild(body);
  container.appendChild(wrapper);
  updatePageControls(container);
}

/**
 * Renders the complete letter with automatic pagination.
 */
async function renderMultiPageLetter(companyName, jobTitle, bodyText, footerType) {
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
      const content = linkifyText(p.replace(/\n/g, '<br>'));
      return `<p>${content}</p>`;
    });

  // Create first page with header
  let { wrapper: currentWrapper, page: currentPage } = createPage();
  const header = document.createElement('header');
  header.className = 'cl-header';
  header.contentEditable = 'true';
  header.innerHTML = headerHTML;
  currentPage.appendChild(header);

  let body = document.createElement('section');
  body.className = 'cl-body';
  body.contentEditable = 'true';
  currentPage.appendChild(body);
  if (footerType !== 'none') await addFooter(currentPage, footerType);

  container.appendChild(currentWrapper);

  // Add paragraphs, creating new pages as needed
  for (const paraHTML of paragraphs) {
    const tempP = document.createElement('div');
    tempP.innerHTML = paraHTML;
    const para = tempP.firstChild;
    body.appendChild(para);

    // Check if content overflows current page (body padding reserves footer space)
    if (currentPage.scrollHeight > currentPage.clientHeight) {
      // Remove the paragraph that caused overflow
      body.removeChild(para);

      // Create new page with footer pre-added
      const next = createPage();
      currentWrapper = next.wrapper;
      currentPage = next.page;
      const newBody = document.createElement('section');
      newBody.className = 'cl-body';
      newBody.contentEditable = 'true';
      currentPage.appendChild(newBody);
      if (footerType !== 'none') await addFooter(currentPage, footerType);
      container.appendChild(currentWrapper);

      // Add the paragraph to new page
      newBody.appendChild(para);
      body = newBody;
    }
  }

  updatePageControls(container);
}

/**
 * Creates a new page element wrapped in a page-wrapper div.
 * Returns { wrapper, page }.
 */
function createPage() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  const page = document.createElement('div');
  page.className = 'page';
  wrapper.appendChild(page);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-page-btn';
  removeBtn.title = 'Remove this page';
  removeBtn.textContent = '✕';
  wrapper.appendChild(removeBtn);

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = wrapper.querySelector('.remove-confirm');
    if (existing) { existing.remove(); return; }

    const tooltip = document.createElement('div');
    tooltip.className = 'remove-confirm';
    tooltip.innerHTML = `
      <span class="remove-confirm-text">Remove this page?</span>
      <button class="remove-confirm-yes">Confirm</button>
      <button class="remove-confirm-no">Cancel</button>
    `;
    wrapper.appendChild(tooltip);

    tooltip.querySelector('.remove-confirm-yes').addEventListener('click', () => {
      const container = document.getElementById('pages-container');
      wrapper.remove();
      updatePageControls(container);
    });
    tooltip.querySelector('.remove-confirm-no').addEventListener('click', () => tooltip.remove());

    // Click outside to dismiss
    const dismiss = (ev) => {
      if (!tooltip.contains(ev.target) && ev.target !== removeBtn) {
        tooltip.remove();
        document.removeEventListener('click', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  });

  return { wrapper, page };
}

/**
 * Refreshes remove-button visibility (hidden when only 1 page) and
 * ensures exactly one add-page strip exists at the bottom.
 */
function updatePageControls(container) {
  const wrappers = container.querySelectorAll('.page-wrapper');

  // Show/hide remove buttons based on page count
  wrappers.forEach((w) => {
    const btn = w.querySelector('.remove-page-btn');
    if (btn) btn.style.display = wrappers.length === 1 ? 'none' : '';
  });

  // Remove existing strip, re-add after last wrapper
  const existingStrip = container.querySelector('.add-page-strip');
  if (existingStrip) existingStrip.remove();
  container.appendChild(buildAddPageStrip());
}

/**
 * Builds the "+ Add Page" strip element.
 */
function buildAddPageStrip() {
  const strip = document.createElement('div');
  strip.className = 'add-page-strip';

  const label = document.createElement('span');
  label.className = 'add-page-label';
  label.innerHTML = '+ Add Page';
  strip.appendChild(label);

  strip.addEventListener('click', async () => {
    const container = document.getElementById('pages-container');
    const { wrapper, page } = createPage();
    const body = document.createElement('section');
    body.className = 'cl-body';
    body.contentEditable = 'true';
    page.appendChild(body);
    if (currentFooterType !== 'none') await addFooter(page, currentFooterType);

    // Insert wrapper before the strip
    const strip = container.querySelector('.add-page-strip');
    container.insertBefore(wrapper, strip);
    updatePageControls(container);
  });

  return strip;
}

/**
 * Adds footer with logo to a page.
 * Returns a Promise that resolves once the footer image has loaded and
 * body padding has been applied to prevent text from running into the footer.
 */
function addFooter(page, footerType) {
  const footer = document.createElement('footer');
  footer.className = footerType === 'eng' ? 'cl-footer--eng' : 'cl-footer--science';
  const logo = document.createElement('img');
  if (footerType === 'eng') {
    logo.src = chrome.runtime.getURL('assets/eng_coop_footer.png');
    logo.alt = 'UBC Engineering Co-op';
  } else {
    logo.src = chrome.runtime.getURL('assets/science_coop_footer.png');
    logo.alt = 'UBC Science Co-op';
  }
  footer.appendChild(logo);
  page.appendChild(footer);

  return new Promise((resolve) => {
    if (logo.complete && logo.naturalHeight > 0) {
      resolve();
    } else {
      logo.addEventListener('load', resolve, { once: true });
      logo.addEventListener('error', resolve, { once: true });
    }
  });
}

/**
 * Wraps plain-text links in the given HTML string with anchor tags.
 * Handles:
 *   - Email addresses (e.g. user@example.com) → mailto: link
 *   - Domains with common TLDs (e.g. example.com, → target="_blank" link
 *     sciencecoop.ubc.ca, www.example.com,
 *     https://example.com/path)
 *
 * Email is tested first so "user@example.com" is never partially matched
 * as a bare domain.
 */
function linkifyText(html) {
  const pattern = new RegExp(
    // 1. Email address
    '([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})' +
    // 2. Domain with optional scheme/www prefix and common TLD
    '|([a-zA-Z0-9][a-zA-Z0-9.\\-]*' +
      '\\.(?:com|ca|org|net|edu|gov|io|co|uk|us|au|nz|de|fr|jp|cn|info|biz|me|app|dev|tech)' +
      '(?:\\/[^\\s<>"\']*)?)',
    'g'
  );

  return html.replace(pattern, (match, email, domain) => {
    if (email)  return `<a href="mailto:${email}">${email}</a>`;
    if (domain) {
      const href = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
      return `<a href="${href}" target="_blank">${domain}</a>`;
    }
    return match;
  });
}

/**
 * Downloads the cover letter as a PDF using the browser's print dialog.
 */
function downloadPDF() {
  window.print();
}
