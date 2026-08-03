# Schema guide

The browser-safe `@holdenmatt/md-bundle/schema` entry point describes and
validates formats built on the in-memory
[`MarkdownBundle` model](../SPEC.md). It performs no filesystem I/O.

## Define a schema

Every schema names its required root path and chooses how to handle files that
no rule claims:

```ts
import { bundleSchema } from "@holdenmatt/md-bundle/schema";

const skillSchema = bundleSchema({
  root: { path: "SKILL.md" },
  additionalFiles: "allow",
});

const result = skillSchema.parse(bundle);
```

Invalid schema paths, patterns, and declarations throw when the schema is
constructed. Problems in a bundle become findings returned by `parse`.

## Parse a typed root

A root parser uses a small structural safe-parser interface:

```ts
type SafeParser<T> = {
  parse(input: string): { success: true; data: T } | { success: false; error: unknown };
};
```

This keeps validation-library integrations optional. Parsers from
`@holdenmatt/md-schema` satisfy the interface directly:

```ts
import { markdownSchema } from "@holdenmatt/md-schema";
import { bundleSchema } from "@holdenmatt/md-bundle/schema";
import { z } from "zod";

const skillSchema = bundleSchema({
  root: {
    path: "SKILL.md",
    parser: markdownSchema(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    ),
  },
  additionalFiles: "allow",
});

const result = skillSchema.parse(bundle);
if (result.success) {
  result.root.frontmatter.name;
  result.root.body;
}
```

JSON, YAML, Zod, or domain-specific parsers can be adapted without adding them
as dependencies of this package:

```ts
const jsonParser = {
  parse(input: string) {
    try {
      return {
        success: true as const,
        data: JSON.parse(input) as { name: string },
      };
    } catch (error) {
      return { success: false as const, error };
    }
  },
};
```

The containing directory is not part of a `MarkdownBundle`, so discovery code
remains responsible for rules involving the directory name.

## File rules

File rules are ordered. The first matching rule owns a complete path:

```ts
const bookSchema = bundleSchema({
  root: { path: "BOOK.md", parser: bookParser },
  files: [
    { match: "LICENSE.md", kind: "text", required: true },
    { match: "chapters/*.md", kind: "text", validate: validateChapter },
    { match: "assets/**", kind: "any" },
    { match: "images/*", kind: "binary" },
  ],
  additionalFiles: "block",
});
```

- `text` requires text content and may run a validation callback.
- `binary` requires binary content.
- `any` accepts either representation without inspecting its contents.
- `required: true` requires the rule to own at least one file.

Patterns are bundle-relative and segment-oriented. Literal segments match
themselves, `*` matches within one segment, and `**` matches zero or more
complete segments. See the [schema specification](./schema-spec.md) for the
precise grammar and precedence rules.

Unclaimed text and binary files can share one policy:

```ts
additionalFiles: "allow";
additionalFiles: "warn";
additionalFiles: "block";
```

Or use separate policies:

```ts
additionalFiles: { text: "allow", binary: "block" };
```

Warnings keep the parse successful. Blocks make `success` false.

## Nested bundles

Nested rules validate matching directories as complete child bundles:

```ts
const chapterSchema = bundleSchema({
  root: { path: "CHAPTER.md" },
  additionalFiles: "allow",
});

const bookSchema = bundleSchema({
  root: { path: "BOOK.md" },
  nested: [{ match: "chapters/*", schema: chapterSchema, required: true }],
  additionalFiles: "block",
});
```

A nested rule owns the entire matched subtree before parent file rules run.
Nested findings are re-anchored to their paths in the parent bundle. Nested
patterns have fixed depth and therefore cannot contain `**`.

## Findings and results

Text-rule validation callbacks return findings:

```ts
type BundleFinding = {
  code: string;
  severity: "warn" | "block";
  path?: string;
  message: string;
};
```

A callback finding without `path` inherits the matched file's path. The
formatter combines findings into one message when an integration exposes an
invalid bundle as an error:

```ts
import { formatBundleFindings } from "@holdenmatt/md-bundle/schema";

if (!result.success) {
  throw new Error(formatBundleFindings(result.findings));
}
```

`parse` always returns every visible finding. A successful result contains
typed root data when a parser is configured. A blocked result may still contain
root data when root parsing succeeded before another check failed.

## Public API

The schema entry exports:

- `bundleSchema(definition)`: constructs an immutable, reusable schema.
- `BundleSchema<RootData>`: constructed schema type.
- `BundleSchemaResult<RootData>`: discriminated parse result.
- `SafeParser<Data>`: structural root-parser contract.
- `BundleFinding`: structural or content finding.
- `formatBundleFindings(findings)`: human-readable findings formatter.

For exact matching, ownership, validation, and result semantics, see the
[schema specification](./schema-spec.md). For the underlying value and path
APIs, see [Bundle API and usage](./api.md); the
[core bundle specification](../SPEC.md) covers precise behavior and edge cases.
