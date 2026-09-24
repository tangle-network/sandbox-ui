// @vitest-environment node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { verifyArtifact, verifyFocusHelpers } from './verify-focus-dependencies.mjs';

const bytes = Buffer.from('verified package bytes');
const metadata = { name: '@tangle-network/ui', version: '11.10.0', dist: {
  integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
} };

test('accepts exactly matching package bytes and identity', () => {
  assert.equal(verifyArtifact(metadata, metadata.name, metadata.version, bytes).integrity, metadata.dist.integrity);
});
test('rejects a changed package name, version, or downloaded byte', () => {
  assert.throws(() => verifyArtifact(metadata, '@tangle-network/brand', metadata.version, bytes));
  assert.throws(() => verifyArtifact(metadata, metadata.name, '11.9.0', bytes));
  assert.throws(() => verifyArtifact(metadata, metadata.name, metadata.version, Buffer.from('different')));
});
test('requires registry SHA-512 integrity rather than trusting visibility', () => {
  assert.throws(() => verifyArtifact({ ...metadata, dist: {} }, metadata.name, metadata.version, bytes));
});
test('checks every installed focus helper', () => {
  const exports = Object.fromEntries(['focusField', 'focusFieldWithin', 'focusFieldInvalid', 'focusRing', 'focusRingInset'].map((name) => [name, 'focus-visible:outline']));
  assert.equal(verifyFocusHelpers(exports).length, 5);
  for (const name of Object.keys(exports)) {
    assert.throws(() => verifyFocusHelpers({ ...exports, [name]: undefined }));
    assert.throws(() => verifyFocusHelpers({ ...exports, [name]: '' }));
  }
});
