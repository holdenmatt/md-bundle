# @holdenmatt/md-bundle

A Markdown bundle is one root text file plus related files in the same folder
tree, addressed by bundle-relative paths.

The root stays the entry point while supporting Markdown files, scripts, and
assets let the bundle grow without becoming one giant document. An
[Agent Skill](https://agentskills.io/) is one example: `SKILL.md` is the root,
with references, scripts, and assets beside it. Markdown is conventional, but
any text file can be the root.

## Install

```sh
npm install @holdenmatt/md-bundle
```

## Load a bundle

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
const checklist = getTextFile(bundle, "references/checklist.md");
```

For browser or in-memory code, create the same value without filesystem access:

```ts
import { createBundle } from "@holdenmatt/md-bundle";

const bundle = createBundle({
  rootPath: "README.md",
  files: [{ path: "README.md", content: "# Example\n" }],
});
```

## Entry points

- `@holdenmatt/md-bundle`: browser-safe bundle model, guards, paths,
  references, and in-memory construction.
- `@holdenmatt/md-bundle/schema`: browser-safe structural validation for
  bundle formats.
- `@holdenmatt/md-bundle/node`: Node filesystem loading and writing.

The core and schema entries do not import Node builtins. A `MarkdownBundle` is
a value; where it comes from is an adapter.

## Validate a bundle format

Use the optional `@holdenmatt/md-bundle/schema` entry point to define rules for
root files, supporting files, and nested bundles.

```ts
import { bundleSchema } from "@holdenmatt/md-bundle/schema";

const skillSchema = bundleSchema({
  root: { path: "SKILL.md" },
  additionalFiles: "allow",
});

const result = skillSchema.parse(bundle);
```

See [Schema guide](./docs/schema.md) for typed parsers, file rules, nested
bundles, findings, and the complete API.

## Documentation

- [Bundle API and usage](./docs/api.md)
- [Core bundle specification](./SPEC.md)
- [Schema guide](./docs/schema.md)
- [Schema specification](./docs/schema-spec.md)
- [Changelog](./CHANGELOG.md)
