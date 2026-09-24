#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registryPackageUrl } from './publish-package.mjs';

const REGISTRY = 'https://registry.npmjs.org';
const EXACT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const HELPERS = ['focusField', 'focusFieldWithin', 'focusFieldInvalid', 'focusRing', 'focusRingInset'];

export function verifyArtifact(metadata, name, version, bytes) {
  if (metadata?.name !== name || metadata?.version !== version) {
    throw new Error(`Registry identity does not match ${name}@${version}`);
  }
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (typeof metadata.dist?.integrity !== 'string' || !metadata.dist.integrity.split(/\s+/).includes(integrity)) {
    throw new Error(`SHA-512 integrity mismatch or missing integrity for ${name}@${version}`);
  }
  return { name, version, integrity };
}

export function verifyFocusHelpers(exports) {
  for (const name of HELPERS) {
    if (typeof exports[name] !== 'string' || !exports[name].trim()) {
      throw new Error(`Installed @tangle-network/ui/utils is missing ${name}`);
    }
  }
  return HELPERS;
}

async function download(name, version, directory) {
  if (!EXACT_VERSION.test(version)) throw new Error('Supply an exact package version, not a range or dist-tag');
  const url = `${registryPackageUrl(REGISTRY, name)}/${encodeURIComponent(version)}`;
  const metadataResponse = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!metadataResponse.ok) throw new Error(`${name}@${version}: registry HTTP ${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  const tarballUrl = new URL(metadata.dist?.tarball);
  if (tarballUrl.origin !== REGISTRY || tarballUrl.username || tarballUrl.password) {
    throw new Error('Dependency tarball must come from the public npm registry');
  }
  const response = await fetch(tarballUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`${name}@${version}: tarball HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) throw new Error('Dependency tarball exceeded the 64 MiB verification limit');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const proof = verifyArtifact(metadata, name, version, bytes);
  const path = join(directory, `${name.split('/').at(-1)}-${version}.tgz`);
  writeFileSync(path, bytes);
  const packed = JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' }));
  if (packed.name !== name || packed.version !== version) throw new Error('Verified tarball contains a different package identity');
  return { path, proof };
}

export async function runPreflight(brandVersion, uiVersion) {
  const directory = mkdtempSync(join(tmpdir(), 'tangle-focus-preflight-'));
  try {
    const brand = await download('@tangle-network/brand', brandVersion, directory);
    const ui = await download('@tangle-network/ui', uiVersion, directory);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'focus-preflight', private: true, type: 'module' }));
    const config = join(directory, '.npmrc');
    writeFileSync(config, `registry=${REGISTRY}\n@tangle-network:registry=${REGISTRY}\nignore-scripts=true\n`);
    execFileSync('npm', ['install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund',
      brand.path, ui.path], {
      cwd: directory,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: config, NPM_CONFIG_REGISTRY: REGISTRY },
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 300000,
    });
    const require = createRequire(join(directory, 'package.json'));
    const exports = await import(pathToFileURL(require.resolve('@tangle-network/ui/utils')).href);
    const helpers = verifyFocusHelpers(exports);
    for (const expected of [brand.proof, ui.proof]) {
      const installed = JSON.parse(readFileSync(join(directory, 'node_modules', ...expected.name.split('/'), 'package.json'), 'utf8'));
      if (installed.version !== expected.version) throw new Error(`Installed ${expected.name} resolution changed`);
    }
    return { schemaVersion: 1, checkedAt: new Date().toISOString(), registry: REGISTRY,
      packages: [brand.proof, ui.proof], installedFocusHelpers: helpers,
      scope: 'Registry bytes and clean installed exports; not rendered focus or published sandbox-ui proof' };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [brandVersion, uiVersion] = process.argv.slice(2);
    if (!brandVersion || !uiVersion || process.argv.length !== 4) {
      throw new Error('Usage: node scripts/verify-focus-dependencies.mjs <exact-brand-version> <exact-ui-version>');
    }
    console.log(JSON.stringify(await runPreflight(brandVersion, uiVersion), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Focus dependency preflight failed');
    process.exitCode = 1;
  }
}
