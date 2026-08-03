import { validateBundlePath } from "./paths.js";
import { isBinaryFile, isTextFile } from "./types.js";
import type { BundleFinding } from "./findings.js";
import type { MarkdownBundle, MarkdownBundleFile, MarkdownBundleTextFile } from "./types.js";

/** Safe result returned by a root or text-file parser. */
export type SafeParserResult<Data> =
  | { success: true; data: Data }
  | { success: false; error: unknown };

/**
 * Structural parser contract shared by md-schema and other safe text parsers.
 *
 * `markdownSchema(...)` satisfies this interface directly. YAML, JSON, or
 * domain-specific parsers can implement the same contract without coupling
 * this package to a validation library.
 */
export type SafeParser<Data> = {
  parse(input: string): SafeParserResult<Data>;
};

/** Required text root parsed into typed data. */
export type ParsedBundleRootRule<Data> = {
  readonly path: string;
  readonly parser: SafeParser<Data>;
};

/** Required text root whose contents are not parsed by the bundle schema. */
export type UnparsedBundleRootRule = {
  readonly path: string;
  readonly parser?: undefined;
};

/** Required root rule, with or without a typed parser. */
export type BundleRootRule<Data = unknown> = ParsedBundleRootRule<Data> | UnparsedBundleRootRule;

/** Claims matching text or binary files without inspecting their contents. */
export type BundleAnyRule = {
  readonly match: string;
  readonly kind: "any";
  /** Whether at least one file must be owned by this rule. */
  readonly required?: boolean;
};

/** Claims matching binary files without inspecting their contents. */
export type BundleBinaryRule = {
  readonly match: string;
  readonly kind: "binary";
  /** Whether at least one file must be owned by this rule. */
  readonly required?: boolean;
};

/** Claims matching text files and optionally validates their contents. */
export type BundleTextRule = {
  readonly match: string;
  readonly kind: "text";
  /** Whether at least one file must be owned by this rule. */
  readonly required?: boolean;
  readonly validate?: (file: MarkdownBundleTextFile) => readonly BundleFinding[];
};

/**
 * Claims directories matching `match` as recursively validated nested bundles.
 *
 * The nested schema owns every file below each matched directory.
 */
export type BundleNestedRule = {
  readonly match: string;
  readonly schema: BundleSchema<unknown>;
  /** Whether at least one nested bundle directory must be owned by this rule. */
  readonly required?: boolean;
};

/** One ordered claim over a complete file path. */
export type BundleRule = BundleAnyRule | BundleBinaryRule | BundleTextRule;

/** Severity policy applied to an additional text or binary file. */
export type AdditionalFilePolicy = "allow" | "warn" | "block";

/** Policy for files outside nested subtrees that no ordered rule claims. */
export type AdditionalFilesPolicy =
  | AdditionalFilePolicy
  | {
      readonly text: AdditionalFilePolicy;
      readonly binary: AdditionalFilePolicy;
    };

type BundleRootPathRule = {
  readonly path: string;
};

/** Declarative contract used to construct a reusable bundle schema. */
export type BundleSchemaDefinition<Root extends BundleRootPathRule = BundleRootRule> = {
  readonly root: Root;
  /**
   * Ordered claims over fixed-depth nested bundle directories. Nested
   * ownership is resolved before leaf rules and applies to the full subtree.
   */
  readonly nested?: readonly BundleNestedRule[];
  /** Ordered claims over complete file paths outside nested bundle subtrees. */
  readonly files?: readonly BundleRule[];
  /** Whether files not explicitly claimed by the schema are admitted. */
  readonly additionalFiles: AdditionalFilesPolicy;
};

/** Result of safely parsing one bundle against a schema. */
export type BundleSchemaResult<RootData> = {
  /** Every structural and content problem visible in the supplied bundle. */
  findings: BundleFinding[];
} & (
  | {
      /** No block-severity finding was produced. */
      success: true;
      /** Typed root data produced by the root parser. */
      root: RootData;
    }
  | {
      /** At least one block-severity finding was produced. */
      success: false;
      /** Typed root data when parsing succeeded before another check blocked. */
      root: RootData | undefined;
    }
);

/** Reusable, browser-safe schema over an in-memory Markdown bundle. */
export type BundleSchema<RootData, Root extends BundleRootPathRule = BundleRootPathRule> = {
  readonly definition: BundleSchemaDefinition<Root>;
  parse(bundle: MarkdownBundle): BundleSchemaResult<RootData>;
};

