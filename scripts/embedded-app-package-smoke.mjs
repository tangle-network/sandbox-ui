import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const workdir = realpathSync(mkdtempSync(join(tmpdir(), "sandbox-ui-embedded-consumer-")))
const consumer = join(workdir, "consumer")
const pack = join(workdir, "pack")

try {
  mkdirSync(join(consumer, "src"), { recursive: true })
  const tarball = process.env.SANDBOX_UI_TARBALL
    ? resolve(process.env.SANDBOX_UI_TARBALL)
    : execFileSync(join(root, "scripts/pack-package.sh"), [pack], { cwd: root, encoding: "utf8" }).trim()
  if (!existsSync(tarball)) throw new Error("Packed sandbox-ui artifact is missing: " + tarball)
  const manifest = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }))
  if (manifest.name !== "@tangle-network/sandbox-ui") throw new Error("The packed artifact is not sandbox-ui.")
  const dependencies = [
    ["react", manifest.devDependencies?.react],
    ["react-dom", manifest.devDependencies?.["react-dom"]],
    ["@tangle-network/ui", manifest.dependencies?.["@tangle-network/ui"]],
    ["@tangle-network/brand", manifest.peerDependencies?.["@tangle-network/brand"]],
  ].map(([name, version]) => {
    if (typeof version !== "string" || !version.trim()) throw new Error(`Packed ${name} version is missing.`)
    return `${name}@${version}`
  })

  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "embedded-app-consumer", private: true, type: "module",
  }))
  writeFileSync(join(consumer, "index.html"),
    '<main id="root"></main><script type="module" src="/src/main.jsx"></script>')
  writeFileSync(join(consumer, "src/main.jsx"), [
    'import React from "react"',
    'import { createRoot } from "react-dom/client"',
    'import { EmbeddedAppView } from "@tangle-network/sandbox-ui/workbench/embedded-app"',
    'import { DiffView } from "@tangle-network/sandbox-ui/workbench/diff"',
    '',
    'createRoot(document.getElementById("root")).render(',
    '  React.createElement(React.Fragment, null, React.createElement(EmbeddedAppView, {',
    '    app: { id: "app-1", name: "Example app", status: "unavailable" },',
    '  }), React.createElement(DiffView, { filename: "answer.md", baseline: "before\\n", current: "after\\n" })),',
    ')',
  ].join("\n"))

  execFileSync("npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball, ...dependencies,
  ], { cwd: consumer, stdio: "inherit" })

  const terminalPackages = readdirSync(join(consumer, "node_modules"), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name === "@xterm")
  if (terminalPackages.length) throw new Error("The clean consumer unexpectedly installed xterm, including nested dependencies.")

  const uiDirectories = execFileSync("npm", ["ls", "@tangle-network/ui", "--all", "--parseable"], {
    cwd: consumer, encoding: "utf8",
  }).trim().split(/\r?\n/).filter(path => path.endsWith(join("node_modules", "@tangle-network", "ui")))
    .map(path => realpathSync(path))
  if (new Set(uiDirectories).size !== 1) {
    throw new Error("The host and packed Sandbox consumer must resolve one shared UI directory: " + JSON.stringify(uiDirectories))
  }

  await build({ root: consumer, configFile: false, logLevel: "error",
    build: { outDir: join(consumer, "dist"), emptyOutDir: true } })

  const emitted = readdirSync(join(consumer, "dist", "assets"))
    .filter(name => name.endsWith(".js"))
    .map(name => readFileSync(join(consumer, "dist", "assets", name), "utf8"))
    .join("\n")
  if (emitted.includes("@xterm/") || emitted.includes("Could not resolve")) {
    throw new Error("A focused workbench entry pulled unresolved optional peers into the consumer bundle.")
  }
  console.log("EmbeddedAppView and DiffView built from the packed artifact with one shared UI directory and no xterm peers.")
} finally {
  rmSync(workdir, { recursive: true, force: true })
}
