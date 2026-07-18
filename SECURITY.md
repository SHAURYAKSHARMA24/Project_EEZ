# Security Policy

## Supported versions

preflight is pre-release software and has **not** been published to npm. There
are no released versions yet, so support is limited to the current state of the
`main` branch. Fixes land on `main`; there is no back-port process while the
project is unpublished.

| Version | Supported |
| --- | --- |
| `main` (unreleased) | ✅ |
| Any tagged/published release | ❌ (none exist yet) |

## Reporting a vulnerability

Please report security vulnerabilities **privately** through GitHub's private
vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (or open
   <https://github.com/SHAURYAKSHARMA24/Project_EEZ/security/advisories/new>).
3. Describe the issue, the affected code path, and a reproduction if possible.

**Do not open a public issue for a security vulnerability.** Public issues are
visible to everyone and can put users at risk before a fix is available.

You should receive an acknowledgement of your report. If a fix is warranted, it
will be prepared privately through a GitHub security advisory and released on
`main`.

## Scope

preflight runs entirely locally and performs no network requests. The most
relevant security-sensitive areas are its taint analysis, secret redaction,
staged-index reads, and the generated pre-commit hook. Reports that show a
missed high-confidence flow, a secret leak in output, or unsafe hook or Git
handling are especially valuable.
