# SCOPEOut

A Chrome browser extension that generates AI-powered cover letters from [UBC Science Co-op SCOPE](https://scope.sciencecoop.ubc.ca) job postings using the Google Gemini API.

## Features

- **One-click generation** — scrapes company name, job title & description directly from any SCOPE job posting page
- **Model selection** — choose between Gemini 2.5 Flash Lite, Gemini 2.5 Flash, or Gemini 3 Flash
- **Smart paragraph selection** — AI picks the best skill paragraph (Data/R, Python, Full-Stack, Java/OOD, or IT) based on the role
- **Live preview & edit** — opens a clean, editable cover letter preview in a new tab
- **PDF download** — one-click PDF export via the browser print dialog

## Project Structure

```
src/
├── manifest.json              # Chrome extension manifest (MV3)
├── icons/                     # Extension icons (16, 48, 128 px)
├── assets/
│   └── science_coop_footer.png
├── popup/                     # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                   # Content script injected into SCOPE pages
│   └── scraper.js
├── api/                       # Gemini API client & cover letter template
│   ├── gemini.js
│   └── cover-letter-template.js
├── background/                # Background service worker
│   └── service-worker.js
└── preview/                   # Cover letter preview/edit page
    ├── preview.html
    ├── preview.css
    └── preview.js
```

## Installation

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `src/` folder.
5. The SCOPEOut icon will appear in your toolbar.

## Usage

1. Navigate to a job posting on [SCOPE](https://scope.sciencecoop.ubc.ca).
2. Click the **SCOPEOut** extension icon.
3. Open **Settings** and enter your [Gemini API key](https://aistudio.google.com/apikey) (saved locally, only needs to be done once).
4. Choose a Gemini model from the dropdown.
5. Click **Generate Cover Letter**.
6. Review and edit the cover letter in the preview tab that opens.
7. Click **Download PDF** (top-right) to save as PDF.

## Requirements

- Google Chrome (or any Chromium-based browser)
- A valid [Google Gemini API key](https://aistudio.google.com/apikey)
