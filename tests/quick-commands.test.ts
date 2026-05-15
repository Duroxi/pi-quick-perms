import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { registerQuickPermissionCommands } from "../src/quick-commands";

type RegisteredCommand = {
	description: string;
	handler: (args: string, ctx: CommandContextStub) => Promise<void>;
};

type CommandContextStub = {
	ui: {
		notify(message: string, level: "info" | "warning" | "error"): void;
	};
	reload(): Promise<void>;
};

type Notification = { message: string; level: "info" | "warning" | "error" };

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(path, "utf8"));
}

function createHarness(configPath: string): {
	commands: Map<string, RegisteredCommand>;
	ctx: CommandContextStub;
	notifications: Notification[];
	reload: ReturnType<typeof vi.fn>;
} {
	const commands = new Map<string, RegisteredCommand>();
	const notifications: Notification[] = [];
	const reload = vi.fn().mockResolvedValue(undefined);

	registerQuickPermissionCommands(
		{
			registerCommand(name: string, command: RegisteredCommand) {
				commands.set(name, command);
			},
		} as never,
		{ getConfigPath: () => configPath },
	);

	return {
		commands,
		notifications,
		reload,
		ctx: {
			ui: {
				notify(message: string, level: "info" | "warning" | "error") {
					notifications.push({ message, level });
				},
			},
			reload,
		},
	};
}

describe("quick permission commands", () => {
	it("registers allow, block, ask, policy, and policy-reload", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-register-"));
		try {
			const { commands } = createHarness(join(dir, "config.json"));
			expect([...commands.keys()].sort()).toEqual([
				"allow",
				"ask",
				"block",
				"policy",
				"policy-reload",
			]);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes allow, deny, and ask rules then reloads after each mutation", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-rules-"));
		const configPath = join(dir, "nested", "config.json");
		try {
			const { commands, ctx, reload } = createHarness(configPath);

			await commands.get("allow")?.handler("bash gh api *", ctx);
			await commands.get("block")?.handler("bash sudo *", ctx);
			await commands.get("ask")?.handler("bash git push *", ctx);

			expect(await readJson(configPath)).toEqual({
				permission: {
					bash: {
						"gh api *": "allow",
						"sudo *": "deny",
						"git push *": "ask",
					},
				},
			});
			expect(reload).toHaveBeenCalledTimes(3);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("preserves scalar tool permissions as catch-all rules", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-scalar-"));
		const configPath = join(dir, "config.json");
		try {
			await import("node:fs/promises").then(({ writeFile }) =>
				writeFile(
					configPath,
					JSON.stringify({ permission: { bash: "allow" } }, null, 2),
					"utf8",
				),
			);
			const { commands, ctx } = createHarness(configPath);

			await commands.get("block")?.handler("bash sudo *", ctx);

			expect(await readJson(configPath)).toEqual({
				permission: {
					bash: {
						"*": "allow",
						"sudo *": "deny",
					},
				},
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("shows policy summary without reloading", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-policy-"));
		const configPath = join(dir, "config.json");
		try {
			await import("node:fs/promises").then(({ writeFile }) =>
				writeFile(
					configPath,
					JSON.stringify(
						{ permission: { bash: { "gh api *": "allow" } } },
						null,
						2,
					),
					"utf8",
				),
			);
			const { commands, ctx, notifications, reload } =
				createHarness(configPath);

			await commands.get("policy")?.handler("", ctx);

			expect(notifications.at(-1)).toEqual({
				level: "info",
				message: `Policy file: ${configPath}\n\nbash\n  gh api *: allow`,
			});
			expect(reload).not.toHaveBeenCalled();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("reloads on policy-reload", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-reload-"));
		try {
			const { commands, ctx, reload } = createHarness(join(dir, "config.json"));

			await commands.get("policy-reload")?.handler("", ctx);

			expect(reload).toHaveBeenCalledTimes(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
