# CV Studio

A personal CV application for English and German applications. It runs on your computer and saves data inside this folder.

## Install from GitHub

Install Node.js 22.18 or newer, then run:

    git clone https://github.com/rohanvan19/cv_generator.git
    cd cv_generator
    npm ci
    npm run build
    npm start

Open http://127.0.0.1:4310 in your browser. On later launches, use **npm start** or the Windows launchers below.

Saved CVs, candidate photos, backups, API keys, logs, dependencies and build output are local files excluded from this repository. The app starts with an empty workspace on a new computer. Optional AI setup is described below; the editor and PDF export work without API credentials.

## Open the app

Double-click **Start CV Studio.vbs**. Your browser opens at http://127.0.0.1:4310.

- **Restart CV Studio.vbs** restarts the app after changing AI settings.
- **Stop CV Studio.vbs** stops the local app server.
- Keep this folder intact. The app requires Node.js 22.18 or newer.

If Windows disables VBScript, run `node scripts/launch.mjs` from this folder. The app can also be started with `npm start`.

## Create your CV

1. Enter your master profile. Personal details include date of birth and up to 20 optional custom fields with separate English and German titles and values. Other sections cover professional summary, experience, internships, education, certifications, projects, grouped skills, languages, and interests. Professional Experience entries can be marked Full-time, Part-time, or Internship; the selected type appears inline with the role in the PDF. Skill groups use separate Category and Skills / tools fields, such as Programming - Python, C++.
2. Add a JPG/PNG portrait (up to 8 MB), then crop and position it. The image is resized locally and placed at the top right of the PDF. You can hide it for any application.
3. Use **Editing content in** to enter or review English and German versions. The separate language selector above the preview controls the exported CV language. The EN/DE selector in the top bar controls the interface language.
4. Create an application with a company and role. The app copies your master profile into an independent draft. Later master-profile changes do not overwrite old applications. Use **Duplicate** on an application card or **Duplicate application** inside a draft to reuse its CV, layout and cover-letter text for a new company and role. Copies start as Draft and remain independent. The trash icon on each card asks for confirmation before deleting that application.
5. Choose which entries to include and edit the content for your application. Use **Typography** beside the live preview to choose Modern Inter, Clean Arial, or Classic Times and a base size from 8–12 pt. Use **Arrange** and drag the section handles to reorder complete CV sections. Keyboard arrow keys are also available on the focused handle; typography and section order are saved independently for the master profile and each application. Entries within work experience, internships, education and certificates appear most recent first.
6. Expand **Signature**, enable a signature image, upload a PNG/JPG, and adjust its size from 25% to 200%. Your signature image appears at the end of the CV without repeating your typed name. Each profile/application keeps its own signature settings. Review the actual generated PDF in the preview. Add your name to enable **Download PDF**.

The PDF has embedded fonts, selectable text, a narrow dates column, a wide details column, readable spaced birth dates, inline employment types, compact two-column languages, clickable web links, automatic wrapping, page breaks, and page numbers. The live preview uses the same renderer as the downloaded PDF. Long CVs continue onto additional A4 pages; compact mode reduces the selected base size by 1 pt without silently deleting content.

## Internships

Use the **Internships** tab (**Praktika** in German) to add internship roles, organizations, locations, dates and responsibilities/achievements. Each text field supports English and German. Entries can be included or excluded and deleted like other entries. The separate PDF section appears only when it has included entries, is sorted most recent first, and can be moved using **Arrange**. Existing section orders receive Internships after Professional Experience while retaining the order of other sections. Existing experience entries are kept in their current section.

Internships are copied into new application drafts and included in translation.

CV sections use paired headers with a full-width panel for the active section. Click a heading or chevron to expand the fields. Drag a grip onto another header to swap their positions, or focus the grip and use arrow keys (Home/End select the first/last position). Escape cancels a drag. Each profile/application saves its own editor layout; PDF section order remains controlled by **Arrange**. Edit **CV document heading** under **Personal details** for each language; leave it blank to hide the heading.

