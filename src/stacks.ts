export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type Runtime = "node" | "bun";
export type Integration = "platform" | "standalone";

/** Bun projects run on Bun; every other package manager runs on Node. */
export const runtimeFor = (packageManager: PackageManager): Runtime =>
  packageManager === "bun" ? "bun" : "node";

export type RuntimeSetup = {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  types: string[];
};

export type BackendStack = {
  /** `platform` consumes erxes-api-shared; `standalone` mirrors it locally. */
  integration: Integration;
  label: string;
  hint: string;
  /** Template directories under `templates/`, copied in order into `api/`. */
  templates: string[];
  runtimes: Partial<Record<Runtime, RuntimeSetup>>;
};

export const INTEGRATIONS = {
  platform: {
    label: "erxes-api-shared",
    hint: "startPlugin: gateway registration, tenant models, permissions (Express under the hood, Node.js)",
  },
  standalone: {
    label: "standalone",
    hint: "no erxes dependency; mirrors the gateway registration locally",
  },
} as const;

const NODE_SETUP: RuntimeSetup = {
  scripts: {
    dev: "tsx watch --env-file-if-exists=.env src/main.ts",
    build: "tsc -p tsconfig.build.json",
    start: "node --env-file-if-exists=.env dist/main.js",
    check: "tsc --noEmit",
  },
  devDependencies: { "@types/node": "^22.18.0", tsx: "^4.23.15" },
  types: ["node"],
};

const BUN_SETUP: RuntimeSetup = {
  scripts: {
    dev: "bun --watch src/main.ts",
    start: "bun src/main.ts",
    check: "tsc --noEmit",
  },
  devDependencies: { "@types/bun": "^1.4.2" },
  types: ["bun"],
};

export const BACKENDS = {
  platform: {
    integration: "platform",
    label: "Express via erxes-api-shared",
    hint: "erxes-api-shared startPlugin + tenant-scoped Mongoose models (Node.js)",
    templates: ["api/commonjs", "api/platform"],
    runtimes: {
      node: NODE_SETUP,
    },
  },
  express: {
    integration: "standalone",
    label: "Express",
    hint: "Express 5 + Apollo Server federated subgraph",
    templates: ["api/standalone", "api/standalone-schema", "api/express"],
    runtimes: {
      node: NODE_SETUP,
      bun: BUN_SETUP,
    },
  },
  fastify: {
    integration: "standalone",
    label: "Fastify",
    hint: "Fastify + Apollo Server federated subgraph",
    templates: ["api/standalone", "api/standalone-schema", "api/fastify"],
    runtimes: {
      node: NODE_SETUP,
    },
  },
  hono: {
    integration: "standalone",
    label: "Hono",
    hint: "Hono + GraphQL Yoga federated subgraph (Node.js or Bun)",
    templates: ["api/standalone", "api/standalone-schema", "api/hono"],
    runtimes: {
      node: NODE_SETUP,
      bun: BUN_SETUP,
    },
  },
  elysia: {
    integration: "standalone",
    label: "Elysia",
    hint: "Elysia + GraphQL Yoga federated subgraph (Bun)",
    templates: ["api/standalone", "api/standalone-schema", "api/elysia"],
    runtimes: {
      bun: BUN_SETUP,
    },
  },
  nestjs: {
    integration: "standalone",
    label: "NestJS",
    hint: "NestJS + @nestjs/apollo federation driver",
    templates: ["api/standalone", "api/commonjs", "api/nestjs"],
    runtimes: {
      node: {
        scripts: {
          dev: 'nest start --watch --exec "node --env-file-if-exists=.env"',
          build: "nest build",
          start: "node --env-file-if-exists=.env dist/main.js",
          check: "tsc --noEmit",
        },
        devDependencies: { "@nestjs/cli": "^12.0.8", "@types/node": "^22.18.0" },
        types: ["node"],
      },
    },
  },
} satisfies Record<string, BackendStack>;

export type Backend = keyof typeof BACKENDS;

export const DEFAULT_BACKEND: Backend = "platform";

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
