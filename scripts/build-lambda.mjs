// Assembles the Lambda deployment package from Next's standalone output.
//
// Run after `next build`:  node scripts/build-lambda.mjs
// Produces:                dist/lambda.zip
//
// Two things this exists to get right:
//
//   1. `output: "standalone"` writes a server.js and the modules it reaches, but
//      deliberately leaves out .next/static and public/ — Next expects those to
//      be served by a CDN. They are copied in anyway so the function is
//      self-sufficient; CloudFront still serves them from S3, this is only the
//      fallback for anything that reaches the origin.
//
//   2. run.sh has to be executable inside the archive. Windows has no executable
//      bit, so relying on the filesystem gives 0644 and the adapter fails at cold
//      start with "permission denied" — a failure that looks like a broken
//      runtime rather than a file mode. The mode is therefore set explicitly.
import { createWriteStream } from "node:fs";
import { cp, mkdir, rm, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// archiver is CommonJS and exposes no default ESM export, so importing it
// directly from a .mjs fails at module instantiation.
const archiver = createRequire(import.meta.url)("archiver");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "lambda.zip");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(standalone, "server.js")))) {
  console.error(
    "No .next/standalone/server.js — run `npm run build` first.\n" +
      "If the build ran but produced nothing here, check that next.config.ts still sets output: \"standalone\".",
  );
  process.exit(1);
}

// Static assets and public files, which standalone omits by design.
const staticSrc = path.join(root, ".next", "static");
if (await exists(staticSrc)) {
  await cp(staticSrc, path.join(standalone, ".next", "static"), { recursive: true });
}
const publicSrc = path.join(root, "public");
if (await exists(publicSrc)) {
  await cp(publicSrc, path.join(standalone, "public"), { recursive: true });
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const runSh = await readFile(path.join(root, "deploy", "run.sh"), "utf8");
const bootstrap = await readFile(path.join(root, "deploy", "bootstrap.mjs"), "utf8");

const output = createWriteStream(outFile);
const archive = archiver("zip", { zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output.on("close", resolve);
  archive.on("error", reject);
  archive.on("warning", (e) => {
    // A missing file is a broken package, not a warning to shrug at.
    if (e.code === "ENOENT") reject(e);
    else console.warn(e);
  });
});

archive.pipe(output);
archive.directory(standalone, false);
// 0o755 so the adapter can execute it. Newlines forced to LF: a CRLF shebang
// makes the kernel look for an interpreter named "/bin/sh\r", which does not
// exist, and the error names neither the file nor the reason.
archive.append(runSh.replace(/\r\n/g, "\n"), { name: "run.sh", mode: 0o755 });
archive.append(bootstrap.replace(/\r\n/g, "\n"), { name: "bootstrap.mjs", mode: 0o644 });

await archive.finalize();
await done;

const { size } = await stat(outFile);
console.log(`dist/lambda.zip  ${(size / 1024 / 1024).toFixed(1)} MB`);
