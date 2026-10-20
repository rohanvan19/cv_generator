# CV Studio implementation plan

1. Build a local personal workspace with a master profile, job applications, and English/German interface.
2. Persist profile data and candidate photos to data/workspace.json; keep each application as an independent snapshot. Include export/import backups.
3. Add all CV sections, bilingual descriptions, date controls, include/exclude switches, photo upload and crop.
4. Generate genuine A4 text PDFs with a narrow date column, wide content column, portrait, wrapping, and page numbers. Show the actual generated PDF in the preview.
5. Add evidence-based job keyword matching and optional API-backed translation/tailoring. Keep personal facts locked and all output editable.
6. Validate persistence, draft isolation, matching, API input handling, production build, and PDF extraction/rendering. Supply a Windows launcher and usage documentation.

Scope: local application in the requested Windows folder. No public hosting, accounts, or credentials are required for the core editor and PDF export.