## Custom sections

Use **Add custom section** above the expandable editor sections to create sections such as Volunteering, Research, or Leadership. Enter a heading in English, German, or both. Each section has the same entry fields as Professional Experience: title/role, organization, location, employment type, dates, ongoing status, and responsibilities/achievements. You can create up to 20 custom sections with up to 60 entries each.

Edit the heading using **Section title** and the content language selector. Hide an entire section or individual entries, or delete a section and its entries after confirmation. Use **Arrange** beside the preview to place sections anywhere in the CV; **Reset order** puts custom sections after the built-in sections. Included entries appear newest first, and empty or hidden sections do not appear in the PDF.

Custom sections are saved in workspace backups, copied independently into application drafts, and included in translation. Their headings and entry text support English and German.

## English and German

CV headings and interface labels are provided in both languages. User-written descriptions have separate English and German fields. A missing translation temporarily falls back to the other language and is clearly flagged above the PDF preview. Automatic natural-language translation requires the optional AI connection below; switching a language selector alone does not translate arbitrary prose.

## Optional AI assistance

The profile editor, saved applications, photo tools and PDF generation work without AI. Open **Settings & backup**, choose **Automatic**, **Ollama · local**, or **OpenAI**, and use **Test connection**. Automatic mode prefers a reachable local Ollama model before OpenAI.

### Local Ollama

1. Install and start Ollama on this computer.
2. Install a model with: ollama pull MODEL_NAME
3. In CV Studio, choose **Ollama · local**, select the detected model, and test the connection. The first request can take several minutes while Ollama loads the model.

CV Studio discovers models through Ollama's local /api/tags endpoint and requests schema-constrained output through /api/chat. The default address is http://127.0.0.1:11434; it can be changed with OLLAMA_BASE_URL in .env, but CV Studio accepts only localhost addresses. OLLAMA_MODEL can set a default model. With Ollama, profile text, company and role stay on this computer and are sent only to the local Ollama service.

### OpenAI

1. Copy .env.example to .env in this folder.
2. Fill in OPENAI_API_KEY with your OpenAI API key.
3. Keep OPENAI_MODEL=gpt-4.1-mini, or choose another Responses API model that supports structured outputs.
4. Double-click **Restart CV Studio.vbs**.

OpenAI API usage is billed separately. Keys stay on the local server and are not included in browser code or exported workspace backups.

For either provider, AI is used only for translation and cover letters. Profile text is sent only when you request AI assistance. Photo bytes, name, email, phone, street address and links are excluded. Translation includes city/country and the titles and values of custom personal fields. Cover letters use the company, role and included CV content, without changing the CV itself. Review and accept generated text before it is applied. If you edit the source profile while a request is running, the older result cannot overwrite your newer edits.

Ollama API references:
- https://docs.ollama.com/api/tags
- https://docs.ollama.com/api/chat
- https://docs.ollama.com/capabilities/structured-outputs

OpenAI structured outputs:
- https://developers.openai.com/api/docs/guides/structured-outputs
## Translating a completed CV

Choose **Deutsch** under **Translate into**, then click **Translate into German** on the master profile or the specific application draft. Translation reads the English source for every populated bilingual field, including role and project titles, education, university/school names, entry locations, personal city/country, certifications, skill categories and names, language names, interests, and custom personal fields. Existing school/organization and location strings migrate to bilingual fields while preserving the original text. These fields can also be edited directly using the content language selector. Existing German text is refreshed from the English source. Fields with no English source are kept. Proper names and technical names such as Python can remain the same.

The model translates small batches, retries missing or invalid fields once, and reports incomplete translation instead of silently returning only part of the CV. Translation preserves all bullet points. Review shows the source, current German text and proposed German text even while the editor is in English. Accept individual fields or **Accept all**, then **Apply accepted**. Only accepted German fields are saved. Select **DE** as the CV language in the preview to view or download them. The editor language switches to the accepted translation language. Switching preview language alone displays stored translations, falling back to source text where translations are missing; it does not call the model.

