import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import { isPermissionState } from "./common";
import type { FlatPermissionConfig, PermissionState } from "./types";

type PermissionSystemConfigFile = {
	permission?: FlatPermissionConfig;
	[key: string]: unknown;
};

type QuickPermissionCommandController = {
	getConfigPath(): string;
};

type ParsedRuleCommand = {
	tool: string;
	pattern: string;
};

const explicitSurfaces = new Set([
	"bash",
	"edit",
	"external_directory",
	"find",
	"grep",
	"ls",
	"mcp",
	"path",
	"read",
	"skill",
	"write",
]);

const usage =
	"Usage: /allow [surface] <pattern>, for example /allow bash gh api * or /allow sudo *";

export function registerQuickPermissionCommands(
	pi: ExtensionAPI,
	controller: QuickPermissionCommandController,
): void {
	registerRuleCommand(
		pi,
		controller,
		"allow",
		"Add an allow rule and reload permission config",
		"allow",
	);
	registerRuleCommand(
		pi,
		controller,
		"ask",
		"Add an ask rule and reload permission config",
		"ask",
	);
	registerRuleCommand(
		pi,
		controller,
		"block",
		"Add a deny rule and reload permission config",
		"deny",
	);

	pi.registerCommand("policy", {
		description:
			"Show the active permission policy file managed by pi-permission-system",
		handler: async (_args, ctx) => {
			const configPath = controller.getConfigPath();
			const config = await loadConfig(configPath);
			ctx.ui.notify(
				`Policy file: ${configPath}\n\n${summarizePolicy(config)}`,
				"info",
			);
		},
	});

	pi.registerCommand("policy-reload", {
		description: "Reload Pi resources after permission policy changes",
		handler: async (_args, ctx) => {
			await ctx.reload();
		},
	});
}

function registerRuleCommand(
	pi: ExtensionAPI,
	controller: QuickPermissionCommandController,
	name: string,
	description: string,
	action: PermissionState,
): void {
	pi.registerCommand(name, {
		description,
		handler: async (args, ctx) => {
			try {
				const { tool, pattern } = parseRuleCommand(args);
				const configPath = controller.getConfigPath();
				const currentConfig = await loadConfig(configPath);
				const nextConfig = applyRule(currentConfig, tool, pattern, action);

				await saveConfig(configPath, nextConfig);
				ctx.ui.notify(
					`${name}: ${tool} ${pattern}\nSaved to ${configPath}\nReloading...`,
					"info",
				);
				await ctx.reload();
			} catch (error) {
				ctx.ui.notify(
					error instanceof Error ? error.message : String(error),
					"error",
				);
			}
		},
	});
}

function parseRuleCommand(args: string): ParsedRuleCommand {
	const parts = args.trim().split(/\s+/).filter(Boolean);

	if (parts.length === 1 && parts[0] === "*") {
		return {
			tool: "*",
			pattern: "*",
		};
	}

	if (parts.length < 2) {
		throw new Error(usage);
	}

	const [tool, ...patternParts] = parts;
	const normalizedTool = tool.toLowerCase();

	if (!explicitSurfaces.has(normalizedTool)) {
		return {
			tool: "bash",
			pattern: parts.join(" "),
		};
	}

	return {
		tool: normalizedTool,
		pattern: patternParts.join(" "),
	};
}

function applyRule(
	config: PermissionSystemConfigFile,
	tool: string,
	pattern: string,
	action: PermissionState,
): PermissionSystemConfigFile {
	const permission = { ...(config.permission ?? {}) };
	if (tool === "*" && pattern === "*") {
		return {
			...config,
			permission: {
				...permission,
				"*": action,
			},
		};
	}

	const currentSurface = permission[tool];
	const toolRules = isRuleMap(currentSurface)
		? { ...currentSurface }
		: preserveScalarSurface(currentSurface);

	toolRules[pattern] = action;
	permission[tool] = toolRules;

	return {
		...config,
		permission,
	};
}

async function loadConfig(path: string): Promise<PermissionSystemConfigFile> {
	try {
		return JSON.parse(
			await readFile(path, "utf8"),
		) as PermissionSystemConfigFile;
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") {
			return {};
		}
		throw error;
	}
}

async function saveConfig(
	path: string,
	config: PermissionSystemConfigFile,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function summarizePolicy(config: PermissionSystemConfigFile): string {
	const permission = config.permission ?? {};
	const entries = Object.entries(permission);

	if (entries.length === 0) {
		return "No permission rules configured.";
	}

	return entries
		.map(([surface, value]) => {
			if (!isRuleMap(value)) {
				return `${surface}: ${value}`;
			}

			const rules = Object.entries(value)
				.map(([pattern, action]) => `  ${pattern}: ${action}`)
				.join("\n");

			return `${surface}\n${rules}`;
		})
		.join("\n\n");
}

function preserveScalarSurface(
	value: PermissionState | Record<string, PermissionState> | undefined,
): Record<string, PermissionState> {
	return isPermissionState(value) ? { "*": value } : {};
}

function isRuleMap(
	value: PermissionState | Record<string, PermissionState> | undefined,
): value is Record<string, PermissionState> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
