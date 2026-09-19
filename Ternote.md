# Ternote — Technical setup & implementation notes

> This document preserves the technical setup, implementation details and known limitations. See the **[official product README](README.md)** for the product overview and the **[17-phase roadmap](Test.md)** for planned work and acceptance criteria.

Independent, local-first AI chat exporter for ChatGPT, Claude and Gemini. Development build 0.1.0. GitHub: [Anson-Saju-George/Ternote](https://github.com/Anson-Saju-George/Ternote). Public license and Chrome Web Store publisher are still to be chosen; no store release has been submitted.

The user approved the UI, PDF identity and compact attachment-layout checkpoint on 2026-09-17, and confirmed native PPTX original downloading in ChatGPT on 2026-09-18. On 2026-09-19 the requirement was clarified: complete slide visuals, not reflow. The current candidate navigates filename-matched ChatGPT slide viewers and captures readable full-slide image/canvas pixels into PDF/HTML at the attachment position. It requires live visual validation. Reflow is no longer used by the export path. PDF/DOCX conversion, common text files, attachment-type selection and unchanged original PPTX downloads remain. See [next steps](docs/NEXT-STEPS.md) for the handoff.

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

Resources come from DOM-exposed URLs, already-rendered images, or a recognized ChatGPT file viewer's Download action. The native adapter temporarily observes window.open and programmatic anchor clicks during that action, accepts only same-origin HTTPS URLs, and restores those methods on completion, cancellation or timeout. It requires an unambiguous filename match. CORS-protected, expired, redirected, password-protected, missing, or unrecognized attachments may be unavailable. These get explicit notes, not silent omissions. The extension does not probe private endpoints, read tokens, bypass access controls, or request access to every website.

PPTX originals remain in the export view's memory and are discarded on a new capture, disconnect or view closure. Saving originals is disabled while exact-text redaction is enabled because the files are unchanged. DOCX/PPTX containers receive bounded ZIP structure checks; these are not malware scanning or full Office validation. Unfamiliar or localized viewer controls may not match.

PPTX preview capture uses visible previous/next controls, a matched filename (or filename stem), an unambiguous slide counter, and settled readable image/canvas pixels. It returns to slide 1, captures in order, and accepts only a complete sequence. It reads accessible same-origin frames without bypassing browser restrictions. Detected separate visible text/vector layers are rejected to avoid exporting an incomplete canvas. Limits: five minutes per deck, 64 MiB of preview bytes per deck within the 256 MiB capture total, and 2200 pixels on the longest image side. Previews transfer in 256 KiB chunks and are released afterward. New viewers are closed; pre-existing viewer positions are restored when possible. Unsupported viewers report explicit errors, not reconstructed slides. Screenshot appearance alone cannot establish whether the live viewer's DOM is readable; live verification remains necessary. The former bounded OOXML reflow parser is regression-tested but not called by the product export path.

The Attachments button opens detected-type checkboxes and a separate conversation-image toggle. They filter all export formats after capture and compose with message selection; embedded images follow their parent document. Changing them invalidates the rendered preview/PDF cache without another capture. TXT/MD/CSV/JSON/HTML/XML/YAML/log/code attachments render as inert source in PDF/HTML; UTF-8 and BOM-marked UTF-16 are supported. XLSX, legacy Office formats and faithful slide reproduction are not implemented.

Attached PDFs are included as rendered pages, not embedded original files; their text is not searchable in the combined PDF. Conversation and DOCX text remain searchable. DOCX is reflowed, not an exact reproduction of Word pagination, styles, or headers. HTML/SVG/code artifacts are rendered as inert source, never executed. Only exposed or safely expandable artifact panes are captured.

The browser has finite memory. Safety budgets are explicit: 64 MiB source bytes per file, 256 MiB captured attachment bytes, 128 MiB raster output per PDF, 256 MiB rendered attachment data, and about 64 million serialized chat characters. DOCX ZIP expansion is limited to 128 MiB and conversion to 60 seconds. Files that fail are reported; an oversized chat fails rather than silently truncating. There is no fixed message-count or PDF-page-count cutoff.

Images are resized to at most 2200 pixels on their longest side for the final document. DOCX external resources are disabled. Exact-text redaction omits images and attached PDF pages because their pixels cannot be safely text-redacted. Inspect documents before sharing.

Inline formatting, mathematical semantics, complex merged tables, and some writing systems still need fidelity work. Fonts cover Latin/Greek/Cyrillic, Devanagari, Malayalam, Tamil and monochrome emoji; other scripts are not yet guaranteed. The snapshot belongs to this export view; reopen the exporter to capture newer messages.

## Verification and distribution

npm run test:browser uses an isolated Chromium profile with synthetic conversations, original DOCX fixtures, and locally generated PDFs. Set BROWSER_PATH to select Edge. It does not use your normal profile.

npm run package creates a compressed development ZIP with a SHA-256 sidecar. CI installs the locked dependencies and verifies the source before building. Libraries, fonts, PDF workers, character maps and required decoding assets are bundled locally; no executable code is downloaded at runtime. The build collects third-party notices. See [dependencies](docs/DEPENDENCIES.md), [privacy](PRIVACY.md), and [visual checklist](docs/VISUAL-TEST-CHECKLIST.md).

No proprietary extension code, branding, templates or assets are included in the product. Private reference snapshots live under docs/research/snapshots, which is Git-ignored and excluded from builds.
