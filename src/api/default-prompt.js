/**
 * api/default-prompt.js — Default AI prompt.
 *
 * This prompt uses placeholders {companyName}, {jobTitle}, and {jobDescription}
 * that get replaced with actual values when generating the cover letter.
 */

export const DEFAULT_PROMPT = `Based on the following job description for {companyName} as a {jobTitle}, fill in the blanks for my cover letter. For the second body paragraph, choose one of the "Python/Developer", "Fullstack/Web/Javascript", or "Java/OOD/TDD" paragraphs that best fits this role.

--- COVER LETTER TEMPLATE ---
Dear Hiring Manager,

<Introductory paragraph expressing interest in the role and company, and a brief overview of qualifications.>

Python/Developer
<A Python/Developer project experience that demonstrates relevant skills and technologies. Use the STAR method and a connection to the company at the end of the paragraph.>

Fullstack/Web/Javascript
<A Fullstack/Web/Javascript project experience that demonstrates relevant skills and technologies. Use the STAR method and a connection to the company at the end of the paragraph.>

Java/OOD/TDD
<A Java/OOD/TDD project experience that demonstrates relevant skills and technologies. Use the STAR method and a connection to the company at the end of the paragraph.>

<Your soft skills, with examples, and connecting these skills to the company culture or values.>

<Closing paragraph reiterating interest and summarizing qualifications, with a call to action.>

Sincerely,
<Full Name>

--- JOB DESCRIPTION ---
{jobDescription}

IMPORTANT INSTRUCTIONS:
- Fill in ALL blanks indicated by angle brackets (< >) with appropriate content based on the job description.
- Choose exactly ONE of the skill paragraphs for the second body paragraph that best matches this role.
- Remove the paragraph labels (e.g., "Python/Developer", etc.) from the output.
- Remove ALL the other skill paragraphs that were not chosen.
- Output ONLY the final cover letter text with line breaks between paragraphs. Do NOT include any markdown formatting, labels, or extra commentary.`;