/**
 * Constructs a bundle schema, rejecting malformed schema paths immediately.
 *
 * Expected content failures become findings. Invalid schema declarations and
 * callbacks that violate the safe-parser contract throw as programmer errors.
 */
export function bundleSchema<const Data>(
  definition: BundleSchemaDefinition<ParsedBundleRootRule<Data>>,
): BundleSchema<Data, ParsedBundleRootRule<Data>>;
export function bundleSchema(
  definition: BundleSchemaDefinition<UnparsedBundleRootRule>,
): BundleSchema<undefined, UnparsedBundleRootRule>;
export function bundleSchema(definition: BundleSchemaDefinition): BundleSchema<unknown> {
  validateDefinition(definition);

  const normalized: BundleSchemaDefinition = Object.freeze({
    root: Object.freeze({ ...definition.root }),
    nested:
      definition.nested === undefined
        ? undefined
        : Object.freeze(definition.nested.map((rule) => Object.freeze({ ...rule }))),
    files:
      definition.files === undefined
        ? undefined
        : Object.freeze(definition.files.map((rule) => Object.freeze({ ...rule }))),
    additionalFiles:
      typeof definition.additionalFiles === "string"
        ? definition.additionalFiles
        : Object.freeze({ ...definition.additionalFiles }),
  });

  return Object.freeze({
    definition: normalized,
    parse(bundle) {
      return parseBundle(bundle, normalized);
    },
  });
}

/** Safely parses one bundle against an already validated definition. */
function parseBundle(
  bundle: MarkdownBundle,
  definition: BundleSchemaDefinition,
): BundleSchemaResult<unknown> {
  const findings: BundleFinding[] = [];
  let rootData: unknown;

  if (bundle.root.path !== definition.root.path) {
    findings.push({
      code: "bundle.root_path",
      severity: "block",
      path: bundle.root.path,
      message: `Bundle root must be ${definition.root.path}.`,
    });
  } else if (definition.root.parser !== undefined) {
    const parsed = runSafeParser(definition.root.parser, bundle.root.content);

    if (parsed.success) {
      rootData = parsed.data;
    } else {
      findings.push(parserFinding(bundle.root.path, parsed.error));
    }
  }

  const nestedBundles = new Map<
    string,
    { schema: BundleSchema<unknown>; files: MarkdownBundleFile[] }
  >();
  const matchedFiles = new Map<BundleRule, number>();
  const matchedNestedDirectories = new Map<BundleNestedRule, Set<string>>();

  for (const file of bundle.files) {
    if (file.path === bundle.root.path) continue;

    const nestedMatch = matchNestedRule(definition.nested ?? [], file.path);

    if (nestedMatch !== undefined) {
      const directories = matchedNestedDirectories.get(nestedMatch.rule) ?? new Set<string>();
      directories.add(nestedMatch.directory);
      matchedNestedDirectories.set(nestedMatch.rule, directories);

      const nested = nestedBundles.get(nestedMatch.directory) ?? {
        schema: nestedMatch.rule.schema,
        files: [],
      };
      nested.files.push(relativizeFile(file, nestedMatch.directory));
      nestedBundles.set(nestedMatch.directory, nested);
      continue;
    }

    const match = matchFileRule(definition.files ?? [], file.path);

    if (match !== undefined) {
      matchedFiles.set(match, (matchedFiles.get(match) ?? 0) + 1);
    }

    if (match?.kind === "text") {
      validateTextRule(file, match, findings);
      continue;
    }

    if (match?.kind === "binary") {
      validateBinaryRule(file, findings);
      continue;
    }

    if (match?.kind === "any") continue;

    applyAdditionalFilesPolicy(file, definition.additionalFiles, findings);
  }

  addRequiredRuleFindings(definition, matchedFiles, matchedNestedDirectories, findings);

  for (const [directory, nested] of nestedBundles) {
    validateNestedBundle(directory, nested, findings);
  }

  const success = findings.every(({ severity }) => severity !== "block");
  return success
    ? { success: true, findings, root: rootData }
    : { success: false, findings, root: rootData };
}

