# Public taint benchmark

This directory is the versioned public benchmark for preflight's TypeScript
model-controlled-data-to-code-execution rule. The corpus contains small, reviewable source
files rather than generated projects so each label can be audited directly.

## Running the benchmark

Build the CLI before scoring the corpus:

```sh
npm run build
npm run benchmark:corpus
```

`npm run ci` runs the corpus scorer after the build and also preserves the separate 500-file
performance benchmark (`npm run benchmark`). The scorer invokes `dist/cli.js check
benchmark/corpus --json`; it does not call internal rule functions.

## Labels

[`expected.json`](./expected.json) is a schema-versioned list with exactly one entry for every
`.ts` file under `corpus/`. A list is used so the scorer can reject duplicate paths after
normalizing Windows and POSIX separators.

- `expected: "finding"` means the file contains exactly one model-controlled-data-to-sink
  path that v0.1 claims to detect.
- `expected: "clean"` means the file is safe or is deliberately outside the declared v0.1
  scope.
- `gap: true` is required only for `known-gaps/` cases. These cases remain labeled clean and
  visible in the output, but are excluded from precision and recall denominators.
- `provenance` records a real-world source when a fixture is derived from one. `limitation`
  explains why every known-gap case is deferred.

Corpus fixtures never contain suppression directives. A suppressed result is not a detection,
and the scorer rejects any suppression in its JSON report.

## Categories and current size

| Category | Cases | Purpose |
|---|---:|---|
| `positives/direct` | 6 | OpenAI Responses or Vercel `generateText` output directly reaches `exec`, `execSync`, `eval`, `Function`, or `spawn(..., { shell: true })`. |
| `positives/concat` | 6 | The same sources reach those sinks through `+` concatenation, including a one-const hop and a concatenation inside a template span. |
| `positives/tool-arg` | 8 | Vercel `tool({ execute })` and MCP tool-handler parameters reach modeled sinks. |
| `negatives/sanitized` | 5 | Number conversion, fixed dispatch, allowlisting, validation, and schema parsing produce constrained values before a sink. |
| `negatives/benign` | 5 | Model output is logged, returned, written, passed as a non-shell argument, or appears beside a static sink call. |
| `negatives/shadowed` | 5 | Same-named local functions/classes and non-MCP tool registries must not be mistaken for modeled sources or sinks. |
| `known-gaps` | 7 | Deferred interprocedural, cross-file, second-hop, and deeper tool-property propagation remains visible without overstating v0.1 recall. |

Total: 42 cases.

## Scoring and failure policy

Scoring is file-level: one or more findings would mark a file detected, but the current corpus
requires exactly one finding per positive and rejects duplicate finding paths. The table reports
TP, FP, FN, TN, precision, and recall by category and overall. Known gaps are printed but excluded
from the overall totals.

The command fails when:

- recall is below `0.90` in any of `positives/direct`, `positives/concat`, or
  `positives/tool-arg`;
- any sanitized, benign, or shadowed negative has a finding;
- the CLI reports a scanner error, malformed JSON, suppressions, or an unexpected exit status;
- labels and files do not match exactly, a path is duplicated or escapes the corpus, a finding
  names an unexpected path, the manifest schema is malformed, or any required category is empty;
- the corpus size leaves the required 30-50 case range.

## Real-world provenance

The four `positives/tool-arg/mcp-*.ts` cases model the MCP command-execution-handler pattern
associated with mcp-remote [CVE-2025-6514](https://nvd.nist.gov/vuln/detail/CVE-2025-6514):

- `mcp-bare-function.ts` varies the direct registration API and dynamic-evaluation sink.
- `mcp-inline-tool-spawn.ts` varies an inline server receiver and shell-enabled spawn.
- `mcp-namespace-exec-sync.ts` varies the MCP method and namespace-imported sink.
- `mcp-register-exec.ts` is the canonical destructured command argument reaching `exec`.

The Vercel fixtures model the documented `tool({ execute })` handler shape but are not claimed to
reproduce a specific vulnerability. Every provenance-bearing case repeats its provenance in the
manifest and a source comment so it survives copying a fixture independently.

## Limitations

This is a focused regression benchmark, not a prevalence study. Its files are intentionally
minimal, TypeScript-only, and limited to the providers and sinks declared for v0.1. The scanner
does not yet perform interprocedural summaries, cross-file taint propagation, propagation beyond
one const binding, or general method/deep-property propagation. It also does not model sanitizers
as first-class taint stoppers; the sanitized controls use transformations that produce constrained
values and are not traced as tainted by the current shallow engine. Additional model providers,
SARIF output, and richer sanitizer semantics remain future work.
