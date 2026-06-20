import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const artifactIdPattern = /^artifact_[A-Za-z0-9_-]{1,128}$/;

export type ArtifactByteStore = {
  set(artifactId: string, bytes: Uint8Array): void;
  get(artifactId: string): Uint8Array | undefined;
  delete(artifactId: string): void;
};

export function createInMemoryArtifactByteStore(): ArtifactByteStore {
  const memory = new Map<string, Uint8Array>();
  return {
    set(artifactId, bytes) {
      memory.set(artifactId, bytes);
    },
    get(artifactId) {
      return memory.get(artifactId);
    },
    delete(artifactId) {
      memory.delete(artifactId);
    },
  };
}

export function createPersistentArtifactByteStore(directory: string): ArtifactByteStore {
  mkdirSync(directory, { recursive: true });
  const memory = new Map<string, Uint8Array>();
  return {
    set(artifactId, bytes) {
      assertSafeArtifactId(artifactId);
      memory.set(artifactId, bytes);
      writeFileSync(resolveArtifactPath(directory, artifactId), bytes);
    },
    get(artifactId) {
      const cached = memory.get(artifactId);
      if (cached !== undefined) return cached;
      if (!isSafeArtifactId(artifactId)) return undefined;
      const path = resolveArtifactPath(directory, artifactId);
      if (!existsSync(path)) return undefined;
      const bytes = readFileSync(path);
      memory.set(artifactId, bytes);
      return bytes;
    },
    delete(artifactId) {
      memory.delete(artifactId);
      if (!isSafeArtifactId(artifactId)) return;
      const path = resolveArtifactPath(directory, artifactId);
      if (existsSync(path)) rmSync(path);
    },
  };
}

export function resolveDefaultArtifactBytesDirectory(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.TRACE_LAYER_ARTIFACT_BYTES_DIR;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv;
  return resolve(process.cwd(), 'data', 'artifact-bytes');
}

function resolveArtifactPath(directory: string, artifactId: string): string {
  return resolve(directory, `${artifactId}.bin`);
}

function isSafeArtifactId(artifactId: string): boolean {
  return artifactIdPattern.test(artifactId);
}

function assertSafeArtifactId(artifactId: string): void {
  if (!isSafeArtifactId(artifactId)) throw new Error('artifactId must match pattern artifact_[A-Za-z0-9_-]{1,128}');
}
