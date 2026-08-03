# Bundle API and usage

This guide covers the browser-safe bundle model and the Node filesystem
adapter. For format validation, see the [schema guide](./schema.md).

## Bundle model

A Markdown bundle has one root text file and a complete list of its text and
binary files:

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

`root` is the text file clients should read first. It is usually Markdown,
but any text format can be the root. `files` contains the complete bundle,
including `root`, sorted lexicographically by path.

Bundle paths use `/` and are relative to the bundle directory:

```txt
SKILL.md
references/checklist.md
assets/logo.png
```

## Load from the filesystem

`loadBundle` is available from the Node entry point:

```ts
import { loadBundle } from "@holdenmatt/md-bundle/node";

const bundle = await loadBundle("my-skill/SKILL.md");
```

When the input is a file, that file becomes the root and its parent directory
becomes the bundle directory.

Directory input can provide an explicit bundle-relative root:

```ts
const bundle = await loadBundle("my-skill", {
  rootPath: "SKILL.md",
});
```

Without `rootPath`, directory loading examines top-level Markdown files. It
uses the only `.md` file when there is one, then prefers `SKILL.md`, then
`index.md`. Otherwise it reports a missing or ambiguous root.

Files containing valid UTF-8 load as text; other files load as bytes.
`.git` directories and symlinks are not loaded.

## Create in memory

`createBundle` constructs the same normalized value without filesystem
access:

```ts
import { createBundle } from "@holdenmatt/md-bundle";

const bundle = createBundle({
  rootPath: "README.md",
  files: [
    { path: "README.md", content: "# Example\n" },
    { path: "notes/todo.txt", content: "Ship it.\n" },
    { path: "assets/logo.png", bytes: new Uint8Array([137, 80, 78, 71]) },
  ],
});
```

`rootPath` must identify one text file. Paths must be valid and unique.
`createBundle` sorts the returned file list and makes `bundle.root` refer to
the matching item in that list.

The exported `CreateBundleInput` type describes this input.

## Read files

Use the file getters when a missing file or representation mismatch should be
an error:

```ts
import { getBinaryFile, getFile, getTextFile } from "@holdenmatt/md-bundle";

const root = getTextFile(bundle, "README.md");
const logo = getBinaryFile(bundle, "assets/logo.png");
const file = getFile(bundle, "notes/todo.txt");
```

- `getFile` returns a text or binary file.
- `getTextFile` requires text content.
- `getBinaryFile` requires binary bytes.

The file guards narrow `MarkdownBundleFile` when filtering or branching:

```ts
import { isBinaryFile, isMarkdownFile, isTextFile } from "@holdenmatt/md-bundle";

const markdownFiles = bundle.files.filter(isMarkdownFile);

for (const file of bundle.files) {
  if (isTextFile(file)) {
    console.log(file.content);
  } else if (isBinaryFile(file)) {
    console.log(file.bytes.byteLength);
  }
}
```

`isMarkdownFile` requires both text content and a path ending in `.md`.

## Validate paths

`validateBundlePath` accepts contained, bundle-relative paths:

```ts
import { validateBundlePath } from "@holdenmatt/md-bundle";

validateBundlePath("references/checklist.md");
```

Paths cannot be empty or absolute, use backslashes, or contain empty, `.`, or
`..` segments. Invalid paths throw `MarkdownBundleError`.

## Resolve references

`resolveBundleReference` resolves a reference from the directory of the file
that contains it:

```ts
import { resolveBundleReference } from "@holdenmatt/md-bundle";

resolveBundleReference("docs/index.md", "./intro.md");
// "docs/intro.md"

resolveBundleReference("docs/index.md", "/assets/logo.png");
// "assets/logo.png"
```

Resolution validates containment but does not check whether the target exists.

`formatBundleReference` performs the inverse formatting operation:

```ts
import { formatBundleReference } from "@holdenmatt/md-bundle";

formatBundleReference("docs/index.md", "assets/logo.png");
// "../assets/logo.png"
```

## Write to the filesystem

`writeBundle` is available from the Node entry point:

```ts
import { writeBundle } from "@holdenmatt/md-bundle/node";

await writeBundle(bundle, "output");
```

It creates parent directories and writes every bundle file beneath the target
directory. It does not delete files that are already present.

## Handle errors

Expected failures throw `MarkdownBundleError` with a stable machine-readable
`code`:

```ts
import { MarkdownBundleError } from "@holdenmatt/md-bundle";

try {
  validateBundlePath("../outside.md");
} catch (error) {
  if (error instanceof MarkdownBundleError) {
    console.error(error.code, error.message);
  }
}
```

## Entry-point exports

`@holdenmatt/md-bundle` exports:

- `createBundle`
- `getFile`, `getTextFile`, and `getBinaryFile`
- `isTextFile`, `isBinaryFile`, and `isMarkdownFile`
- `validateBundlePath`
- `resolveBundleReference` and `formatBundleReference`
- `MarkdownBundleError`
- `CreateBundleInput`
- `MarkdownBundle`, `MarkdownBundleFile`, `MarkdownBundleTextFile`, and
  `MarkdownBundleBinaryFile`

`@holdenmatt/md-bundle/node` exports:

- `loadBundle` and `LoadBundleOptions`
- `writeBundle`

For format validation, continue with the [schema guide](./schema.md). For exact
behavioral guarantees and edge cases, consult the optional
[core specification](../SPEC.md).
