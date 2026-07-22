import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 10_000;

export function registryPackageUrl(registry, packageName) {
  const base = registry.endsWith("/") ? registry : `${registry}/`;
  const encodedName = encodeURIComponent(packageName).replace(/^%40/, "@");
  return new URL(encodedName, base).href;
}

export async function registryShasum({ registry, packageName, version, token, fetchImpl = fetch }) {
  const headers = { accept: "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(registryPackageUrl(registry, packageName), {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${registry} returned HTTP ${response.status} for ${packageName}@${version}`);
  }

  const metadata = await response.json();
  if (!metadata?.versions || typeof metadata.versions !== "object") {
    throw new Error(`${registry} returned package metadata without versions`);
  }
  const versionMetadata = metadata.versions[version];
  if (!versionMetadata) {
    return null;
  }
  if (typeof versionMetadata?.dist?.shasum !== "string" || versionMetadata.dist.shasum.length === 0) {
    throw new Error(`${registry} returned ${packageName}@${version} metadata without dist.shasum`);
  }
  return versionMetadata.dist.shasum;
}

function packageManifest(tarballPath) {
  const output = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
  });
  const manifest = JSON.parse(output);
  if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
    throw new Error("Packed package.json must contain name and version strings");
  }
  return manifest;
}

function npmUserConfig({ registry, packageName, token, directory }) {
  const registryUrl = new URL(registry.endsWith("/") ? registry : `${registry}/`);
  const lines = [`registry=${registryUrl.href}`];
  if (packageName.startsWith("@")) {
    lines.push(`${packageName.split("/")[0]}:registry=${registryUrl.href}`);
  }
  if (token) {
    lines.push(`//${registryUrl.host}${registryUrl.pathname}:_authToken=${token}`);
  }
  const path = join(directory, ".npmrc");
  writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  return path;
}

async function waitForPublishedArtifact(options, expectedShasum) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const publishedShasum = await registryShasum(options);
    if (publishedShasum === expectedShasum) {
      return;
    }
    if (publishedShasum) {
      throw new Error(
        `${options.registry} returned different package bytes: local=${expectedShasum} registry=${publishedShasum}`,
      );
    }
    if (attempt < POLL_ATTEMPTS) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_INTERVAL_MS));
    }
  }
  throw new Error(`Published package was not visible from ${options.registry} after ${POLL_ATTEMPTS} attempts`);
}

async function main() {
  const [tarballArgument, registryArgument, tag = "latest", provenanceArgument] = process.argv.slice(2);
  if (!tarballArgument || !registryArgument) {
    throw new Error(
      "Usage: node scripts/publish-package.mjs <package.tgz> <registry-url> [tag] [--provenance]",
    );
  }

  const tarballPath = resolve(tarballArgument);
  if (!existsSync(tarballPath) || !tarballPath.endsWith(".tgz")) {
    throw new Error(`Package tarball does not exist: ${tarballPath}`);
  }

  const registry = new URL(registryArgument).href;
  const manifest = packageManifest(tarballPath);
  const localShasum = createHash("sha1").update(readFileSync(tarballPath)).digest("hex");
  const token = process.env.NODE_AUTH_TOKEN?.trim() || undefined;
  const registryOptions = {
    registry,
    packageName: manifest.name,
    version: manifest.version,
    token,
  };

  const existingShasum = await registryShasum(registryOptions);
  if (existingShasum) {
    if (existingShasum !== localShasum) {
      throw new Error(
        `${manifest.name}@${manifest.version} already exists with different package bytes: local=${localShasum} registry=${existingShasum}`,
      );
    }
    console.log(
      `${manifest.name}@${manifest.version} already exists at ${registry} with sha1=${localShasum}; skipping publish`,
    );
    return;
  }

  const configDirectory = mkdtempSync(join(tmpdir(), "sandbox-ui-npm-config-"));
  try {
    const userConfig = npmUserConfig({
      registry,
      packageName: manifest.name,
      token,
      directory: configDirectory,
    });
    const npmArguments = [
      "publish",
      tarballPath,
      "--tag",
      tag,
      "--access",
      "public",
      "--registry",
      registry,
    ];
    if (provenanceArgument === "--provenance") {
      npmArguments.push("--provenance");
    } else if (provenanceArgument) {
      throw new Error(`Unknown publish option: ${provenanceArgument}`);
    }

    execFileSync("npm", npmArguments, {
      env: { ...process.env, NPM_CONFIG_USERCONFIG: userConfig },
      stdio: "inherit",
    });
  } finally {
    rmSync(configDirectory, { force: true, recursive: true });
  }

  await waitForPublishedArtifact(registryOptions, localShasum);
  console.log(
    `Published and verified ${manifest.name}@${manifest.version} from ${basename(tarballPath)} at ${registry} sha1=${localShasum}`,
  );
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
