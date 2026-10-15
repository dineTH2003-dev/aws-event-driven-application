import * as esbuild from "esbuild";
import { mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const functions = [
  { name: "create-order", entry: "src/functions/create-order/handler.js" },
  { name: "process-order", entry: "src/functions/process-order/handler.js" },
  { name: "publish-notification", entry: "src/functions/publish-notification/handler.js" }
];

async function buildAll() {
  console.log("⚡ Building Lambda handlers with esbuild...");

  for (const fn of functions) {
    const outdir = resolve(`dist/${fn.name}`);
    if (!existsSync(outdir)) {
      mkdirSync(outdir, { recursive: true });
    }

    await esbuild.build({
      entryPoints: [fn.entry],
      bundle: true,
      minify: true,
      keepNames: true,
      sourcemap: true,
      platform: "node",
      target: "node20",
      format: "esm",
      outfile: `${outdir}/index.mjs`,
      external: [
        "@aws-sdk/*"
      ]
    });

    console.log(`✅ Built dist/${fn.name}/index.mjs`);
  }
}

buildAll().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
