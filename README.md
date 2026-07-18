# preflight (working name)

Fast, deterministic security preflight for AI-written TypeScript. It installs
one pinned TypeScript runtime dependency and runs entirely locally: your code
never leaves your machine. TypeScript stays external to `dist` and resolves
from preflight's own installation, never from the project being scanned.

`preflight` is still a working name. This repository is not published to npm.

## Usage

Build a local checkout first:

```sh
npm install
npm run build
node dist/cli.js --help
```

The packaged command accepts:

```text
preflight <check|audit> [path] [--staged] [--json | --format sober|json|github] [--report html --output <file>]
preflight install-hook
preflight --help | -h
preflight --version | -v
```

Passing a directory without `check` is equivalent to `preflight check <path>`.
`check` exits 1 for active blocking findings and exits 2 for usage, scan, or
suppression diagnostics. `audit` reports the same diagnostics but always exits
0. `--help` and `--version` do not scan and exit 0; using both together is a
usage error.

### Pre-commit and staged scans

`preflight check --staged` scans the complete stage-0 blobs in Git's index for
added, copied, modified, and renamed JavaScript/TypeScript files. It does not
read their working-tree contents, so a partially staged safe file stays safe
even if its unstaged version is vulnerable. Each staged file is analyzed as a
complete file in one shared in-memory analysis; a path cannot be combined with
`--staged`. Deleted files and non-regular Git entries are not scanned.

Install the repository-local hook with:

```sh
preflight install-hook
```

The generated cross-platform Git hook runs `preflight check --staged` before a
commit and blocks on active findings or diagnostics. Installation is
idempotent. Preflight never overwrites a different existing pre-commit hook;
in that case, preserve the hook and add `preflight check --staged` to it
manually. If dependencies move or are removed, reinstall them and rerun the
installer. No global installation or hook framework is required.

### Agent and CI output

`--json` is a backward-compatible alias for `--format json`. JSON reports use
schema version 1 and always contain these top-level fields:

```json
{
  "schemaVersion": 1,
  "findings": [],
  "errors": [],
  "suppressed": [],
  "summary": { "check": 0, "audit": 0, "suppressed": 0, "total": 0 }
}
```

Finding locations use repository/scan-root-relative paths and one-based line
numbers; `column`, `source`, `sink`, and `masked` are present only when known.
Suppression records include `ruleId`, `file`, `line`, `directiveLine`, and a
redacted `reason`. Consumers should ignore unknown fields. Compatible fields
may be added within version 1; an incompatible shape will increment
`schemaVersion`.

For GitHub Actions, `--format github` emits native workflow annotations:
blocking findings and diagnostics are errors, while audit findings are
warnings. Annotation properties and messages are command-escaped and redacted.
No Action, problem-matcher, or SARIF upload is required.

The exit-code contract is stable:

- `check`: 0 when clean, 1 for active blocking findings, 2 for usage, scan, or
  suppression diagnostics.
- `audit`: always 0, including when it reports findings or diagnostics.
- `--help` and `--version`: 0 when used validly.
- `install-hook`: 0 when installed/already installed, 2 when installation
  cannot be completed safely.

### Shareable HTML report

Add `--report html --output <file>` to any `check` or `audit` scan to write a
self-contained HTML sidecar while keeping the selected sober, JSON, or GitHub
output on stdout. The report groups findings, shows counts and concrete fixes,
uses inline CSS only, and contains no scripts or external assets. Dynamic
content and known secret values are redacted before HTML escaping, just as in
the sober and JSON reports.

Preflight is fully offline and deterministic. It performs no network requests,
uploads, or telemetry in any output mode.

## Intentional test-fixture suppressions

Suppress a named rule on exactly the next physical JavaScript or TypeScript
line with a non-empty reason:

```ts
// preflight-ignore-next-line hardcoded-credential,secret-to-browser -- intentional test fixture
const fixtureKey = "...";
```

Only registered rule IDs are accepted. A malformed directive, unknown rule,
or directive that suppresses no finding is a diagnostic: it makes `check` exit
2 and is reported without blocking `audit`. Suppressions never apply to
`.env*` files, and they remove only the named finding(s) from exit-code
evaluation. Directive content and known secret values are redacted in output.

JSON output includes structured `suppressed` records and a suppressed count in
its summary. The sober text report prints only a compact suppression count, not
suppression reasons.

## What it checks (v0.1)

- **Hardcoded credentials** - known provider key formats and PEM private keys.
  In `.env*` files, this gate fires only when Git tracks the file, avoiding
  false positives for ignored local configuration.
- **Secrets exposed to the browser** - known secrets attached to
  `NEXT_PUBLIC_*` / `VITE_*` variables that ship in the client bundle.
- **LLM output passed to execution sinks** - OpenAI Responses `output_text` or
  Vercel AI SDK `generateText().text` flowing directly within a lexical owner
  to `child_process.exec` / `execSync`, global `eval`, or global `Function`.

Every finding masks the secret and includes a concrete fix. `preflight` never
claims your app is secure - it reports only what it is confident about.

## Verification and CI

Run the complete self-hosting release check with:

```sh
npm run ci
```

It type-checks, tests, builds, verifies `npm pack --dry-run`, installs one
locally packed tarball, and exercises its bin, JSON v1, GitHub annotations,
HTML report, staged scan, pre-commit hook, and TypeScript dependency isolation.
It then scans this repository with the built CLI and checks the 500-file
benchmark. The individual self-scan is available as `npm run check:self`; the
package smoke test is `npm run package:smoke`.

GitHub Actions runs this same workflow for `push` and `pull_request` on Node
20 for Ubuntu and Windows, with read-only repository permissions.

## Roadmap

Additional trust-boundary gates, an `audit` tier for cloud/IAM/Firebase/
Supabase, SARIF/reusable CI integrations, and richer policy configuration.
