export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type Runtime = "node" | "bun";

/** Bun projects run on Bun; every other package manager runs on Node. */
export const runtimeFor = (packageManager: PackageManager): Runtime =>
  packageManager === "bun" ? "bun" : "node";

export type RuntimeSetup = {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  types: string[];
};

export type BackendStack = {
  label: string;
  hint: string;
  /** Template directory under `templates/`, copied to `api/`. */
  template: string;
  runtimes: Partial<Record<Runtime, RuntimeSetup>>;
};

export const BACKENDS = {
  express: {
    label: "Express",
    hint: "Express 5 + Apollo Server federated subgraph",
    template: "api/express",
    runtimes: {
      node: {
        scripts: {
          dev: "tsx watch --env-file-if-exists=.env src/main.ts",
          build: "tsc -p tsconfig.build.json",
          start: "node --env-file-if-exists=.env dist/main.js",
          check: "tsc --noEmit",
        },
        devDependencies: { "@types/node": "^22.18.0", tsx: "^4.23.15" },
        types: ["node"],
      },
      bun: {
        scripts: {
          dev: "bun --watch src/main.ts",
          start: "bun src/main.ts",
          check: "tsc --noEmit",
        },
        devDependencies: { "@types/bun": "^1.4.2" },
        types: ["bun"],
      },
    },
  },
  platform: {
    label: "erxes platform",
    hint: "erxes-api-shared startPlugin + tenant-scoped Mongoose models (Node.js)",
    template: "api/platform",
    runtimes: {
      node: {
        scripts: {
          dev: "tsx watch --env-file-if-exists=.env src/main.ts",
          build: "tsc -p tsconfig.build.json",
          start: "node --env-file-if-exists=.env dist/main.js",
          check: "tsc --noEmit",
        },
        devDependencies: { "@types/node": "^22.18.0", tsx: "^4.23.15" },
        types: ["node"],
      },
    },
  },
} satisfies Record<string, BackendStack>;

export type Backend = keyof typeof BACKENDS;

export const FRONTENDS = {
  react: {
    label: "React",
    hint: "React 18 + Rspack Module Federation remote + Tailwind CSS",
    template: "ui/react",
  },
} as const;

export type Frontend = keyof typeof FRONTENDS;

export const isBackend = (value: string): value is Backend => value in BACKENDS;
export const isPackageManager = (value: string): value is PackageManager =>
  (PACKAGE_MANAGERS as readonly string[]).includes(value);

/** Runs a script inside one workspace package. */
export const workspaceRun = (pm: PackageManager, workspace: string, script: string) =>
  ({
    npm: `npm run ${script} -w ${workspace}`,
    pnpm: `pnpm --filter ${workspace} ${script}`,
    yarn: `yarn workspace ${workspace} ${script}`,
    bun: `bun --filter ${workspace} ${script}`,
  })[pm];
