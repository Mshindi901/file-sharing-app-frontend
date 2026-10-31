import tailwind from "bun-plugin-tailwind";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
const apiBaseUrl =
  process.env.BUN_PUBLIC_API_BASE_URL ||
  "https://file-sharing-app-backend-sdqm.onrender.com/api";
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

await writeFile(
  path.join(outdir, "api-config.json"),
  JSON.stringify({ apiBaseUrl }),
);

for (const output of result.outputs) {
  console.log(
    ` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`,
  );
}
