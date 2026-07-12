# Changelog

## 0.2.0

- Breaking: the root `md-bundle` entry point is now browser-safe and exports
  only the pure Markdown bundle model.
- Move Node filesystem helpers to `md-bundle/node`.
- Migration: replace `import { loadBundle, writeBundle } from "md-bundle"` with
  `import { loadBundle, writeBundle } from "md-bundle/node"`.
