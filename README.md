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
4. Create an application with a company, role and pasted job description. The app copies your master profile into an independent draft. Later master-profile changes do not overwrite old applications.
5. Choose which entries to include. The requirement coverage panel separates direct CV matches, related evidence, and requirements that are not yet evidenced. Direct and related results name the CV sections and entries that support them. Use **Generate JD suggestions** to ask the selected AI model to rewrite supported evidence for the role. Review each proposed change and accept or decline it individually; only accepted suggestions are applied. Use **Typography** beside the live preview to choose Modern Inter, Clean Arial, or Classic Times and a base size from 8–12 pt. Use **Arrange** to move complete CV sections up or down; typography and section order are saved independently for the master profile and each application. Entries within work experience, internships, education and certificates appear most recent first.
6. Review the actual generated PDF in the preview. Add your name to enable **Download PDF**.

The PDF has embedded fonts, selectable text, a narrow dates column, a wide details column, readable spaced birth dates, inline employment types, compact two-column languages, clickable web links, automatic wrapping, page breaks, and page numbers. The live preview uses the same renderer as the downloaded PDF. Long CVs continue onto additional A4 pages; compact mode reduces the selected base size by 1 pt without silently deleting content.

## Internships

Use the **Internships** tab (**Praktika** in German) to add internship roles, organizations, locations, dates and responsibilities/achievements. Each text field supports English and German. Entries can be included or excluded and deleted like other entries. The separate PDF section appears only when it has included entries, is sorted most recent first, and can be moved using **Arrange**. Existing section orders receive Internships after Professional Experience while retaining the order of other sections. Existing experience entries are kept in their current section.

Internships are copied into new application drafts and included in translation and requirement coverage. JD rewriting remains limited to Professional Experience, Projects and Skills.

## English and German

CV headings and interface labels are provided in both languages. User-written descriptions have separate English and German fields. A missing translation temporarily falls back to the other language and is clearly flagged above the PDF preview. Automatic natural-language translation requires the optional AI connection below; switching a language selector alone does not translate arbitrary prose.

## Optional AI assistance

The profile editor, local keyword matching, saved applications, photo tools and PDF generation work without AI. Open **Settings & backup**, choose **Automatic**, **Ollama · local**, or **OpenAI**, and use **Test connection**. Automatic mode prefers a reachable local Ollama model before OpenAI.

### Local Ollama

1. Install and start Ollama on this computer.
2. Install a model with: ollama pull MODEL_NAME
3. In CV Studio, choose **Ollama · local**, select the detected model, and test the connection. The first request can take several minutes while Ollama loads the model.

CV Studio discovers models through Ollama's local /api/tags endpoint and requests schema-constrained output through /api/chat. The default address is http://127.0.0.1:11434; it can be changed with OLLAMA_BASE_URL in .env, but CV Studio accepts only localhost addresses. OLLAMA_MODEL can set a default model. With Ollama, profile text and job descriptions stay on this computer and are sent only to the local Ollama service.

### OpenAI

1. Copy .env.example to .env in this folder.
2. Fill in OPENAI_API_KEY with your OpenAI API key.
3. Keep OPENAI_MODEL=gpt-4.1-mini, or choose another Responses API model that supports structured outputs.
4. Double-click **Restart CV Studio.vbs**.

OpenAI API usage is billed separately. Keys stay on the local server and are not included in browser code or exported workspace backups.

For either provider, profile text and job descriptions are sent only when you request AI assistance. Photo bytes, name, email, phone, street address and links are excluded. Translation includes city/country and the titles and values of custom personal fields. In an application, **Generate JD suggestions** asks the selected model to read the complete editable CV context and job description. JD tailoring is restricted on the server to Professional Experience descriptions, Project titles/descriptions, and existing Skill categories/names. Headline, summary, education, certifications, interests, languages, employers, dates, locations, proficiency levels, entry membership and identifiers cannot be changed by this action. Each generated description uses as many supported points as needed, up to four. The model may reorder or rephrase existing verified skills but cannot add unsupported skills; missing requirements are returned as recommendations. The review shows English tailoring suggestions once while the matching German wording is generated in the background. Every wording change has separate **Accept** and **Decline** controls, with optional accept-all/decline-all actions. Applying the review copies only accepted bilingual fields into the draft. A **Reasoning** panel gives concise evidence/JD justifications. If you edit the source profile while a suggestion is generated, the older result cannot overwrite your newer edits.

Ollama API references:
- https://docs.ollama.com/api/tags
- https://docs.ollama.com/api/chat
- https://docs.ollama.com/capabilities/structured-outputs

OpenAI structured outputs:
- https://developers.openai.com/api/docs/guides/structured-outputs
## Translating a completed CV

Choose **Deutsch** under **Translate into**, then click **Translate into German** on the master profile or the specific application draft. Translation reads the English source for every populated bilingual field, including role and project titles, education, university/school names, entry locations, personal city/country, certifications, skill categories and names, language names, interests, and custom personal fields. Existing school/organization and location strings migrate to bilingual fields while preserving the original text. These fields can also be edited directly using the content language selector. Existing German text is refreshed from the English source. Fields with no English source are kept. Proper names and technical names such as Python can remain the same.

The model translates small batches, retries missing or invalid fields once, and reports incomplete translation instead of silently returning only part of the CV. Translation preserves all bullet points; the four-point limit applies only to JD tailoring. Review shows the source, current German text and proposed German text even while the editor is in English. Accept individual fields or **Accept all**, then **Apply accepted**. Only accepted German fields are saved. Select **DE** as the CV language in the preview to view or download them. The editor language switches to the accepted translation language. Switching preview language alone displays stored translations, falling back to source text where translations are missing; it does not call the model.

## Cover letters

Open an application and select **Cover letter**. Enter text in either language and download a matching text PDF. With AI configured, you can generate and review a draft based on your supplied experience and job description.

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

`PLAN.md` records implementation scope. `tests/core.test.mjs` covers persistence, concurrent-save protection, independent drafts, keyword matching, input validation and PDF generation. Test storage uses a separate temporary directory; it never writes sample data into your workspace.

An optional WebMCP tool, `create_cv_application_draft`, is registered only in browsers supporting `document.modelContext`. The normal interface does not depend on it. Its browser integration is not part of the automated verification.

## Current boundaries

- Requirement coverage is an evidence-finding aid, not an ATS score or a hiring prediction. It recognizes common terms plus skills entered in your profile, distinguishes direct terms from a small set of related phrases, and shows the supporting included CV sections. It does not fully understand every job description.
- Existing arbitrary PDF/Word CV import and automatic profile extraction are not included. Workspace backup import is supported.
- No automatic job submission, email sending, public sharing, or account synchronization is performed.
- The built-in PDF font supports the Latin characters used for English/German CVs; other writing systems need additional fonts.
