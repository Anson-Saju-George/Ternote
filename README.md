# Ternote

Independent, local-first AI chat exporter for ChatGPT, Claude and Gemini. Development build 0.1.0. GitHub: [Anson-Saju-George/Ternote](https://github.com/Anson-Saju-George/Ternote). Public license and Chrome Web Store publisher are still to be chosen; no store release has been submitted.

The user approved the UI, PDF identity and compact attachment-layout checkpoint on 2026-09-17. Native file-card/PPTX extraction is still pending; approval is not a claim of production readiness. No demo or sample UI is included. See [next steps](docs/NEXT-STEPS.md) for the ordered feature backlog and restart handoff.

## Run

Requires Node.js 24 or newer.

    npm ci --ignore-scripts
    npm run check
    npm test
    npm run build
    npm run test:browser
    npm run open:edge -- --reload

Load the generated dist folder as an unpacked extension. Enable only the platforms you use. On a chat, click the small Export button for a dedicated export tab, or use the toolbar popup. Keep the export view open while it works; closing it cancels the job.

For manual testing, prefer normal Edge: open edge://extensions, enable Developer mode, choose Load unpacked and select dist. The open:edge command launches a separate debug profile with separate login data; it may encounter platform verification. Complete any verification manually; the extension does not bypass it.

## Current features

- Optional, separate permissions for ChatGPT, Claude and Gemini.
- Entire-conversation loading: walk both scroll directions, collect messages incrementally, wait for visible loading states, and activate recognized load-history controls.
- Progress with message counts and cancellation. Unknown history size uses an indeterminate bar; attachment/page work shows real counts.
- Stable-ID collection retains virtualized messages and preserves identical messages with different IDs. Restore the page scroll position and recognized expanded controls after capture.
- Markdown, HTML, TXT, JSON, CSV, and directly downloaded PDF files. No print dialog.
- Original PDF layout: A4 pages, tinted message boxes, paired user/assistant turn numbering, ChatGPT source logo, observed model/effort metadata, page numbers, light/dark palettes, repeated table/code headers, and paginated code.
- Accessible attachments use bordered cards at their conversation position. Images and messages share remaining page space; two landscape images can fit on one page. PDF attachment pages retain a larger readable size and paginate naturally.
- PDF preview renders the actual download, one page at a time. The completed PDF is reused when exporting unchanged settings.
- Accessible images, PDF pages, DOCX text/tables/images, and exposed artifact content in PDF and HTML.
- Message selection is built only when requested. Captured messages transfer in bounded batches; binary attachments transfer in chunks.
- Metadata toggle, custom filenames, literal text redaction, and local preferences. Conversation data is not stored.

## Important boundaries

The three platform adapters remain independently authored candidates. Passing synthetic fixtures does not establish compatibility with every current live site. Validate with dummy chats in Edge, especially Claude artifact controls.

The loader reaches both visible scroll boundaries and waits for them to settle. This is not proof that a platform exposed its whole server-side history. Delayed loading without an observable busy indicator, inaccessible branches, unresolved controls, or recycled elements without stable IDs can affect completeness. Warnings are retained in the export; it is never labelled server-verified complete.

Only DOM-exposed resource URLs and already-rendered images are read. CORS-protected, expired, redirected, password-protected, missing, or card-only attachments may be unavailable. These get explicit notes, not silent omissions. The extension does not probe private endpoints, read tokens, bypass access controls, or request access to every website. Open a restricted attachment in the chat and retry; some need a future platform-specific adapter.

Attached PDFs are included as rendered pages, not embedded original files; their text is not searchable in the combined PDF. Conversation and DOCX text remain searchable. DOCX is reflowed, not an exact reproduction of Word pagination, styles, or headers. HTML/SVG/code artifacts are rendered as inert source, never executed. Only exposed or safely expandable artifact panes are captured.

The browser has finite memory. Safety budgets are explicit: 64 MiB source bytes per file, 256 MiB captured attachment bytes, 128 MiB raster output per PDF, 256 MiB rendered attachment data, and about 64 million serialized chat characters. DOCX ZIP expansion is limited to 128 MiB and conversion to 60 seconds. Files that fail are reported; an oversized chat fails rather than silently truncating. There is no fixed message-count or PDF-page-count cutoff.

Images are resized to at most 2200 pixels on their longest side for the final document. DOCX external resources are disabled. Exact-text redaction omits images and attached PDF pages because their pixels cannot be safely text-redacted. Inspect documents before sharing.

Inline formatting, mathematical semantics, complex merged tables, and some writing systems still need fidelity work. Fonts cover Latin/Greek/Cyrillic, Devanagari, Malayalam, Tamil and monochrome emoji; other scripts are not yet guaranteed. The snapshot belongs to this export view; reopen the exporter to capture newer messages.

## Verification and distribution

npm run test:browser uses an isolated Chromium profile with synthetic conversations, original DOCX fixtures, and locally generated PDFs. Set BROWSER_PATH to select Edge. It does not use your normal profile.

npm run package creates a compressed development ZIP with a SHA-256 sidecar. CI installs the locked dependencies and verifies the source before building. Libraries, fonts, PDF workers, character maps and required decoding assets are bundled locally; no executable code is downloaded at runtime. The build collects third-party notices. See [dependencies](docs/DEPENDENCIES.md), [privacy](PRIVACY.md), and [visual checklist](docs/VISUAL-TEST-CHECKLIST.md).

No proprietary extension code, branding, templates or assets are included in the product. Private reference snapshots live under docs/research/snapshots, which is Git-ignored and excluded from builds.
