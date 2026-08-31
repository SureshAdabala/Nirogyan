# Path migration and preservation audit

The 2026-08-21 reorganization was a move-only operation. No source, configuration, schema, dataset, research document, Office artifact, or historical file was deleted or overwritten. Destination collisions were checked before each move.

The pre-move inventory contained 180 non-dependency files (49,306,687 bytes) across 52 project directories. The six top-level moves and four nested archive/fixture moves are recorded in `PROJECT-STRUCTURE.md`. After the move, the source file set is verified again by path and content checks before the persistence build; application build outputs are intentionally regenerated because they are derived from source.

The workspace metadata was updated for `apps/client` and `apps/server` in the root package/workspace graph, TypeScript project references, lint/format globs, package-relative test configuration, README, environment examples, the implementation plan, Claude context, and P0A contract references. No clinical value or P0A contract meaning was changed.
