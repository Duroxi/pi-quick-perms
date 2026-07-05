import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadAndMergeConfigs,
  loadUnifiedConfig,
  mergeUnifiedConfigs,
  resolveMode,
} from "../src/config-loader";

describe("loadUnifiedConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "config-loader-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("parses a valid JSON file with runtime knobs and flat permission", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: true,
        permissionReviewLog: false,
        yoloMode: true,
        permission: {
          "*": "ask",
          read: "allow",
          bash: { "git status": "allow" },
        },
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBe(true);
    expect(result.config.permissionReviewLog).toBe(false);
    expect(result.config.yoloMode).toBe(true);
    expect(result.config.permission).toEqual({
      "*": "ask",
      read: "allow",
      bash: { "git status": "allow" },
    });
  });

  it("strips JSONC comments before parsing", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      `{
  // This is a comment
  "debugLog": true,
  /* block comment */
  "permission": { "*": "ask" }
}`,
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBe(true);
    expect(result.config.permission).toEqual({ "*": "ask" });
  });

  it("ignores unknown keys without emitting issues", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: false,
        unknownField: "ignored",
        anotherRandom: 42,
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBe(false);
    expect(result.config).not.toHaveProperty("unknownField");
  });

  it("returns empty config and no issues when the file does not exist", () => {
    const configPath = join(tempDir, "nonexistent.json");
    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBeUndefined();
    expect(result.config.permission).toBeUndefined();
  });

  it("returns empty config and an issue when the file contains invalid JSON", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(configPath, "not valid json {{{");

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain(configPath);
  });

  it("normalizes boolean fields strictly", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: "yes",
        permissionReviewLog: 1,
        yoloMode: null,
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.config.debugLog).toBeUndefined();
    expect(result.config.permissionReviewLog).toBeUndefined();
    expect(result.config.yoloMode).toBeUndefined();
  });

  it("normalizes permission map, keeping only valid PermissionState values", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        permission: {
          read: "allow",
          write: "invalid",
          bash: { "git *": "ask", "rm -rf": 42 },
        },
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.config.permission).toEqual({
      read: "allow",
      bash: { "git *": "ask" },
    });
  });

  it("accepts permission as object with mixed string and object values", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        permission: {
          "*": "ask",
          read: "allow",
          bash: { "*": "ask", "git *": "allow" },
          external_directory: "ask",
        },
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.permission).toEqual({
      "*": "ask",
      read: "allow",
      bash: { "*": "ask", "git *": "allow" },
      external_directory: "ask",
    });
  });

  it("returns no permission when the permission field is absent", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(configPath, JSON.stringify({ debugLog: false }));

    const result = loadUnifiedConfig(configPath);
    expect(result.config.permission).toBeUndefined();
  });

  it("ignores a non-object permission field", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(configPath, JSON.stringify({ permission: "allow" }));

    const result = loadUnifiedConfig(configPath);
    expect(result.config.permission).toBeUndefined();
  });
});

describe("mergeUnifiedConfigs", () => {
  it("deep-merges permission objects so project overrides global per-key", () => {
    const merged = mergeUnifiedConfigs(
      {
        permission: {
          "*": "ask",
          read: "allow",
          bash: { "git status": "allow" },
        },
      },
      {
        permission: {
          "*": "allow",
          bash: { "rm -rf *": "deny" },
        },
      },
    );

    expect(merged.permission).toEqual({
      "*": "allow",
      read: "allow",
      bash: { "git status": "allow", "rm -rf *": "deny" },
    });
  });

  it("string permission value in override replaces base string for same key", () => {
    const merged = mergeUnifiedConfigs(
      { permission: { read: "ask" } },
      { permission: { read: "allow" } },
    );
    expect(merged.permission).toEqual({ read: "allow" });
  });

  it("object replaces string when override uses object for same surface", () => {
    const merged = mergeUnifiedConfigs(
      { permission: { bash: "ask" } },
      { permission: { bash: { "*": "allow", "rm -rf *": "deny" } } },
    );
    expect(merged.permission).toEqual({
      bash: { "*": "allow", "rm -rf *": "deny" },
    });
  });

  it("string replaces object when override uses string for same surface", () => {
    const merged = mergeUnifiedConfigs(
      { permission: { bash: { "git *": "allow" } } },
      { permission: { bash: "deny" } },
    );
    expect(merged.permission).toEqual({ bash: "deny" });
  });

  it("replaces scalar runtime knobs (project wins)", () => {
    const merged = mergeUnifiedConfigs(
      { debugLog: true, permissionReviewLog: true, yoloMode: false },
      { debugLog: false, yoloMode: true },
    );

    expect(merged.debugLog).toBe(false);
    expect(merged.permissionReviewLog).toBe(true);
    expect(merged.yoloMode).toBe(true);
  });

  it("returns base unchanged when override is empty", () => {
    const base = {
      debugLog: true,
      permission: { read: "allow" as const },
    };
    const merged = mergeUnifiedConfigs(base, {});

    expect(merged.debugLog).toBe(true);
    expect(merged.permission).toEqual({ read: "allow" });
  });

  it("returns override unchanged when base is empty", () => {
    const override = {
      yoloMode: true,
      permission: { bash: { "rm -rf *": "deny" as const } },
    };
    const merged = mergeUnifiedConfigs({}, override);

    expect(merged.yoloMode).toBe(true);
    expect(merged.permission).toEqual({ bash: { "rm -rf *": "deny" } });
  });

  it("does not set undefined keys in the merged result", () => {
    const merged = mergeUnifiedConfigs({ debugLog: true }, { yoloMode: false });

    expect(merged.debugLog).toBe(true);
    expect(merged.yoloMode).toBe(false);
    expect(merged).not.toHaveProperty("permissionReviewLog");
    expect(merged).not.toHaveProperty("permission");
  });
});

