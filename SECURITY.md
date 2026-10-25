# Security Policy

## Supported versions

Security fixes are applied to the latest release and the `dev` branch.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose notes, local
files, credentials, or code execution.

Use GitHub's private vulnerability reporting:

<https://github.com/felixgugu/PuffJoplin/security/advisories/new>

Include:

- Affected version or commit.
- Windows and WebView2 versions.
- Reproduction steps or proof of concept.
- Impact and required preconditions.
- Whether database and managed Markdown-directory modes are both affected.

Please allow time for investigation before public disclosure.

## Sensitive local data

PuffJoplin stores notes, attachments, settings, and logs in the configured data
directory. When reporting a problem, redact private note content and personal
paths from screenshots and logs.
