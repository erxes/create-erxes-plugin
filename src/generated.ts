import type { PluginNames } from "./naming.ts";
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
  /** Git ref (branch, tag or sha) of erxes/erxes for shared-library git deps. */
  erxesRef?: string;
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
    name: o.names.id,
    remote: o.names.remote,
    path: o.names.name,
  },
});

/** A backend's per-runtime setups; a missing runtime means it is unsupported. */
export const runtimesFor = (
  o: Pick<ProjectOptions, "backend">,
): BackendStack["runtimes"] => BACKENDS[o.backend].runtimes;

const LINT_DEPENDENCIES = { oxfmt: "^0.71.0", oxlint: "^1.86.0" };

export const createRootPackageJson = (o: ProjectOptions) => {
  const { packageManager: pm, names } = o;
  const api = `${names.name}_api`;
  const ui = `${names.name}_ui`;
  const apiScripts = runtimesFor(o)[runtimeFor(pm)]?.scripts ?? {};
  const build = [
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
      "dev:ui": workspaceRun(pm, ui, "dev"),
      build: build.join(" && "),
      check: [workspaceRun(pm, api, "check"), workspaceRun(pm, ui, "check")].join(" && "),
      lint: "oxlint",
      fmt: "oxfmt",
    },
    devDependencies: LINT_DEPENDENCIES,
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
    // Git-dependency `prepare` scripts are blocked by default; the erxes
    // libraries must be allowlisted so they can emit dist/ on install.
    return {
      "pnpm-workspace.yaml":
        "packages:\n" +
        "  - api\n" +
        "  - ui\n" +
        "onlyBuiltDependencies:\n" +
        '  - "erxes-api-shared"\n' +
        '  - "erxes-ui"\n' +
        '  - "ui-modules"\n',
    };
  }
  if (o.packageManager === "yarn") {
    return { ".yarnrc.yml": "nodeLinker: node-modules\n" };
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
