import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { x } from "tinyexec";
import { satisfies } from "semver";
import { runtimesFor } from "../src/generated.ts";
import { derivePluginNames } from "../src/naming.ts";
import { ERXES_PACKAGE_RELEASE } from "../src/scaffold.ts";
import { BACKENDS, type Backend, type PackageManager } from "../src/stacks.ts";

// Installs real dependencies from npm, so it is opt-in: E2E=1 pnpm test:e2e.
// Every backend runs with pnpm (bun where it is Bun-only); the platform stack
// also runs with npm and yarn, since external plugins use all of them.
const enabled = process.env.E2E === "1";
const cases: [Backend, PackageManager][] = [
  ...(Object.keys(BACKENDS) as Backend[]).map((backend): [Backend, PackageManager] => [
    backend,
    runtimesFor({ backend }).node ? "pnpm" : "bun",
  ]),
  ["platform", "npm"],
  ["platform", "yarn"],
].filter(
  ([backend, pm]) => !process.env.E2E_CASE || process.env.E2E_CASE === `${backend}-${pm}`,
) as [Backend, PackageManager][];
if (enabled && cases.length === 0) throw new Error(`Unknown E2E_CASE: ${process.env.E2E_CASE}`);

const run = async (command: string, args: string[], cwd: string) => {
  const result = await x(command, args, {
    nodeOptions: { cwd },
    timeout: 10 * 60_000,
    throwOnError: false,
  });
  assert.equal(
    result.exitCode,
    0,
    `${command} ${args.join(" ")} failed in ${cwd}\n${result.stdout}${result.stderr}`,
  );
  return result.stdout;
};

type InstalledPackage = { version: string; peerDependencies?: Record<string, string> };
const checkPeers = async (dir: string) => {
  const require = createRequire(join(dir, "ui/package.json"));
  for (const name of ["erxes-ui", "ui-modules"]) {
    const pkg = require(`${name}/package.json`) as InstalledPackage;
    assert.equal(pkg.version, ERXES_PACKAGE_RELEASE, `${name} is the tested release`);
    for (const [peer, range] of Object.entries(pkg.peerDependencies ?? {})) {
      const installed = require(`${peer}/package.json`) as InstalledPackage;
      assert.ok(
        satisfies(installed.version, range),
        `${name}: ${peer}@${installed.version} must satisfy ${range}`,
      );
    }
  }
};

const checkRemote = async (dir: string, id: string, publicName: string) => {
  assert.ok(existsSync(join(dir, "ui/dist/remoteEntry.js")), "browser remote entry");
  const stats = JSON.parse(await readFile(join(dir, "ui/dist/mf-stats.json"), "utf8")) as {
    name: string;
    exposes: { path: string; assets: { js: { sync: string[]; async: string[] } } }[];
    shared: {
      name: string;
      singleton: boolean;
      import: boolean;
      assets: { js: { sync: string[]; async: string[] } };
      fallback: string;
    }[];
  };
  assert.equal(stats.name, `${id}_ui`);
  assert.deepEqual(
    stats.exposes.map((item) => item.path).sort(),
    [`./${publicName}`, "./config"].sort(),
  );
  const hostKeys = new Set([
    "react",
    "react-dom",
    "react-router",
    "react-router-dom",
    "@apollo/client",
    "jotai",
    "react-i18next",
    "erxes-ui",
    "ui-modules",
  ]);
  for (const shared of stats.shared) {
    assert.ok(hostKeys.has(shared.name), `unexpected host share: ${shared.name}`);
    assert.equal(shared.singleton, true, shared.name);
    assert.equal(shared.import, false, `${shared.name}: no private provider`);
    assert.equal(shared.fallback, "", `${shared.name}: no runtime fallback`);
    assert.deepEqual(
      shared.assets.js,
      { async: [], sync: [] },
      `${shared.name}: no bundled singleton assets`,
    );
  }
  for (const name of ["react", "react-router", "erxes-ui", "ui-modules", "@apollo/client"]) {
    assert.ok(
      stats.shared.some((item) => item.name === name),
      `${name} consumed from host`,
    );
  }
};

describe("generated projects install, type-check and build", { skip: !enabled }, () => {
  let root: string;
  let cli: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "create-erxes-plugin-e2e-"));
    const repo = fileURLToPath(new URL("../", import.meta.url));
    const output = await run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", root],
      repo,
    );
    const [{ filename }] = JSON.parse(output) as [{ filename: string }];
    const cliDir = join(root, "cli");
    await run(
      "npm",
      [
        "install",
        "--prefix",
        cliDir,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        join(root, filename),
      ],
      root,
    );
    cli = join(cliDir, "node_modules/@erxes/create-plugin/dist/index.js");
    assert.equal(existsSync(join(cliDir, "node_modules/@erxes/create-plugin/templates")), false);
  });
  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  for (const [backend, pm] of cases) {
    it(`${backend} with ${pm}`, { timeout: 15 * 60_000 }, async () => {
      const dir = join(root, `${backend}-${pm}`);
      const names = derivePluginNames(pm === "npm" ? "inventory" : "inventory-tools");
      await run(
        process.execPath,
        [
          cli,
          dir,
          "--name",
          names.name,
          "--backend",
          backend,
          "--pm",
          pm,
          "--no-install",
          "--no-git",
          "--yes",
        ],
        root,
      );

      await run(pm, pm === "pnpm" ? ["install", "--strict-peer-dependencies"] : ["install"], dir);
      await checkPeers(dir);
      await run(pm, ["run", "codegen"], dir);
      await run(pm, ["run", "check"], dir);
      const sdl = await readFile(join(dir, "api/generated/schema.graphql"), "utf8");
      assert.ok(sdl.includes(`${names.camel}Status`), "schema.graphql has the status field");
      assert.ok(existsSync(join(dir, "ui/src/gql/graphql.ts")), "ui/src/gql/graphql.ts");
      await run(pm, ["run", "lint"], dir);
      await run(pm, ["run", "build"], dir);
      await checkRemote(dir, names.id, names.name);
      if (backend === "platform") {
        const require = createRequire(join(dir, "api/package.json"));
        assert.equal(
          (require("erxes-api-shared/package.json") as InstalledPackage).version,
          ERXES_PACKAGE_RELEASE,
        );
        // Execute the actual generated resolver and model with fake tenant DBs,
        // without starting Redis, MongoDB or the API server.
        const fixture = await readFile(
          new URL("./fixtures/platform-access.mjs", import.meta.url),
          "utf8",
        );
        await writeFile(
          join(dir, "api/access-test.cjs"),
          fixture.replaceAll("__camel__", names.camel),
        );
        await run(process.execPath, ["access-test.cjs"], join(dir, "api"));
      } else {
        await writeFile(
          join(dir, "api/context-test.mjs"),
          await readFile(new URL("./fixtures/standalone-context.mjs", import.meta.url), "utf8"),
        );
        await run(
          backend === "elysia" ? "bun" : process.execPath,
          ["context-test.mjs", backend === "elysia" ? "./src/context.ts" : "./dist/context.js"],
          join(dir, "api"),
        );
      }
    });
  }
});
