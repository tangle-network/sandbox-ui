import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
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
const consumerDistDir = join(consumerDir, "dist");

// Vite 8.1.5 resolves an optional peer that is not installed to a stub module
// whose body throws this text. The stub decision reads the peerDependenciesMeta
// of the nearest package.json above the IMPORTING file, so an import inside
// @tangle-network/ui is governed by that package's manifest, not this one.
// A Vite upgrade that rewords the throw must update this marker; the
// `stubbedPeers.size === 0` guard below turns a stale marker into a failing run
// rather than a silent pass.
const stubMarker = (name) => `Could not resolve "${name}"`;

const expectedAgentInterfaceRange = "^1.0.0";
const expectedAgentInterfaceVersion =
  process.env.SANDBOX_UI_AGENT_INTERFACE_VERSION ?? "1.0.0";

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
  const patternSubpaths = Object.keys(manifest.exports).filter((subpath) =>
    subpath.includes("*"),
  );
  if (patternSubpaths.length > 0) {
    throw new Error(
      `packed exports map declares pattern subpaths: ${patternSubpaths.join(", ")}. ` +
        "Each subpath must name one file, so that a source file rename stays internal " +
        "and cannot break a deep import.",
    );
  }
  if (
    manifest.peerDependencies?.["@tangle-network/agent-interface"] !==
    expectedAgentInterfaceRange
  ) {
    throw new Error(
      `packed package must require @tangle-network/agent-interface ${expectedAgentInterfaceRange}`,
    );
  }

  const invalidOptionalPeers = Object.keys(manifest.peerDependenciesMeta ?? {}).filter(
    (name) => !manifest.peerDependencies?.[name],
  );
  if (invalidOptionalPeers.length > 0) {
    throw new Error(
      `optional peer metadata is missing peer declarations: ${invalidOptionalPeers.join(", ")}`,
    );
  }

  const declaredOptionalPeers = Object.entries(manifest.peerDependenciesMeta ?? {})
    .filter(([, metadata]) => metadata?.optional === true)
    .map(([name]) => name);

  // The peers to leave uninstalled. An optional peer only earns the name when a
  // consumer without it still builds, so this run proves the promise the
  // manifest makes. `test:package` runs the script once with every optional
  // peer installed and once without the editor's peers.
  const omittedOptionalPeers = JSON.parse(
    process.env.PACKAGE_OMIT_OPTIONAL_PEERS ?? "[]",
  );
  if (
    !Array.isArray(omittedOptionalPeers) ||
    omittedOptionalPeers.some((name) => typeof name !== "string")
  ) {
    throw new Error("PACKAGE_OMIT_OPTIONAL_PEERS must be a JSON array of package names");
  }
  const notOptionalOmissions = omittedOptionalPeers.filter(
    (name) => !declaredOptionalPeers.includes(name),
  );
  if (notOptionalOmissions.length > 0) {
    throw new Error(
      "cannot omit peers that the packed manifest does not declare optional: " +
        notOptionalOmissions.join(", "),
    );
  }

  const optionalPeers = declaredOptionalPeers
    .filter((name) => !omittedOptionalPeers.includes(name))
    .map((name) => {
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
      `@tangle-network/agent-interface@${expectedAgentInterfaceVersion}`,
      "react@19",
      "react-dom@19",
      ...optionalPeers,
    ],
    { cwd: consumerDir, stdio: "inherit" },
  );

  // Smoke the gauge: a peer that npm still installs through another dependency
  // would make this run a false green.
  const leakedOmissions = omittedOptionalPeers.filter((name) =>
    existsSync(join(consumerDir, "node_modules", ...name.split("/"))),
  );
  if (leakedOmissions.length > 0) {
    throw new Error(
      `omitted optional peers reached the consumer anyway: ${leakedOmissions.join(", ")}`,
    );
  }

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
  if (agentInterfaceManifest.version !== expectedAgentInterfaceVersion) {
    throw new Error(
      `clean consumer installed agent-interface ${agentInterfaceManifest.version}, expected ${expectedAgentInterfaceVersion}`,
    );
  }
  const { harnessTypeSchema } = await import(pathToFileURL(agentInterfaceEntry));
  for (const removedAlias of ["claude", "claudish", "kimi"]) {
    if (harnessTypeSchema.safeParse(removedAlias).success) {
      throw new Error(`agent-interface accepted removed harness alias ${removedAlias}`);
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
import { ReasoningLevelPicker } from "@tangle-network/sandbox-ui/chat";

document.documentElement.dataset.sandboxUiExportCount = String(
  [${publicEntries}].reduce((count, entry) => count + Object.keys(entry).length, 0),
);
createRoot(document.getElementById("root")).render(
  React.createElement(ReasoningLevelPicker, {
    value: "auto",
    onChange() {},
  }),
);
`,
  );

  await build({
    root: consumerDir,
    logLevel: "error",
    build: {
      emptyOutDir: true,
      outDir: consumerDistDir,
    },
  });

  // A dynamic import of an uninstalled optional peer builds green: the peer
  // becomes its own chunk that throws when it loads. That is the wanted
  // behaviour, and it also means a green build no longer proves that an
  // INSTALLED peer resolved. Read the emitted chunks and say which peers the
  // bundle stubbed.
  const stubbedPeers = new Set();
  for (const entry of readdirSync(consumerDistDir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const code = readFileSync(join(entry.parentPath, entry.name), "utf8");
    for (const name of declaredOptionalPeers) {
      if (code.includes(stubMarker(name))) stubbedPeers.add(name);
    }
  }

  const unresolvedInstalledPeers = declaredOptionalPeers.filter(
    (name) => !omittedOptionalPeers.includes(name) && stubbedPeers.has(name),
  );
  if (unresolvedInstalledPeers.length > 0) {
    throw new Error(
      `installed optional peers did not resolve in the consumer: ${unresolvedInstalledPeers.join(", ")}`,
    );
  }

  // Not every omitted peer leaves a stub — a peer this package reaches only
  // through types never reaches the bundle at all. One stub is enough to prove
  // the run exercised the uninstalled path, and it pins the marker string the
  // check above reads.
  if (omittedOptionalPeers.length > 0 && stubbedPeers.size === 0) {
    throw new Error(
      "no omitted optional peer was stubbed; either the build never reached " +
        `${omittedOptionalPeers.join(", ")}, or Vite reworded the stub this script reads. ` +
        "The marker was read from Vite 8.1.5 — compare it against the Vite now installed " +
        "and update stubMarker() in this file.",
    );
  }

  const omissionNote =
    omittedOptionalPeers.length > 0
      ? ` without ${omittedOptionalPeers.join(", ")}`
      : "";
  console.log(
    `Packed ${manifest.name}@${manifest.version} passed a clean consumer build across ${jsSpecifiers.length} JS and ${cssSpecifiers.length} CSS exports${omissionNote}`,
  );
} finally {
  rmSync(workdir, { force: true, recursive: true });
}
