import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { toRecord } from "./common";
import type { PermissionMode } from "./config-loader";

export type { PermissionMode };

export const EXTENSION_ID = "pi-quick-perms";

export interface PermissionSystemExtensionConfig {
  debugLog: boolean;
  permissionReviewLog: boolean;
  mode: PermissionMode;
  /** Additional directories to auto-allow for reads as Pi infrastructure. */
  piInfrastructureReadPaths?: string[];
}

export const DEFAULT_EXTENSION_CONFIG: PermissionSystemExtensionConfig = {
  debugLog: false,
  permissionReviewLog: true,
  mode: "default",
};

export function resolveExtensionRoot(moduleUrl = import.meta.url): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}

export const EXTENSION_ROOT = resolveExtensionRoot();

const PERMISSION_POLICY_KEYS: ReadonlySet<string> = new Set([
  "defaultPolicy",
  "tools",
  "bash",
  "mcp",
  "skills",
  "special",
  "external_directory",
]);

export function detectMisplacedPermissionKeys(
  raw: Record<string, unknown>,
): string[] {
  return Object.keys(raw).filter((key) => PERMISSION_POLICY_KEYS.has(key));
}

const VALID_MODES = new Set(["default", "allowEdits", "yolo"]);

/**
 * Resolve the effective mode from a raw config record.
 *
 * Precedence:
 *   1. Explicit `mode` field (new format)
 *   2. `yoloMode: true` (deprecated) → "yolo"
 *   3. `allowEditsMode: true` (deprecated) → "allowEdits"
 *   4. Default: "default"
 */
function resolveModeFromRecord(record: Record<string, unknown>): PermissionMode {
  if (typeof record.mode === "string" && VALID_MODES.has(record.mode)) {
    return record.mode as PermissionMode;
  }
  if (record.yoloMode === true) return "yolo";
  if (record.allowEditsMode === true) return "allowEdits";
  return "default";
}

export function normalizePermissionSystemConfig(
  raw: unknown,
): PermissionSystemExtensionConfig {
  const record = toRecord(raw);
  const rawPaths = record.piInfrastructureReadPaths;
  const piInfrastructureReadPaths: string[] | undefined =
    Array.isArray(rawPaths) &&
    rawPaths.every((p): p is string => typeof p === "string")
      ? rawPaths
      : undefined;
  const result: PermissionSystemExtensionConfig = {
    debugLog: record.debugLog === true,
    permissionReviewLog: record.permissionReviewLog !== false,
    mode: resolveModeFromRecord(record),
  };
  if (piInfrastructureReadPaths !== undefined) {
    result.piInfrastructureReadPaths = piInfrastructureReadPaths;
  }
  return result;
}

export function ensurePermissionSystemLogsDirectory(
  logsDir: string,
): string | undefined {
  try {
    mkdirSync(logsDir, { recursive: true });
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Failed to create pi-quick-perms log directory '${logsDir}': ${message}`;
  }
}
