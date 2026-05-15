import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { registerQuickPermissionCommands } from "../src/quick-commands";

type RegisteredCommand = {
	description: string;
	handler: (args: string, ctx: CommandContextStub) => Promise<void>;
};

type CommandContextStub = {
	cwd?: string;
	ui: {
		notify(message: string, level: "info" | "warning" | "error"): void;
	};
	reload(): Promise<void>;
};

type Notification = { message: string; level: "info" | "warning" | "error" };

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(path, "utf8"));
}

function getProjectConfigPath(cwd: string): string {
	return join(cwd, ".pi", "extensions", "pi-permission-system", "config.json");
}

function createHarness(options: { globalConfigPath: string; cwd?: string }): {
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
		{
			getGlobalConfigPath: () => options.globalConfigPath,
			getProjectConfigPath,
		},
	);

	return {
		commands,
		notifications,
		reload,
		ctx: {
			cwd: options.cwd,
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
			const { commands } = createHarness({
				globalConfigPath: join(dir, "global", "config.json"),
				cwd: join(dir, "project"),
			});
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

	it("writes allow, deny, and ask rules to project config by default", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-rules-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		const projectConfigPath = getProjectConfigPath(projectCwd);
		try {
			const { commands, ctx, reload } = createHarness({
				globalConfigPath,
				cwd: projectCwd,
			});

			await commands.get("allow")?.handler("bash gh api *", ctx);
			await commands.get("block")?.handler("bash sudo *", ctx);
			await commands.get("ask")?.handler("bash git push *", ctx);

			expect(await readJson(projectConfigPath)).toEqual({
				permission: {
					bash: {
						"gh api *": "allow",
						"sudo *": "deny",
						"git push *": "ask",
					},
				},
			});
			await expect(readFile(globalConfigPath, "utf8")).rejects.toMatchObject({
				code: "ENOENT",
			});
			expect(reload).toHaveBeenCalledTimes(3);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes rule commands to global config with --global", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-global-flag-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		const projectConfigPath = getProjectConfigPath(projectCwd);
		try {
			const { commands, ctx } = createHarness({ globalConfigPath, cwd: projectCwd });

			await commands.get("allow")?.handler("--global sudo *", ctx);

			expect(await readJson(globalConfigPath)).toEqual({
				permission: {
					bash: {
						"sudo *": "allow",
					},
				},
			});
			await expect(readFile(projectConfigPath, "utf8")).rejects.toMatchObject({
				code: "ENOENT",
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes bare wildcard rules to project config by default", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-project-wildcard-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		const projectConfigPath = getProjectConfigPath(projectCwd);
		try {
			const { commands, ctx, reload } = createHarness({
				globalConfigPath,
				cwd: projectCwd,
			});

			await commands.get("allow")?.handler("*", ctx);

			expect(await readJson(projectConfigPath)).toEqual({
				permission: { "*": "allow" },
			});
			expect(reload).toHaveBeenCalledTimes(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes bare wildcard rules to global config with --global", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-global-wildcard-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		try {
			const { commands, ctx } = createHarness({ globalConfigPath, cwd: projectCwd });

			await commands.get("allow")?.handler("--global *", ctx);

			expect(await readJson(globalConfigPath)).toEqual({
				permission: { "*": "allow" },
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("treats commands without an explicit surface as bash patterns", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-bash-shorthand-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		const projectConfigPath = getProjectConfigPath(projectCwd);
		try {
			const { commands, ctx } = createHarness({ globalConfigPath, cwd: projectCwd });

			await commands.get("allow")?.handler("sudo *", ctx);

			expect(await readJson(projectConfigPath)).toEqual({
				permission: {
					bash: {
						"sudo *": "allow",
					},
				},
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("preserves scalar tool permissions as catch-all rules", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-scalar-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		const projectConfigPath = getProjectConfigPath(projectCwd);
		try {
			await mkdir(dirname(projectConfigPath), { recursive: true });
			await writeFile(
				projectConfigPath,
				JSON.stringify({ permission: { bash: "allow" } }, null, 2),
				"utf8",
			);
			const { commands, ctx } = createHarness({ globalConfigPath, cwd: projectCwd });

			await commands.get("block")?.handler("bash sudo *", ctx);

			expect(await readJson(projectConfigPath)).toEqual({
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

	it("shows project policy by default with global fallback path", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-policy-project-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		const projectConfigPath = getProjectConfigPath(projectCwd);
		try {
			await mkdir(dirname(projectConfigPath), { recursive: true });
			await writeFile(
				projectConfigPath,
				JSON.stringify({ permission: { bash: { "sudo *": "allow" } } }),
				"utf8",
			);
			const { commands, ctx, notifications, reload } = createHarness({
				globalConfigPath,
				cwd: projectCwd,
			});

			await commands.get("policy")?.handler("", ctx);

			expect(notifications.at(-1)?.message).toContain("Scope: project");
			expect(notifications.at(-1)?.message).toContain(
				`Policy file: ${projectConfigPath}`,
			);
			expect(notifications.at(-1)?.message).toContain(
				`Global fallback: ${globalConfigPath}`,
			);
			expect(notifications.at(-1)?.message).toContain("sudo *: allow");
			expect(reload).not.toHaveBeenCalled();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("shows global policy with --global", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-policy-global-"));
		const globalConfigPath = join(dir, "global", "config.json");
		const projectCwd = join(dir, "project");
		try {
			await mkdir(dirname(globalConfigPath), { recursive: true });
			await writeFile(
				globalConfigPath,
				JSON.stringify({ permission: { bash: { "sudo *": "allow" } } }),
				"utf8",
			);
			const { commands, ctx, notifications, reload } = createHarness({
				globalConfigPath,
				cwd: projectCwd,
			});

			await commands.get("policy")?.handler("--global", ctx);

			expect(notifications.at(-1)?.message).toContain("Scope: global");
			expect(notifications.at(-1)?.message).toContain(
				`Policy file: ${globalConfigPath}`,
			);
			expect(notifications.at(-1)?.message).not.toContain("Global fallback:");
			expect(notifications.at(-1)?.message).toContain("sudo *: allow");
			expect(reload).not.toHaveBeenCalled();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("reports an error when project scope has no cwd", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-no-cwd-"));
		try {
			const { commands, ctx, notifications, reload } = createHarness({
				globalConfigPath: join(dir, "global", "config.json"),
			});

			await commands.get("allow")?.handler("sudo *", ctx);

			expect(notifications.at(-1)).toEqual({
				level: "error",
				message:
					"Project policy requires a working directory. Use --global to write global policy.",
			});
			expect(reload).not.toHaveBeenCalled();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("reloads on policy-reload", async () => {
		const dir = await mkdtemp(join(tmpdir(), "quick-perms-reload-"));
		try {
			const { commands, ctx, reload } = createHarness({
				globalConfigPath: join(dir, "global", "config.json"),
				cwd: join(dir, "project"),
			});

			await commands.get("policy-reload")?.handler("", ctx);

			expect(reload).toHaveBeenCalledTimes(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
