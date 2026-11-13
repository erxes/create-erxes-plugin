import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Command, Option } from "commander";
import { getUserAgent } from "package-manager-detector/detect";
import { x } from "tinyexec";
import {
  cloneErxes,
  DEFAULT_REF,
  ERXES_REPO,
  erxesCacheDir,
  listOldPlugins,
  scaffoldCore,
} from "./core-scaffold.ts";
import { type ProjectOptions, runtimesFor } from "./generated.ts";
import { derivePluginNames, validateCorePluginName, validatePluginName } from "./naming.ts";
import { scaffold } from "./scaffold.ts";
import { VERSION } from "./templates.generated.ts";
import {
  BACKENDS,
  type Backend,
  DEFAULT_BACKEND,
  INTEGRATIONS,
  type Integration,
  isBackend,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
  runtimeFor,
} from "./stacks.ts";

const DEFAULT_API_PORT = 3399;
const DEFAULT_UI_PORT = 3099;

const ERXES_TARGETS = ["old", "core"] as const;
type ErxesTarget = (typeof ERXES_TARGETS)[number];

type CliOptions = {
  erxes?: string;
  migrate?: boolean;
  from?: string;
  clone?: boolean;
  plugin?: string;
  ref?: string;
  name?: string;
  title?: string;
  description?: string;
  backend?: string;
  pm?: string;
  apiPort?: string;
  uiPort?: string;
  install: boolean;
  git: boolean;
  yes?: boolean;
};

const unwrap = <T>(value: T): Exclude<T, symbol> => {
  if (typeof value === "symbol") {
    p.cancel("Cancelled.");
    process.exit(1);
  }
  return value as Exclude<T, symbol>;
};

const fail = (message: string): never => {
  p.cancel(message);
  process.exit(1);
};

const validatePort = (value: string | undefined) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536
    ? undefined
    : "Enter a port between 1 and 65535.";
};

const isEmptyDir = (dir: string) => !existsSync(dir) || readdirSync(dir).length === 0;

// Next steps target a POSIX shell on Unix and PowerShell on Windows. Single
// quotes keep spaces and shell metacharacters literal in both, with different
// escaping for an apostrophe inside the path.
const changeDirectoryCommand = (path: string) =>
  process.platform === "win32"
    ? `Set-Location -LiteralPath '${path.replaceAll("'", "''")}'`
    : `cd -- '${path.replaceAll("'", "'\\''")}'`;

const detectPackageManager = (): PackageManager => {
  const agent = getUserAgent();
  return agent && isPackageManager(agent) ? agent : "npm";
};

const packageManagerVersion = async (pm: PackageManager) => {
  const result = await x(pm, ["--version"], { throwOnError: false });
  const version = result.stdout.trim();
  return /^\d+\.\d+\.\d+$/.test(version) ? version : undefined;
};

const askName = async (
  cli: CliOptions,
  directory?: string,
  validate: (name: string) => string | undefined = validatePluginName,
) => {
  const fromDirectory = directory ? basename(resolve(directory)) : undefined;
  const candidate = cli.name ?? fromDirectory;

  if (candidate && !validate(candidate)) return candidate;
  if (cli.name) fail(`Invalid plugin name "${cli.name}": ${validate(cli.name)}`);
  if (cli.yes) fail("Pass a valid plugin name with --name or as the directory.");

  return unwrap(
    await p.text({
      message: "Plugin name",
      placeholder: "inventory",
      validate: (value) => validate(value ?? ""),
    }),
  );
};

const isErxesTarget = (value: string): value is ErxesTarget =>
  ERXES_TARGETS.some((target) => target === value);

const askErxes = async (cli: CliOptions): Promise<ErxesTarget> => {
  if (cli.erxes)
    return isErxesTarget(cli.erxes) ? cli.erxes : fail(`Unknown erxes "${cli.erxes}".`);
  if (cli.yes) return "old";

  return unwrap(
    await p.select<ErxesTarget>({
      message: "Which erxes?",
      initialValue: "old",
      options: [
        { value: "old", label: "old erxes", hint: "GraphQL gateway, Mongo" },
        { value: "core", label: "new core", hint: "Postgres and oRPC, erxes branch postgre" },
      ],
    }),
  );
};

const askText = async (
  message: string,
  given: string | undefined,
  fallback: string,
  yes?: boolean,
) =>
  given ??
  (yes
    ? fallback
    : unwrap(await p.text({ message, defaultValue: fallback, placeholder: fallback })));

const askPort = async (
  message: string,
  given: string | undefined,
  fallback: number,
  yes?: boolean,
) => {
  if (given !== undefined) {
    const error = validatePort(given);
    if (error) fail(`${message}: ${error}`);
    return Number(given);
  }
  if (yes) return fallback;
  const answer = unwrap(
    await p.text({
      message,
      defaultValue: String(fallback),
      placeholder: String(fallback),
      validate: (value) => (value ? validatePort(value) : undefined),
    }),
  );
  return Number(answer);
};

