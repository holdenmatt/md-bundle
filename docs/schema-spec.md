# Bundle schema specification

This specification defines the precise behavior of
`@holdenmatt/md-bundle/schema`. The entry validates an in-memory
`MarkdownBundle` without filesystem I/O or Node builtins. The
[core specification](../SPEC.md) defines the underlying bundle model and paths;
the [schema guide](./schema.md) provides examples.

## Schema declarations

A schema declares:

- one required root path, with an optional typed parser;
- ordered file rules;
- ordered nested-bundle rules; and
- a required policy for files no rule claims.

Invalid paths, patterns, and schema declarations throw during construction.
Expected bundle-content problems become findings.

Patterns are `/`-separated and bundle-relative. Literal segments match
themselves, `*` matches within one segment, and `**` matches zero or more
complete segments. Empty, `.`, `..`, and backslash-separated segments are
invalid. `**` must occupy a complete segment; other segments may contain at
most one `*`.

Nested patterns cannot contain `**` because a variable-depth match does not
identify one unambiguous owning directory. Duplicate patterns are rejected
within the file-rule or nested-rule namespace.

## Ownership and matching

Nested rules claim complete directory subtrees before file rules run. When
nested patterns overlap, the outermost matching directory wins; declaration
order breaks ties at the same depth. The nested schema validates every file in
the claimed subtree.

Outside nested subtrees, the first matching file rule owns a path:

- `text` requires text content;
- `binary` requires binary content; and
- `any` accepts text or binary content.

A text rule may return findings from a validation callback. Callback findings
without a path inherit the matched file's path. Callback results and finding
paths are validated; malformed callback output is a programmer error and
throws.

`required: true` means a file rule must own at least one file, or a nested
rule must own at least one directory. No broader cardinality constraints are
defined.

Only unclaimed files reach `additionalFiles`. A scalar `allow`, `warn`, or
`block` policy applies to both text and binary files; an object can set their
policies independently.

## Root validation

The bundle root path must equal the schema root path. A configured safe parser
receives the root text and returns either typed data or a content error.
Expected parser failures produce a `bundle.root_content` block finding.
Malformed safe-parser results throw as programmer errors.

## Nested validation

Each directory owned by a nested rule is reconstructed as a relative child
bundle. A missing child root produces `bundle.nested_root_missing`. A binary
child root produces `bundle.file_type`. Otherwise the child schema parses the
bundle and all child findings are re-anchored beneath the owning directory.

## Result semantics

Parsing returns:

```ts
type BundleSchemaResult<RootData> =
  | { success: true; findings: BundleFinding[]; root: RootData }
  | {
      success: false;
      findings: BundleFinding[];
      root: RootData | undefined;
    };
```

`success` is false when any finding has severity `block`. Warnings preserve
a successful result. Parsed root data can remain available on a blocked result
when a later structural or semantic check fails.

Findings are deterministic because the core bundle model normalizes files in
lexicographic path order and schema rules preserve declaration order.

The schema validates structure, the authoritative root, and declared text
callbacks. It does not load files, resolve Markdown references, or build a
typed tree of supporting files.
