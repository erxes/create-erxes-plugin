import type { PluginNames } from "./naming.ts";
import { ERXES_PACKAGES } from "./releases.ts";
import {
  BACKENDS,
  type Backend,
  type BackendStack,
  type Frontend,
  type PackageManager,
  type Runtime,
  runtimeFor,
  workspaceRun,
} from "./stacks.ts";

export type ProjectOptions = {
  names: PluginNames;
  description: string;
  backend: Backend;
  frontend: Frontend;
  packageManager: PackageManager;
  /** `x.y.z` of the chosen package manager, when known. */
  packageManagerVersion?: string;
  apiPort: number;
  uiPort: number;
};

/** Shape of `erxes.json`, the plugin's single source of identity and ports. */
export type ErxesManifest = {
  name: string;
  title: string;
  description: string;
  version: string;
  api: { framework: Backend; runtime: Runtime; port: number; graphql: string; health: string };
  ui: { framework: Frontend; port: number; name: string; remote: string; path: string };
};

export const createManifest = (o: ProjectOptions): ErxesManifest => ({
  name: o.names.name,
  title: o.names.title,
  description: o.description,
  version: "0.1.0",
  api: {
    framework: o.backend,
    runtime: runtimeFor(o.packageManager),
    port: o.apiPort,
    graphql: "/graphql",
    health: "/health",
  },
  ui: {
    framework: o.frontend,
    port: o.uiPort,
    // Permission checks use the same public identity as API metadata/Redis.
    name: o.names.name,
    remote: o.names.remote,
    path: o.names.name,
  },
});

/** A backend's per-runtime setups; a missing runtime means it is unsupported. */
export const runtimesFor = (o: Pick<ProjectOptions, "backend">): BackendStack["runtimes"] =>
  BACKENDS[o.backend].runtimes;

// Keep React shared by the host and all transitive UI dependencies on the
// tested React 18 release, including npm's automatic peer installation.
const REACT_COHORT = { react: "18.3.1", "react-dom": "18.3.1" };

const LINT_DEPENDENCIES = { oxfmt: "^0.71.0", oxlint: "^1.86.0" };

// The platform 3.3.2 dependency graph was tested with this telemetry cohort.
// api-shared's floating Sentry dependencies otherwise select OTel API 1.10,
// which violates the trace SDK's <1.10 peer range. Keep real peer checks on.
const PLATFORM_TELEMETRY = {
  "@sentry/node": "10.76.2",
  "@opentelemetry/api": "1.9.1",
  "@opentelemetry/instrumentation": "0.220.0",
  "@opentelemetry/sdk-trace-base": "2.12.0",
};

// Published packages omit providers needed by their children. These exact
// version metadata repairs add real dependencies/peers, never optionalize them.
// Recheck Yarn's peer-requirements report when updating any affected package.
const YARN_UI_EXTENSIONS = {
  "@erxes/ui@3.3.4": { peerDependencies: { "react-is": "^18.3.1", typescript: "^5.9.3" } },
  "@erxes/ui-modules@3.3.4": { peerDependencies: { "react-is": "^18.3.1" } },
  "@maily-to/core@0.3.7": {
    dependencies: {
      "@tiptap/extension-code-block": "2.27.3",
      "prosemirror-model": "1.25.12",
      "prosemirror-state": "1.4.4",
      "prosemirror-view": "1.42.6",
      "y-protocols": "1.0.7",
      yjs: "13.6.33",
    },
    peerDependencies: { "react-dom": "^18.0.0 || ^19.0.0" },
  },
  "@maily-to/render@0.2.3": { peerDependencies: { "react-dom": "^18.0.0 || ^19.0.0" } },
  "@react-email/components@0.5.7": { peerDependencies: { "react-dom": "^18.0.0 || ^19.0.0" } },
  "@module-federation/enhanced@0.6.6": {
    peerDependencies: { react: ">=16.9.0", "react-dom": ">=16.9.0" },
  },
  "@module-federation/enhanced@2.9.2": {
    peerDependencies: { "@rspack/core": "^0.7.0 || ^1.0.0 || ^2.0.0-0" },
  },
  "@module-federation/cli@2.9.2": { peerDependencies: { typescript: "^5.9.3" } },
  "@module-federation/manifest@0.6.6": { peerDependencies: { typescript: "^5.9.3" } },
  "@module-federation/manifest@2.9.2": { peerDependencies: { typescript: "^5.9.3" } },
};

const YARN_PLATFORM_EXTENSIONS = {
  "@azure/storage-common@12.5.0": { dependencies: { "@azure/core-client": "1.11.1" } },
  "@erxes/api-shared@3.3.4": { peerDependencies: { typescript: "^5.9.3" } },
  "@sentry/node@10.76.2": { dependencies: { "@opentelemetry/core": "2.12.0" } },
};

/** Runs a script at the workspace root (yarn drops the extra `run`). */
const rootRun = (pm: PackageManager, script: string) =>
  pm === "yarn" ? `yarn ${script}` : `${pm} run ${script}`;

