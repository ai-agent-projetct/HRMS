// Makes .next/standalone self-contained for the desktop build by copying the
// static assets and public folder into it (Next does not do this automatically).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
if (!existsSync(standalone)) {
  console.error("✖ .next/standalone not found — run `next build` first (output: 'standalone').");
  process.exit(1);
}

mkdirSync(join(standalone, ".next"), { recursive: true });
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
}
console.log("✔ standalone prepared (.next/static + public copied)");
