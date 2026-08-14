import { formatBytes } from "../utils";

/**
 * Limits applied when staging files onto a composer.
 *
 * @deprecated Composer-only helper of the legacy AgentComposer. Use
 * ChatComposer from `@tangle-network/agent-app/web-react` — the canonical
 * composer. AgentComposer is frozen and will be removed at sandbox-ui's next
 * breaking release.
 */
export interface ComposerFileValidationConfig {
  /** Reject any single file larger than this. */
  maxSizeBytes?: number;
  /** Reject files once the staged count would exceed this. */
  maxCount?: number;
  /** Files already staged, counted against `maxCount` before this batch. */
  currentCount?: number;
  /**
   * Comma-separated accept list, same grammar as the native `<input accept>`
   * attribute: file extensions (`.png`), exact MIME types (`image/png`), and
   * MIME wildcards (`image/*`).
   */
  accept?: string;
}

/** A file that failed validation, paired with a human-readable reason.
 *
 * @deprecated Composer-only helper of the legacy AgentComposer. Use
 * ChatComposer from `@tangle-network/agent-app/web-react` — the canonical
 * composer. AgentComposer is frozen and will be removed at sandbox-ui's next
 * breaking release. */
export interface ComposerFileRejection {
  file: File;
  reason: string;
}

/**
 * Checks a single file against a comma-separated `accept` list using the same
 * grammar as the native `<input accept>` attribute. An undefined or empty
 * `accept` accepts everything.
 *
 * @deprecated Composer-only helper of the legacy AgentComposer. Use
 * ChatComposer from `@tangle-network/agent-app/web-react` — the canonical
 * composer. AgentComposer is frozen and will be removed at sandbox-ui's next
 * breaking release.
 */
export function isAcceptedType(file: File, accept?: string): boolean {
  if (!accept || accept.trim().length === 0) return true;

  const patterns = accept
    .split(",")
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
  if (patterns.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  return patterns.some((pattern) => {
    const lowerPattern = pattern.toLowerCase();
    if (lowerPattern.startsWith(".")) {
      return name.endsWith(lowerPattern);
    }
    if (lowerPattern.endsWith("/*")) {
      const prefix = lowerPattern.slice(0, -1); // keep the trailing "/"
      return type.startsWith(prefix);
    }
    return type === lowerPattern;
  });
}

/**
 * Splits a batch of files into what's safe to stage and what's rejected,
 * checking accept type, then size, then the running count against
 * `currentCount` + `maxCount`. Each rejection carries a reason naming the
 * file and the limit it broke. Pure data in, pure data out — no throwing,
 * no console noise, so callers decide how to surface rejections.
 *
 * @deprecated Composer-only helper of the legacy AgentComposer. Use
 * ChatComposer from `@tangle-network/agent-app/web-react` — the canonical
 * composer. AgentComposer is frozen and will be removed at sandbox-ui's next
 * breaking release.
 */
export function validateComposerFiles(
  files: File[] | FileList,
  config: ComposerFileValidationConfig,
): { accepted: File[]; rejected: ComposerFileRejection[] } {
  const { maxSizeBytes, maxCount, currentCount = 0, accept } = config;
  const list = Array.isArray(files) ? files : Array.from(files);

  const accepted: File[] = [];
  const rejected: ComposerFileRejection[] = [];

  for (const file of list) {
    if (!isAcceptedType(file, accept)) {
      rejected.push({
        file,
        reason: `"${file.name}" is not an accepted file type (${accept}).`,
      });
      continue;
    }

    if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
      rejected.push({
        file,
        reason: `"${file.name}" (${formatBytes(file.size)}) exceeds the ${formatBytes(maxSizeBytes)} limit.`,
      });
      continue;
    }

    if (maxCount !== undefined && currentCount + accepted.length >= maxCount) {
      rejected.push({
        file,
        reason: `"${file.name}" was not added — the ${maxCount}-file limit is already reached.`,
      });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
