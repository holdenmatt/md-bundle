# md-bundle spec

This spec defines behavior that is intentionally more precise than the README.

## Bundle Model

- Files are sorted lexicographically by path.

## Paths

- Bundle paths use `/` and are relative to the bundle directory.
- Stored file paths cannot be empty, absolute, or escape the bundle.
- `.` and `..` segments are resolved before storage.

## Construction

- `rootPath` must identify one text `.md` file in `files`.
- File paths must be valid and unique.

## Loading

- Without `rootPath`, loading infers the root from top-level Markdown files:
  the only `.md` file, otherwise `SKILL.md`, otherwise `index.md`.
- Missing or ambiguous roots fail.
- Loading skips `.git` directories and does not follow symlinks.
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
