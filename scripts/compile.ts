import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { x } from "tinyexec";

const TARGETS = [
  "linux-x64",
  "linux-arm64",
  "linux-x64-musl",
  "linux-arm64-musl",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64",
] as const;

const run = (command: string, args: string[]) =>
  x(command, args, { nodeOptions: { stdio: "inherit" }, throwOnError: true });

const requested = process.argv.slice(2);
const targets = requested.length > 0 ? requested : [...TARGETS];
for (const target of targets) {
  if (!(TARGETS as readonly string[]).includes(target)) {
    console.error(`Unknown target "${target}". Expected one of: ${TARGETS.join(", ")}`);
    process.exit(1);
  }
}

await run("pnpm", ["templates"]);

for (const target of targets) {
  const dir = join("dist", "bin", target);
  const outfile = join(dir, "create-erxes-plugin");
  console.log(`\n==> ${target}`);
  await run("bun", [
    "build",
    "--compile",
    "--minify",
    `--target=bun-${target}`,
    "src/index.ts",
    "--outfile",
    outfile,
  ]);
  // Bun appends .exe to Windows binaries when the outfile lacks it; make sure
  // the final name is always create-erxes-plugin.exe.
  if (target.startsWith("windows") && existsSync(outfile) && !existsSync(`${outfile}.exe`)) {
    renameSync(outfile, `${outfile}.exe`);
  }
}
