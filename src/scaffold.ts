import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDockerfile,
  createManifest,
  createPackageManagerFiles,
  createRootPackageJson,
  type ProjectOptions,
  runtimesFor,
} from "./generated.ts";
import { BACKENDS, type Backend, FRONTENDS, runtimeFor } from "./stacks.ts";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));

// npm strips dotfiles like .gitignore from published packages, so templates
// store them with a leading underscore.
const DOTFILES: Record<string, string> = {
  _gitignore: ".gitignore",
  _dockerignore: ".dockerignore",
  "_env.example": ".env.example",
};

const applyTokens = (text: string, tokens: [string, string][]) =>
  tokens.reduce((result, [token, value]) => result.replaceAll(token, value), text);

const tokensFor = ({
  names,
  description,
  apiPort,
  uiPort,
  packageManager,
  backend,
  erxesRef = "main",
}: ProjectOptions): [string, string][] => {
  // pnpm resolves monorepo subdirectories in git deps; the other package
  // managers get a sibling-checkout fallback (erxes must be cloned next to the
  // plugin to run its dev stack anyway).
  const erxesDep = (path: string) =>
    packageManager === "pnpm"
      ? `github:erxes/erxes#${erxesRef}&path:${path}`
      : `file:../erxes/${path}`;

  const tokens: [string, string][] = [
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
    ["__backendLabel__", BACKENDS[backend].label],
    ["__backendHint__", BACKENDS[backend].hint],
    ["__erxesRef__", erxesRef],
    ["__erxesUiDep__", erxesDep("frontend/libs/erxes-ui")],
    ["__erxesUiModulesDep__", erxesDep("frontend/libs/ui-modules")],
    ["__erxesApiSharedDep__", erxesDep("backend/erxes-api-shared")],
  ];

  // The prose blocks embed the same placeholders (e.g. `__name__` inside
  // "erxes-service-__name__"); fill them with the already-built token map so
  // nothing survives into the generated files.
  tokens.push(
    ["__apiContracts__", applyTokens(API_CONTRACTS[backend], tokens)],
    ["__apiRegistration__", applyTokens(API_REGISTRATION[backend], tokens)],
  );

  return tokens;
};

// Stack-specific prose for the generated AGENTS.md contract bullets and the
// API registration section of docs/erxes-integration.md.
const API_CONTRACTS: Record<Backend, string> = {
  express: `- \`api/src/gateway.ts\` mirrors erxes-api-shared \`joinErxesGateway\`: same Redis
  keys, same config JSON shape, and in production the router-update lock plus
  the BullMQ \`gateway-update-apollo-router\` job. Do not drop the job.
- \`api/src/context.ts\` is the only place that reads gateway headers (\`user\`,
  \`hostname\`/\`nginx-hostname\`). Resolvers receive \`{ subdomain, user }\`.`,
  platform: `- \`api/src/main.ts\` boots through erxes-api-shared \`startPlugin\`, which owns
  gateway registration (including \`UI_ENTRY_URL\`), \`/health\`, \`/graphql\`,
  gateway-header parsing and — in production — the router-update BullMQ job.
- Tenant data goes through \`generateModels(subdomain)\` onto \`context.models\`;
  never connect to Mongo directly. \`checkPermission(action)\` is on the context.`,
};

const API_REGISTRATION: Record<Backend, string> = {
  express: `On start, \`api/src/gateway.ts\` writes what erxes-api-shared \`joinErxesGateway\`
writes:

- \`erxesservice:config:__name__\`: \`{ dbConnectionString, hasSubscriptions, meta, releaseVersion, uiEntry }\`.
  \`uiEntry\` is \`UI_ENTRY_URL\`; \`releaseVersion\` is \`RELEASE_VERSION\` when it
  starts with \`3.\`, otherwise \`latest\`.
- \`erxes-service-__name__\`: the address the gateway proxies to.
  \`LOAD_BALANCER_ADDRESS\`, else \`http://localhost:<port>\` in development and
  \`http://plugin-__name__-api:<port>\` otherwise.
- In production only: the \`gateway:update-apollo-router:pending\` lock (30 s)
  and a BullMQ job \`service-discovery-updated\` on queue
  \`gateway-update-apollo-router\`. Without it a production gateway never
  recomposes the supergraph.

\`api/src/context.ts\` turns the gateway's forwarded headers — \`user\` (base64
JSON of the signed-in user, absent for anonymous requests) and \`hostname\`
(or \`nginx-hostname\` behind nginx; its first label is the tenant
\`subdomain\`) — into the GraphQL context. A malformed \`user\` header is
treated as anonymous.

The API serves \`GET /health\` and a federated subgraph at \`/graphql\`
(Federation v2). Every type and operation carries the plugin prefix because
all plugins share one supergraph.`,
  platform: `On start, erxes-api-shared \`startPlugin\` writes what
\`joinErxesGateway\` writes: the \`erxesservice:config:__name__\` JSON
(\`uiEntry\` from \`UI_ENTRY_URL\`), the \`erxes-service-__name__\` address, and
in production the router-update lock plus the BullMQ
\`gateway-update-apollo-router\` job.

\`startPlugin\` serves the federated subgraph at \`/graphql\`, exposes
\`GET /health\`, and parses the gateway's forwarded headers — \`user\` (base64
JSON of the signed-in user) and \`hostname\`/\`nginx-hostname\` — into the
context itself. \`apolloServerContext\` then adds \`models\` from
\`generateModels(subdomain)\`: Mongoose models bound to that tenant's
database, which is the only supported way to touch plugin data.

The context also carries \`checkPermission(action)\` — use it in resolvers;
the UI route guard is not a security boundary. Every type and operation
carries the plugin prefix because all plugins share one supergraph.`,
};

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
  const setup = runtimesFor(options)[runtime];
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
  // Framework-neutral API files (erxes.json + env loading).
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