const askBackend = async (cli: CliOptions): Promise<Backend> => {
  if (cli.backend)
    return isBackend(cli.backend) ? cli.backend : fail(`Unknown backend "${cli.backend}".`);

  if (cli.yes) return DEFAULT_BACKEND;

  const integration = unwrap(
    await p.select<Integration>({
      message: "erxes integration",
      initialValue: "platform",
      options: Object.entries(INTEGRATIONS).map(([value, { label, hint }]) => ({
        value: value as Integration,
        label,
        hint,
      })),
    }),
  );
  if (integration === "platform") return "platform";

  const frameworks = Object.entries(BACKENDS).filter(
    (entry): entry is [Backend, (typeof BACKENDS)[Backend]] =>
      entry[1].integration === "standalone",
  );
  return unwrap(
    await p.select<Backend>({
      message: "Backend framework",
      options: frameworks.map(([value, { label, hint }]) => ({ value, label, hint })),
    }),
  );
};

const askPackageManager = async (cli: CliOptions): Promise<PackageManager> => {
  if (cli.pm)
    return isPackageManager(cli.pm) ? cli.pm : fail(`Unknown package manager "${cli.pm}".`);

  const detected = detectPackageManager();
  if (cli.yes) return detected;

  return unwrap(
    await p.select<PackageManager>({
      message: "Package manager",
      initialValue: detected,
      options: PACKAGE_MANAGERS.map((value) => ({
        value,
        label: value,
        hint: value === "bun" ? "runs the API on Bun" : "runs the API on Node.js",
      })),
    }),
  );
};

const run = async (command: string, args: string[], cwd: string) => {
  const result = await x(command, args, { nodeOptions: { cwd }, throwOnError: false });
  return { ok: result.exitCode === 0, output: `${result.stdout}${result.stderr}`.trim() };
};

type Migration = { from: string; plugin: string; ref: string };

const askCheckout = async (cli: CliOptions) => {
  if (cli.from && cli.clone) fail("Pass --from or --clone, not both.");
  if (cli.from) return resolve(cli.from);

  const clone =
    cli.clone ||
    (cli.yes
      ? fail("Pass an old erxes checkout with --from, or --clone.")
      : unwrap(
          await p.select({
            message: "Old erxes checkout",
            options: [
              { value: "path", label: "A checkout on this machine" },
              {
                value: "clone",
                label: `Clone erxes/erxes main into ${erxesCacheDir()}`,
                hint: "blobless, only backend/plugins and frontend/plugins",
              },
            ],
          }),
        ) === "clone");

  if (!clone) {
    const path = unwrap(
      await p.text({
        message: "Path to the old erxes checkout",
        validate: (value) =>
          existsSync(join(resolve(value ?? ""), ".git")) ? undefined : "Not a git checkout.",
      }),
    );
    return resolve(path);
  }

  const spin = p.spinner();
  spin.start(`Cloning ${ERXES_REPO}`);
  try {
    const dir = await cloneErxes();
    spin.stop(`Old erxes is in ${dir}`);
    return dir;
  } catch (error) {
    spin.error("Clone failed");
    return fail(error instanceof Error ? error.message : String(error));
  }
};

const askMigration = async (cli: CliOptions): Promise<Migration | undefined> => {
  const migrate =
    cli.migrate ??
    (Boolean(cli.plugin || cli.from || cli.clone) ||
      (!cli.yes &&
        unwrap(await p.confirm({ message: "Migrating an old plugin?", initialValue: false }))));
  if (!migrate) return undefined;

  const ref = cli.ref ?? DEFAULT_REF;
  const from = await askCheckout(cli);
  const plugins = await listOldPlugins(from, ref).catch((error: unknown) =>
    fail(error instanceof Error ? error.message : String(error)),
  );
  if (!plugins.length) fail(`${from} has no backend/plugins/*_api at ${ref}.`);

  if (cli.plugin) {
    return plugins.includes(cli.plugin)
      ? { from, plugin: cli.plugin, ref }
      : fail(`No ${cli.plugin}_api at ${ref}. Old plugins: ${plugins.join(", ")}`);
  }
  if (cli.yes) fail("Pass the old plugin to migrate with --plugin.");

  const plugin = unwrap(
    await p.select({
      message: "Plugin to migrate",
      options: plugins.map((value) => ({ value, label: value })),
    }),
  );
  return { from, plugin, ref };
};

