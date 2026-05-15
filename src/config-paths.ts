import { join } from "node:path";

const GLOBAL_EXTENSION_ID = "pi-quick-perms";
const PROJECT_POLICY_EXTENSION_ID = "pi-permission-system";

export const DEBUG_LOG_FILENAME = `${GLOBAL_EXTENSION_ID}-debug.jsonl`;
export const REVIEW_LOG_FILENAME = `${GLOBAL_EXTENSION_ID}-permission-review.jsonl`;

export function getGlobalConfigDir(agentDir: string): string {
  return join(agentDir, "extensions", GLOBAL_EXTENSION_ID);
}

export function getGlobalConfigPath(agentDir: string): string {
  return join(getGlobalConfigDir(agentDir), "config.json");
}

export function getGlobalLogsDir(agentDir: string): string {
  return join(getGlobalConfigDir(agentDir), "logs");
}

export function getProjectConfigPath(cwd: string): string {
  return join(cwd, ".pi", "extensions", PROJECT_POLICY_EXTENSION_ID, "config.json");
}

export function getLegacyGlobalPolicyPath(agentDir: string): string {
  return join(agentDir, "pi-permissions.jsonc");
}

export function getLegacyProjectPolicyPath(cwd: string): string {
  return join(cwd, ".pi", "agent", "pi-permissions.jsonc");
}

export function getLegacyExtensionConfigPath(extensionRoot: string): string {
  return join(extensionRoot, "config.json");
}
