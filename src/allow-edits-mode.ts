import type { PermissionSystemExtensionConfig } from "./extension-config";
import type { PermissionState } from "./types";

/** Surfaces that allow-edits mode auto-approves when state is ask. */
const AUTO_APPROVE_SURFACES = new Set(["write", "edit"]);

export function isAllowEditsModeEnabled(
  config: PermissionSystemExtensionConfig,
): boolean {
  return config.allowEditsMode === true;
}

/**
 * Returns true when the current tool + state should be auto-approved
 * under allow-edits mode.
 *
 * Only applies when:
 *   - allowEditsMode is enabled
 *   - state is exactly "ask"
 *   - toolName is a recognized surface (write / edit)
 */
export function shouldAutoApproveForTool(
  toolName: string | undefined,
  state: PermissionState,
  config: PermissionSystemExtensionConfig,
): boolean {
  if (!isAllowEditsModeEnabled(config)) return false;
  if (state !== "ask") return false;
  if (!toolName) return false;
  return AUTO_APPROVE_SURFACES.has(toolName.trim().toLowerCase());
}
