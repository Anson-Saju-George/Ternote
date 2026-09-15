# Development status

Latest checkpoint (2026-09-15): sharper-green PDF/identity pass. 23 unit/security tests and the complete isolated Edge suite pass. Source attribution, paired turn numbering, tinted boxes, fresh-page attachment flow, stronger UI contrast, squarer widget, image-in-button discovery and targeted expansion warnings are implemented. User visual approval is pending. See NEXT-STEPS.md for the agreed sequence and full requested feature backlog.

Capture-loop follow-up: anonymous artifact panels now have distinct identities and nested panel wrappers are read once. The regression fixture reproduces the old loop and passes with the fix. The original ChatGPT tab was no longer open when the session resumed, so confirmation against that same live conversation remains pending. Edge is open for the user's next check.

Important: native ChatGPT PPTX/DOCX/PDF buttons still need a download resolver; the current PDF reports unavailable file cards at their conversation position. Reusable cross-view caching, General/Export settings, saved library, sidebar and additional formats are NOT complete. Cache draft modules are excluded from dist.

Step 1 UI: approved. No demo/sample card or controls remain.

Step 2 requested by the user: entire-chat loading with progress/cancel, accessible images/PDF/DOCX/artifacts, optimized preview, and a polished directly downloaded PDF. Direct-URL and synthetic cases work; native file-card coverage is incomplete. Continue via individually approved checkpoints.

Implemented additions: bidirectional incremental capture, stable-ID virtualization handling, conservative history/expand controls, scroll restoration, chunked transfers, cancellable local document workers, an expiring capture session, explicit asset failure notes, original PDF layout, actual paginated PDF preview, cached download bytes, offline fonts, compressed ZIP packaging, and updated privacy/security documentation.

Automated checks include 21 unit/security tests plus isolated Edge scenarios: zero default site grants, no sample UI, capture-on-action, HTML preview/selection/Unicode, three synthetic adapters, direct PDF file bytes and download, no print dialog, searchable PDF text, delayed history loading, 200-message virtualized capture, duplicate-message preservation, scroll restoration, safe content expansion/cancellation, image capture, PDF page rendering, DOCX conversion, inert HTML sanitization, artifact capture, and combined attachment PDF output. Synthetic tests are not live-platform certification.

The PDF worker-global collision, a reproducible upstream fontkit Malayalam crash, background-tab PDF rendering stalls, and trailing blank-page spacing were corrected during testing.

Remaining release gates: current live-site dummy-chat checks; platform-specific hidden/card-only attachment and artifact handling; deeper math/inline/merged-table fidelity; broader language coverage; malformed-input/performance/privacy/accessibility audits; final branding, license, GitHub owner and store publisher; original store screenshots and public support/privacy URLs.

The Git repository uses main. The user authorized this checkpoint's commit/push to https://github.com/Anson-Saju-George/ConvoLeaf.git. The extension retains its working name because an unrelated “ConvoLeaf - Chat Exporter” already exists in the Chrome Web Store; branding is unresolved. package.json remains private and UNLICENSED until the user selects the public license. Dependencies and generated notices are prepared for a later distribution review. Proprietary snapshots, browser profiles, captures, dependencies and generated builds remain outside Git.

Phases remain: archive/research; product specification; independent foundation; feature-by-feature Edge approval; hardening; GitHub preparation; Chrome Web Store submission.