/** Reports required file or nested rules that own no matches. */
function addRequiredRuleFindings(
  definition: BundleSchemaDefinition,
  matchedFiles: ReadonlyMap<BundleRule, number>,
  matchedNestedDirectories: ReadonlyMap<BundleNestedRule, ReadonlySet<string>>,
  findings: BundleFinding[],
) {
  for (const rule of definition.files ?? []) {
    if (rule.required === true && (matchedFiles.get(rule) ?? 0) === 0) {
      findings.push({
        code: "bundle.required_file_missing",
        severity: "block",
        message: `Required file pattern has no matches: ${rule.match}.`,
      });
    }
  }

  for (const rule of definition.nested ?? []) {
    if (rule.required === true && (matchedNestedDirectories.get(rule)?.size ?? 0) === 0) {
      findings.push({
        code: "bundle.required_nested_bundle_missing",
        severity: "block",
        message: `Required nested bundle pattern has no matches: ${rule.match}.`,
      });
    }
  }
}

/** Applies one text rule, treating a binary match as a contract violation. */
function validateTextRule(
  file: MarkdownBundleFile,
  rule: BundleTextRule,
  findings: BundleFinding[],
) {
  if (!isTextFile(file)) {
    findings.push({
      code: "bundle.file_type",
      severity: "block",
      path: file.path,
      message: "Rule requires a text file.",
    });
    return;
  }

  findings.push(...anchorFindings(rule.validate?.(file) ?? [], file.path));
}

/** Applies one binary rule, rejecting text at a binary-owned path. */
function validateBinaryRule(file: MarkdownBundleFile, findings: BundleFinding[]) {
  if (isBinaryFile(file)) return;

  findings.push({
    code: "bundle.file_type",
    severity: "block",
    path: file.path,
    message: "Rule requires a binary file.",
  });
}

/** Applies the relevant additional-file policy without hidden precedence. */
function applyAdditionalFilesPolicy(
  file: MarkdownBundleFile,
  policies: AdditionalFilesPolicy,
  findings: BundleFinding[],
) {
  const type = isBinaryFile(file) ? "binary" : "text";
  const policy = typeof policies === "string" ? policies : policies[type];
  if (policy === "allow") return;

  findings.push({
    code: "bundle.additional_file",
    severity: policy,
    path: file.path,
    message: `No schema rule claims this additional ${type} file.`,
  });
}

/** Reconstructs and validates one nested bundle, re-anchoring its findings. */
function validateNestedBundle(
  directory: string,
  nested: { schema: BundleSchema<unknown>; files: MarkdownBundleFile[] },
  findings: BundleFinding[],
) {
  const rootPath = nested.schema.definition.root.path;
  const root = nested.files.find((file) => file.path === rootPath);

  if (root === undefined) {
    findings.push({
      code: "bundle.nested_root_missing",
      severity: "block",
      path: directory,
      message: `Nested bundle must contain ${rootPath}.`,
    });
    return;
  }

  if (!isTextFile(root)) {
    findings.push({
      code: "bundle.file_type",
      severity: "block",
      path: `${directory}/${root.path}`,
      message: "Nested bundle root must be a text file.",
    });
    return;
  }

  const result = nested.schema.parse({ root, files: nested.files });
  findings.push(
    ...result.findings.map((finding) => ({
      ...finding,
      path: finding.path === undefined ? directory : `${directory}/${finding.path}`,
    })),
  );
}

/**
 * Finds the outermost nested directory claiming a path.
 *
 * A shallower match must win even when declared later so one child schema
 * cannot carve a subtree out of another. Declaration order breaks ties between
 * overlapping rules at the same depth.
 */
function matchNestedRule(
  rules: readonly BundleNestedRule[],
  path: string,
): { rule: BundleNestedRule; directory: string } | undefined {
  const segments = path.split("/");
  let match: { rule: BundleNestedRule; directory: string; depth: number } | undefined;

  for (const rule of rules) {
    const directory = matchDirectoryPrefix(rule.match, segments);
    if (directory === undefined) continue;

    const depth = rule.match.split("/").length;
    if (match === undefined || depth < match.depth) {
      match = { rule, directory, depth };
    }
  }

  return match;
}

/** Finds the first ordered leaf rule claiming one complete file path. */
function matchFileRule(rules: readonly BundleRule[], path: string): BundleRule | undefined {
  for (const rule of rules) {
    if (matchesPattern(rule.match, path)) return rule;
  }

  return undefined;
}

/** Matches a directory pattern against a strict prefix of a file path. */
function matchDirectoryPrefix(pattern: string, segments: string[]): string | undefined {
  const patternSegments = pattern.split("/");
  if (segments.length <= patternSegments.length) return undefined;

  const prefix = segments.slice(0, patternSegments.length);
  return matchSegments(patternSegments, prefix) ? prefix.join("/") : undefined;
}

