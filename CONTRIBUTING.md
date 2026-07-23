# Contributing to EEZ

Thanks for your interest in improving EEZ. This is a small,
solo-maintained project, so the process is deliberately lightweight — but
because it is a security scanner, correctness and precision matter a lot.

## Prerequisites

- **Node.js 20 or newer** (the CI matrix runs Node 20 on Ubuntu and Windows).
- **npm** (the repository ships a `package-lock.json`; use `npm ci`).
- **git**.

The only production dependency is a pinned TypeScript runtime; everything else
is a dev dependency.

## Getting started

```sh
git clone https://github.com/SHAURYAKSHARMA24/Project_EEZ.git
cd Project_EEZ
npm ci
```

## Development commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-check `src` with `tsc --noEmit`. |
| `npm test` | Run the Vitest suite. |
| `npm run build` | Bundle the CLI with tsup (TypeScript stays external to `dist`). |
| `npm run check:self` | Scan this repository with the built CLI. |
| `npm run package:smoke` | Pack a tarball and exercise the installed bin end to end. |
| `npm run benchmark` | Run the 500-file performance benchmark. |
| `npm run ci` | The full release check (all of the above, in order). |

Before opening a pull request, run the complete check locally:

```sh
npm run ci
```

`npm run ci` type-checks, runs every test, builds, verifies `npm pack
--dry-run`, installs one locally packed tarball, self-scans this repository,
and checks the benchmark. It must pass on both Ubuntu and Windows.

## Pull request expectations

- Keep each PR focused on a single change; unrelated cleanups belong in their
  own PR.
- Use [Conventional Commit](https://www.conventionalcommits.org/) style commit
  and PR titles (`feat:`, `fix:`, `docs:`, `chore:`, …).
- Add or update tests for every behavior change. New detection behavior needs
  both positive and negative coverage.
- Ensure `npm run ci` is green and the working tree is clean
  (`git diff --check`).
- Update the README or other docs when behavior or claims change. Do not
  overstate scanner coverage — precision and honesty are the point.

## Security-sensitive changes

EEZ's value depends on the precision of its taint analysis, its secret
redaction, its staged-index reads, and its pre-commit hook. Changes to any of
the following require focused regression tests and extra review:

- taint sources, sinks, flow, or lexical-ownership logic (`src/taint`, `src/ast`);
- secret detection, masking, or redaction (`src/rules`, `src/redact.ts`, `src/mask.ts`);
- report escaping (`src/report`);
- staged-index scanning (`src/git`) and the pre-commit hook (`src/hooks`).

If you discover a vulnerability, please **do not** open a public issue — see
[SECURITY.md](SECURITY.md) for private reporting.

## Suppression-fixture conventions

Corpus fixtures live under `tests/corpus` (`positives/` and `negatives/`) and
`tests/taint/fixtures`. Because `npm run check:self` scans the whole repository
with the built CLI, any fixture that contains a real finding must suppress it
on the line directly above the finding:

```ts
// eez-ignore-next-line <rule-id> -- intentional positive fixture
exec(modelOutput);
```

- **Positive fixtures** carry exactly one suppression per intended finding, with
  a non-empty reason.
- **Negative fixtures** must produce no findings, so they carry **no**
  suppressions (an unused suppression is a "stale suppression" diagnostic and
  fails the self-scan).
- The positive and negative corpora assert exact counts; update those counts
  when you add a fixture.
