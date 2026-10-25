# Third-Party Notices

PuffJoplin includes or links against third-party software. Those components
remain the property of their respective copyright holders and are governed by
their own licenses.

This file identifies major direct dependencies and required attribution. The
authoritative dependency graph is recorded in `go.mod`, `go.sum`, and
`frontend/package-lock.json`. License files for bundled icon assets are kept
with those assets.

## Backend

| Component | License | Project |
|---|---|---|
| Wails v2 | MIT | <https://github.com/wailsapp/wails> |
| chromedp | MIT | <https://github.com/chromedp/chromedp> |
| pdfcpu | Apache-2.0 | <https://github.com/pdfcpu/pdfcpu> |
| fsnotify | BSD-3-Clause | <https://github.com/fsnotify/fsnotify> |
| google/uuid | BSD-3-Clause | <https://github.com/google/uuid> |
| bluemonday | BSD-3-Clause | <https://github.com/microcosm-cc/bluemonday> |
| modernc.org/sqlite | BSD-3-Clause | <https://gitlab.com/cznic/sqlite> |
| golang.org/x/image | BSD-3-Clause | <https://golang.org/x/image> |
| golang.org/x/net | BSD-3-Clause | <https://golang.org/x/net> |
| golang.org/x/sys | BSD-3-Clause | <https://golang.org/x/sys> |

## Frontend

| Component | License | Project |
|---|---|---|
| React and React DOM | MIT | <https://github.com/facebook/react> |
| Vditor | MIT | <https://github.com/Vanessa219/vditor> |
| CodeMirror 6 packages | MIT | <https://github.com/codemirror/dev> |
| Lezer Highlight | MIT | <https://github.com/lezer-parser/highlight> |
| Canvg | MIT | <https://github.com/canvg/canvg> |
| md-to-docx | MIT | <https://github.com/mohtasham/md-to-docx> |
| Vite | MIT | <https://github.com/vitejs/vite> |
| TypeScript | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| Vitest | MIT | <https://github.com/vitest-dev/vitest> |
| PostCSS | MIT | <https://github.com/postcss/postcss> |
| happy-dom | MIT | <https://github.com/capricorn86/happy-dom> |

## Font Awesome Free

The toolbar SVG assets under
`frontend/src/assets/toolbar-icons-fontawesome/` are from Font Awesome Free by
Fonticons, Inc.

- Icons: CC BY 4.0
- Fonts: SIL OFL 1.1
- Non-font code: MIT
- Full license: <https://fontawesome.com/license/free>

The bundled `LICENSE.txt` in that directory contains the complete applicable
license and attribution information.

## Fonts and platform components

PuffJoplin uses fonts and WebView2 components supplied by the operating system.
They are not redistributed in this repository. Windows, Microsoft Edge WebView2,
Segoe UI, Microsoft JhengHei UI, and related names are trademarks or components
of Microsoft Corporation.

## Distribution

When distributing a compiled PuffJoplin binary, include:

- `LICENSE`
- `NOTICE.md`
- `THIRD_PARTY_NOTICES.md`
- The generated `licenses/` directory containing dependency license texts
- `SHA256SUMS.txt`

The corresponding source for AGPL-covered code must be available for the exact
published version. Release tags on the public repository provide that mapping.
