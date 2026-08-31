# Repository structure

The repository is organized as a TypeScript modular monolith. Active runtime code is kept under `apps/` and `packages/`; source fixtures and quarantined research data are kept under `data/`; design evidence and historical artifacts are kept under `docs/`.

```text
apps/
  client/                  Next.js public client and future admin surface
  server/                  Express/TypeScript API and persistence boundary
packages/
  contracts/               P0A schemas, semantic contracts, validation registers
  engine/                  Pure deterministic calculator engine (foundation only)
data/
  fixtures/config-samples/ Five untouched draft calculator configurations + biomarker fixture
  catalog/                 Quarantined 62-calculator/79-measurement research datasets
  sources/risk-analysis/   Original Niro PDF/XLSX scoring sources
docs/
  research/                Verified research and scoring extraction
  archive/deliverables/    Prior design pass and utility artifacts
  history/                 Context, transcripts, and Office-document history
scripts/                   Active repository tooling
```

The catalog remains quarantined and no catalog record is imported by the persistence baseline. `data/catalog/backup-2026-08-20/` is retained beneath the catalog as the immutable pre-cleanup backup. Generated `node_modules`, `dist`, and `.next` outputs remain derived artifacts and are recreated by the workspace build.

## Reorganization map

| Previous path                  | Canonical path                  | Treatment                                |
| ------------------------------ | ------------------------------- | ---------------------------------------- |
| `client/`                      | `apps/client/`                  | Active Next.js application               |
| `server/`                      | `apps/server/`                  | Active Express application               |
| `deliverables/config-samples/` | `data/fixtures/config-samples/` | Active draft fixtures, unchanged bytes   |
| `deliverables/research/`       | `docs/research/`                | Research evidence                        |
| `deliverables/transcripts/`    | `docs/history/transcripts/`     | Historical transcripts                   |
| `deliverables/word/`           | `docs/history/word/`            | Historical Office artifacts              |
| remaining `deliverables/`      | `docs/archive/deliverables/`    | Prior design/archive artifacts           |
| `catalog/`                     | `data/catalog/`                 | Quarantined research datasets and backup |
| `Risk Analysis/`               | `data/sources/risk-analysis/`   | Original clinical scoring sources        |
| `context-archive/`             | `docs/history/context-archive/` | Historical analysis/context archive      |

Historical documents are preserved as artifacts. Their narrative references to the former layout are historical evidence; active source-of-truth documents and all executable/configuration references use the canonical paths above.
