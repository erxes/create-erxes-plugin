import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { x } from "tinyexec";
import type { PluginNames } from "./naming.ts";
import { copyLayer, type PackageJson, readJson, sortKeys, writeJson } from "./scaffold.ts";

// A plugin for the new core (erxes `postgre`): Express 5 + oRPC + Drizzle on
// Postgres, and an Rsbuild Module Federation remote on React 19. pnpm only.

export const ERXES_REPO = "https://github.com/erxes/erxes.git";
export const DEFAULT_REF = "origin/main";

export type CoreOptions = {
  names: PluginNames;
  apiPort: number;
  uiPort: number;
  pnpmVersion: string;
  /** The old plugin this repo ports, e.g. `operation`. Adds the migration kit. */
  migrateFrom?: string;
};

export const scaffoldCore = async (targetDir: string, options: CoreOptions) => {
  const { names, migrateFrom } = options;
  const tokens: [string, string][] = [
    ["__id__", names.id],
    ["__Pascal__", names.pascal],
    ["__title__", names.title],
    ["__apiPort__", String(options.apiPort)],
    ["__uiPort__", String(options.uiPort)],
    ["__pnpmVersion__", options.pnpmVersion],
    [
      "__migrationSkill__",
      migrateFrom
        ? `\n- This repo ports the old erxes \`${migrateFrom}\` plugin. Work through
  \`MIGRATION.md\` with the \`plugin-migrate\` skill.`
        : "",
    ],
  ];
  await copyLayer("core/base", targetDir, tokens);
  // `@__id__/api` takes its place in the sorted list only once it has the plugin's name.
  const uiPackageJson = join(targetDir, "ui/package.json");
  const ui = await readJson<PackageJson>(uiPackageJson);
  await writeJson(uiPackageJson, { ...ui, devDependencies: sortKeys(ui.devDependencies ?? {}) });
  if (!migrateFrom) return;

  // The migrate layer's package.json holds only the scripts and dev
  // dependencies it adds to the base one.
  const packageJson = join(targetDir, "package.json");
  const base = await readJson<PackageJson>(packageJson);
  await copyLayer("core/migrate", targetDir, tokens);
  const extra = await readJson<Partial<PackageJson>>(packageJson);

  await writeJson(packageJson, {
    ...base,
    scripts: { ...base.scripts, ...extra.scripts },
    devDependencies: sortKeys({ ...base.devDependencies, ...extra.devDependencies }),
  });
};

const git = async (args: string[], cwd?: string) => {
  const result = await x("git", args, { nodeOptions: { cwd }, throwOnError: false });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  return result.stdout;
};

export const erxesCacheDir = () =>
  join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "create-erxes-plugin", "erxes");

/** A shallow, blobless clone of erxes/erxes main that checks out only the plugin folders. */
export const cloneErxes = async (dir = erxesCacheDir()) => {
  if (existsSync(join(dir, ".git"))) {
    await git(["fetch", "-q", "--depth=1", "origin", "main"], dir);
    await git(["checkout", "-q", "--detach", DEFAULT_REF], dir);
    return dir;
  }

  await mkdir(dirname(dir), { recursive: true });
  await git(["clone", "-q", "--depth=1", "--filter=blob:none", "--sparse", ERXES_REPO, dir]);
  await git(["sparse-checkout", "set", "backend/plugins", "frontend/plugins"], dir);
  return dir;
};

/** Old plugins at `ref`: every `backend/plugins/<name>_api`. */
export const listOldPlugins = async (from: string, ref: string) =>
  (await git(["ls-tree", "--name-only", `${ref}:backend/plugins`], from))
    .split("\n")
    .filter((entry) => entry.endsWith("_api"))
    .map((entry) => entry.slice(0, -"_api".length));
