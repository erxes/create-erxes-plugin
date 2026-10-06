import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Command, Option } from "commander";
import { getUserAgent } from "package-manager-detector/detect";
import { x } from "tinyexec";
import { type ProjectOptions, runtimesFor } from "./generated.ts";
import { derivePluginNames, validatePluginName } from "./naming.ts";
import { ERXES_CHECKOUT, erxesLibraries, scaffold } from "./scaffold.ts";
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

type CliOptions = {
  name?: string;
  title?: string;
  description?: string;
  backend?: string;
  pm?: string;
  apiPort?: string;
  uiPort?: string;
  erxesRef?: string;
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

const detectPackageManager = (): PackageManager => {
  const agent = getUserAgent();
  return agent && isPackageManager(agent) ? agent : "npm";
};

const packageManagerVersion = async (pm: PackageManager) => {
  const result = await x(pm, ["--version"], { throwOnError: false });
  const version = result.stdout.trim();
  return /^\d+\.\d+\.\d+$/.test(version) ? version : undefined;
};

const askName = async (cli: CliOptions, directory?: string) => {
  const fromDirectory = directory ? basename(resolve(directory)) : undefined;
  const candidate = cli.name ?? fromDirectory;

  if (candidate && !validatePluginName(candidate)) return candidate;
  if (cli.name) fail(`Invalid plugin name "${cli.name}": ${validatePluginName(cli.name)}`);
  if (cli.yes) fail("Pass a valid plugin name with --name or as the directory.");

  return unwrap(
    await p.text({
      message: "Plugin name",
      placeholder: "inventory",
      validate: (value) => validatePluginName(value ?? ""),
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

/** Libraries a non-pnpm install would resolve from the sibling erxes clone but cannot find. */
const missingErxesLibraries = (targetDir: string, options: ProjectOptions) =>
  options.packageManager === "pnpm"
    ? []
    : erxesLibraries(options).filter(
        (library) => !existsSync(join(dirname(targetDir), ERXES_CHECKOUT, library, "package.json")),
      );

const run = async (command: string, args: string[], cwd: string) => {
  const result = await x(command, args, { nodeOptions: { cwd }, throwOnError: false });
  return { ok: result.exitCode === 0, output: `${result.stdout}${result.stderr}`.trim() };
};

const main = async (directoryArg: string | undefined, cli: CliOptions) => {
  p.intro("create-erxes-plugin");

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
    erxesRef: cli.erxesRef,
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
    const missing = missingErxesLibraries(targetDir, options);
    if (missing.length) {
      const fromCwd = relative(process.cwd(), join(dirname(targetDir), ERXES_CHECKOUT));
      const checkout = fromCwd.startsWith("..") ? fromCwd : `./${fromCwd}`;
      installFailure = [
        `${packageManager} installs the erxes shared libraries from a local erxes clone, but ${checkout} is missing ${missing.join(", ")}.`,
        `Clone erxes/erxes to ${checkout}, run pnpm install there, then run ${packageManager} install in the plugin — or use --pm pnpm, which installs them from GitHub.`,
      ].join("\n");
    } else {
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
  }

  const cd = relative(process.cwd(), targetDir);
  const runScript = (script: string) =>
    packageManager === "npm" ? `npm run ${script}` : `${packageManager} run ${script}`;
  p.note(
    [
      ...(cd ? [`cd ${cd}`] : []),
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
    .option(
      "--erxes-ref <ref>",
      "git ref of erxes/erxes for shared-library deps: branch, tag or sha (default main)",
    )
    .option("--no-install", "skip installing dependencies")
    .option("--no-git", "skip git init")
    .option("-y, --yes", "accept defaults for every unanswered question")
    .action(main);

  await program.parseAsync(argv);
};
