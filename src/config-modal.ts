import {
  type ExtensionAPI,
  type ExtensionCommandContext,
  getSettingsListTheme,
} from "@earendil-works/pi-coding-agent";
import { type SettingItem, SettingsList } from "@earendil-works/pi-tui";

import {
  DEFAULT_EXTENSION_CONFIG,
  type PermissionSystemExtensionConfig,
} from "./extension-config";
import type { Ruleset } from "./rule";

interface PermissionSystemConfigController {
  getConfig(): PermissionSystemExtensionConfig;
  setConfig(
    next: PermissionSystemExtensionConfig,
    ctx: ExtensionCommandContext,
  ): void;
  getConfigPath(): string;
  /** Optional: returns the composed config-layer ruleset for origin display. */
  getComposedRules?(): Ruleset;
}

const ON_OFF = ["on", "off"];
const COMMAND_ARGUMENTS = [
  {
    value: "show",
    label: "Show active settings",
    description: "Display the current pi-quick-perms config summary",
  },
  {
    value: "path",
    label: "Show config path",
    description: "Display the config.json path used by pi-quick-perms",
  },
  {
    value: "reset",
    label: "Reset defaults",
    description: "Restore default yolo/logging settings and persist them",
  },
  {
    value: "help",
    label: "Show help",
    description: "Display command usage",
  },
] as const;
const USAGE_TEXT =
  "Usage: /permission-system [show|path|reset|help] (or run /permission-system with no args to open settings modal)";

function cloneDefaultConfig(): PermissionSystemExtensionConfig {
  return {
    debugLog: DEFAULT_EXTENSION_CONFIG.debugLog,
    permissionReviewLog: DEFAULT_EXTENSION_CONFIG.permissionReviewLog,
    yoloMode: DEFAULT_EXTENSION_CONFIG.yoloMode,
    allowEditsMode: DEFAULT_EXTENSION_CONFIG.allowEditsMode,
  };
}

function toOnOff(value: boolean): string {
  return value ? "on" : "off";
}

function formatRulesSummary(rules: Ruleset): string {
  const configRules = rules.filter((r) => r.layer === "config" && r.origin);
  if (configRules.length === 0) return "";
  const formatted = configRules
    .map((r) => {
      const key =
        r.pattern === "*" ? r.surface : `${r.surface}["${r.pattern}"]`;
      return `${key}=${r.action} (${r.origin})`;
    })
    .join(", ");
  return `\n  rules: ${formatted}`;
}

function summarizeConfig(
  config: PermissionSystemExtensionConfig,
  rules?: Ruleset,
): string {
  const knobs = [
    `yoloMode=${toOnOff(config.yoloMode)}`,
    `allowEditsMode=${toOnOff(config.allowEditsMode)}`,
    `permissionReviewLog=${toOnOff(config.permissionReviewLog)}`,
    `debugLog=${toOnOff(config.debugLog)}`,
  ].join(", ");
  const rulesSuffix = rules ? formatRulesSummary(rules) : "";
  return `${knobs}${rulesSuffix}`;
}

function buildSettingItems(
  config: PermissionSystemExtensionConfig,
): SettingItem[] {
  return [
    {
      id: "yoloMode",
      label: "YOLO mode",
      description:
        "Auto-approve ask-state permission checks, including subagent approval forwarding",
      currentValue: toOnOff(config.yoloMode),
      values: ON_OFF,
    },
    {
      id: "allowEditsMode",
      label: "Allow edits mode",
      description:
        "Auto-approve ask-state permission checks for write and edit tools only",
      currentValue: toOnOff(config.allowEditsMode),
      values: ON_OFF,
    },
    {
      id: "permissionReviewLog",
      label: "Permission review log",
      description:
        "Write permission request and decision audit events to the extension logs directory",
      currentValue: toOnOff(config.permissionReviewLog),
      values: ON_OFF,
    },
    {
      id: "debugLog",
      label: "Debug logging",
      description:
        "Write verbose pi-quick-perms diagnostics to the extension logs directory",
      currentValue: toOnOff(config.debugLog),
      values: ON_OFF,
    },
  ];
}