## Cover letters

The **Cover letter** sidebar tab provides a separate German letter template. Enter your name, street address, postal code/PIN, city, country, phone number and email; then the company name, person/team, street address, postal code/PIN, city and country. Add the date and application subject. The letter saves automatically with your workspace and is included in backups. Existing application letters remain available within each application.

The A4 layout starts with an editable **COVER LETTER** heading matching the CV heading style. Change it under **Document heading**, or leave it blank to hide it. The layout uses a left-aligned sender block positioned at the top right, separate phone and email lines, postal code/city/country together, and a recipient block at the left with a bold company name, a left-aligned city/date line beneath the recipient, a bold subject, an editable salutation, justified body paragraphs, and a closing followed directly by your typed name. Paste only the body from ChatGPT; the template adds the other elements. **Use today’s date** uses the Europe/Berlin date. Postal codes are text fields so leading zeros are retained. **Download PDF** becomes available after entering your name, company, date and subject. Dates use a two-digit day, full English month and year (for example, 09 October 2026). Enable **Include signature image** to upload a PNG or JPG up to 5 MB from your device. The image appears below your typed name, preserves its proportions and transparency, and is saved for reuse even when switched off. Replace or remove it from the same panel, or adjust **Signature size** from 25% to 200%; proportions and the saved size are preserved. Preview and download use the same PDF renderer. Long letters continue onto further pages with a reminder to shorten the text if appropriate.

This is a DIN 5008–inspired business-letter design, not a claim of certified compliance. The structure follows the [Bundesagentur für Arbeit's cover-letter guidance](https://web.arbeitsagentur.de/bildung/bewerbung/anschreiben).

Open an application and select **Cover letter**. Enter text in either language and download a matching text PDF. With AI configured, you can generate and review a draft based on your company, role and included CV experience. Review both language versions before applying them.

## Data and backups

- Current workspace: `data/workspace.json`
- Previous successful save: `data/workspace.backup.json`
- App log: `data/app.log`
- **Settings & backup** provides portable JSON export and restore, including portraits and application drafts.
- Wait for **Saved to this computer** before closing. Conflicting edits in separate windows are rejected rather than silently overwriting a newer save.
- Your chosen folder is inside OneDrive. Whether these local files also sync to the cloud depends on your OneDrive settings. This also applies to `.env` if you create one.
- Clear workspace removes the active profile and applications. Previous backups, exported files, and OneDrive version history remain separate.
- The app listens only on `127.0.0.1`, not the local network. It is a single-person local application, without public hosting or multi-user accounts.

## Development

```powershell
npm install
npm run dev
```

Use the same local URL. Stop the installed app first so port 4310 is available.

```powershell
npm run typecheck
npm test
npm run build
npm start
```

The frontend uses the Sites Vinext/React starter and its accessible Base UI/Shadcn controls. The production frontend is statically built; a small local Node server handles file saving, PDFKit export and optional AI requests. No Cloudflare account is needed for local use.

`PLAN.md` records implementation scope. `tests/core.test.mjs` covers persistence, concurrent-save protection, independent drafts, input validation and PDF generation. Test storage uses a separate temporary directory; it never writes sample data into your workspace.

An optional WebMCP tool, `create_cv_application_draft`, is registered only in browsers supporting `document.modelContext`. The normal interface does not depend on it. Its browser integration is not part of the automated verification.

## Current boundaries

- Job-description entry, requirement matching and automatic JD suggestions are no longer available. Existing job-description text remains in legacy workspace backups for compatibility, but is not displayed or sent to AI.
- Existing arbitrary PDF/Word CV import and automatic profile extraction are not included. Workspace backup import is supported.
- No automatic job submission, email sending, public sharing, or account synchronization is performed.
- The built-in PDF font supports the Latin characters used for English/German CVs; other writing systems need additional fonts.
