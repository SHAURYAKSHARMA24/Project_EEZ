# EEZ

[![CI](https://github.com/SHAURYAKSHARMA24/Project_EEZ/actions/workflows/ci.yml/badge.svg)](https://github.com/SHAURYAKSHARMA24/Project_EEZ/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)

Fast, deterministic security scanning for AI-written TypeScript. EEZ installs
one pinned TypeScript runtime dependency and runs entirely locally: your code
never leaves your machine. TypeScript stays external to `dist` and resolves
from EEZ's own installation, never from the project being scanned.

EEZ is pre-release software and has not yet been published to npm.

## Usage

Build a local checkout first:

```sh
npm install
npm run build
node dist/cli.js --help
```

The packaged command accepts:

```text
eez <check|audit> [path] [--staged] [--json | --format sober|json|github] [--report html --output <file>]
eez install-hook
eez --help | -h
eez --version | -v
```

Passing a directory without `check` is equivalent to `eez check <path>`.
`check` exits 1 for active blocking findings and exits 2 for usage, scan, or
suppression diagnostics. `audit` is non-blocking for findings and exits 0 for
them, but surfaces the same usage, scan, and suppression diagnostics as
`check` and exits 2 for those. `--help` and `--version` do not scan and exit
0; using both together is a usage error.

### Pre-commit and staged scans

`eez check --staged` scans the complete stage-0 blobs in Git's index for
added, copied, modified, and renamed JavaScript/TypeScript files. It does not
read their working-tree contents, so a partially staged safe file stays safe
even if its unstaged version is vulnerable. Each staged file is analyzed as a
complete file in one shared in-memory analysis; a path cannot be combined with
`--staged`. Deleted files and non-regular Git entries are not scanned.

Install the repository-local hook with:

```sh
eez install-hook
```

The generated cross-platform Git hook runs `eez check --staged` before a
commit and blocks on active findings or diagnostics. Installation is
idempotent. EEZ never overwrites a different existing pre-commit hook;
in that case, preserve the hook and add `eez check --staged` to it
manually. If dependencies move or are removed, reinstall them and rerun the
installer. No global installation or hook framework is required.

### Agent and CI output

`--json` is a backward-compatible alias for `--format json`. JSON reports use
schema version 1 and always contain these top-level fields:

```json
{
  "schemaVersion": 1,
  "scanComplete": true,
  "findings": [],
  "errors": [],
  "suppressed": [],
  "summary": { "check": 0, "audit": 0, "suppressed": 0, "total": 0 }
}
```

`scanComplete` is `true` only when the scanner completed every requested file;
consumers must treat a missing or false value as an incomplete result. Finding
locations use repository/scan-root-relative paths and one-based line
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
- `audit`: 0 when clean or when it reports findings, 2 for usage, scan, or
  suppression diagnostics.
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

EEZ is fully offline and deterministic. It performs no network requests,
uploads, or telemetry in any output mode.

## Intentional test-fixture suppressions

Suppress a named rule on exactly the next physical JavaScript or TypeScript
line with a non-empty reason:

```ts
// eez-ignore-next-line hardcoded-credential,secret-to-browser -- intentional test fixture
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
- **Model-controlled data passed to execution sinks** - selected model output
  and tool-handler arguments flowing to shell or dynamic-code execution.

### v0.1 model-to-execution coverage

| Area | Detected in v0.1 | Boundary |
|---|---|---|
| Sources | OpenAI Responses API `output_text` | Requires a const-bound client constructed from the default `openai` import, such as `const client = new OpenAI(); client.responses.create(...)`; direct constructor chaining, unrelated, and shadowed symbols do not match. |
| Sources | Vercel AI SDK `generateText()` text: destructured `{ text }`, `result.text`, or direct `(await generateText(...)).text` | Only the supported `text` shapes are modeled; other properties of a non-destructured result are not tainted. |
| Sources | First parameter of an inline Vercel AI SDK `tool({ execute: (...) => ... })` handler | Identifier handlers and shorthand `execute` properties are not resolved. |
| Sources | First parameter of inline MCP SDK `registerTool(...)` and `.tool(...)` handlers, when the registration declares tool inputs | The handler must be inline and the receiver/import must resolve to the `@modelcontextprotocol/sdk` package family. `registerTool` requires an `inputSchema` in its config; the deprecated `.tool(...)` requires a params-schema argument. Registrations without one take no tool arguments - their first parameter is the transport `extra` object, so they are not treated as a source. `.tool(name, annotations, cb)` and `.tool(name, schema, cb)` are indistinguishable by type, so an object whose values are all primitive literals is read as annotations. |
| Sinks | Imported Node `child_process` / `node:child_process` `exec` and `execSync`; unshadowed global `eval`; unshadowed global `Function` calls or construction | Sink matching uses import or global symbol identity, not bare names. |
| Sinks | Imported Node `child_process` / `node:child_process` `spawn` | Detected only when an inline options object contains literal `shell: true`. |
| Propagation | Direct flows, template-literal spans, `+` concatenation, and one `const` assignment hop, within the same lexical owner | A direct tool-parameter property supports one const hop, such as `const command = args.cmd; exec(command)`. Deeper properties, method calls, mutable bindings, and second-hop chains are not modeled. |

Known gaps in v0.1 are interprocedural helper calls, cross-file flows,
second-hop assignment chains, tool-argument method calls or deep property
access, sanitizer modeling, string-valued `shell` options, additional model and
tool providers, and SARIF output.

Every finding masks the secret and includes a concrete fix. EEZ never
claims your app is secure - it reports only what it is confident about.

## Verification and CI

Run the complete self-hosting release check with:

```sh
npm run ci
```

It type-checks, tests, builds, scores the public labeled corpus, verifies
`npm pack --dry-run`, installs one locally packed tarball, and exercises its
bin, JSON v1, GitHub annotations, HTML report, staged scan, pre-commit hook,
and TypeScript dependency isolation. It then scans this repository with the
built CLI and runs a separate synthetic 500-file throughput benchmark that
includes about 20,000 unrelated calls in clean files. The
individual self-scan is available as `npm run check:self`; the package smoke
test is `npm run package:smoke`.

After `npm run build`, run `npm run benchmark:corpus` to score the 48-case
public corpus in `benchmark/corpus` against `benchmark/expected.json`. The
scorer validates the JSON v1 report (including `scanComplete: true`), rejects
suppressions and scan errors, reports per-category and overall precision and
recall, and lists known-gap cases—including any detections—separately from the
scored totals. Run
`npm run benchmark` for the distinct generated 500-file performance check.

GitHub Actions runs this same workflow for `push` and `pull_request` on Node
20 for Ubuntu and Windows, with read-only repository permissions.

## Roadmap

Additional trust-boundary gates, an `audit` tier for cloud/IAM/Firebase/
Supabase, SARIF/reusable CI integrations, and richer policy configuration.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for
prerequisites, development commands, the `npm run ci` release check, and the
suppression-fixture conventions. Please also review the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, use GitHub's private vulnerability reporting instead
of a public issue. See [SECURITY.md](SECURITY.md) for details.

## License

[MIT](LICENSE) © 2026 Shaurya K Sharma
