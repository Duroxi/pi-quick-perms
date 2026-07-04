export function formatExternalDirectoryHardStopHint(): string {
  return "Hard stop: this external directory permission denial is policy-enforced. Do not retry this path, do not attempt a filesystem bypass, and report the block to the user.";
}

/**
 * @deprecated This prompt now shows the external path only. `toolName` is no longer used.
 */
export function formatExternalDirectoryAskPrompt(
  _toolName: string,
  pathValue: string,
  _cwd: string,
  _agentName?: string,
): string {
  return `External directory access: ${pathValue}`;
}

export function formatExternalDirectoryDenyReason(
  toolName: string,
  pathValue: string,
  cwd: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  return `${subject} is not permitted to run tool '${toolName}' for path '${pathValue}' outside working directory '${cwd}'. ${formatExternalDirectoryHardStopHint()}`;
}

export function formatExternalDirectoryUserDeniedReason(
  toolName: string,
  pathValue: string,
  denialReason?: string,
): string {
  const reasonSuffix = denialReason ? ` Reason: ${denialReason}.` : "";
  return `User denied external directory access for tool '${toolName}' path '${pathValue}'.${reasonSuffix} ${formatExternalDirectoryHardStopHint()}`;
}

export function formatBashExternalDirectoryAskPrompt(
  command: string,
  _externalPaths: string[],
  _cwd: string,
  _agentName?: string,
): string {
  return `Bash external directory access: ${command}`;
}

export function formatBashExternalDirectoryDenyReason(
  command: string,
  externalPaths: string[],
  cwd: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  const pathList = externalPaths.join(", ");
  return `${subject} is not permitted to run bash command '${command}' which references path(s) outside working directory '${cwd}': ${pathList}. ${formatExternalDirectoryHardStopHint()}`;
}
