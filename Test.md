# Ternote — 17-phase roadmap & acceptance plan

Updated **2026-09-17**. This is a development and testing roadmap, not a list of shipped features.

**Workflow:** implement one small checkpoint → run focused checks → visual test in normal Edge → obtain user approval → record limitations → commit and push the completed phase.

The owner accepted all implemented work through compact PDF/image layout. This does not approve unfinished capabilities or certify production readiness. Current focus: **Phase 5 — native attachments and PPTX**.

| Phase | Scope | Status |
| :--- | :--- | :--- |
| 1 | Research & specification | Initial research done; comparisons/audit pending |
| 2 | Extension foundation | Built; release hardening remains |
| 3 | Core UI & exports | Current implementation approved |
| 4 | PDF layout & images | Current implementation approved |
| 5 | Native attachments & PPTX | Original download confirmed; whole-slide preview capture awaiting live review |
| 6 | Capture reliability & caching | Basic loading built; hardening/cache pending |
| 7 | General & export settings | Basic controls built; expansion pending |
| 8 | Selection & quick-export workflow | Basic selection built; expansion pending |
| 9 | Additional export formats | Pending |
| 10 | Saved conversations & backup | Pending |
| 11 | Screenshots & share cards | Pending |
| 12 | Batch export | Pending |
| 13 | Platform expansion | Initial adapters exist; live validation pending |
| 14 | Production hardening | Ongoing; release audit pending |
| 15 | Public release preparation | GitHub live; remainder pending |
| 16 | Chrome Web Store launch | Pending |
| 17 | Maintenance | After launch |

## 1. Research & specification

**Build:** feature comparisons, platform limitations, privacy boundaries, release scope and acceptance criteria. Inspect licensed open-source references separately from proprietary feature/UX research.

**Accept when:** dummy-chat comparisons are documented, privacy review is complete, and requirements distinguish current capabilities from future work. Private snapshots stay outside Git and release packages.

## 2. Extension foundation

**Build:** Manifest V3, optional per-platform permissions, local processing, modular adapters, build tooling and automated tests.

**Accept when:** installation, permission grant/revocation and clean startup pass without default all-site access or remotely loaded executable code. Foundation exists; release audit remains separate.

## 3. Core UI & exports

**Build:** compact Export button, green interface, message selection and PDF/Markdown/HTML/TXT/JSON/CSV exports.

**Accept when:** previews and downloads respect selection and settings; PDF downloads without a print popup; demo UI is absent; user approves the visual checkpoint. **Current implementation approved.**

## 4. PDF layout & images

**Build:** USER labels, source attribution, observed metadata, message boxes and bordered attachment cards that share space with surrounding queries.

**Accept when:** two landscape images and short surrounding text fit on one page; larger content paginates without clipping; light/dark output and long code retain content. **Current implementation approved.** Do not restore the superseded forced-page-break design.

## 5. Native attachments & PPTX

2026-09-19: native PPTX original download is confirmed. The owner rejected reflow as the slide solution and supplied a screenshot of ChatGPT's 12-slide preview. The new candidate captures readable full-slide previews for uploaded/generated cards. Attachment selection and original downloads remain. Verify the live 12-slide deck and uploaded deck separately; this phase is not complete.

Previous checkpoint evidence: 37 unit tests and the isolated Edge suite passed for reflow and selection. That does not certify the new live-preview adapter. Record the new run in docs/STATUS.md; live visual approval is still required.

**Build:** retrieve uploaded and generated files through visible ChatGPT file-viewer/download controls; integrate PDF/DOCX content and PPTX slide content at the correct conversation position.

**Accept when:** original files and complete static slide previews are verified for both uploaded and generated decks; all slides retain order and displayed layout at their conversation position; incomplete/unreadable viewers produce explicit errors. Reflowed text is not an acceptable substitute. Do not claim support for every file format or legacy `.doc`/`.ppt` files.

## 6. Capture reliability & caching

**Build:** harden long-chat and collapsed-content capture; add conversation-scoped, short-lived caching with change detection, memory budgets and a clear-cache action.

