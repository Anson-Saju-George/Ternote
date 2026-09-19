# Edge visual tests

Current check: complete ChatGPT slide previews and attachment selection, not PPTX reflow. In normal Edge, open edge://extensions, reload Ternote (unpacked dist), refresh the ChatGPT tab and reopen the export view. Do not use the dedicated debug profile for this live check; it previously encountered human verification.

- Summary: ChatGPT logo/name, message count, link, exposed model identifier and effort or an explicit unavailable label.
- Conversation: USER 1 / logo 1, USER 2 / logo 2; tinted rectangular boxes; readable tables/code with repeated headers.
- Images: clickable previews should be included in bordered cards; images and queries share remaining page space. Large document pages paginate naturally, without unconditional fresh-page breaks.
- Popup/widget: darker privacy copy, stronger type, squared controls, subtle privacy-dot pulse (off with reduced motion).
- Native file-card retrieval is a candidate awaiting live approval. Test uploaded and generated PDF/DOCX/PPTX cards; unsupported cards must retain explicit names/limitations.

Step 1: popup design approved. Demo/sample card and controls removed.

Step 2: full-chat loading, attached content and polished direct PDF — ready for user testing after automated checks.

1. Reload Ternote in normal Edge as above. Enable your platform if needed.
2. Open a dummy conversation with older messages, images, a PDF, a DOCX and an artifact. Use the small in-page Export button to keep a dedicated export view open.
3. Watch the progress bar and message count while the page scrolls. Check that early and late messages appear once, in order. Compare repeated identical messages too.
4. Cancel a capture. It should stop, restore the scroll position and download nothing incomplete.
5. Choose PDF document .pdf, Paper or Midnight, then Preview. This shows actual PDF pages; use the arrows to inspect them.
6. Check speaker labels, title, margins, code wrapping, table headings, image sizing and page breaks. No blank trailing page should appear.
7. Export. A .pdf should download directly, with no print popup. Compare it against the preview.
8. Check every page of attached PDFs. Check DOCX text, tables and images, and exposed artifact content. Unreadable attachments must have a note explaining why; a filename alone is not a successful attachment export.
9. Test selected messages and metadata off. Enable redaction: image/PDF pixel content must be omitted with an explanation, not claim to be redacted.
10. Switch to another browser tab during a long PDF preparation, then return. Rendering should continue. Reopen the exporter to capture a changed conversation.

## Native-file checkpoint

- Check that each viewer resolves the correct filename and closes after retrieval; no unrelated controls should activate. Cancel during viewer loading and verify cleanup.
- Uploaded/generated PDF and DOCX content should appear in conversation order, with explicit notes for inaccessible files. Confirm every page and embedded image against the original.
- A retrieved PPTX should offer Save original. Compare it with ChatGPT's download. PDF/HTML should contain complete slide-preview images between surrounding conversation blocks, in slide order, with original displayed graphics/layout. Check all 12 slides in the screenshot's generated deck, then the uploaded deck separately. Do not accept extracted/reflowed text or a single embedded image as a complete slide.
- Cancel during slide navigation; check cleanup and that no partial deck is exported. Test a missing/stalled/protected preview: it must report failure, never silently substitute reflow. Already-open viewer state should be restored when possible. Slide pixels must be omitted under redaction.
- Open Attachments: each detected file type has a checkbox; conversation images have their own toggle. Uncheck PPTX, preview again and confirm it disappears without recapture. Restore it and confirm its content returns. Combine with selected messages and PDF/DOCX/TXT files. Document-embedded images follow their parent document.
- Enter a redaction term: original downloads must become disabled. Clear it: they should be available again.
- Capture another conversation or close the export view: previous originals must not remain available. Missing, expired, ambiguous or unsupported files should report failure without substituting another file.

Known platform boundary: complete server-side history and hidden/private attachment endpoints cannot be guaranteed from the visible page. Adapters require current live dummy-chat validation; report the platform and what visibly failed, without sharing private chats.
