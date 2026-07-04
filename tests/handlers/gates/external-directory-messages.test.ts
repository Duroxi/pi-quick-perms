import { describe, expect, test } from "vitest";

import {
  formatBashExternalDirectoryAskPrompt,
  formatBashExternalDirectoryDenyReason,
  formatExternalDirectoryAskPrompt,
  formatExternalDirectoryDenyReason,
  formatExternalDirectoryHardStopHint,
  formatExternalDirectoryUserDeniedReason,
} from "../../../src/handlers/gates/external-directory-messages";

describe("formatExternalDirectoryHardStopHint", () => {
  test("returns the hard stop instruction string", () => {
    const hint = formatExternalDirectoryHardStopHint();
    expect(hint).toContain("Hard stop");
    expect(hint).toContain("external directory");
  });
});

describe("formatExternalDirectoryAskPrompt", () => {
  test("formats external directory access message", () => {
    const result = formatExternalDirectoryAskPrompt(
      "read",
      "/etc/passwd",
      "/projects/my-app",
    );
    expect(result).toBe("External directory access: /etc/passwd");
  });

  test("formats external directory access for write tool", () => {
    const result = formatExternalDirectoryAskPrompt(
      "write",
      "/tmp/out.txt",
      "/projects/my-app",
    );
    expect(result).toBe("External directory access: /tmp/out.txt");
  });
});

describe("formatExternalDirectoryDenyReason", () => {
  test("includes tool name, path, cwd, agent name, and hard stop hint", () => {
    const result = formatExternalDirectoryDenyReason(
      "read",
      "/etc/passwd",
      "/projects/my-app",
      "sec-agent",
    );
    expect(result).toContain("Agent 'sec-agent'");
    expect(result).toContain("read");
    expect(result).toContain("/etc/passwd");
    expect(result).toContain("/projects/my-app");
    expect(result).toContain("Hard stop");
  });

  test("uses 'Current agent' without agent name", () => {
    const result = formatExternalDirectoryDenyReason(
      "read",
      "/etc",
      "/projects",
    );
    expect(result).toContain("Current agent");
  });
});

describe("formatExternalDirectoryUserDeniedReason", () => {
  test("includes tool name and path", () => {
    const result = formatExternalDirectoryUserDeniedReason(
      "edit",
      "/etc/hosts",
    );
    expect(result).toContain("edit");
    expect(result).toContain("/etc/hosts");
    expect(result).toContain("Hard stop");
  });

  test("appends denial reason when provided", () => {
    const result = formatExternalDirectoryUserDeniedReason(
      "edit",
      "/etc/hosts",
      "too risky",
    );
    expect(result).toContain("Reason: too risky");
  });

  test("omits reason suffix when not provided", () => {
    const result = formatExternalDirectoryUserDeniedReason(
      "edit",
      "/etc/hosts",
    );
    expect(result).not.toContain("Reason:");
  });
});

describe("formatBashExternalDirectoryAskPrompt", () => {
  test("formats bash external directory access message", () => {
    const result = formatBashExternalDirectoryAskPrompt(
      "cat /etc/passwd",
      ["/etc/passwd"],
      "/projects/my-app",
    );
    expect(result).toBe("Bash external directory access: cat /etc/passwd");
  });

  test("formats bash external directory access without agent name", () => {
    const result = formatBashExternalDirectoryAskPrompt(
      "ls /tmp",
      ["/tmp"],
      "/projects/my-app",
    );
    expect(result).toBe("Bash external directory access: ls /tmp");
  });

  test("formats bash external directory access with multiple external paths", () => {
    const result = formatBashExternalDirectoryAskPrompt(
      "diff /etc/hosts /var/log/syslog",
      ["/etc/hosts", "/var/log/syslog"],
      "/projects/my-app",
    );
    expect(result).toBe(
      "Bash external directory access: diff /etc/hosts /var/log/syslog",
    );
  });
});

describe("formatBashExternalDirectoryDenyReason", () => {
  test("includes command, paths, cwd, agent name, and hard stop hint", () => {
    const result = formatBashExternalDirectoryDenyReason(
      "rm /etc/hosts",
      ["/etc/hosts"],
      "/projects/my-app",
      "sec-agent",
    );
    expect(result).toContain("Agent 'sec-agent'");
    expect(result).toContain("rm /etc/hosts");
    expect(result).toContain("/etc/hosts");
    expect(result).toContain("Hard stop");
  });
});
