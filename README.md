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
preflight [check] [path] [--json]
preflight audit [path] [--json]
preflight --help | -h
preflight --version | -v
```

Passing a directory without `check` is equivalent to `preflight check <path>`.
`check` exits 1 for active blocking findings and exits 2 for usage, scan, or
suppression diagnostics. `audit` reports the same diagnostics but always exits
0. `--help` and `--version` do not scan and exit 0; using both together is a
usage error. Use `--json` for machine-readable output.

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

Every finding masks the secret and includes a concrete fix. `preflight` never
claims your app is secure - it reports only what it is confident about.

## Verification and CI

Run the complete self-hosting release check with:

```sh
npm run ci
```

It type-checks, tests, builds, verifies `npm pack --dry-run`, installs a locally
packed tarball to exercise its bin and a known M1a finding, and scans this
repository with the built CLI. The individual self-scan is available as
`npm run check:self`; the package smoke test is `npm run package:smoke`.

GitHub Actions runs this same workflow for `push` and `pull_request` on Node
20 for Ubuntu and Windows, with read-only repository permissions.

## Roadmap

Model-output trust-boundary gates (LLM output to shell/eval/SQL/HTML), an
`audit` tier for cloud/IAM/Firebase/Supabase, pre-commit and agent
integrations, and a screenshot-able report.