const mainCore = async (directoryArg: string | undefined, cli: CliOptions) => {
  const name = await askName(cli, directoryArg, validateCorePluginName);
  const targetDir = resolve(directoryArg ?? name);
  if (!isEmptyDir(targetDir)) fail(`${targetDir} already exists and is not empty.`);

  const migration = await askMigration(cli);
  const pnpmVersion =
    (await packageManagerVersion("pnpm")) ??
    fail("New core plugins use pnpm. Install it with `corepack enable pnpm` and run again.");
  const apiPort = await askPort("API dev port", cli.apiPort, DEFAULT_API_PORT, true);
  const uiPort = await askPort("UI dev port", cli.uiPort, DEFAULT_UI_PORT, true);
  if (apiPort === uiPort) fail("API and UI ports must differ.");
  const install =
    cli.install &&
    (cli.yes ||
      unwrap(await p.confirm({ message: "Install dependencies now?", initialValue: true })));

  const names = derivePluginNames(name, cli.title);
  const spin = p.spinner();
  spin.start("Creating project");
  await scaffoldCore(targetDir, {
    names,
    apiPort,
    uiPort,
    pnpmVersion,
    migrateFrom: migration?.plugin,
  });
  spin.stop(`Created ${relative(process.cwd(), targetDir) || "."}`);

  if (cli.git) {
    const git = await run("git", ["init", "-q"], targetDir);
    if (!git.ok) p.log.warn(`git init failed: ${git.output}`);
  }

  const inventoryArgs = migration
    ? ["--from", migration.from, "--plugin", migration.plugin, "--ref", migration.ref]
    : [];
  let failure: string | undefined;
  let installed = false;
  let inventoried = false;
  if (install) {
    spin.start("Installing dependencies with pnpm");
    const result = await run("pnpm", ["install"], targetDir);
    installed = result.ok;
    if (result.ok) spin.stop("Dependencies installed");
    else {
      spin.error("pnpm install failed");
      p.log.message(result.output);
      failure = "pnpm install failed; see the output above.";
    }
  }
  if (migration && installed) {
    spin.start(`Reading ${migration.plugin} at ${migration.ref}`);
    const inventory = await run(
      "pnpm",
      ["-s", "migrate:inventory", "--", ...inventoryArgs],
      targetDir,
    );
    const result = inventory.ok
      ? await run("pnpm", ["-s", "migrate:checklist"], targetDir)
      : inventory;
    inventoried = result.ok;
    if (result.ok)
      spin.stop(
        result.output.split("\n").find((line) => line.startsWith("MIGRATION.md")) ??
          "Wrote MIGRATION.md",
      );
    else {
      spin.error("The migration inventory failed");
      p.log.message(result.output);
      failure = "The migration inventory failed; see the output above.";
    }
  }
  // The plugin name moves keys that sort by name, e.g. `@<name>/api`.
  if (installed) await run("pnpm", ["fmt"], targetDir);

  const cd = relative(process.cwd(), targetDir);
  p.note(
    [
      ...(cd ? [changeDirectoryCommand(cd)] : []),
      ...(installed ? [] : ["pnpm install"]),
      ...(migration && !inventoried
        ? [`pnpm migrate:inventory -- ${inventoryArgs.join(" ")}`, "pnpm migrate:checklist"]
        : []),
      "cp .env.example .env",
      "pnpm dev:api",
      "pnpm dev:ui",
      "",
      `core .env: CORE_PLUGIN_KEYS=${names.id}:<32+ character secret>`,
      `core-ui .env: PUBLIC_PLUGINS=${names.remote}@http://localhost:${uiPort}/remoteEntry.js`,
      ...(migration ? ["", "Then work through MIGRATION.md with the plugin-migrate skill."] : []),
    ].join("\n"),
    "Next steps",
  );

  if (failure) {
    p.log.error(failure);
    p.outro(`Plugin "${name}" was created, but it is not ready yet.`);
    process.exitCode = 1;
    return;
  }
  p.outro(`Plugin "${name}" is ready. See AGENTS.md.`);
};

