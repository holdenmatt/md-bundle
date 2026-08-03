/** Severity of one bundle-schema finding. */
export type BundleFindingSeverity = "block" | "warn";

/** One structural or content problem discovered while parsing a bundle. */
export type BundleFinding = {
  /** Stable machine-readable identity. */
  code: string;
  /** Whether the problem invalidates the bundle or only deserves attention. */
  severity: BundleFindingSeverity;
  /** Bundle-relative path associated with the problem, when file-specific. */
  path?: string;
  /** Human-readable detail without duplicated path context. */
  message: string;
};

/** Formats findings for loaders that expose invalid bundles as one error. */
export function formatBundleFindings(findings: readonly BundleFinding[]): string {
  return findings
    .map((finding) =>
      finding.path === undefined ? finding.message : `${finding.path}: ${finding.message}`,
    )
    .join("; ");
}
