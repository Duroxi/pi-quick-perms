<p align="center">
  <img src="docs/assets/logo.png" alt="pi-quick-perms logo">
</p>

# pi-quick-perms

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Pi Package](https://img.shields.io/badge/Pi-Package-6366F1?style=flat)](https://pi.mariozechner.at/)

Permission enforcement extension for the [Pi](https://pi.mariozechner.at/) coding agent that provides centralized, deterministic permission gates over tool, bash, MCP, skill, and special operations plus quick policy commands.

> **Fork notice:** This package is a local fork of `@gotgenes/pi-permission-system`, forked from upstream package version `5.18.1`.
> Its own package version starts at `1.0.0` under the `pi-quick-perms` identity because it has diverged in config paths, quick commands, and permission prompt UX.

## What It Does

- **Hides disallowed tools** before the agent starts — no wasted turns probing for blocked tools
- **Enforces allow / ask / deny** at tool-call time with UI confirmation dialogs
- **Controls bash commands** with wildcard pattern matching (`git *: ask`, `rm -rf *: deny`)
- **Gates MCP and skill access** at server, tool, and skill-name granularity
- **Protects sensitive file patterns** — cross-cutting `path` rules deny `.env`, `~/.ssh/*`, etc. across all tools and bash at once
- **Guards external paths** — prompts before file tools or bash commands reach outside `cwd`
- **Forwards prompts from subagents** — `ask` policies work even in non-UI execution contexts

## Install

This local fork folds quick policy commands into the enforcement extension and uses clearer permission dialog labels.

To load it locally:

```bash
pi remove npm:@gotgenes/pi-permission-system
pi remove /home/atb/Code/pi-quick-perms
pi install /home/atb/Code/pi-quick-perms
```

Global policy lives at:

```text
~/.pi/agent/extensions/pi-quick-perms/config.json
```

Project policy remains compatible with the upstream path:

```text
<project>/.pi/extensions/pi-permission-system/config.json
```

## Quick Start

1. Create the global config file at `~/.pi/agent/extensions/pi-quick-perms/config.json`:

    ```jsonc
    {
      "permission": {
        "*": "allow",
        "path": {
          "*": "allow",
          "*.env": "deny",
          "*.env.*": "deny",
          "*.env.example": "allow"
        },
        "bash": {
          "rm -rf *": "deny",
          "sudo *": "ask"
        },
        "external_directory": "ask"
      }
    }
    ```

2. Start Pi — the extension automatically loads and enforces your policy.

The local fork also provides shortcut commands:

```text
/allow bash gh api *
/block bash sudo *
/ask bash git push *
/policy
/policy-reload
```

`/block` writes gotgenes' `deny` action. Rule mutations save the global config file and call Pi's reload flow automatically.

All permissions use one of three states:

|State|Behavior|
|---|---|
|`allow`|Permits the action silently|
|`deny`|Blocks the action with an error message|
|`ask`|Prompts the user for confirmation via UI|

When the dialog prompts, you can approve once or approve a pattern for the rest of the session.
See [docs/session-approvals.md](docs/session-approvals.md) for details on session-scoped rules and pattern suggestions.

The `path` surface is a cross-cutting gate that applies to **all** file access — both Pi tools and bash commands.
A `path` deny cannot be overridden by a per-tool allow, making it the right place to protect sensitive files like `.env` or `~/.ssh/*` from every tool at once.

For per-tool path patterns (`read`, `write`, `edit`, `find`, `grep`, `ls`), patterns are matched against the file path from `input.path`.
This lets you express rules like "allow reads but deny `.env` files" at the individual tool level.

Four layers compose with most-restrictive-wins: `path` (cross-cutting) → `external_directory` (CWD boundary) → per-tool patterns → `bash` command patterns.

## Configuration

Config lives in one JSON file per scope:

|Scope|Path|
|---|---|
|Global|`~/.pi/agent/extensions/pi-quick-perms/config.json`|
|Project|`<cwd>/.pi/extensions/pi-permission-system/config.json`|

Project overrides global; per-agent YAML frontmatter overrides both.

Within a surface map like `bash` or `mcp`, **last matching rule wins** — put broad catch-alls first and specific overrides after.

For the full reference — all surfaces, runtime knobs, per-agent overrides, merge semantics, and common recipes — see [docs/configuration.md](docs/configuration.md).

## Documentation

|Document|Contents|
|---|---|
|[docs/configuration.md](docs/configuration.md)|Full policy reference, runtime knobs, per-agent overrides, recipes|
|[docs/session-approvals.md](docs/session-approvals.md)|Session-scoped rules, pattern suggestions, bash arity table|
|[docs/cross-extension-api.md](docs/cross-extension-api.md)|Cross-extension service accessor, event bus integration, decision broadcasts|
|[docs/subagent-integration.md](docs/subagent-integration.md)|Permission forwarding, coexistence with subagent extensions|
|[docs/guides/permission-frontmatter-for-subagent-extensions.md](docs/guides/permission-frontmatter-for-subagent-extensions.md)|Convention guide for subagent extension authors|
|[docs/opencode-compatibility.md](docs/opencode-compatibility.md)|OpenCode compatibility — shared concepts, divergences, porting guide|
|[docs/troubleshooting.md](docs/troubleshooting.md)|Common issues, diagnostic logging, threat model|
|[docs/migration/legacy-to-flat.md](docs/migration/legacy-to-flat.md)|Migration from pre-v2 config layout|

## Development

```bash
pnpm run build       # Type-check TypeScript (no emit)
pnpm run lint        # Biome lint + format check
pnpm run lint:fix    # Biome lint + format auto-fix
pnpm run lint:md     # markdownlint-cli2 on README etc.
pnpm run lint:all    # lint + lint:md
pnpm run format      # Biome format --write
pnpm run test        # Run tests from ./tests
pnpm run check       # build + lint:all + test
```

### Pre-commit hooks

This project uses [prek](https://prek.j178.dev/) to run Biome and markdownlint on staged files before each commit.
Run `pnpm install` to set up hooks automatically.

## Acknowledgments

This project began as a fork of [MasuRii/pi-permission-system](https://github.com/MasuRii/pi-permission-system).
Thank you to [MasuRii](https://github.com/MasuRii) for the original work that made this possible.

Thank you to the [OpenCode](https://opencode.ai) team for the permission model design that inspired the flat config format and evaluation semantics used in this extension.

## License

[MIT](LICENSE)
