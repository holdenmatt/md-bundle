# Changelog

## 0.4.0

- Add the browser-safe `@holdenmatt/md-bundle/schema` entry point for typed
  bundle-format validation, nested bundles, and findings.
- Include the schema guide and specification in the published package.

## 0.3.0

- Package identity: this package is now published as `@holdenmatt/md-bundle`.
- Breaking: bundle paths are now strictly contained paths. Stored paths with
  absolute paths, empty segments, `.`, `..`, or backslash separators now throw.
- Breaking: `loadBundle` now throws `MarkdownBundleError` with code
  `path-escape` when a symlinked file or directory resolves outside the bundle
  directory.
- Document that bundle roots are text files. Markdown is the convention, but
  other roots such as `PROVIDER.yaml` are supported.
- Add `validateBundlePath` to the browser-safe root entry.

## 0.2.0

- Breaking: the root `@holdenmatt/md-bundle` entry point is now browser-safe
  and exports only the pure Markdown bundle model.
- Move Node filesystem helpers to `@holdenmatt/md-bundle/node`.
- Migration: replace
  `import { loadBundle, writeBundle } from "@holdenmatt/md-bundle"` with
  `import { loadBundle, writeBundle } from "@holdenmatt/md-bundle/node"`.
