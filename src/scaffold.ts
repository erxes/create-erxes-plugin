import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDockerfile,
  createManifest,
  createPackageManagerFiles,
  createRootPackageJson,
  type ProjectOptions,
} from "./generated.ts";
import { BACKENDS, FRONTENDS, runtimeFor } from "./stacks.ts";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));

// npm strips dotfiles like .gitignore from published packages, so templates
// store them with a leading underscore.
const DOTFILES: Record<string, string> = {
  _gitignore: ".gitignore",
  _dockerignore: ".dockerignore",
  "_env.example": ".env.example",
};

const tokensFor = ({
  names,
  description,
  apiPort,
  uiPort,
  packageManager,
}: ProjectOptions): [string, string][] => [
  ["__pmRun__", packageManager === "yarn" ? "yarn" : `${packageManager} run`],
  ["__pm__", packageManager],
  ["__runtime__", runtimeFor(packageManager) === "bun" ? "Bun" : "Node.js 22"],
  ["__apiPort__", String(apiPort)],
  ["__uiPort__", String(uiPort)],
  ["__name__", names.name],
  ["__id__", names.id],
  ["__remote__", names.remote],
  ["__camel__", names.camel],
  ["__Pascal__", names.pascal],
  ["__title__", names.title],
  ["__twPrefix__", names.cssPrefix],
  ["__description__", description],
];

const applyTokens = (text: string, tokens: [string, string][]) =>
  tokens.reduce((result, [token, value]) => result.replaceAll(token, value), text);

/** Copies a template layer into `targetDir`, renaming dotfiles and filling tokens. */
const copyLayer = async (layer: string, targetDir: string, tokens: [string, string][]) => {
  const sourceDir = join(TEMPLATES_DIR, layer);

  for (const entry of await readdir(sourceDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;

    const dir = join(targetDir, relative(sourceDir, entry.parentPath));
    const fileName = DOTFILES[entry.name] ?? applyTokens(entry.name, tokens);
    const content = await readFile(join(entry.parentPath, entry.name), "utf8");

    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, fileName), applyTokens(content, tokens));
  }
};

type PackageJson = {
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
type TsConfig = { compilerOptions?: { types?: string[] } };

const readJson = async <T>(path: string) => JSON.parse(await readFile(path, "utf8")) as T;

const writeJson = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

const sortKeys = (record: Record<string, string>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

/** Applies the runtime-specific scripts, dev dependencies and types to `api/`. */
const configureApiRuntime = async (apiDir: string, options: ProjectOptions) => {
  const runtime = runtimeFor(options.packageManager);
  const setup = BACKENDS[options.backend].runtimes[runtime];
  if (!setup) {
    throw new Error(`${BACKENDS[options.backend].label} does not support the ${runtime} runtime.`);
  }

  const pkgPath = join(apiDir, "package.json");
  const { scripts, dependencies, devDependencies, ...pkg } = await readJson<PackageJson>(pkgPath);
  await writeJson(pkgPath, {
    ...pkg,
    scripts: { ...setup.scripts, ...scripts },
    dependencies,
    devDependencies: sortKeys({ ...devDependencies, ...setup.devDependencies }),
  });

  const tsconfigPath = join(apiDir, "tsconfig.json");
  const tsconfig = await readJson<TsConfig>(tsconfigPath);
  await writeJson(tsconfigPath, {
    ...tsconfig,
    compilerOptions: { ...tsconfig.compilerOptions, types: setup.types },
  });
};

export const scaffold = async (targetDir: string, options: ProjectOptions) => {
  const tokens = tokensFor(options);
  const apiDir = join(targetDir, "api");

  await mkdir(targetDir, { recursive: true });
  await copyLayer("base", targetDir, tokens);
  // Framework-neutral API files (erxes.json/env loading, gateway registration).
  await copyLayer("api/shared", apiDir, tokens);
  await copyLayer(BACKENDS[options.backend].template, apiDir, tokens);
  await copyLayer(FRONTENDS[options.frontend].template, join(targetDir, "ui"), tokens);
  await configureApiRuntime(apiDir, options);

  await writeJson(join(targetDir, "erxes.json"), createManifest(options));
  await writeJson(join(targetDir, "package.json"), createRootPackageJson(options));
  await writeFile(join(targetDir, "Dockerfile"), createDockerfile(options));
  for (const [file, content] of Object.entries(createPackageManagerFiles(options))) {
    await writeFile(join(targetDir, file), content);
  }
};