/** Whether a supported pattern matches one complete bundle path. */
function matchesPattern(pattern: string, path: string): boolean {
  return matchSegments(pattern.split("/"), path.split("/"));
}

/** Matches the package's deliberately small segment-oriented pattern grammar. */
function matchSegments(pattern: string[], segments: string[]): boolean {
  const memo = new Map<string, boolean>();

  function visit(patternIndex: number, segmentIndex: number): boolean {
    const key = `${patternIndex}:${segmentIndex}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const currentPattern = pattern[patternIndex];
    let matches: boolean;

    if (currentPattern === undefined) {
      matches = segmentIndex === segments.length;
    } else if (currentPattern === "**") {
      matches =
        visit(patternIndex + 1, segmentIndex) ||
        (segmentIndex < segments.length && visit(patternIndex, segmentIndex + 1));
    } else {
      const currentSegment = segments[segmentIndex];
      matches =
        currentSegment !== undefined &&
        segmentMatches(currentPattern, currentSegment) &&
        visit(patternIndex + 1, segmentIndex + 1);
    }

    memo.set(key, matches);
    return matches;
  }

  return visit(0, 0);
}

/** Matches one literal or single-wildcard pattern segment. */
function segmentMatches(pattern: string, segment: string): boolean {
  const star = pattern.indexOf("*");
  if (star < 0) return pattern === segment;

  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return (
    segment.length >= prefix.length + suffix.length &&
    segment.startsWith(prefix) &&
    segment.endsWith(suffix)
  );
}

/** Re-anchors a file beneath a nested-bundle directory. */
function relativizeFile(file: MarkdownBundleFile, directory: string): MarkdownBundleFile {
  return { ...file, path: file.path.slice(directory.length + 1) };
}

/** Executes a safe parser and rejects malformed callback results. */
function runSafeParser<Data>(parser: SafeParser<Data>, input: string): SafeParserResult<Data> {
  const result: unknown = parser.parse(input);

  if (!isRecord(result) || typeof result.success !== "boolean") {
    throw new TypeError("Safe parser must return a result with a boolean success field.");
  }
  if (result.success) {
    if (!("data" in result)) {
      throw new TypeError("Successful safe-parser result must contain data.");
    }
    return result as { success: true; data: Data };
  }
  if (!("error" in result)) {
    throw new TypeError("Failed safe-parser result must contain an error.");
  }
  return result as { success: false; error: unknown };
}

/** Validates callback findings and anchors bundle-wide results to their file. */
function anchorFindings(value: unknown, defaultPath: string): BundleFinding[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Validation callback must return an array of findings.");
  }

  return value.map((finding) => {
    if (
      !isRecord(finding) ||
      typeof finding.code !== "string" ||
      (finding.severity !== "warn" && finding.severity !== "block") ||
      (finding.path !== undefined && typeof finding.path !== "string") ||
      typeof finding.message !== "string"
    ) {
      throw new TypeError("Validation callback returned an invalid bundle finding.");
    }

    const path = finding.path ?? defaultPath;
    validateBundlePath(path);

    return {
      code: finding.code,
      severity: finding.severity,
      path,
      message: finding.message,
    };
  });
}

/** Converts one safe-parser error into a stable bundle finding. */
function parserFinding(path: string, error: unknown): BundleFinding {
  const detail = error instanceof Error ? error.message : String(error);

  return {
    code: "bundle.root_content",
    severity: "block",
    path,
    message: `Invalid bundle root: ${detail}`,
  };
}

/** Validates the schema language once, before it is used against bundle data. */
function validateDefinition(definition: BundleSchemaDefinition) {
  if (!isRecord(definition)) {
    throw new TypeError("Bundle schema definition must be an object.");
  }

  validateRootRule(definition.root);
  validateAdditionalFilesPolicy(definition.additionalFiles);

  if (definition.files !== undefined && !Array.isArray(definition.files)) {
    throw new TypeError("Bundle schema files must be an array.");
  }
  if (definition.nested !== undefined && !Array.isArray(definition.nested)) {
    throw new TypeError("Bundle schema nested rules must be an array.");
  }

  for (const rule of definition.files ?? []) {
    validateFileRule(rule);
  }
  for (const rule of definition.nested ?? []) {
    validateNestedRule(rule);
  }

  validateBundlePath(definition.root.path);
  validateRulePatterns(definition.files ?? [], "file");
  validateRulePatterns(definition.nested ?? [], "nested bundle");

  for (const rule of definition.nested ?? []) {
    if (rule.match.split("/").includes("**")) {
      throw new Error(`Nested bundle patterns must have a fixed depth: ${rule.match}`);
    }
  }
}

/** Validates the root branch of the runtime schema declaration. */
function validateRootRule(root: BundleRootRule) {
  if (!isRecord(root) || typeof root.path !== "string") {
    throw new TypeError("Bundle schema root must have a string path.");
  }

  if ("validate" in root || "failure" in root) {
    throw new TypeError("Bundle schema root rules cannot declare validate or failure.");
  }

  if (root.parser === undefined) return;

  validateSafeParser(root.parser, "Bundle schema root parser");
}

/** Validates one runtime file-rule declaration. */
function validateFileRule(rule: BundleRule) {
  if (!isRecord(rule) || typeof rule.match !== "string") {
    throw new TypeError("Bundle schema file rules must have a string match.");
  }
  const runtimeKind: unknown = rule.kind;
  if (runtimeKind !== "any" && runtimeKind !== "binary" && runtimeKind !== "text") {
    throw new TypeError(`Invalid bundle file rule kind: ${String(runtimeKind)}.`);
  }

  validateOptionalBoolean(rule.required, "Bundle schema file rule required");

  if ("parser" in rule || "failure" in rule) {
    throw new TypeError("Bundle schema file rules cannot declare parser or failure.");
  }

  if (rule.kind !== "text") {
    if ("validate" in rule) {
      throw new TypeError(`Bundle schema ${rule.kind} rules cannot declare validate.`);
    }
    return;
  }

  validateOptionalFunction(rule.validate, "Bundle schema text rule validate");
}

/** Validates one runtime nested-rule declaration. */
function validateNestedRule(rule: BundleNestedRule) {
  if (!isRecord(rule) || typeof rule.match !== "string") {
    throw new TypeError("Bundle schema nested rules must have a string match.");
  }
  if (
    !isRecord(rule.schema) ||
    typeof rule.schema.parse !== "function" ||
    !isRecord(rule.schema.definition) ||
    !isRecord(rule.schema.definition.root) ||
    typeof rule.schema.definition.root.path !== "string"
  ) {
    throw new TypeError("Bundle schema nested rules must contain a constructed bundle schema.");
  }

  validateOptionalBoolean(rule.required, "Bundle schema nested rule required");
}

/** Validates the scalar or representation-specific additional-file policy. */
function validateAdditionalFilesPolicy(policy: AdditionalFilesPolicy) {
  if (isAdditionalFilePolicy(policy)) return;

  if (
    !isRecord(policy) ||
    !isAdditionalFilePolicy(policy.text) ||
    !isAdditionalFilePolicy(policy.binary)
  ) {
    throw new TypeError(
      "Bundle schema additionalFiles must be allow, warn, block, or text/binary policies.",
    );
  }
}

function isAdditionalFilePolicy(value: unknown): value is AdditionalFilePolicy {
  return value === "allow" || value === "warn" || value === "block";
}

/** Validates a parser object without executing consumer code. */
function validateSafeParser(parser: SafeParser<unknown>, label: string) {
  if (!isRecord(parser) || typeof parser.parse !== "function") {
    throw new TypeError(`${label} must have a parse function.`);
  }
}

function validateOptionalFunction(value: unknown, label: string) {
  if (value !== undefined && typeof value !== "function") {
    throw new TypeError(`${label} must be a function.`);
  }
}

function validateOptionalBoolean(value: unknown, label: string) {
  if (value !== undefined && typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validates one independently ordered pattern namespace. */
function validateRulePatterns(
  rules: readonly { match: string }[],
  label: "file" | "nested bundle",
) {
  const patterns = new Set<string>();

  for (const rule of rules) {
    validatePattern(rule.match);
    if (patterns.has(rule.match)) {
      throw new Error(`Duplicate ${label} pattern: ${rule.match}`);
    }
    patterns.add(rule.match);
  }
}

/** Validates the minimal `*`/`**` pattern grammar used by schema rules. */
function validatePattern(pattern: string) {
  if (pattern === "" || pattern.startsWith("/") || pattern.endsWith("/")) {
    throw new Error(`Invalid bundle rule pattern: ${pattern}`);
  }

  for (const segment of pattern.split("/")) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\\") ||
      (segment !== "**" && countCharacters(segment, "*") > 1)
    ) {
      throw new Error(`Invalid bundle rule pattern: ${pattern}`);
    }
  }
}

function countCharacters(value: string, character: string) {
  return [...value].filter((candidate) => candidate === character).length;
}
