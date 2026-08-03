# @holdenmatt/md-bundle spec

This spec defines behavior that is intentionally more precise than the README.

This document covers the core bundle model and Node adapter. Schema validation
is specified separately in [docs/schema-spec.md](./docs/schema-spec.md); see the
[schema guide](./docs/schema.md) for examples.

## Entry Points

- `@holdenmatt/md-bundle` is the pure model entry point and must not import
  Node builtins.
- `@holdenmatt/md-bundle/node` is the Node filesystem adapter entry point.
- `@holdenmatt/md-bundle/schema` is a separate browser-safe schema entry point
  and is not imported by the core model.
- `loadBundle` and `writeBundle` are exported from
  `@holdenmatt/md-bundle/node`, not from `@holdenmatt/md-bundle`.
- Migration from `0.1.x`: replace
  `import { loadBundle, writeBundle } from "@holdenmatt/md-bundle"` with
  `import { loadBundle, writeBundle } from "@holdenmatt/md-bundle/node"`.
- A `MarkdownBundle` is a value; where it comes from is an adapter.

## Bundle Model

- Files are sorted lexicographically by path.
- The root is the text file clients read first.
- The root is usually Markdown by convention, but any text format works.
- Root inference is Markdown-biased; explicit `rootPath` is the escape hatch for
  roots such as YAML or JSON manifests.

## Paths

- Bundle paths use `/` and are relative to the bundle directory.
- Stored file paths cannot be empty, absolute, or escape the bundle.
- Stored file paths cannot contain empty, `.`, `..`, or backslash-separated
  segments.
- `validateBundlePath` returns valid contained bundle paths and throws
  `MarkdownBundleError` for invalid paths.

## Construction

- `rootPath` must identify one text file in `files`.
- File paths must be valid and unique.

## Loading

- Without `rootPath`, loading infers the root from top-level Markdown files:
  the only `.md` file, otherwise `SKILL.md`, otherwise `index.md`.
- Missing or ambiguous roots fail.
- Loading skips `.git` directories and does not follow symlinks.
- Loading throws `MarkdownBundleError` with code `path-escape` when a symlinked
  file or directory resolves outside the bundle directory.
- Valid UTF-8 files load as text; non-UTF-8 files load as binary.

## Bundle References

- References resolve from the directory of the file that contains them.
- References starting with `/` resolve from the bundle root.
- Reference resolution can return `""` for the bundle root.
- References cannot escape the bundle.
- Resolution does not check target existence.
- Formatted references are relative to the directory of the file that contains
  them.

## Writing

- Parent directories are created, but existing output directories are not
  deleted.
- Bundle paths are validated before writing so crafted bundle values cannot
  write outside the target directory.

See the [README](./README.md) for an overview and the
[schema specification](./docs/schema-spec.md) for validation semantics layered
on this model.
