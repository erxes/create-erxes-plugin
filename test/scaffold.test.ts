import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { type ErxesManifest, type ProjectOptions, runtimesFor } from "../src/generated.ts";
import { derivePluginNames } from "../src/naming.ts";
import { ERXES_PACKAGES, scaffold } from "../src/scaffold.ts";
import {
  BACKENDS,
  type Backend,
  PACKAGE_MANAGERS,
  type PackageManager,
  runtimeFor,
} from "../src/stacks.ts";
import { TEMPLATES } from "../src/templates.generated.ts";

const optionsFor = (packageManager: PackageManager): ProjectOptions => ({
  names: derivePluginNames("erxes-agent-v2"),
  description: "Test plugin",
  backend: "express",
  frontend: "react",
  packageManager,
  packageManagerVersion: packageManager === "yarn" ? "1.22.22" : "10.28.1",
  apiPort: 3400,
  uiPort: 3100,
});

const listFiles = async (dir: string) =>
  (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

const readJson = async <T>(path: string) => JSON.parse(await readFile(path, "utf8")) as T;

type PackageJson = { scripts: Record<string, string>; devDependencies: Record<string, string> };

let root: string;
before(async () => {
  root = await mkdtemp(join(tmpdir(), "create-erxes-plugin-"));
});
after(async () => {
  await rm(root, { recursive: true, force: true });
});

for (const pm of PACKAGE_MANAGERS) {
  describe(`scaffold with ${pm}`, () => {
    let dir: string;
    before(async () => {
      dir = join(root, pm);
      await scaffold(dir, optionsFor(pm));
    });

    it("fills every template token", async () => {
      for (const file of await listFiles(dir)) {
        assert.doesNotMatch(await readFile(file, "utf8"), /__[a-zA-Z]+__/, file);
      }
      const readme = await readFile(join(dir, "README.md"), "utf8");
      assert.match(readme, /^# Erxes Agent V2\n\nTest plugin\n/);
    });

    it("writes dotfiles and the manifest", async () => {
      for (const file of [".gitignore", ".dockerignore", ".env.example", "Dockerfile"]) {
        assert.ok(existsSync(join(dir, file)), file);
      }
      assert.equal(existsSync(join(dir, "api/.env.example")), false);
      const manifest = await readJson<{ name: string; ui: Record<string, unknown> }>(
        join(dir, "erxes.json"),
      );
      assert.equal(manifest.name, "erxes-agent-v2");
      assert.deepEqual(manifest.ui, {
        framework: "react",
        port: 3100,
        name: "erxes_agent_v2",
        remote: "erxes_agent_v2_ui",
        path: "erxes-agent-v2",
      });
    });

    it("configures the API for its runtime", async () => {
      const api = await readJson<PackageJson>(join(dir, "api/package.json"));
      const dockerfile = await readFile(join(dir, "Dockerfile"), "utf8");
      if (pm === "bun") {
        assert.equal(api.scripts.dev, "bun --env-file=../.env --watch src/main.ts");
        assert.ok(api.devDependencies["@types/bun"]);
        assert.match(dockerfile, /CMD \["bun", "api\/src\/main.ts"\]/);
      } else {
        assert.match(api.scripts.dev ?? "", /^tsx watch/);
        assert.ok(api.devDependencies.tsx);
        assert.match(dockerfile, /CMD \["node", "api\/dist\/main.js"\]/);
      }
    });

    it("uses workspace commands of the package manager", async () => {
      const pkg = await readJson<PackageJson & { workspaces?: string[] }>(
        join(dir, "package.json"),
      );
      const filter = {
        npm: "npm run dev -w erxes-agent-v2_api",
        pnpm: "pnpm --filter erxes-agent-v2_api dev",
        yarn: "yarn workspace erxes-agent-v2_api run dev",
        bun: "bun --filter erxes-agent-v2_api dev",
      }[pm];
      assert.equal(pkg.scripts["dev:api"], filter);
      assert.equal(existsSync(join(dir, "pnpm-workspace.yaml")), pm === "pnpm");
      assert.equal(pkg.workspaces === undefined, pm === "pnpm");
    });

    it("wires codegen into the root scripts", async () => {
      const pkg = await readJson<PackageJson>(join(dir, "package.json"));
      const expectedCodegen = {
        npm: "npm run schema:print -w erxes-agent-v2_api && npm run codegen -w erxes-agent-v2_ui",
        pnpm: "pnpm --filter erxes-agent-v2_api schema:print && pnpm --filter erxes-agent-v2_ui codegen",
        yarn: "yarn workspace erxes-agent-v2_api run schema:print && yarn workspace erxes-agent-v2_ui run codegen",
        bun: "bun --filter erxes-agent-v2_api schema:print && bun --filter erxes-agent-v2_ui codegen",
      }[pm];
      assert.equal(pkg.scripts.codegen, expectedCodegen);
      assert.ok(
        pkg.scripts.check?.startsWith(
          pm === "yarn" ? "yarn codegen && " : `${pm} run codegen && `,
        ),
        pkg.scripts.check,
      );
      assert.ok(existsSync(join(dir, "ui/codegen.ts")), "ui/codegen.ts");
      assert.ok(existsSync(join(dir, ".oxlintrc.json")), ".oxlintrc.json");
      const gitignore = await readFile(join(dir, ".gitignore"), "utf8");
      assert.match(gitignore, /api\/generated/);
      assert.match(gitignore, /ui\/src\/gql/);
      const graphql = await readFile(join(dir, "ui/src/graphql.ts"), "utf8");
      assert.match(graphql, /from "~\/gql"/);
      assert.doesNotMatch(graphql, /@apollo\/client/);
    });

    it("needs no install settings for the erxes shared libraries", async () => {
      assert.equal(existsSync(join(dir, ".npmrc")), false);
      if (pm === "pnpm") {
        assert.equal(
          await readFile(join(dir, "pnpm-workspace.yaml"), "utf8"),
          "packages:\n  - api\n  - ui\n",
        );
      }
    });

    it("installs the erxes shared libraries from npm under their import names", async () => {
      const ui = await readJson<PackageJson>(join(dir, "ui/package.json"));
      for (const name of ["erxes-ui", "ui-modules"] as const) {
        assert.equal(ui.devDependencies[name], ERXES_PACKAGES[name]);
      }
    });
  });
}

// elysia is Bun-only; every other stack runs on Node.js.
const STACK_PM: Record<Backend, PackageManager> = {
  platform: "pnpm",
  express: "pnpm",
  fastify: "pnpm",
  hono: "pnpm",
  elysia: "bun",
  nestjs: "pnpm",
};

describe("backend stacks", () => {
  for (const backend of Object.keys(BACKENDS) as Backend[]) {
    it(`${backend}: every template layer exists`, () => {
      for (const layer of BACKENDS[backend].templates) {
        assert.ok(
          Object.keys(TEMPLATES).some((key) => key.startsWith(`${layer}/`)),
          layer,
        );
      }
    });

    it(`${backend}: scaffolds and configures the API`, async () => {
      const pm = STACK_PM[backend];
      const dir = join(root, `stack-${backend}`);
      await scaffold(dir, { ...optionsFor(pm), backend });

      for (const file of await listFiles(dir)) {
        assert.doesNotMatch(await readFile(file, "utf8"), /__[a-zA-Z]+__/, file);
      }

      const standalone = BACKENDS[backend].integration === "standalone";
      assert.equal(existsSync(join(dir, "api/src/gateway.ts")), standalone);
      assert.equal(existsSync(join(dir, "api/src/context.ts")), standalone);
      // NestJS is code-first; the other stacks carry the SDL template.
      assert.equal(existsSync(join(dir, "api/src/graphql/schema.ts")), backend !== "nestjs");

      const manifest = await readJson<ErxesManifest>(join(dir, "erxes.json"));
      assert.equal(manifest.api.framework, backend);

      const api = await readJson<PackageJson>(join(dir, "api/package.json"));
      assert.deepEqual(api.scripts, runtimesFor({ backend })[runtimeFor(pm)]?.scripts);
      assert.ok(api.scripts["schema:print"], "schema:print");
      assert.ok(existsSync(join(dir, "api/src/print-schema.ts")));
      assert.equal(
        existsSync(join(dir, "api/src/resolvers.ts")),
        backend === "nestjs",
      );
      // Scripts run in api/ and must read the single .env at the repo root.
      for (const script of [api.scripts.dev, api.scripts.start]) {
        assert.match(script ?? "", /--env-file(-if-exists)?=\.\.\/\.env\b/, script);
      }

      for (const file of [
        "ui/src/Settings.tsx",
        "ui/src/pages/IndexPage.tsx",
        "ui/src/modules/Navigation.tsx",
        "ui/src/widgets/NotificationWidget.tsx",
      ]) {
        assert.ok(existsSync(join(dir, file)), file);
      }
      assert.equal(existsSync(join(dir, "ui/src/PluginIcon.tsx")), false);

      const indexPage = await readFile(join(dir, "ui/src/pages/IndexPage.tsx"), "utf8");
      const apiEntryHint =
        backend === "platform"
          ? "api/src/modules/sample"
          : backend === "nestjs"
            ? "api/src/status/status.resolver.ts"
            : "api/src/graphql/schema.ts";
      assert.ok(indexPage.includes(apiEntryHint), apiEntryHint);
    });
  }
});
