import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { x } from "tinyexec";
import { runtimesFor } from "../src/generated.ts";
import { derivePluginNames } from "../src/naming.ts";
import { scaffold } from "../src/scaffold.ts";
import { BACKENDS, type Backend } from "../src/stacks.ts";

// Installs real dependencies (the erxes libraries come from GitHub), so it is
// opt-in: E2E=1 pnpm test:e2e. Only pnpm can install without a local erxes
// clone, which limits the matrix to the stacks that run on Node.js.
const enabled = process.env.E2E === "1";
const backends = (Object.keys(BACKENDS) as Backend[]).filter(
  (backend) => runtimesFor({ backend }).node,
);

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

  for (const backend of backends) {
    it(`${backend} with pnpm`, { timeout: 15 * 60_000 }, async () => {
      const dir = join(root, backend);
      await scaffold(dir, {
        names: derivePluginNames(`e2e-${backend}`),
        description: "End-to-end test plugin",
        backend,
        frontend: "react",
        packageManager: "pnpm",
        apiPort: 3400,
        uiPort: 3100,
      });

      await run("pnpm", ["install"], dir);
      await run("pnpm", ["run", "check"], dir);
      await run("pnpm", ["run", "lint"], dir);
      await run("pnpm", ["run", "build"], dir);
    });
  }
});
