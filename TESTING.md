# Verification

Final update verified on 2026-10-30:

- All 40 automated tests and the standard TypeScript check passed.
- Production build passed after adding duplicate/delete application-card actions.
- Signature tests cover saved image reuse, visibility, proportional resizing, placement below the name, and invalid image handling. Dates use a two-digit day and full English month.
- Application duplication tests verify copied content, new identity and Draft status, backup round trips, and independence from the original application and master profile.
- The desktop launcher was tested without opening a browser; the server was then stopped again.

German cover-letter template verified on 2026-10-30:

- TypeScript, production build, and all 38 automated tests passed.
- Tests cover legacy workspace migration, saved template round trips, leading-zero postal codes, valid calendar dates, PDF reading order/alignment, long-text pagination, and the dedicated PDF API with input and origin checks.
- Visually inspected standard, long-address/subject, and two-page PDF fixtures. Text extraction confirmed no horizontal overflow in the long-address fixture.
- Browser verification used an isolated workspace: entered all sender/recipient fields, date, subject and body; downloaded a PDF; reloaded and confirmed the saved data remained.

Custom sections verified on 2026-10-28:

- Production build and TypeScript passed; 33 automated tests passed.
- New tests cover legacy migration, independent application copies, section/order validation, translation and selective acceptance, included requirement evidence, bilingual PDF output with chronology and employment types, and persistence/PDF API round trips.
- Browser checks used an isolated workspace on port 4311: creating a bilingual section, adding and editing an experience-style entry, choosing employment type, arranging/resetting sections, saving, reloading, and viewing the generated PDF all passed.
- Targeted lint still reports pre-existing issues in the existing photo controls, page hooks/imports, PDF control-character regex, and deprecated API schema methods.

Completed on 2026-09-04.

- Production build: passed (Vinext static export).
- TypeScript: passed.
- Automated tests: 14 passed, including independent application snapshots, direct/related/missing requirement classification with CV evidence sources, keyword boundaries/aliases, truthful local tailoring, date ordering, personal-field and typography migration/validation, disk persistence, stale-write rejection, cross-origin rejection, and PDF generation with Inter, Arial and Times.
- AI integration: OpenAI and local Ollama flows were checked with simulated provider responses. JD tailoring now exposes only Professional Experience descriptions, Project wording, and existing Skill fields to the patch schema; tests confirm headline, summary, education, certifications and languages are excluded. Selective application was verified by accepting one skill suggestion while leaving declined experience and project wording unchanged. Tests also verify that a five-point provider response is reduced to four. Ollama model discovery, local-first Automatic selection even with OpenAI configured, provider/model reporting, and settings migration passed. Contact and photo fields were excluded; employers, entry membership and proficiency levels were preserved; unknown patch keys were ignored; suggestions did not modify saved data automatically.
- Custom section order: the English heading is Projects, and a non-default section sequence was confirmed in extracted PDF text.
- Personal details and compact fields: date of birth and bilingual custom fields were confirmed in English and German photo-layout PDFs; birth dates now render with visible day/month/year spacing. Full-time, Part-time, and Internship values are schema-validated with safe migration for old entries. A rendered A4 fixture confirmed employment type inline with the role and the third language at the top of a second language column.
- PDF checks: one-page German CV with a photo, one-page English CV without a photo, and a six-page German stress fixture. Unicode extraction, image inclusion/exclusion, page numbering, margin bounds, and retention of the final text all passed. Separate 8 pt Arial and 12 pt Times New Roman fixtures were generated; both fonts were subset-embedded with Unicode maps, both remained A4, and the final section survived the expected two-page large-text layout. The German first page and a continuation page from the primary fixtures were visually inspected.
- Launcher: start, already-running start, and restart passed.
- Production HTTP checks: homepage, PDF worker, font, and health endpoint returned successful responses.
- Dependency scan after compatible updates: 0 known vulnerabilities reported by npm.

Limits: live paid OpenAI requests were not made. Local generation speed depends on the selected Ollama model, prompt complexity and this computer; the latest verified gemma3:latest request took 112 seconds. Browser interaction testing and the optional WebMCP browser contract were not run.

Test fixtures are fictional and stored under tmp/pdfs. The test API saves to an isolated operating-system temporary folder, never the active workspace.
