import { describe, expect, it } from "vitest";

import {
  detectMisplacedPermissionKeys,
  normalizePermissionSystemConfig,
} from "../src/extension-config";

describe("detectMisplacedPermissionKeys", () => {
  it("returns an empty array for a record with only valid extension keys", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: true,
      permissionReviewLog: true,
      yoloMode: false,
    });
    expect(result).toEqual([]);
  });

  it("returns an empty array for an empty record", () => {
    const result = detectMisplacedPermissionKeys({});
    expect(result).toEqual([]);
  });

  it("returns misplaced key names when legacy permission-rule keys are present", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: true,
      defaultPolicy: { tools: "ask" },
      bash: { "git status": "allow" },
    });
    expect(result).toEqual(["defaultPolicy", "bash"]);
  });

  it("detects all known legacy permission-rule keys", () => {
    const result = detectMisplacedPermissionKeys({
      defaultPolicy: {},
      tools: {},
      bash: {},
      mcp: {},
      skills: {},
      special: {},
      external_directory: {},
    });
    expect(result).toEqual([
      "defaultPolicy",
      "tools",
      "bash",
      "mcp",
      "skills",
      "special",
      "external_directory",
    ]);
  });

  it("does not detect doom_loop as a misplaced permission key", () => {
    const result = detectMisplacedPermissionKeys({
      doom_loop: {},
    });
    expect(result).toEqual([]);
  });

  it("does not flag the new flat-format permission key as misplaced", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: false,
      permission: { "*": "ask" },
    });
    expect(result).toEqual([]);
  });

  it("ignores unknown keys that are not permission-rule keys", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: true,
      someRandomKey: "value",
    });
    expect(result).toEqual([]);
  });
});

describe("normalizePermissionSystemConfig", () => {
  it("normalizes a valid config object", () => {
    const result = normalizePermissionSystemConfig({
      debugLog: true,
      permissionReviewLog: false,
      mode: "yolo",
    });
    expect(result).toEqual({
      debugLog: true,
      permissionReviewLog: false,
      mode: "yolo",
    });
  });

  it("defaults debugLog to false when missing", () => {
    const result = normalizePermissionSystemConfig({});
    expect(result.debugLog).toBe(false);
    expect(result.mode).toBe("default");
  });

  it("defaults permissionReviewLog to true when missing", () => {
    const result = normalizePermissionSystemConfig({});
    expect(result.permissionReviewLog).toBe(true);
    expect(result.mode).toBe("default");
  });

  it("defaults mode to 'default' when missing", () => {
    const result = normalizePermissionSystemConfig({});
    expect(result.mode).toBe("default");
  });

  it("coerces non-boolean values to their defaults", () => {
    const result = normalizePermissionSystemConfig({
      debugLog: "yes",
      permissionReviewLog: 1,
      mode: null,
    });
    expect(result.debugLog).toBe(false);
    expect(result.permissionReviewLog).toBe(true);
    expect(result.mode).toBe("default");
  });

  it("handles null/undefined input gracefully", () => {
    const result = normalizePermissionSystemConfig(null);
    expect(result).toEqual({
      debugLog: false,
      permissionReviewLog: true,
      mode: "default",
    });
  });

  it("resolves deprecated yoloMode: true to mode: 'yolo'", () => {
    const result = normalizePermissionSystemConfig({ yoloMode: true });
    expect(result.mode).toBe("yolo");
  });

  it("resolves deprecated allowEditsMode: true to mode: 'allowEdits'", () => {
    const result = normalizePermissionSystemConfig({ allowEditsMode: true });
    expect(result.mode).toBe("allowEdits");
  });

  it("new mode field takes precedence over deprecated booleans", () => {
    const result = normalizePermissionSystemConfig({
      mode: "default",
      yoloMode: true,
      allowEditsMode: true,
    });
    expect(result.mode).toBe("default");
  });
});