function applySetting(
  config: PermissionSystemExtensionConfig,
  id: string,
  value: string,
): PermissionSystemExtensionConfig {
  switch (id) {
    case "yoloMode":
      return { ...config, yoloMode: value === "on" };
    case "allowEditsMode":
      return { ...config, allowEditsMode: value === "on" };
    case "permissionReviewLog":
      return { ...config, permissionReviewLog: value === "on" };
    case "debugLog":
      return { ...config, debugLog: value === "on" };
    default:
      return config;
  }
}

function syncSettingValues(
  settingsList: SettingsList,
  config: PermissionSystemExtensionConfig,
): void {
  settingsList.updateValue("yoloMode", toOnOff(config.yoloMode));
  settingsList.updateValue("allowEditsMode", toOnOff(config.allowEditsMode));
  settingsList.updateValue(
    "permissionReviewLog",
    toOnOff(config.permissionReviewLog),
  );
  settingsList.updateValue("debugLog", toOnOff(config.debugLog));
}

function getArgumentCompletions(
  argumentPrefix: string,
): Array<{ value: string; label: string; description: string }> | null {
  const normalized = argumentPrefix.trim().toLowerCase();
  if (normalized.includes(" ")) {
    return null;
  }

  const filtered = COMMAND_ARGUMENTS.filter((item) =>
    item.value.startsWith(normalized),
  );
  return filtered.length > 0 ? [...filtered] : null;
}

async function openSettingsModal(
  ctx: ExtensionCommandContext,
  controller: PermissionSystemConfigController,
): Promise<void> {
  const overlayOptions = {
    anchor: "center" as const,
    width: 82,
    maxHeight: "85%" as const,
    margin: 1,
  };

  await ctx.ui.custom<void>(
    (_tui, _theme, _keybindings, done) => {
      let current = controller.getConfig();
      const settingsList = new SettingsList(
        buildSettingItems(current),
        10,
        getSettingsListTheme(),
        (id, newValue) => {
          current = applySetting(current, id, newValue);
          controller.setConfig(current, ctx);
          current = controller.getConfig();
          syncSettingValues(settingsList, current);
        },
        () => done(),
      );

      return settingsList;
    },
    { overlay: true, overlayOptions },
  );
}

function handleArgs(
  args: string,
  ctx: ExtensionCommandContext,
  controller: PermissionSystemConfigController,
): boolean {
  const normalized = args.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === "show") {
    const rules = controller.getComposedRules?.();
    ctx.ui.notify(
      `pi-quick-perms: ${summarizeConfig(controller.getConfig(), rules)}`,
      "info",
    );
    return true;
  }

  if (normalized === "path") {
    ctx.ui.notify(
      `pi-quick-perms config: ${controller.getConfigPath()}`,
      "info",
    );
    return true;
  }

  if (normalized === "reset") {
    controller.setConfig(cloneDefaultConfig(), ctx);
    ctx.ui.notify("Pi quick perms settings reset to defaults.", "info");
    return true;
  }

  if (normalized === "help") {
    ctx.ui.notify(USAGE_TEXT, "info");
    return true;
  }

  ctx.ui.notify(USAGE_TEXT, "warning");
  return true;
}

export function registerPermissionSystemCommand(
  pi: ExtensionAPI,
  controller: PermissionSystemConfigController,
): void {
  pi.registerCommand("permission-system", {
    description:
      "Configure pi-quick-perms logging and yolo-mode behavior",
    getArgumentCompletions,
    handler: async (args, ctx) => {
      if (handleArgs(args, ctx, controller)) {
        return;
      }

      if (!ctx.hasUI) {
        ctx.ui.notify(
          "/permission-system requires interactive TUI mode.",
          "warning",
        );
        return;
      }

      await openSettingsModal(ctx, controller);
    },
  });
}
