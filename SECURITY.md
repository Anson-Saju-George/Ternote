# Security

This is an unpublished development build. Select a reporting contact before release. Never post real chats, credentials, signed attachment links or tokens in public issues.

Page content is untrusted data. Export text is escaped. HTML preview uses a sandboxed iframe without scripts or modals, and exported HTML allows only inline styling and embedded raster images. There are no active artifact previews.

Attachment acquisition accepts resource URLs present in the enabled conversation DOM, or same-origin HTTPS URLs exposed by a recognized ChatGPT viewer's visible Download action. That adapter matches the filename, validates the requesting extension/tab/capture session, temporarily observes window.open/programmatic anchor clicks, and restores methods on completion, cancellation or timeout. It does not enumerate private APIs or scrape app state. URL credentials, redirects, unsupported schemes and obvious local/IP remote targets are rejected. CORS and site access controls still apply.

PDF/DOCX parsing uses local libraries. PDF JavaScript evaluation is disabled. DOCX runs in a terminable worker with external file access off, a ZIP expansion check and a timeout. Converter HTML is parsed in an inert template then rebuilt as a constrained block model; raw markup and external image URLs never enter the export. Files, raster sizes and aggregate memory have explicit budgets, and failures are disclosed.

The PDF generator runs in a dedicated worker. Cancellation terminates workers and aborts capture/fetching. Navigation and permission removal invalidate capture. Page-side jobs expire after a missed heartbeat; completed data is explicitly released.

The product no longer uses PPTX reflow for slide export. The preview adapter requires the current capture token, asset marker, unchanged chat URL, filename-matched viewer, and unambiguous counter/navigation. It reads image/canvas pixels using browser origin protections, checks slide order and settling, and rejects incomplete sequences. Protected frames and detected separate visible text/vector layers are not flattened by guessing. It closes a newly opened viewer, or attempts to restore a pre-existing viewer's slide position. Preview budgets are 64 MiB per deck, within the 256 MiB capture total, and five minutes per deck. The older bounded OOXML parser remains regression-tested but is not called by the export path. Structural checks are not malware scanning; unchanged originals remain untrusted files.

Attachment-type and conversation-image controls filter the export, not capture. Original PPTX downloads are an explicit separate action and are disabled while text redaction is enabled. Embedded document pixels are omitted under redaction; editable text is redacted without changing the stored original bytes.

Literal redaction removes text from structured exports and omits unredactable pixel content. Selected-message exports exclude unrelated assets. CSV formulas are neutralized and filenames reject path separators, controls and reserved device names.

Manifest permissions remain minimal and platform-specific. The extension CSP permits only locally bundled JS/Workers/WASM and local preview assets; it does not grant runtime remote script loading. Dependency versions are locked and their notices included in the generated distribution. See docs/DEPENDENCIES.md for the narrowly scoped fontkit compatibility patch.

Live-site adapter validation, hostile document fuzzing, large-memory stress testing, accessibility, and a final dependency/license audit remain public-release gates.
