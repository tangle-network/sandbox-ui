import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workdir = mkdtempSync(join(tmpdir(), "sandbox-ui-package-smoke-"));
const packDir = join(workdir, "pack");
const consumerDir = join(workdir, "consumer");

const mentionRuntimeDependencies = [
  "@tiptap/core",
  "@tiptap/extension-mention",
  "@tiptap/react",
  "@tiptap/starter-kit",
  "@tiptap/suggestion",
];
const expectedAgentInterfaceRange = "^0.36.0";

function packedManifest(tarballPath) {
  return JSON.parse(
    execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
      encoding: "utf8",
    }),
  );
}

function exportTarget(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.import === "string") {
    return value.import;
  }
  return undefined;
}

function packageSpecifier(packageName, subpath) {
  return subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`;
}

try {
  if (!existsSync(join(root, "dist/chat.js"))) {
    throw new Error("dist/chat.js is missing; run pnpm build before test:package");
  }

  mkdirSync(join(consumerDir, "src"), { recursive: true });

  let tarballPath;
  if (process.env.SANDBOX_UI_TARBALL) {
    tarballPath = resolve(process.env.SANDBOX_UI_TARBALL);
    if (!existsSync(tarballPath) || !tarballPath.endsWith(".tgz")) {
      throw new Error(`SANDBOX_UI_TARBALL must point to a package tarball: ${tarballPath}`);
    }
  } else {
    tarballPath = execFileSync(join(root, "scripts/pack-package.sh"), [packDir], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  }

  const manifest = packedManifest(tarballPath);
  if (
    typeof manifest.name !== "string" ||
    typeof manifest.version !== "string" ||
    !manifest.exports ||
    typeof manifest.exports !== "object"
  ) {
    throw new Error("packed package.json must contain name, version, and exports");
  }
  if (
    manifest.peerDependencies?.["@tangle-network/agent-interface"] !==
    expectedAgentInterfaceRange
  ) {
    throw new Error(
      `packed package must require @tangle-network/agent-interface ${expectedAgentInterfaceRange}`,
    );
  }

  const optionalPeers = Object.entries(manifest.peerDependenciesMeta ?? {})
    .filter(([, metadata]) => metadata?.optional === true)
    .map(([name]) => {
      const version = manifest.devDependencies?.[name] ?? manifest.peerDependencies?.[name];
      return version ? `${name}@${version}` : name;
    });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: "sandbox-ui-clean-consumer", private: true, type: "module" }),
  );
  writeFileSync(
    join(consumerDir, "index.html"),
    '<main id="root"></main><script type="module" src="/src/main.js"></script>',
  );

  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarballPath,
      "react@19",
      "react-dom@19",
      ...optionalPeers,
    ],
    { cwd: consumerDir, stdio: "inherit" },
  );

  const packageDirectory = join(
    consumerDir,
    "node_modules",
    ...manifest.name.split("/"),
  );
  const installedManifest = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  if (installedManifest.version !== manifest.version) {
    throw new Error(
      `installed package version ${installedManifest.version} does not match tarball ${manifest.version}`,
    );
  }

  for (const [subpath, value] of Object.entries(manifest.exports)) {
    const targets = typeof value === "string" ? [value] : Object.values(value);
    for (const target of targets) {
      if (typeof target === "string" && !existsSync(resolve(packageDirectory, target))) {
        throw new Error(`packed export ${subpath} points to missing file ${target}`);
      }
    }
  }

  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    const dependencyDirectory = join(
      consumerDir,
      "node_modules",
      ...dependency.split("/"),
    );
    if (!existsSync(dependencyDirectory)) {
      throw new Error(`clean install is missing runtime dependency ${dependency}`);
    }
  }

  const consumerRequire = createRequire(join(consumerDir, "package.json"));
  const agentInterfaceEntry = consumerRequire.resolve("@tangle-network/agent-interface");
  const agentInterfaceManifest = JSON.parse(
    readFileSync(resolve(dirname(agentInterfaceEntry), "../package.json"), "utf8"),
  );
  if (!/^0\.36\./.test(agentInterfaceManifest.version)) {
    throw new Error(
      `clean consumer installed agent-interface ${agentInterfaceManifest.version}, expected 0.36.x`,
    );
  }
  const { harnessTypeSchema } = await import(pathToFileURL(agentInterfaceEntry));
  for (const removedAlias of ["claude", "claudish", "kimi"]) {
    if (harnessTypeSchema.safeParse(removedAlias).success) {
      throw new Error(`agent-interface accepted removed harness alias ${removedAlias}`);
    }
  }
  for (const dependency of mentionRuntimeDependencies) {
    consumerRequire.resolve(dependency);
    if (!manifest.dependencies?.[dependency]) {
      throw new Error(`packed manifest is missing runtime dependency ${dependency}`);
    }
  }

  const jsSpecifiers = [];
  const cssSpecifiers = [];
  for (const [subpath, value] of Object.entries(manifest.exports)) {
    const target = exportTarget(value);
    if (target?.endsWith(".js")) {
      jsSpecifiers.push(packageSpecifier(manifest.name, subpath));
    } else if (target?.endsWith(".css")) {
      cssSpecifiers.push(packageSpecifier(manifest.name, subpath));
    }
  }

  const moduleImports = jsSpecifiers.map(
    (specifier, index) => `import * as publicEntry${index} from ${JSON.stringify(specifier)};`,
  );
  const cssImports = cssSpecifiers.map(
    (specifier) => `import ${JSON.stringify(specifier)};`,
  );
  const publicEntries = jsSpecifiers.map((_, index) => `publicEntry${index}`).join(", ");
  writeFileSync(
    join(consumerDir, "src/main.js"),
    `${moduleImports.join("\n")}
${cssImports.join("\n")}
import React from "react";
import { createRoot } from "react-dom/client";
import { AgentComposer } from "@tangle-network/sandbox-ui/chat";

document.documentElement.dataset.sandboxUiExportCount = String(
  [${publicEntries}].reduce((count, entry) => count + Object.keys(entry).length, 0),
);
createRoot(document.getElementById("root")).render(
  React.createElement(AgentComposer, {
    value: "",
    onChange() {},
    onSubmit() {},
    mention: { fetchItems: async () => [] },
  }),
);
`,
  );

  await build({
    root: consumerDir,
    logLevel: "error",
    build: {
      emptyOutDir: true,
      outDir: join(consumerDir, "dist"),
    },
  });

  console.log(
    `Packed ${manifest.name}@${manifest.version} passed a clean consumer build across ${jsSpecifiers.length} JS and ${cssSpecifiers.length} CSS exports`,
  );
} finally {
  rmSync(workdir, { force: true, recursive: true });
}
