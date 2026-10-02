import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "playwright";
import { assertPresentationUtilities, collectPresentationUtilities } from "./presentation-css-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const floor = (range) => {
  const match = /^\^?(\d+\.\d+\.\d+)$/.exec(range ?? "");
  if (!match) throw new Error(`Expected one explicit package floor, received ${range}`);
  return match[1];
};
const uiFloor = floor(manifest.peerDependencies["@tangle-network/ui"]);
const brandFloor = floor(manifest.peerDependencies["@tangle-network/brand"]);
const installed = (dir, name) => JSON.parse(readFileSync(join(dir, "node_modules", name, "package.json"), "utf8"));
// A latest-only pass cannot establish the advertised minimum.
assert.equal(installed(root, "@tangle-network/ui").version, uiFloor, "Build and test the declared UI floor");
assert.equal(installed(root, "@tangle-network/brand").version, brandFloor, "Build and test the declared Brand floor");
const utilities = await collectPresentationUtilities();
const work = realpathSync(mkdtempSync(join(tmpdir(), "sandbox-ui-presentation-")));
const consumer = join(work, "consumer");
const evidence = join(root, "test-results", "presentation");
mkdirSync(join(consumer, "src"), { recursive: true });
mkdirSync(evidence, { recursive: true });
let browser;
let server;
const results = [];
try {
  const tarball = process.env.SANDBOX_UI_TARBALL
    ? resolve(process.env.SANDBOX_UI_TARBALL)
    : execFileSync(join(root, "scripts/pack-package.sh"), [join(work, "pack")], { cwd: root, encoding: "utf8" }).trim();
  assert.ok(existsSync(tarball), "A real package tarball is required; run pnpm build first");
  const packed = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
  assert.equal(packed.peerDependencies["@tangle-network/ui"], manifest.peerDependencies["@tangle-network/ui"]);
  assert.equal(packed.peerDependencies["@tangle-network/brand"], manifest.peerDependencies["@tangle-network/brand"]);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "sandbox-presentation-real-consumer", private: true, type: "module",
    dependencies: {
      // Exercise root imports with their real optional peers, as test:package
      // does. Optional-peer omission stays covered by that existing suite.
      ...Object.fromEntries(Object.entries(packed.peerDependenciesMeta ?? {})
        .filter(([, metadata]) => metadata.optional === true)
        .map(([name]) => [name, floor(manifest.devDependencies[name])])),
      "@tangle-network/sandbox-ui": `file:${tarball}`,
      "@tangle-network/ui": uiFloor, "@tangle-network/brand": brandFloor,
      "@tangle-network/agent-interface": manifest.devDependencies["@tangle-network/agent-interface"],
      react: floor(manifest.devDependencies.react), "react-dom": floor(manifest.devDependencies["react-dom"]),
    },
    devDependencies: Object.fromEntries(["typescript", "@types/react", "@types/react-dom", "tailwindcss", "@tailwindcss/postcss", "postcss"]
      .map((name) => [name, floor(manifest.devDependencies[name])])),
  }, null, 2));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: consumer, stdio: "inherit" });
  assert.equal(installed(consumer, "@tangle-network/ui").version, uiFloor);
  assert.equal(installed(consumer, "@tangle-network/brand").version, brandFloor);
  const packageDir = join(consumer, "node_modules/@tangle-network/sandbox-ui");
  assert.equal(installed(consumer, "@tangle-network/sandbox-ui").version, packed.version);
  assert.ok(!existsSync(join(packageDir, "src")), "The consumer must not resolve Sandbox source");
  assert.equal(readFileSync(join(packageDir, "dist/globals.css"), "utf8"), readFileSync(join(packageDir, "dist/styles.css"), "utf8"));
  assert.equal(readFileSync(join(packageDir, "dist/tokens.css"), "utf8"), readFileSync(join(consumer, "node_modules/@tangle-network/brand/src/styles/tokens.css"), "utf8"));

  cpSync(join(root, "tests/fixtures/presentation-consumer.tsx"), join(consumer, "src/fixture.tsx"));
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", noEmit: true, skipLibCheck: true, esModuleInterop: true, lib: ["ES2022", "DOM"] },
    include: ["src/fixture.tsx"],
  }));
  execFileSync(join(consumer, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"], { cwd: consumer, stdio: "inherit" });

  const consumerRequire = createRequire(join(consumer, "package.json"));
  const { default: postcss } = await import(consumerRequire.resolve("postcss"));
  const { default: tailwind } = await import(consumerRequire.resolve("@tailwindcss/postcss"));
  const hostSource = '@import "@tangle-network/sandbox-ui/tailwind.css";\n@source "./fixture.tsx";\n';
  const hostCss = (await postcss([tailwind({ base: consumer })]).process(hostSource, { from: join(consumer, "src/host.css") })).css;
  const compiledCss = readFileSync(join(packageDir, "dist/globals.css"), "utf8");
  assertPresentationUtilities(compiledCss, utilities, "packed globals.css at peer floors");
  assertPresentationUtilities(hostCss, utilities, "independent host Tailwind output at peer floors");
  writeFileSync(join(consumer, "src/host.compiled.css"), hostCss);

  // Negative control: deleting the canonical source scan must lose heading
  // utilities. This check cannot be satisfied by scanning its own oracle.
  const packedSource = readFileSync(join(packageDir, "dist/tailwind.css"), "utf8");
  assert.ok(!packedSource.includes("../../src/") && !packedSource.includes("../../node_modules/"));
  const withoutPeer = packedSource.replace(/^@source "\.\.\/\.\.\/ui\/src\/[^\n]+\n/gm, "");
  assert.notEqual(withoutPeer, packedSource, "Both peer source directives must be removable");
  const negativeCss = (await postcss([tailwind({ base: consumer })]).process(withoutPeer, { from: join(packageDir, "dist/missing-peer.css") })).css;
  assert.throws(() => assertPresentationUtilities(negativeCss, utilities, "missing peer scan"), /no compiled rule/);

  browser = await chromium.launch({ headless: true });
  for (const mode of ["precompiled", "host-tailwind"]) {
    writeFileSync(join(consumer, "src/main.tsx"), `import ${JSON.stringify(mode === "precompiled" ? "@tangle-network/sandbox-ui/globals.css" : "./host.compiled.css")};\nimport "./fixture";\n`);
    writeFileSync(join(consumer, "index.html"), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>');
    const outDir = join(consumer, `dist-${mode}`);
    await build({ root: consumer, configFile: false, logLevel: "error", build: { outDir, emptyOutDir: true } });
    server = await preview({ root: consumer, configFile: false, logLevel: "error", build: { outDir }, preview: { host: "127.0.0.1", port: 0 } });
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== "string");
    for (const [width, height, theme] of [[390, 844, "light"], [1280, 900, "dark"]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await page.evaluate((theme) => { document.documentElement.className = theme; }, theme);
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      assert.equal(await page.getByRole("heading", { level: 2, name: "Runs" }).count(), 1);
      assert.equal(await page.getByRole("heading", { level: 2, name: "Legacy display" }).count(), 1);
      assert.equal(await page.getByRole("heading", { level: 3, name: "Build record" }).count(), 1);
      assert.equal(await page.locator("body").getAttribute("data-identity"), "true");
      assert.equal(await page.locator("body").getAttribute("data-refs"), "true");
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector(".consumer-shell");
        const title = document.querySelector("h1");
        const gap = document.querySelector('[data-testid="prose-gap"]');
        return { overflow: document.documentElement.scrollWidth - innerWidth,
          gutter: parseFloat(getComputedStyle(shell).paddingLeft),
          titleSize: parseFloat(getComputedStyle(title).fontSize),
          titleFont: getComputedStyle(title).fontFamily,
          proseGap: parseFloat(getComputedStyle(gap).marginTop) };
      });
      assert.ok(metrics.overflow <= 1, `${mode}/${width}: page overflows by ${metrics.overflow}px`);
      assert.equal(metrics.gutter, width < 1024 ? 24 : 32);
      assert.ok(metrics.titleSize >= 24 && metrics.titleFont.includes("Inter"), "Canonical heading font utility must resolve");
      assert.ok(metrics.proseGap > 0, "Brand prose consolidation must preserve paragraph spacing");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), "page-action");
      assert.ok(await page.locator("#page-action").evaluate((el) => {
        const style = getComputedStyle(el);
        return el.matches(":focus-visible") && (style.outlineStyle !== "none" || style.boxShadow !== "none");
      }), "Keyboard action must retain visible focus");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-actions") === "1");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), "section-action");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), "card-action");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("aria-label"), "Run history");
      if (width < 640) {
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => document.querySelector('[aria-label="Run history"]').scrollLeft > 0);
      }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(evidence, `${mode}-${width}-${theme}.png`), fullPage: true });
      results.push({ mode, width, height, theme, ...metrics, keyboard: "pass", refs: "pass", identity: "pass", pageErrors: errors });
      await page.close();
    }
    await new Promise((done) => server.httpServer.close(done));
    server = undefined;
  }
  const receipt = { sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), uiFloor, brandFloor, packageVersion: packed.version, tarballSha256: createHash("sha256").update(readFileSync(tarball)).digest("hex"), utilityCount: utilities.size, types: "pass", missingPeerScan: "rejected", results };
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  if (server) await new Promise((done) => server.httpServer.close(done));
  await browser?.close();
  rmSync(work, { recursive: true, force: true });
}
