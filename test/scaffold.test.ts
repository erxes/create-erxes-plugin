import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { type ErxesManifest, type ProjectOptions, runtimesFor } from "../src/generated.ts";
import { derivePluginNames } from "../src/naming.ts";
import { scaffold } from "../src/scaffold.ts";
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
      for (const file of [".gitignore", ".dockerignore", "api/.env.example", "Dockerfile"]) {
        assert.ok(existsSync(join(dir, file)), file);
      }
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
        assert.equal(api.scripts.dev, "bun --watch src/main.ts");
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
        yarn: "yarn workspace erxes-agent-v2_api dev",
        bun: "bun --filter erxes-agent-v2_api dev",
      }[pm];
      assert.equal(pkg.scripts["dev:api"], filter);
      assert.equal(existsSync(join(dir, "pnpm-workspace.yaml")), pm === "pnpm");
      assert.equal(pkg.workspaces === undefined, pm === "pnpm");
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
      assert.equal(
        existsSync(join(dir, "api/src/graphql/schema.ts")),
        backend !== "nestjs",
      );

      const manifest = await readJson<ErxesManifest>(join(dir, "erxes.json"));
      assert.equal(manifest.api.framework, backend);

      const api = await readJson<PackageJson>(join(dir, "api/package.json"));
      assert.deepEqual(api.scripts, runtimesFor({ backend })[runtimeFor(pm)]?.scripts);

      for (const file of [
        "ui/src/Settings.tsx",
        "ui/src/pages/IndexPage.tsx",
        "ui/src/modules/Navigation.tsx",
        "ui/src/widgets/NotificationWidget.tsx",
      ]) {
        assert.ok(existsSync(join(dir, file)), file);
      }
      assert.equal(existsSync(join(dir, "ui/src/PluginIcon.tsx")), false);

      const indexPage = await readFile(
        join(dir, "ui/src/pages/IndexPage.tsx"),
        "utf8",
      );
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
