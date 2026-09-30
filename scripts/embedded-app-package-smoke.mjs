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

  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "embedded-app-consumer", private: true, type: "module",
  }))
  writeFileSync(join(consumer, "index.html"),
    '<main id="root"></main><script type="module" src="/src/main.jsx"></script>')
  writeFileSync(join(consumer, "src/main.jsx"), [
    'import React from "react"',
    'import { createRoot } from "react-dom/client"',
    'import { EmbeddedAppView } from "@tangle-network/sandbox-ui/workbench/embedded-app"',
    '',
    'createRoot(document.getElementById("root")).render(',
    '  React.createElement(EmbeddedAppView, {',
    '    app: { id: "app-1", name: "Example app", status: "unavailable" },',
    '  }),',
    ')',
  ].join("\n"))

  execFileSync("npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps",
    tarball, "react@19", "react-dom@19", "@tangle-network/ui@11.10.0", "@tangle-network/brand@1.8.0",
  ], { cwd: consumer, stdio: "inherit" })

  if (existsSync(join(consumer, "node_modules", "@xterm"))) {
    throw new Error("The clean consumer unexpectedly installed xterm.")
  }

  await build({ root: consumer, configFile: false, logLevel: "error",
    build: { outDir: join(consumer, "dist"), emptyOutDir: true } })

  const emitted = readdirSync(join(consumer, "dist", "assets"))
    .filter(name => name.endsWith(".js"))
    .map(name => readFileSync(join(consumer, "dist", "assets", name), "utf8"))
    .join("\n")
  if (emitted.includes("@xterm/") || emitted.includes("Could not resolve")) {
    throw new Error("The embedded app entry pulled unresolved optional peers into the consumer bundle.")
  }
  console.log("EmbeddedAppView built from a packed artifact without xterm peers.")
} finally {
  rmSync(workdir, { recursive: true, force: true })
}
