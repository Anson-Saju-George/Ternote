# Edge visual tests

Current check: sharper green PDF. Run npm run open:edge -- --reload --chat-preview to reopen the latest ChatGPT chat in the dedicated test profile and prepare its actual PDF preview. This does not download the chat automatically.

- Summary: ChatGPT logo/name, message count, link, exposed model identifier and effort or an explicit unavailable label.
- Conversation: You 1 / logo 1, You 2 / logo 2; tinted rectangular boxes; readable tables/code with repeated headers.
- Images: clickable image previews should now be included; accessible attachments start new pages in sequence and text continues afterward.
- Popup/widget: darker privacy copy, stronger type, squared controls, subtle privacy-dot pulse (off with reduced motion).
- Native file-card contents are the NEXT checkpoint. Their names/limitations must appear explicitly, not silently vanish.

Step 1: popup design approved. Demo/sample card and controls removed.

Step 2: full-chat loading, attached content and polished direct PDF — ready for user testing after automated checks.

1. Run npm run open:edge -- --reload. Use the dedicated Edge test profile. Enable your platform if needed.
2. Open a dummy conversation with older messages, images, a PDF, a DOCX and an artifact. Use the small in-page Export button to keep a dedicated export view open.
3. Watch the progress bar and message count while the page scrolls. Check that early and late messages appear once, in order. Compare repeated identical messages too.
4. Cancel a capture. It should stop, restore the scroll position and download nothing incomplete.
5. Choose PDF document .pdf, Paper or Midnight, then Preview. This shows actual PDF pages; use the arrows to inspect them.
6. Check speaker labels, title, margins, code wrapping, table headings, image sizing and page breaks. No blank trailing page should appear.
7. Export. A .pdf should download directly, with no print popup. Compare it against the preview.
8. Check every page of attached PDFs. Check DOCX text, tables and images, and exposed artifact content. Unreadable attachments must have a note explaining why; a filename alone is not a successful attachment export.
9. Test selected messages and metadata off. Enable redaction: image/PDF pixel content must be omitted with an explanation, not claim to be redacted.
10. Switch to another browser tab during a long PDF preparation, then return. Rendering should continue. Reopen the exporter to capture a changed conversation.

Known platform boundary: complete server-side history and hidden/private attachment endpoints cannot be guaranteed from the visible page. Adapters require current live dummy-chat validation; report the platform and what visibly failed, without sharing private chats.