**Accept when:** long/virtualized chats preserve stable IDs, duplicates and order; navigation, edits, branches and streaming invalidate stale data; cancellation and permission revocation release resources. Investigate the observed ordering-test flake and live-capture timeout. Cached content must not be presented as verified server-complete history.

## 7. General & export settings

**Build:** Light/Dark/Auto UI, filename tokens/prefix, metadata/reasoning/source controls, clipboard, notifications, selector behavior and settings import/export. Ship only languages actually translated.

**Accept when:** each setting changes its documented behavior; filenames and imported settings are validated; clipboard works only for supported formats; missing model/effort metadata is not invented. Only visible reasoning sections may be exported.

## 8. Selection & quick-export workflow

**Build:** all/questions/answers/invert selection, recent formats, quick-export controls and an optional sidebar.

**Accept when:** selection is consistent across preview and downloads; keyboard navigation works; quick-export visibility and sidebar lifecycle do not clutter or disrupt the chat.

## 9. Additional export formats

**Build:** original-files ZIP, DOCX, XLSX and EPUB output, delivered as separate format checkpoints.

**Accept when:** generated files open in representative readers; file names/paths and spreadsheet cells are safe; original files match captured bytes; format-specific fidelity limits are documented. Unsupported attachments are reported, not silently dropped.

## 10. Saved conversations & backup

**Build:** opt-in local library, search, collections, storage limits, deletion and backup/restore.

**Accept when:** storage is off by default; quota/eviction behavior is clear; delete and clear-all work; backup restore validates schema and content without executing it. Privacy documentation matches the implementation.

## 11. Screenshots & share cards

**Build:** conversation screenshots and shareable visual cards with explicit long-chat limits.

**Accept when:** output dimensions are bounded, long content is handled predictably, selected content is respected, and users can review sensitive content before saving or sharing. No automatic public upload.

## 12. Batch export

**Build:** export explicitly selected conversations with progress, cancellation and recovery.

**Accept when:** only selected chats are processed; partial failures are itemized; retries avoid unintended duplicates; cancellation stops work. No account-wide scraping inferred from a single export request.

## 13. Platform expansion

**Build:** validate Claude/Gemini against live dummy chats, then add further platforms individually.

**Accept when:** each advertised platform has working extraction, permission, navigation, attachment and regression checks. Do not advertise a platform count based only on untested adapters.

## 14. Production hardening

**Build:** security/privacy review, hostile-document testing, accessibility, dependency audits, performance/memory profiling and export-fidelity checks.

**Accept when:** release-blocking findings are resolved; large-chat/document tests meet documented budgets; malformed or unsupported content fails safely; keyboard, contrast and reduced-motion checks pass. Synthetic tests supplement—not replace—live validation.

## 15. Public release preparation

**Build:** choose the public license, finalize original brand assets, user documentation, support/privacy links, release automation and store screenshots.

**Accept when:** licensing is explicit, dependency notices are included, release artifacts are reproducible and documented, and marketing claims match tested behavior. GitHub is live; the project remains UNLICENSED pending the owner's decision.

## 16. Chrome Web Store launch

**Build:** validate the package, prepare accurate permission/data-use disclosures, obtain owner authorization, submit and address review feedback.

**Accept when:** the listing is approved and publicly installable, store-installed behavior is checked, and the README links to the real listing. Until then, label it coming soon—not available.

## 17. Maintenance

**Build:** platform-change fixes, regression coverage, dependency updates and user-feedback triage.

**Accept each update when:** the reported issue has a reproducible test where practical, relevant checks pass, release notes describe changes and limitations, and the checkpoint is committed and pushed. Continue protecting private user data in bug reports.

---

### Checkpoint evidence

Record the date, exact scope, automated results, visual approval, remaining limitations and commit for each checkpoint in [development status](docs/STATUS.md). The [next-step handoff](docs/NEXT-STEPS.md) carries implementation details; the [visual checklist](docs/VISUAL-TEST-CHECKLIST.md) guides manual review.

Baseline for the compact attachment checkpoint: **25 unit tests passed; full isolated Edge suite passed on rerun; owner accepted the implementation.** Native-card extraction, PPTX rendering and production readiness are not part of that completion claim.
