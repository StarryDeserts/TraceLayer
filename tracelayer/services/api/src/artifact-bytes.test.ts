import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createInMemoryArtifactByteStore,
  createPersistentArtifactByteStore,
  resolveDefaultArtifactBytesDirectory,
} from './artifact-bytes.js';

describe('createInMemoryArtifactByteStore', () => {
  it('round-trips bytes by artifactId and clears on delete', () => {
    const store = createInMemoryArtifactByteStore();
    const bytes = new TextEncoder().encode('hello');

    store.set('artifact_abc', bytes);
    expect(store.get('artifact_abc')).toEqual(bytes);

    store.delete('artifact_abc');
    expect(store.get('artifact_abc')).toBeUndefined();
  });
});

describe('createPersistentArtifactByteStore', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'tracelayer-bytes-'));
  });

  afterEach(() => {
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
  });

  it('writes a file when bytes are stored and reads it back through a fresh store', () => {
    const writer = createPersistentArtifactByteStore(directory);
    const bytes = new TextEncoder().encode('persistence');

    writer.set('artifact_xyz', bytes);
    expect(readFileSync(join(directory, 'artifact_xyz.bin'))).toEqual(Buffer.from(bytes));

    const reader = createPersistentArtifactByteStore(directory);
    const recovered = reader.get('artifact_xyz');
    expect(recovered).toBeDefined();
    expect(new TextDecoder().decode(recovered)).toBe('persistence');
  });

  it('returns undefined when no file exists yet for the artifact id', () => {
    const store = createPersistentArtifactByteStore(directory);
    expect(store.get('artifact_missing')).toBeUndefined();
  });

  it('deletes both the in-memory cache and the on-disk file', () => {
    const store = createPersistentArtifactByteStore(directory);
    const bytes = new TextEncoder().encode('disposable');

    store.set('artifact_keep', bytes);
    expect(existsSync(join(directory, 'artifact_keep.bin'))).toBe(true);

    store.delete('artifact_keep');
    expect(store.get('artifact_keep')).toBeUndefined();
    expect(existsSync(join(directory, 'artifact_keep.bin'))).toBe(false);
  });

  it('rejects artifact ids that could enable path traversal on set', () => {
    const store = createPersistentArtifactByteStore(directory);
    expect(() => store.set('../escape', new Uint8Array([1, 2, 3]))).toThrow(/artifactId must match pattern/);
    expect(() => store.set('artifact_../escape', new Uint8Array([1, 2, 3]))).toThrow(/artifactId must match pattern/);
  });

  it('returns undefined for unsafe artifact ids on get without throwing', () => {
    const store = createPersistentArtifactByteStore(directory);
    expect(store.get('../escape')).toBeUndefined();
    expect(store.get('artifact_../escape')).toBeUndefined();
  });

  it('tolerates delete for unknown or unsafe ids without throwing', () => {
    const store = createPersistentArtifactByteStore(directory);
    expect(() => store.delete('artifact_never_stored')).not.toThrow();
    expect(() => store.delete('../escape')).not.toThrow();
  });
});

describe('resolveDefaultArtifactBytesDirectory', () => {
  it('prefers TRACE_LAYER_ARTIFACT_BYTES_DIR when set', () => {
    expect(resolveDefaultArtifactBytesDirectory({ TRACE_LAYER_ARTIFACT_BYTES_DIR: '/tmp/custom-bytes' })).toBe('/tmp/custom-bytes');
  });

  it('falls back to <cwd>/data/artifact-bytes when env is unset or blank', () => {
    const fromUndefined = resolveDefaultArtifactBytesDirectory({});
    const fromBlank = resolveDefaultArtifactBytesDirectory({ TRACE_LAYER_ARTIFACT_BYTES_DIR: '   ' });
    expect(fromUndefined.endsWith(join('data', 'artifact-bytes'))).toBe(true);
    expect(fromBlank).toBe(fromUndefined);
  });
});