export const createRootPackageJson = (o: ProjectOptions) => {
  const { packageManager: pm, names } = o;
  const api = `${names.name}_api`;
  const ui = `${names.name}_ui`;
  const apiScripts = runtimesFor(o)[runtimeFor(pm)]?.scripts ?? {};
  const codegen = rootRun(pm, "codegen");
  const build = [
    codegen,
    ...("build" in apiScripts ? [workspaceRun(pm, api, "build")] : []),
    workspaceRun(pm, ui, "build"),
  ];

  return {
    name: names.name,
    version: "0.1.0",
    private: true,
    type: "module",
    ...(pm === "pnpm" ? {} : { workspaces: ["api", "ui"] }),
    scripts: {
      "dev:api": workspaceRun(pm, api, "dev"),
      "dev:ui": `${codegen} && ${workspaceRun(pm, ui, "dev")}`,
      codegen: [workspaceRun(pm, api, "schema:print"), workspaceRun(pm, ui, "codegen")].join(
        " && ",
      ),
      build: build.join(" && "),
      check: [codegen, workspaceRun(pm, api, "check"), workspaceRun(pm, ui, "check")].join(" && "),
      lint: "oxlint",
      fmt: "oxfmt",
    },
    devDependencies: LINT_DEPENDENCIES,
    ...(pm === "pnpm"
      ? {
          pnpm: {
            overrides: { ...REACT_COHORT, ...(o.backend === "platform" ? PLATFORM_TELEMETRY : {}) },
          },
        }
      : pm === "yarn"
        ? {
            resolutions: {
              ...REACT_COHORT,
              ...(o.backend === "platform" ? PLATFORM_TELEMETRY : {}),
            },
          }
        : {
            overrides: { ...REACT_COHORT, ...(o.backend === "platform" ? PLATFORM_TELEMETRY : {}) },
          }),
    ...((pm === "pnpm" || pm === "yarn") && o.packageManagerVersion
      ? { packageManager: `${pm}@${o.packageManagerVersion}` }
      : {}),
  };
};

const isYarnBerry = (o: ProjectOptions) =>
  o.packageManager === "yarn" && Number(o.packageManagerVersion?.split(".")[0] ?? 1) >= 2;

/** Files that only exist for some package managers. */
export const createPackageManagerFiles = (o: ProjectOptions): Record<string, string> => {
  if (o.packageManager === "pnpm") {
    return { "pnpm-workspace.yaml": "packages:\n  - api\n  - ui\n" };
  }
  if (o.packageManager === "yarn") {
    return {
      ".yarnrc.yml": `${JSON.stringify(
        {
          nodeLinker: "node-modules",
          // Yarn otherwise turns CI=true into an immutable install and
          // refuses to create the first yarn.lock.
          enableImmutableInstalls: false,
          // These exact first-party releases are selected by the scaffold.
          // Allow installing immediately after publication while preserving
          // Yarn's age gate for all other packages and versions.
          npmPreapprovedPackages: [
            ERXES_PACKAGES["erxes-ui"].slice(4),
            ERXES_PACKAGES["ui-modules"].slice(4),
            ...(o.backend === "platform" ? [ERXES_PACKAGES["erxes-api-shared"].slice(4)] : []),
          ],
          packageExtensions: {
            ...YARN_UI_EXTENSIONS,
            ...(o.backend === "platform" ? YARN_PLATFORM_EXTENSIONS : {}),
          },
        },
        null,
        2,
      )}\n`,
    };
  }
  return {};
};

const LOCKFILES: Record<PackageManager, string> = {
  npm: "package-lock.json",
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
  bun: "bun.lock",
};

const installCommands = (o: ProjectOptions) => {
  switch (o.packageManager) {
    case "npm":
      return { all: "npm ci", production: "npm ci --omit=dev" };
    case "pnpm":
      return {
        all: "pnpm install --frozen-lockfile",
        production: "pnpm install --frozen-lockfile --prod",
      };
    case "yarn":
      return isYarnBerry(o)
        ? {
            all: "yarn install --immutable",
            production: "yarn workspaces focus --all --production",
          }
        : {
            all: "yarn install --frozen-lockfile",
            production: "yarn install --frozen-lockfile --production",
          };
    case "bun":
      return {
        all: "bun install --frozen-lockfile",
        production: "bun install --frozen-lockfile --production",
      };
  }
};

export const createDockerfile = (o: ProjectOptions): string => {
  const pm = o.packageManager;
  const install = installCommands(o);
  const manifests = [
    `COPY package.json ${LOCKFILES[pm]} ${Object.keys(createPackageManagerFiles(o)).join(" ")}`.trimEnd() +
      " ./",
    "COPY api/package.json api/",
    "COPY ui/package.json ui/",
  ].join("\n");
  const uiEntry = "ARG UI_ENTRY_URL\nENV UI_ENTRY_URL=$UI_ENTRY_URL";

  if (runtimeFor(pm) === "bun") {
    return `FROM oven/bun:1-slim
WORKDIR /app
${manifests}
RUN ${install.production}
COPY erxes.json ./
COPY api/tsconfig.json api/
COPY api/src api/src
${uiEntry}
ENV NODE_ENV=production PORT=80
EXPOSE 80
CMD ["bun", "api/src/main.ts"]
`;
  }

  const corepack = pm === "npm" ? "" : "RUN corepack enable\n";

  return `FROM node:22-slim AS base
WORKDIR /app
${corepack}
FROM base AS build
${manifests}
RUN ${install.all}
COPY erxes.json ./
COPY api api
RUN ${workspaceRun(pm, `${o.names.name}_api`, "build")}

FROM base AS runtime
ENV NODE_ENV=production PORT=80
${manifests}
RUN ${install.production}
COPY erxes.json ./
COPY --from=build /app/api/dist api/dist
${uiEntry}
EXPOSE 80
CMD ["node", "api/dist/main.js"]
`;
};
