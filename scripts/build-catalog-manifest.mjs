import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] ?? 'storybook-static');
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error('Catalog requires a full source revision');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const mappings = JSON.parse(readFileSync('.storybook/critical-components.json', 'utf8'));
if (!Array.isArray(mappings) || mappings.length === 0) throw new Error('Critical component mapping is missing or empty');
const indexBytes = readFileSync(resolve(output, 'index.json'));
const index = JSON.parse(indexBytes.toString('utf8'));
const stories = Object.values(index.entries ?? {}).filter((entry) => entry.type === 'story');
if (stories.length === 0) throw new Error('The built Storybook index contains no stories');
const seen = new Set();
const critical = mappings.map((mapping) => {
  if (seen.has(mapping.component)) throw new Error(`Duplicate critical component: ${mapping.component}`);
  seen.add(mapping.component);
  for (const key of ['component', 'source', 'storyFile', 'task']) {
    if (typeof mapping[key] !== 'string' || !mapping[key]) throw new Error(`Critical mapping lacks ${key}`);
  }
  if (!existsSync(mapping.source) || !existsSync(mapping.storyFile)) {
    throw new Error(`Critical source or story file is missing: ${mapping.component}`);
  }
  const states = stories.filter((entry) => entry.importPath?.replace(/^\.\//, '') === mapping.storyFile);
  if (states.length === 0) throw new Error(`No built states found for ${mapping.component}`);
  return { ...mapping, states: states.map(({ id, title, name }) => ({ id, title, name })) };
});
const manifest = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY ?? pkg.repository?.url ?? null,
  sourceSha,
  package: { name: pkg.name, version: pkg.version },
  indexSha256: createHash('sha256').update(indexBytes).digest('hex'),
  builtStoryCount: stories.length,
  critical,
  scope: 'Built component fixtures. Not product-flow, deployment, approval, or WCAG conformance evidence.',
};
writeFileSync(resolve(output, 'catalog-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Attested ${stories.length} stories and ${critical.length} critical components at ${sourceSha}`);
