export type LiveModelArtifact = {
  title: string;
  summary: string;
  taskUnderstanding: string;
  artifactType: 'markdown_report';
  artifactMarkdown: string;
  memoryRefs: LiveModelMemoryRef[];
  replayNotes: string[];
  riskNotes: string[];
  chainOfThoughtIncluded: false;
};

export type LiveModelMemoryRef = {
  label: string;
  summary: string;
  sourceType: 'user_input' | 'session_context' | 'tool_note';
};

export type ValidatedLiveModelArtifact = {
  artifact: LiveModelArtifact;
  bytes: Uint8Array;
};

const maxArtifactBytes = 128 * 1024;
const proofIdentifierKeys = new Set([
  'blobId',
  'blobObjectId',
  'txDigest',
  'anchorTxDigest',
  'anchorObjectId',
  'proofEventId',
  'correlationId',
  'runId',
  'artifactId',
  'onChainOwnerAddress',
  'signerAddress',
  'walrusBlobId',
  'suiTxDigest',
  'suiObjectId',
]);
const secretLikeKeys = new Set(['apiKey', 'authorization', 'password', 'secret', 'token', 'providerKey']);
const memoryRefSourceTypes = new Set(['user_input', 'session_context', 'tool_note']);

export function validateLiveModelArtifactJsonText(artifactJsonText: string): ValidatedLiveModelArtifact {
  const bytes = new TextEncoder().encode(artifactJsonText);
  if (bytes.byteLength > maxArtifactBytes) throw new Error('model artifact exceeds maximum size');

  const parsed = parseJsonObject(artifactJsonText);
  assertNoForbiddenKeys(parsed);
  const artifact = toLiveModelArtifact(parsed);
  return { artifact, bytes };
}

function parseJsonObject(artifactJsonText: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(artifactJsonText);
  } catch {
    throw new Error('model artifact must be valid JSON');
  }
  if (!isRecord(parsed)) throw new Error('model artifact must be a JSON object');
  return parsed;
}

function toLiveModelArtifact(value: Record<string, unknown>): LiveModelArtifact {
  const artifactType = requiredString(value.artifactType, 'artifactType');
  if (artifactType !== 'markdown_report') throw new Error('artifactType must be markdown_report');
  if (value.chainOfThoughtIncluded !== false) throw new Error('chainOfThoughtIncluded must be false');

  return {
    title: requiredString(value.title, 'title'),
    summary: requiredString(value.summary, 'summary'),
    taskUnderstanding: requiredString(value.taskUnderstanding, 'taskUnderstanding'),
    artifactType,
    artifactMarkdown: requiredString(value.artifactMarkdown, 'artifactMarkdown'),
    memoryRefs: requiredMemoryRefs(value.memoryRefs),
    replayNotes: requiredStringArray(value.replayNotes, 'replayNotes'),
    riskNotes: requiredStringArray(value.riskNotes, 'riskNotes'),
    chainOfThoughtIncluded: false,
  };
}

function requiredMemoryRefs(value: unknown): LiveModelMemoryRef[] {
  if (!Array.isArray(value)) throw new Error('memoryRefs must be an array');
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`memoryRefs[${index}] must be an object`);
    const sourceType = requiredString(entry.sourceType, `memoryRefs[${index}].sourceType`);
    if (!memoryRefSourceTypes.has(sourceType)) throw new Error(`memoryRefs[${index}].sourceType is invalid`);
    return {
      label: requiredString(entry.label, `memoryRefs[${index}].label`),
      summary: requiredString(entry.summary, `memoryRefs[${index}].summary`),
      sourceType: sourceType as LiveModelMemoryRef['sourceType'],
    };
  });
}

function requiredStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((entry, index) => requiredString(entry, `${name}[${index}]`));
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertNoForbiddenKeys(entry);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (proofIdentifierKeys.has(key)) throw new Error(`model artifact must not include public proof identifier key ${key}`);
    if (secretLikeKeys.has(key)) throw new Error(`model artifact must not include secret-like key ${key}`);
    assertNoForbiddenKeys(entry);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
