# Contributing to PuffJoplin

Thank you for contributing. PuffJoplin targets Windows 10/11 x64 and is built
with Go, Wails, React, TypeScript, Vditor, and CodeMirror.

## Before opening an issue

- Search existing issues and discussions.
- Confirm the problem exists in the latest `dev` branch build.
- Remove private note content, usernames, tokens, database paths, and other
  sensitive information from screenshots and logs.
- Include reproduction steps, expected behavior, actual behavior, Windows
  version, WebView2 version, and whether the notebook is in database or managed
  Markdown-directory mode.

## Development setup

```powershell
git clone https://github.com/felixgugu/PuffJoplin.git
cd PuffJoplin
npm --prefix frontend install
wails dev
```

Requirements:

- Go 1.26 or newer
- Node.js 22 or newer
- Wails CLI v2.17
- Microsoft Edge WebView2 Runtime
- Google Chrome or Microsoft Edge for PDF export

Use an isolated data directory while testing:

```powershell
$env:PUFFJOPLIN_DATA_DIR = "G:\Temp\PuffJoplin-dev-data"
wails dev
```

## Pull requests

- Keep changes focused and explain the user-visible outcome.
- Add or update tests for behavior changes.
- Preserve existing user data and support both database and managed-directory
  notebooks.
- Do not include generated build output, local `data/`, credentials, or personal
  screenshots.
- Update `README.md`, `AGENTS.md`, or tests when behavior or UI contracts change.

Before submitting:

```powershell
npm run test:all
```

## Code and UI conventions

- Use the UI block names and CSS cascade rules defined in `AGENTS.md`.
- Keep all primary application styles in `frontend/src/styles.css`.
- Do not add remote CDN dependencies for core editor assets.
- Keep notebook content local-first and preserve external Markdown files.
- Follow the AGPL-3.0-or-later license and retain third-party notices.

## Commit messages

Prefer concise conventional prefixes such as:

```text
feat: add ...
fix: correct ...
docs: update ...
test: cover ...
refactor: simplify ...
```
