# Sequential visual checkpoints

Updated 2026-09-15. User wants one working step at a time, opened in Edge for visual approval. Current priority is ChatGPT; Claude/Gemini adapters remain candidates until live validation.

## Current checkpoint: PDF identity and readability

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
7. Release: license/branding decisions, public GitHub preparation, CI/security/performance checks, store assets/privacy disclosures and submission with user authorization.

## Clean-room reference

Primary ChatGPT benchmark requested by user: “ChatGPT Exporter - ChatGPT to PDF, MD, and more.” Private snapshot manifest is at E:/Extension Research/AI Chat Exporters - Installed Snapshots/docs/research/snapshots/ChatGPT Exporter/6.10.0/manifest.json. Other snapshots are secondary references.

Compare visible settings and dummy-chat exported files, not proprietary implementation code. No copied competitor code, selectors, templates, branding or payment logic. No accounts, paid activation, daily quotas or fabricated support links in our product. The official ChatGPT source-attribution logo is independently obtained from ChatGPT, not from a competitor.
