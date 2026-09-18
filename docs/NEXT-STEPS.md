# Sequential visual checkpoints

## Resume checkpoint — 2026-09-18

Native retrieval candidate implemented and tested: recognized ChatGPT PDF/DOCX/PPTX buttons resolve through a filename-matched visible viewer Download action. PDF/DOCX use the existing rendering pipeline; PPTX originals can be saved unchanged from the export view. Slides are not yet included in exports. No new permissions or runtime dependencies were added. 29 unit tests, source/permission checks, build and the full isolated Edge suite passed, including exact-byte original downloads, cancellation and wrong-file rejection. Original saving is disabled under redaction; originals are memory-only and cleared with the capture/view lifecycle.

Next: reload dist in normal Edge, refresh ChatGPT, reopen Ternote and visually test uploaded/generated cards. Do not treat synthetic fixtures as live approval. After that checkpoint is accepted, implement bounded PPTX slide-content extraction with explicit visual-fidelity limits. Earlier notes below describe the pre-resolver state and are historical, not the current implementation status.

Updated 2026-09-17. User wants one working step at a time, opened in Edge for visual approval. Current priority is ChatGPT; Claude/Gemini adapters remain candidates until live validation.

The owner accepted all implemented work through the compact attachment-layout checkpoint. After every completed phase: run proportionate checks, record scope and remaining limitations, commit the phase, and push main to the Ternote origin. Keep private research, user conversations, downloads and browser profiles out of Git. Use normal Edge with dist loaded unpacked for manual visual checks; the dedicated debug profile encountered human verification.

## Current checkpoint: PDF identity and readability

2026-09-17 update: the owner replaced the fresh-page attachment requirement with compact stacking. Images and attachments now have bordered cards without forced before/after page breaks; image cards stay intact and move to the next page only when they do not fit. Two landscape images plus surrounding query text are verified on one rendered page. PDF document pages use a larger fit for readability. Native PPTX integration remains pending. Live manual QA is in scripts/review-chat.mjs; downloaded file bytes and chat diagnostics must stay in ignored test-output/.

Verification: 25 unit tests passed; the full Edge suite passed on rerun, including the new one-page two-image fixture. The preceding run hit a virtualized-message ordering failure, so retain that regression test and investigate timing sensitivity during capture hardening. Live ChatGPT full capture timed out; a DOM-only diagnostic read eight currently mounted messages and two images (not a full-history certification). The generated and uploaded PPTX names were visible, but no complete download was verified; the viewer showed its loading state. Do not claim those decks have been extracted or included.

Implementation: pale-green user boxes, restrained assistant boxes, paired turn numbers, ChatGPT source logo, source link/count, observed model/effort metadata, fresh-page attachments with conversation continuation, stronger green popup text/controls, reduced-motion-aware privacy dot, squarer in-chat Export button. Image previews wrapped in buttons are now discoverable. Collapsed-state warnings target recognized message expansion controls, not unrelated menus.

Do not invent model/effort values. The current live ChatGPT DOM exposes data-message-model-slug on assistant messages. It does not establish historical effort levels. Missing values must say not exposed.

## Next checkpoint: accessible files and reusable capture

- Native ChatGPT PPTX/DOCX/PDF file buttons are not links; resolve through visible file viewer/download controls, without reading private app state/tokens or inventing endpoints.
- Preserve exact conversation placement. Render images/PDF pages/DOCX content; test native slide previews. Preserve original bytes in PDF attachments/ZIP for other formats, with clear preview limitations.
- URL-keyed, short-lived cache; compare latest five message hashes and stable IDs. Conservatively recapture after older edits, page reloads, unknown state, streaming or branch changes; append only with verified overlap.
- Bounded size, eviction, clear action, cancellation, permission revocation and restart cleanup; no permanent archive by default.
- Draft cache-policy.js/cache.js/probe.js are saved under docs/drafts; they are NOT integrated or release-verified and are not bundled. pdf-lib was evaluated for original-file attachment support and removed from dependencies until implementation. Do not claim caching or universal file support works.

## Then: General and Export settings

- Language: ship only translated languages, start English.
- UI theme Light/Dark/Auto separately from export theme.
- Filename pattern/prefix with {title}, {date}, {time}, {format}, {platform}, {model}, {count}; safe paths and live example.
- Quick-export visibility; clipboard for supported text/rich-text formats; success-message mute; optional selector auto-close.
- Title/link/date/time/timestamp/model controls; visible thinking summaries, sources and research references where accessible. No hidden internal reasoning claims.
- Date/time formatting; browser download settings link (no invented folder access).
- Selection actions All/Questions/Answers/Invert/None; recently used formats.
- Opt-in user name/email fields only if requested; do not scrape account details.
- Import/export settings with validation and versioning.

## Later, each separately approved

1. Local saved archive: opt-in, search, collections, quotas, delete/export and privacy documentation.
2. Optional browser sidebar and quick-format actions.
3. Files ZIP, DOCX, XLSX and EPUB with fidelity tests.
4. Screenshot/share-card exports with large-chat limits made explicit.
5. Batch export: user-selected conversations only, progress/cancel/resume, no account-wide scraping.
6. Additional platforms only after individual adapter tests; never advertise unimplemented platform counts.
7. Release: license decision, final Ternote brand assets, public GitHub preparation, CI/security/performance checks, store assets/privacy disclosures and submission with user authorization.

## Clean-room reference

Primary ChatGPT benchmark requested by user: “ChatGPT Exporter - ChatGPT to PDF, MD, and more.” Private snapshot manifest is at docs/research/snapshots/ChatGPT Exporter/6.10.0/manifest.json, relative to the product repository. Other snapshots are secondary references. The snapshot archive is Git-ignored and never bundled.

## Resume handoff — 2026-09-16

The owner requested consolidation into this product repository; research docs are moving here from the old E: workspace. Preserve the existing uncommitted scripts/inspect-edge.mjs diagnostics. The last pushed checkpoint is ebf3eed (Ternote branding and USER labels).

The live ChatGPT PPTX card was inspected through visible UI only. Its file viewer's Download file action exposed a same-origin URL; a bounded diagnostic read returned HTTP 200, application/octet-stream, and ZIP signature bytes. That establishes access for the tested file, not implemented PPTX export. The attempted production native-file resolver patch was rejected by the usage-limit approval gate and was NOT applied. Resume by implementing and testing the native file-viewer resolver, then PPTX content extraction with explicit fidelity limits. PDF/DOCX direct-URL rendering exists; native-card resolution and PPTX rendering are still pending. No private chat URL, file bytes or signed download URL should enter Git.

Compare visible settings and dummy-chat exported files, not proprietary implementation code. No copied competitor code, selectors, templates, branding or payment logic. No accounts, paid activation, daily quotas or fabricated support links in our product. The official ChatGPT source-attribution logo is independently obtained from ChatGPT, not from a competitor.
