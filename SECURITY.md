# Security

This is an unpublished development build. Select a reporting contact before release. Never post real chats, credentials, signed attachment links or tokens in public issues.

Page content is untrusted data. Export text is escaped. HTML preview uses a sandboxed iframe without scripts or modals, and exported HTML allows only inline styling and embedded raster images. There are no active artifact previews.

Attachment acquisition accepts only resource URLs already present in the enabled conversation DOM. It rejects non-HTTPS remote URLs, obvious local/IP targets, credentials in URLs, redirects, and unsupported data schemes. It does not enumerate private APIs or scrape app state. CORS and site access controls still apply.

PDF/DOCX parsing uses local libraries. PDF JavaScript evaluation is disabled. DOCX runs in a terminable worker with external file access off, a ZIP expansion check and a timeout. Converter HTML is parsed in an inert template then rebuilt as a constrained block model; raw markup and external image URLs never enter the export. Files, raster sizes and aggregate memory have explicit budgets, and failures are disclosed.

The PDF generator runs in a dedicated worker. Cancellation terminates workers and aborts capture/fetching. Navigation and permission removal invalidate capture. Page-side jobs expire after a missed heartbeat; completed data is explicitly released.

Literal redaction removes text from structured exports and omits unredactable pixel content. Selected-message exports exclude unrelated assets. CSV formulas are neutralized and filenames reject path separators, controls and reserved device names.

Manifest permissions remain minimal and platform-specific. The extension CSP permits only locally bundled JS/Workers/WASM and local preview assets; it does not grant runtime remote script loading. Dependency versions are locked and their notices included in the generated distribution. See docs/DEPENDENCIES.md for the narrowly scoped fontkit compatibility patch.

Live-site adapter validation, hostile document fuzzing, large-memory stress testing, accessibility, and a final dependency/license audit remain public-release gates.
