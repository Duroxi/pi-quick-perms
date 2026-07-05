import { describe, expect, test } from "vitest";
import type { PermissionSystemExtensionConfig } from "../src/extension-config";
import type { PermissionState } from "../src/types";
import {
  isAllowEditsModeEnabled,
  shouldAutoApproveForTool,
} from "../src/allow-edits-mode";

function makeConfig(
  allowEditsMode: boolean | undefined,
): PermissionSystemExtensionConfig {
  return { mode: allowEditsMode ? "allowEdits" : "default" } as PermissionSystemExtensionConfig;
}

describe("isAllowEditsModeEnabled", () => {
  test("returns true when allowEditsMode is true", () => {
    expect(isAllowEditsModeEnabled(makeConfig(true))).toBe(true);
  });

  test("returns false when allowEditsMode is false", () => {
    expect(isAllowEditsModeEnabled(makeConfig(false))).toBe(false);
  });

  test("returns false when allowEditsMode is undefined", () => {
    expect(isAllowEditsModeEnabled(makeConfig(undefined))).toBe(false);
  });
});

describe("shouldAutoApproveForTool", () => {
  test("auto-approves write when allowEditsMode is on and state is ask", () => {
    expect(
      shouldAutoApproveForTool("write", "ask", makeConfig(true)),
    ).toBe(true);
  });

  test("auto-approves edit when allowEditsMode is on and state is ask", () => {
    expect(shouldAutoApproveForTool("edit", "ask", makeConfig(true))).toBe(
      true,
    );
  });

  test("auto-approves Write with capital W", () => {
    expect(shouldAutoApproveForTool("Write", "ask", makeConfig(true))).toBe(
      true,
    );
  });

  test("auto-approves EDIT with capitals and surrounding spaces", () => {
    expect(shouldAutoApproveForTool("  EDIT  ", "ask", makeConfig(true))).toBe(
      true,
    );
  });

  test("does not auto-approve bash", () => {
    expect(shouldAutoApproveForTool("bash", "ask", makeConfig(true))).toBe(
      false,
    );
  });

  test("does not auto-approve read", () => {
    expect(shouldAutoApproveForTool("read", "ask", makeConfig(true))).toBe(
      false,
    );
  });

  test("does not auto-approve when state is allow", () => {
    expect(shouldAutoApproveForTool("write", "allow", makeConfig(true))).toBe(
      false,
    );
  });

  test("does not auto-approve when state is deny", () => {
    expect(shouldAutoApproveForTool("write", "deny", makeConfig(true))).toBe(
      false,
    );
  });

  test("does not auto-approve when allowEditsMode is off", () => {
    expect(shouldAutoApproveForTool("write", "ask", makeConfig(false))).toBe(
      false,
    );
  });

  test("does not auto-approve when toolName is undefined", () => {
    expect(shouldAutoApproveForTool(undefined, "ask", makeConfig(true))).toBe(
      false,
    );
  });

  test("does not auto-approve unknown tool names", () => {
    expect(
      shouldAutoApproveForTool("unknown-tool", "ask", makeConfig(true)),
    ).toBe(false);
  });

  describe("external path guard", () => {
    test("does not auto-approve write for external paths", () => {
      expect(
        shouldAutoApproveForTool("write", "ask", makeConfig(true), true),
      ).toBe(false);
    });

    test("does not auto-approve edit for external paths", () => {
      expect(
        shouldAutoApproveForTool("edit", "ask", makeConfig(true), true),
      ).toBe(false);
    });

    test("still auto-approves write for internal paths (isExternalPath=false)", () => {
      expect(
        shouldAutoApproveForTool("write", "ask", makeConfig(true), false),
      ).toBe(true);
    });

    test("still auto-approves edit for internal paths (isExternalPath=false)", () => {
      expect(
        shouldAutoApproveForTool("edit", "ask", makeConfig(true), false),
      ).toBe(true);
    });
  });
});
