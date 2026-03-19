import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const srcStylesDir = join(rootDir, "src", "styles");
const distDir = join(rootDir, "dist");

await mkdir(distDir, { recursive: true });
await cp(join(srcStylesDir, "tokens.css"), join(distDir, "tokens.css"));

const globalsCss = await readFile(join(srcStylesDir, "globals.css"), "utf8");

await writeFile(join(distDir, "globals.css"), globalsCss);
await writeFile(join(distDir, "styles.css"), globalsCss);
