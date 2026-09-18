# Bundled dependencies

All libraries are installed from their open-source npm packages with exact direct versions and a committed-intent package-lock.json. No installed proprietary extension is used as a dependency.

- PDF.js / pdfjs-dist 6.3.289 — Apache-2.0. Reads and renders PDF pages. JS, worker, character maps, standard fonts, WASM and ICC resources are local.
- Mammoth 1.12.3 — BSD-2-Clause. Converts DOCX in a worker, with external file access and embedded style maps disabled. Its output is normalized rather than trusted as HTML.
- pdfmake 0.3.11 — MIT. Typesets the original conversation layout and returns real PDF bytes.
- JSZip 3.10.1 — test-only direct dependency for independently generated DOCX/PPTX fixtures; also a transitive Mammoth dependency. The PPTX product reader uses native DecompressionStream, not an added ZIP dependency.
- Roboto 3.014 (2025), distributed with pdfmake — SIL OFL. Its license is preserved from the official Roboto repository.
- Noto Sans Devanagari, Malayalam and Tamil (Regular/Bold) — SIL OFL. From the official archived notofonts/noto-fonts repository, hinted/ttf folders.
- Noto Emoji — SIL OFL. From google/fonts, ofl/notoemoji/NotoEmoji[wght].ttf. Embedded monochrome glyphs, no runtime font download.

The build collects dependency license files and appends the font licenses to THIRD-PARTY-NOTICES.txt. Third-party licensing does not select a license for the original product code, which remains UNLICENSED pending the owner's choice.

## Compatibility adaptations

The generated pdfmake browser bundle has two explicitly documented build-time adaptations:

1. Its UMD export is scoped to a local CommonJS-style module before assigning globalThis.pdfMake. Unscoped UMD exports collide with the read-only WorkerGlobalScope.fonts property in Chromium.
2. Three mark-positioning lookup call sites in its bundled fontkit 2.0.4 skip NULL GPOS anchors. This prevents the reproducible Noto Sans Malayalam crash reported in [fontkit issue 367](https://github.com/foliojs/fontkit/issues/367). Missing anchors are treated as no matching positioning adjustment. The build asserts exactly three matches and fails for review if a library update changes them.

These changes are applied only to the pinned open-source build, and disclosed in its bundled notices. No permissions or executable-code restrictions are bypassed.

Reference documentation: [PDF.js](https://mozilla.github.io/pdf.js/), [Mammoth security](https://github.com/mwilliamson/mammoth.js#security), [pdfmake client methods](https://pdfmake.github.io/docs/0.3/getting-started/client-side/methods/), [Noto sources](https://github.com/notofonts/noto-fonts), [Roboto license](https://github.com/googlefonts/roboto-3-classic/blob/main/OFL.txt).
