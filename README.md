# @holdenmatt/md-bundle

A Markdown bundle is a root text file plus optional related files in the same
folder tree, addressed by bundle-relative paths.

The root file stays the entry point. Supporting Markdown files, scripts, and
assets let the bundle grow by progressive disclosure instead of becoming one
giant document.

An [agent skill](https://agentskills.io/) is one example of a Markdown bundle:
`SKILL.md` is the root file, while references, scripts, and assets can live
beside it. The root is usually Markdown by convention, but any text format can
root a bundle. A YAML or JSON manifest can be the entry point too.

## Install

```sh
npm install @holdenmatt/md-bundle
```

## Example

```txt
my-skill/
  SKILL.md
  references/checklist.md
  assets/logo.png
```

```ts
import { getTextFile } from "@holdenmatt/md-bundle";
import { loadBundle } from "@holdenmatt/md-bundle/node";

const bundle = await loadBundle("my-skill/SKILL.md");

const root = bundle.root.content;
const checklist = getTextFile(bundle, "references/checklist.md");
```

## Entry Points

`@holdenmatt/md-bundle` exports the pure bundle model. It is browser-safe and
has no Node builtins in its import graph. Use it for bundle values, file type
guards, path validation, references, and in-memory bundle construction.

```ts
import {
  createBundle,
  isTextFile,
  resolveBundleReference,
  validateBundlePath,
} from "@holdenmatt/md-bundle";
```

`@holdenmatt/md-bundle/node` exports the Node filesystem adapter.

```ts
import { loadBundle, writeBundle } from "@holdenmatt/md-bundle/node";
```

A `MarkdownBundle` is a value. Where it comes from is an adapter: browser code
can create, validate, transform, and inspect bundles without depending on
`node:fs` or `node:path`.

Migration from `0.1.x`:

```ts
// Before
import { loadBundle, writeBundle } from "@holdenmatt/md-bundle";

// After
import { loadBundle, writeBundle } from "@holdenmatt/md-bundle/node";
```

## Bundle Model

A bundle has one root text file and zero or more related files beside it.

```ts
type MarkdownBundle = {
  root: MarkdownBundleTextFile;
  files: MarkdownBundleFile[];
};

type MarkdownBundleFile = MarkdownBundleTextFile | MarkdownBundleBinaryFile;

type MarkdownBundleTextFile = {
  path: string;
  content: string;
};

type MarkdownBundleBinaryFile = {
  path: string;
  bytes: Uint8Array;
};
```

```txt
SKILL.md
references/checklist.md
assets/logo.png
```

`root` is the text file clients should read first. It is usually Markdown
(eg `SKILL.md`), but any text format works. A YAML or JSON manifest
can root a bundle when callers pass an explicit `rootPath`.

`files` contains the complete bundle, including the root file.

Files are addressed by paths relative to the bundle directory. Text files store
`content`. Binary files store `bytes`.

## API Reference

### Load

```ts
import { loadBundle } from "@holdenmatt/md-bundle/node";

loadBundle(path, { rootPath }?);
```

Reads a bundle from a root text file or directory.

When `path` is a file, that file is the bundle root and its parent directory is
the bundle directory. When `path` is a directory, `rootPath` can identify the
root file. If omitted, `loadBundle` tries to infer it.

### Create

```ts
createBundle({ rootPath, files });
```

Creates a normalized bundle from in-memory files.

### Validate Paths

```ts
validateBundlePath(bundlePath);
```

Returns a contained bundle path or throws `MarkdownBundleError`. Bundle paths
must be relative `/`-separated paths without empty, `.`, `..`, backslash, or
absolute path segments.

### Get Files

- `getFile(bundle, bundlePath)`: returns a text or binary file.
- `getTextFile(bundle, bundlePath)`: returns a text file.
- `getBinaryFile(bundle, bundlePath)`: returns a binary file.

### File Guards

```ts
isTextFile(file);
isBinaryFile(file);
isMarkdownFile(file);
```

These narrow `MarkdownBundleFile` when filtering or branching on file type.

### Bundle References

```ts
resolveBundleReference(fromPath, referencePath);
```

Resolves a reference written in one bundle file to a normalized bundle path.

```ts
resolveBundleReference("docs/index.md", "./intro.md");
// "docs/intro.md"
```

```ts
formatBundleReference(fromPath, targetPath);
```

Formats a bundle path as a relative reference from one file to another.

```ts
formatBundleReference("docs/index.md", "assets/logo.png");
// "../assets/logo.png"
```

### Write

```ts
import { writeBundle } from "@holdenmatt/md-bundle/node";

writeBundle(bundle, directory);
```

Writes bundle files into `directory`, preserving bundle-relative paths.

### Errors

Expected failures throw `MarkdownBundleError` with a stable `code`.

```ts
class MarkdownBundleError extends Error {
  code: string;
}
```

## Spec

See [SPEC.md](./SPEC.md) for precise behavior around path normalization, root
inference, loading, references, and writing.
