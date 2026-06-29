# md-bundle

A Markdown bundle is a root Markdown file plus optional related files in the
same folder tree, addressed by bundle-relative paths.

The root file stays the entry point. Supporting Markdown files, scripts, and
assets let the bundle grow by progressive disclosure instead of becoming one
giant document.

An [agent skill](https://agentskills.io/) is one example of a Markdown bundle:
`SKILL.md` is the root file, while references, scripts, and assets can live
beside it. `md-bundle` makes that folder shape reusable for skills, agent
instructions, docs, specs, and other Markdown artifacts.

## Example

```txt
my-skill/
  SKILL.md
  references/checklist.md
  assets/logo.png
```

```ts
import { getTextFile, loadBundle } from "md-bundle";

const bundle = await loadBundle("my-skill/SKILL.md");

const root = bundle.root.content;
const checklist = getTextFile(bundle, "references/checklist.md");
```

## Bundle Model

A bundle has one root Markdown file and zero or more related files beside it.

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

`root` is the text file clients should read first. `files` contains the complete
bundle, including the root file.

Files are addressed by paths relative to the bundle directory. Text files store
`content`. Binary files store `bytes`.

## API Reference

### Load

```ts
loadBundle(path, { rootPath }?);
```

Reads a bundle from a root Markdown file or directory.

When `path` is a file, that file is the bundle root and its parent directory is
the bundle directory. When `path` is a directory, `rootPath` can identify the
root file. If omitted, `loadBundle` tries to infer it.

### Create

```ts
createBundle({ rootPath, files });
```

Creates a normalized bundle from in-memory files.

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
