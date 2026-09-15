# Privacy

Unpublished development build 0.1.0. This describes implemented behavior, not a store listing.

Chat and document processing happen in the browser. There is no backend, account, analytics, sponsor SDK, upload, or remote executable code. The extension does not read cookies, authentication tokens, password fields, or unrelated pages.

On your export request, it scrolls the enabled chat, reads exposed message content, and expands recognized read-only content/history controls. This may cause the chat website to load its own history. It restores the scroll position and recognized expanded controls when finished.

For attachments, it snapshots already-loaded images where permitted, or fetches resource URLs already exposed by the conversation DOM. Same-origin requests use the browser's ordinary same-origin session; cross-origin requests omit credentials and remain subject to CORS. Requests use no referrer and reject redirects. Resource URLs are held in memory, not written into the exported document. No broad extra host permissions are requested. Unavailable resources are reported.

Source conversation URLs omit query strings and fragments. Metadata can be disabled. Exact-text redaction changes only the exported copy. Because pixel content cannot be safely text-redacted, enabling redaction omits images and attached PDF pages; it does not run OCR.

Preferences and platform-enabled flags use chrome.storage.local. Conversation data, attachment bytes, rendered pages and PDF caches stay in memory. Closing the export view cancels work and discards that view's data. A short page-side lease cleans up interrupted sessions; it is not a background archive. Saved downloads remain until you delete them.

Generated HTML contains no scripts or external resources. DOCX external file access is disabled. PDF.js, Mammoth, pdfmake, fonts and decoding resources are bundled locally. PDF generation downloads a file directly; it does not open a print dialog.

Permissions: storage saves preferences; scripting runs capture and the small button; activeTab identifies the page after a toolbar action. Each supported platform is an optional host permission. No all-sites access, cookies, debugger, downloads-management or browsing-history permission is requested.

Browser and chat-platform network activity is governed by their own policies. No claim is made that an inaccessible attachment or withheld history was captured.
