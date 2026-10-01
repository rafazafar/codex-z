import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { tailwindEsbuildPlugin } from "./tailwind-esbuild-plugin.mjs";

const packageRoot = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(
  await readFile(path.resolve(packageRoot, "../../package.json"), "utf8"),
);
const entries = [
  { entry: "src/index.ts", format: "esm", outfile: "dist/index.js" },
  { entry: "src/production-entry.ts", format: "iife", outfile: "dist/production.js" },
  { entry: "src/probe-entry.ts", format: "iife", outfile: "dist/renderer-binding-probe.js" },
  { entry: "src/audit-entry.ts", format: "iife", outfile: "dist/contract-audit.js" },
];

for (const { entry, format, outfile } of entries) {
  await build({
    absWorkingDir: packageRoot,
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format,
    target: "es2024",
    define: { __CODEX_Z_VERSION__: JSON.stringify(version) },
    loader: { ".png": "dataurl", ".svg": "dataurl", ".css": "text" },
    plugins: [tailwindEsbuildPlugin()],
    outfile,
  });
}
