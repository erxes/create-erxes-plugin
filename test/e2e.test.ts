import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { x } from "tinyexec";
import { runtimesFor } from "../src/generated.ts";
import { derivePluginNames } from "../src/naming.ts";
import { scaffold } from "../src/scaffold.ts";
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
];

const run = async (command: string, args: string[], cwd: string) => {
  const result = await x(command, args, { nodeOptions: { cwd }, throwOnError: false });
  assert.equal(
    result.exitCode,
    0,
    `${command} ${args.join(" ")} failed in ${cwd}\n${result.stdout}${result.stderr}`,
  );
};

describe("generated projects install, type-check and build", { skip: !enabled }, () => {
  let root: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "create-erxes-plugin-e2e-"));
  });
  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  for (const [backend, pm] of cases) {
    it(`${backend} with ${pm}`, { timeout: 15 * 60_000 }, async () => {
      const dir = join(root, `${backend}-${pm}`);
      const names = derivePluginNames(`e2e-${backend}`);
      await scaffold(dir, {
        names,
        description: "End-to-end test plugin",
        backend,
        frontend: "react",
        packageManager: pm,
        apiPort: 3400,
        uiPort: 3100,
      });

      await run(pm, ["install"], dir);
      await run(pm, ["run", "check"], dir);
      const sdl = await readFile(join(dir, "api/generated/schema.graphql"), "utf8");
      assert.ok(sdl.includes(`${names.camel}Status`), "schema.graphql has the status field");
      assert.ok(existsSync(join(dir, "ui/src/gql/graphql.ts")), "ui/src/gql/graphql.ts");
      await run(pm, ["run", "lint"], dir);
      await run(pm, ["run", "build"], dir);
    });
  }
});