const main = async (directoryArg: string | undefined, cli: CliOptions) => {
  p.intro("create-erxes-plugin");

  if ((await askErxes(cli)) === "core") return mainCore(directoryArg, cli);

  const name = await askName(cli, directoryArg);
  const targetDir = resolve(directoryArg ?? name);
  if (!isEmptyDir(targetDir)) fail(`${targetDir} already exists and is not empty.`);

  const defaults = derivePluginNames(name);
  const title = await askText("Display name", cli.title, defaults.title, cli.yes);
  const description = await askText(
    "Description",
    cli.description,
    `${title} plugin for erxes`,
    cli.yes,
  );
  const backend = await askBackend(cli);
  const stack = BACKENDS[backend];
  p.log.info(
    `Backend: ${stack.label}${stack.integration === "standalone" ? " (standalone)" : ""} · Frontend: React`,
  );
  const packageManager = await askPackageManager(cli);
  const runtime = runtimeFor(packageManager);
  const setups = runtimesFor({ backend });
  if (!setups[runtime])
    fail(
      `${stack.label} runs on ${Object.keys(setups).join(" or ")} — the ${runtime} runtime (package manager ${packageManager}) is not supported for this stack.`,
    );
  const apiPort = await askPort("API dev port", cli.apiPort, DEFAULT_API_PORT, cli.yes);
  const uiPort = await askPort("UI dev port", cli.uiPort, DEFAULT_UI_PORT, cli.yes);
  if (apiPort === uiPort) fail("API and UI ports must differ.");
  const install =
    cli.install &&
    (cli.yes ||
      unwrap(await p.confirm({ message: "Install dependencies now?", initialValue: true })));

  const options: ProjectOptions = {
    names: derivePluginNames(name, title),
    description,
    backend,
    frontend: "react",
    packageManager,
    packageManagerVersion:
      packageManager === "npm" ? undefined : await packageManagerVersion(packageManager),
    apiPort,
    uiPort,
  };

  const spin = p.spinner();
  spin.start("Creating project");
  await scaffold(targetDir, options);
  spin.stop(`Created ${relative(process.cwd(), targetDir) || "."}`);

  if (cli.git) {
    const git = await run("git", ["init", "-q"], targetDir);
    if (!git.ok) p.log.warn(`git init failed: ${git.output}`);
  }

  let installFailure: string | undefined;
  if (install) {
    spin.start(`Installing dependencies with ${packageManager}`);
    const result = await run(packageManager, ["install"], targetDir);
    if (result.ok) {
      // Token lengths shift Markdown tables and generated JSON; normalize them.
      await run(packageManager, ["run", "fmt"], targetDir);
      spin.stop("Dependencies installed");
    } else {
      spin.error(`${packageManager} install failed`);
      p.log.message(result.output);
      installFailure = `${packageManager} install failed; see the output above.`;
    }
  }

  const cd = relative(process.cwd(), targetDir);
  const runScript = (script: string) =>
    packageManager === "npm" ? `npm run ${script}` : `${packageManager} run ${script}`;
  p.note(
    [
      ...(cd ? [changeDirectoryCommand(cd)] : []),
      ...(install && !installFailure ? [] : [`${packageManager} install`]),
      "cp .env.example .env",
      runScript("dev:api"),
      runScript("dev:ui"),
      "",
      `erxes .env: add ${name} to ENABLED_PLUGINS`,
    ].join("\n"),
    "Next steps",
  );

  if (installFailure) {
    p.log.error(installFailure);
    p.outro(`Plugin "${name}" was created, but its dependencies are not installed.`);
    process.exitCode = 1;
    return;
  }
  p.outro(`Plugin "${name}" is ready. See README.md.`);
};

export const runCli = async (argv: string[]) => {
  const program = new Command("create-erxes-plugin")
    .version(VERSION)
    .description("Create a standalone erxes plugin repository")
    .argument("[directory]", "target directory (defaults to the plugin name)")
    .addOption(
      new Option("--erxes <target>", "old erxes, or the new core (Postgres)")
        .choices([...ERXES_TARGETS])
        .default(undefined, "old with --yes"),
    )
    .option("--migrate", "new core: port an old erxes plugin")
    .option("--no-migrate", "new core: start a blank plugin")
    .option("--from <path>", "new core migration: an old erxes checkout")
    .option("--clone", "new core migration: clone erxes/erxes main to read the old plugin")
    .option("--plugin <name>", "new core migration: the old plugin, e.g. operation")
    .option("--ref <ref>", `new core migration: the git ref to read (default ${DEFAULT_REF})`)
    .option("-n, --name <name>", "plugin name, e.g. inventory or erxes-agent-v2")
    .option("-t, --title <title>", "display name shown in erxes navigation")
    .option("-d, --description <text>", "one-line description")
    .addOption(
      new Option(
        "-b, --backend <backend>",
        "backend stack: platform (erxes-api-shared) or a standalone framework",
      ).choices(Object.keys(BACKENDS)),
    )
    .addOption(new Option("--pm <manager>", "package manager").choices([...PACKAGE_MANAGERS]))
    .option("--api-port <port>", `API dev port (default ${DEFAULT_API_PORT})`)
    .option("--ui-port <port>", `UI dev server port (default ${DEFAULT_UI_PORT})`)
    .option("--no-install", "skip installing dependencies")
    .option("--no-git", "skip git init")
    .option("-y, --yes", "accept defaults for every unanswered question")
    .action(main);

  await program.parseAsync(argv);
};