describe("loadAndMergeConfigs", () => {
  let tempDir: string;
  let agentDir: string;
  let cwd: string;
  let extensionRoot: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "config-merge-test-"));
    agentDir = join(tempDir, "agent");
    cwd = join(tempDir, "project");
    extensionRoot = join(tempDir, "ext");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeGlobal(content: Record<string, unknown>): void {
    const dir = join(agentDir, "extensions", "pi-quick-perms");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.json"), JSON.stringify(content));
  }

  function writeProject(content: Record<string, unknown>): void {
    const dir = join(cwd, ".pi", "extensions", "pi-permission-system");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.json"), JSON.stringify(content));
  }

  function writeLegacyGlobalPolicy(content: Record<string, unknown>): void {
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      join(agentDir, "pi-permissions.jsonc"),
      JSON.stringify(content),
    );
  }

  function writeLegacyProjectPolicy(content: Record<string, unknown>): void {
    const dir = join(cwd, ".pi", "agent");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "pi-permissions.jsonc"), JSON.stringify(content));
  }

  function writeLegacyExtensionConfig(content: Record<string, unknown>): void {
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, "config.json"), JSON.stringify(content));
  }

  it("merges global and project new-layout configs", () => {
    writeGlobal({
      debugLog: true,
      permission: { "*": "ask", read: "allow" },
    });
    writeProject({
      permission: { "*": "allow", write: "deny" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
    expect(result.merged.debugLog).toBe(true);
    expect(result.merged.permission).toEqual({
      "*": "allow",
      read: "allow",
      write: "deny",
    });
  });

  it("detects legacy global policy and emits migration issue", () => {
    writeLegacyGlobalPolicy({
      defaultPolicy: { tools: "allow" },
      tools: { read: "allow" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("pi-permissions.jsonc");
    expect(result.issues[0]).toContain(
      process.platform === "win32"
        ? join("extensions", "pi-quick-perms")
        : "extensions/pi-quick-perms",
    );
    // Legacy file has no flat-format permission key — no rules extracted
    expect(result.merged.permission).toBeUndefined();
  });

  it("detects legacy project policy and emits migration issue", () => {
    writeLegacyProjectPolicy({
      bash: { "git status": "allow" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain(
      process.platform === "win32"
        ? join(".pi", "agent", "pi-permissions.jsonc")
        : ".pi/agent/pi-permissions.jsonc",
    );
    expect(result.issues[0]).toContain(
      process.platform === "win32"
        ? join(".pi", "extensions", "pi-permission-system")
        : ".pi/extensions/pi-permission-system",
    );
    // Legacy file has no flat-format permission key — no rules extracted
    expect(result.merged.permission).toBeUndefined();
  });

  it("detects legacy extension runtime config and emits migration issue", () => {
    writeLegacyExtensionConfig({
      debugLog: true,
      yoloMode: true,
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain(extensionRoot);
    expect(result.merged.debugLog).toBe(true);
    expect(result.merged.yoloMode).toBe(true);
  });

  it("does not emit legacy extension config issue when path equals new global path", () => {
    const newGlobalDir = join(agentDir, "extensions", "pi-quick-perms");
    mkdirSync(newGlobalDir, { recursive: true });
    writeFileSync(
      join(newGlobalDir, "config.json"),
      JSON.stringify({ debugLog: true }),
    );

    const result = loadAndMergeConfigs(agentDir, cwd, newGlobalDir);
    expect(result.issues.filter((i) => i.includes("legacy"))).toHaveLength(0);
  });

  it("emits no issues when no legacy files exist and no new files exist", () => {
    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
  });

  it("new-layout config takes precedence over legacy config at same scope", () => {
    writeGlobal({
      permission: { "*": "deny" },
    });
    writeLegacyGlobalPolicy({
      permission: { "*": "allow" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    // New layout wins (legacy loaded first, new layout loaded second → new wins)
    expect(result.merged.permission).toEqual({ "*": "deny" });
    // But legacy still emits a migration warning
    expect(result.issues.some((i) => i.includes("pi-permissions.jsonc"))).toBe(
      true,
    );
  });

  it("preserves allowEditsMode through global config", () => {
    writeGlobal({ allowEditsMode: true });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
    expect(result.merged.allowEditsMode).toBe(true);
  });

  it("preserves allowEditsMode through project config", () => {
    writeProject({ allowEditsMode: true });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
    expect(result.merged.allowEditsMode).toBe(true);
  });

  it("global allowEditsMode=false is overridden by project allowEditsMode=true", () => {
    writeGlobal({ allowEditsMode: false });
    writeProject({ allowEditsMode: true });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.merged.allowEditsMode).toBe(true);
  });

  it("defaults allowEditsMode to false when not present in any config", () => {
    writeGlobal({ permission: { "*": "ask" } });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    // merged is UnifiedPermissionConfig, not yet normalized to PermissionSystemExtensionConfig
    // allowEditsMode is undefined at this stage; normalizePermissionSystemConfig will default it to false
    expect(result.merged.allowEditsMode).toBeUndefined();
  });

  // ── mode field ──────────────────────────────────────────────────────────

  it("preserves mode through global config", () => {
    writeGlobal({ mode: "yolo" });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
    expect(result.merged.mode).toBe("yolo");
  });

  it("preserves mode through project config", () => {
    writeProject({ mode: "allowEdits" });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
    expect(result.merged.mode).toBe("allowEdits");
  });

  it("project mode overrides global mode", () => {
    writeGlobal({ mode: "yolo" });
    writeProject({ mode: "default" });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.merged.mode).toBe("default");
  });

  it("mode field takes precedence over deprecated yoloMode boolean", () => {
    writeGlobal({ yoloMode: true });
    writeProject({ mode: "default" });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    // At the UnifiedPermissionConfig level, both fields are present.
    // resolveMode (in normalizePermissionSystemConfig) uses mode first.
    expect(result.merged.mode).toBe("default");
    expect(result.merged.yoloMode).toBe(true);
  });
});

// ── resolveMode ───────────────────────────────────────────────────────────

describe("resolveMode", () => {
  it("returns 'default' for empty config", () => {
    expect(resolveMode({})).toBe("default");
  });

  it("returns 'yolo' when mode is 'yolo'", () => {
    expect(resolveMode({ mode: "yolo" })).toBe("yolo");
  });

  it("returns 'allowEdits' when mode is 'allowEdits'", () => {
    expect(resolveMode({ mode: "allowEdits" })).toBe("allowEdits");
  });

  it("returns 'default' when mode is 'default'", () => {
    expect(resolveMode({ mode: "default" })).toBe("default");
  });

  it("maps deprecated yoloMode: true to 'yolo'", () => {
    expect(resolveMode({ yoloMode: true })).toBe("yolo");
  });

  it("maps deprecated allowEditsMode: true to 'allowEdits'", () => {
    expect(resolveMode({ allowEditsMode: true })).toBe("allowEdits");
  });

  it("mode field takes precedence over deprecated yoloMode", () => {
    expect(resolveMode({ mode: "default", yoloMode: true })).toBe("default");
  });

  it("mode field takes precedence over deprecated allowEditsMode", () => {
    expect(resolveMode({ mode: "yolo", allowEditsMode: true })).toBe("yolo");
  });

  it("yoloMode takes precedence over allowEditsMode when both deprecated", () => {
    expect(resolveMode({ yoloMode: true, allowEditsMode: true })).toBe("yolo");
  });

  it("deprecated false values do not map to mode", () => {
    expect(resolveMode({ yoloMode: false, allowEditsMode: false })).toBe("default");
  });
});
