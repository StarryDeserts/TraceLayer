import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { assembleReplayContext } from '@tracelayer/proof';
import type { AgentRun, ArtifactRef, DelegateEvent, MemoryRef, ProofEvent, ReplayContext } from '@tracelayer/types';

export type TraceLayerDb = DatabaseSync;

type Row = Record<string, unknown>;

const json = {
  parse<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string' || value.length === 0) return fallback;
    return JSON.parse(value) as T;
  },
  stringify(value: unknown): string {
    return JSON.stringify(value);
  },
};

export function openTraceLayerDb(path = resolve(process.cwd(), 'data', 'tracelayer.sqlite')): TraceLayerDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function createInMemoryTraceLayerDb(): TraceLayerDb {
  return openTraceLayerDb(':memory:');
}

export function initializeSchema(db: TraceLayerDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      run_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_version TEXT,
      owner_address TEXT NOT NULL,
      status TEXT NOT NULL,
      task_summary TEXT NOT NULL,
      input_preview TEXT NOT NULL,
      input_hash_sha256 TEXT,
      output_summary TEXT,
      artifact_manifest_hash_sha256 TEXT,
      previous_run_ids_json TEXT NOT NULL,
      started_at_ms INTEGER NOT NULL,
      completed_at_ms INTEGER,
      walrus_network TEXT NOT NULL,
      sui_network TEXT NOT NULL,
      error_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(run_id),
      owner_address TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      blob_id TEXT,
      blob_object_id TEXT,
      walrus_network TEXT NOT NULL,
      epochs INTEGER,
      deletable INTEGER,
      state TEXT NOT NULL,
      upload_status TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      anchor_mode TEXT,
      signer_address TEXT,
      claimed_owner_address TEXT,
      on_chain_owner_address TEXT,
      service_signed INTEGER,
      anchor_object_id TEXT,
      anchor_tx_digest TEXT,
      raw_walrus_response_json TEXT,
      text_preview TEXT,
      created_at_ms INTEGER NOT NULL,
      uploaded_at_ms INTEGER,
      verified_at_ms INTEGER,
      anchored_at_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS proof_events (
      proof_event_id TEXT PRIMARY KEY,
      correlation_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      run_id TEXT,
      artifact_id TEXT,
      delegate_event_id TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      anchor_mode TEXT,
      signer_address TEXT,
      claimed_owner_address TEXT,
      on_chain_owner_address TEXT,
      dry_run INTEGER,
      recorded INTEGER,
      summary TEXT NOT NULL,
      walrus_blob_id TEXT,
      sui_object_id TEXT,
      sui_tx_digest TEXT UNIQUE,
      hash_sha256 TEXT,
      metadata_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_refs (
      memory_ref_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(run_id),
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      ref_uri TEXT,
      ref_hash_sha256 TEXT,
      access_level TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegate_events (
      delegate_event_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      run_id TEXT,
      artifact_id TEXT,
      owner_address TEXT NOT NULL,
      delegate_address TEXT NOT NULL,
      action TEXT NOT NULL,
      scope TEXT NOT NULL,
      policy_hash_sha256 TEXT,
      receipt_tx_digest TEXT,
      receipt_object_id TEXT,
      status TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );
  `);
  addColumnIfMissing(db, 'artifacts', 'raw_walrus_response_json', 'TEXT');
  addColumnIfMissing(db, 'artifacts', 'text_preview', 'TEXT');
}

export function insertAgentRun(db: TraceLayerDb, run: AgentRun): AgentRun {
  db.prepare(`
    INSERT INTO agent_runs (
      run_id, project_id, agent_id, agent_version, owner_address, status, task_summary, input_preview,
      input_hash_sha256, output_summary, artifact_manifest_hash_sha256, previous_run_ids_json,
      started_at_ms, completed_at_ms, walrus_network, sui_network, error_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.runId,
    run.projectId,
    run.agentId,
    run.agentVersion ?? null,
    run.ownerAddress,
    run.status,
    run.taskSummary,
    run.inputPreview,
    run.inputHashSha256 ?? null,
    run.outputSummary ?? null,
    run.artifactManifestHashSha256 ?? null,
    json.stringify(run.previousRunIds),
    run.startedAtMs,
    run.completedAtMs ?? null,
    run.walrusNetwork,
    run.suiNetwork,
    run.errorSummary ?? null,
  );
  return run;
}

export function listAgentRuns(db: TraceLayerDb): AgentRun[] {
  return db.prepare('SELECT * FROM agent_runs ORDER BY started_at_ms DESC').all().map(agentRunFromRow);
}

export function getAgentRun(db: TraceLayerDb, runId: string): AgentRun | undefined {
  const row = db.prepare('SELECT * FROM agent_runs WHERE run_id = ?').get(runId);
  return row ? agentRunFromRow(row as Row) : undefined;
}

export function insertArtifact(db: TraceLayerDb, artifact: ArtifactRef): ArtifactRef {
  db.prepare(`
    INSERT INTO artifacts (
      artifact_id, run_id, owner_address, artifact_type, content_type, byte_length, sha256, blob_id,
      blob_object_id, walrus_network, epochs, deletable, state, upload_status, verification_status,
      anchor_mode, signer_address, claimed_owner_address, on_chain_owner_address, service_signed,
      anchor_object_id, anchor_tx_digest, raw_walrus_response_json, text_preview, created_at_ms, uploaded_at_ms, verified_at_ms, anchored_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artifact.artifactId,
    artifact.runId,
    artifact.ownerAddress,
    artifact.artifactType,
    artifact.contentType,
    artifact.byteLength,
    artifact.sha256,
    artifact.blobId ?? null,
    artifact.blobObjectId ?? null,
    artifact.walrusNetwork,
    artifact.epochs ?? null,
    boolToDb(artifact.deletable),
    artifact.state,
    artifact.uploadStatus,
    artifact.verificationStatus,
    artifact.anchorMode ?? null,
    artifact.signerAddress ?? null,
    artifact.claimedOwnerAddress ?? null,
    artifact.onChainOwnerAddress ?? null,
    boolToDb(artifact.serviceSigned),
    artifact.anchorObjectId ?? null,
    artifact.anchorTxDigest ?? null,
    artifact.rawWalrusResponse === undefined ? null : json.stringify(artifact.rawWalrusResponse),
    artifact.textPreview ?? null,
    artifact.createdAtMs,
    artifact.uploadedAtMs ?? null,
    artifact.verifiedAtMs ?? null,
    artifact.anchoredAtMs ?? null,
  );
  return artifact;
}

export function listArtifacts(db: TraceLayerDb, runId?: string): ArtifactRef[] {
  const statement = runId
    ? db.prepare('SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at_ms ASC')
    : db.prepare('SELECT * FROM artifacts ORDER BY created_at_ms ASC');
  const rows = runId ? statement.all(runId) : statement.all();
  return rows.map(artifactFromRow);
}

export function getArtifact(db: TraceLayerDb, artifactId: string): ArtifactRef | undefined {
  const row = db.prepare('SELECT * FROM artifacts WHERE artifact_id = ?').get(artifactId);
  return row ? artifactFromRow(row as Row) : undefined;
}

export function updateArtifactUpload(
  db: TraceLayerDb,
  artifactId: string,
  update: Pick<ArtifactRef, 'state' | 'uploadStatus' | 'walrusNetwork'> &
    Partial<Pick<ArtifactRef, 'blobId' | 'blobObjectId' | 'epochs' | 'deletable' | 'rawWalrusResponse' | 'uploadedAtMs'>>,
): ArtifactRef {
  db.prepare(`
    UPDATE artifacts
    SET state = ?, upload_status = ?, blob_id = ?, blob_object_id = ?, walrus_network = ?, epochs = ?, deletable = ?, raw_walrus_response_json = ?, uploaded_at_ms = ?
    WHERE artifact_id = ?
  `).run(
    update.state,
    update.uploadStatus,
    update.blobId ?? null,
    update.blobObjectId ?? null,
    update.walrusNetwork,
    update.epochs ?? null,
    boolToDb(update.deletable),
    update.rawWalrusResponse === undefined ? null : json.stringify(update.rawWalrusResponse),
    update.uploadedAtMs ?? null,
    artifactId,
  );
  return requireArtifact(db, artifactId);
}

export function updateArtifactVerification(
  db: TraceLayerDb,
  artifactId: string,
  update: Pick<ArtifactRef, 'state' | 'verificationStatus'> & Partial<Pick<ArtifactRef, 'verifiedAtMs' | 'rawWalrusResponse'>>,
): ArtifactRef {
  db.prepare('UPDATE artifacts SET state = ?, verification_status = ?, raw_walrus_response_json = COALESCE(?, raw_walrus_response_json), verified_at_ms = ? WHERE artifact_id = ?').run(
    update.state,
    update.verificationStatus,
    update.rawWalrusResponse === undefined ? null : json.stringify(update.rawWalrusResponse),
    update.verifiedAtMs ?? null,
    artifactId,
  );
  return requireArtifact(db, artifactId);
}

export function updateArtifactPreview(db: TraceLayerDb, artifactId: string, textPreview: string): ArtifactRef {
  db.prepare('UPDATE artifacts SET text_preview = ? WHERE artifact_id = ?').run(textPreview, artifactId);
  return requireArtifact(db, artifactId);
}

export function updateArtifactAnchor(
  db: TraceLayerDb,
  artifactId: string,
  update: Pick<ArtifactRef, 'state'> &
    Partial<Pick<ArtifactRef, 'anchorMode' | 'signerAddress' | 'claimedOwnerAddress' | 'onChainOwnerAddress' | 'serviceSigned' | 'anchorObjectId' | 'anchorTxDigest' | 'anchoredAtMs'>>,
): ArtifactRef {
  db.prepare(`
    UPDATE artifacts
    SET state = ?,
      anchor_mode = COALESCE(?, anchor_mode),
      signer_address = COALESCE(?, signer_address),
      claimed_owner_address = COALESCE(?, claimed_owner_address),
      on_chain_owner_address = COALESCE(?, on_chain_owner_address),
      service_signed = COALESCE(?, service_signed),
      anchor_object_id = COALESCE(?, anchor_object_id),
      anchor_tx_digest = COALESCE(?, anchor_tx_digest),
      anchored_at_ms = COALESCE(?, anchored_at_ms)
    WHERE artifact_id = ?
  `).run(
    update.state,
    update.anchorMode ?? null,
    update.signerAddress ?? null,
    update.claimedOwnerAddress ?? null,
    update.onChainOwnerAddress ?? null,
    boolToDb(update.serviceSigned),
    update.anchorObjectId ?? null,
    update.anchorTxDigest ?? null,
    update.anchoredAtMs ?? null,
    artifactId,
  );
  return requireArtifact(db, artifactId);
}

export function insertProofEvent(db: TraceLayerDb, event: ProofEvent): ProofEvent {
  db.prepare(`
    INSERT INTO proof_events (
      proof_event_id, correlation_id, project_id, run_id, artifact_id, delegate_event_id, type, status,
      mode, anchor_mode, signer_address, claimed_owner_address, on_chain_owner_address, dry_run,
      recorded, summary, walrus_blob_id, sui_object_id, sui_tx_digest, hash_sha256, metadata_json,
      created_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.proofEventId,
    event.correlationId,
    event.projectId,
    event.runId ?? null,
    event.artifactId ?? null,
    event.delegateEventId ?? null,
    event.type,
    event.status,
    event.mode,
    event.anchorMode ?? null,
    event.signerAddress ?? null,
    event.claimedOwnerAddress ?? null,
    event.onChainOwnerAddress ?? null,
    boolToDb(event.dryRun),
    boolToDb(event.recorded),
    event.summary,
    event.walrusBlobId ?? null,
    event.suiObjectId ?? null,
    event.suiTxDigest ?? null,
    event.hashSha256 ?? null,
    json.stringify(event.metadata),
    event.createdAtMs,
  );
  return event;
}

export function listProofEvents(db: TraceLayerDb, filters: { runId?: string; artifactId?: string } = {}): ProofEvent[] {
  if (filters.runId !== undefined) {
    return db.prepare('SELECT * FROM proof_events WHERE run_id = ? ORDER BY created_at_ms ASC').all(filters.runId).map(proofEventFromRow);
  }
  if (filters.artifactId !== undefined) {
    return db.prepare('SELECT * FROM proof_events WHERE artifact_id = ? ORDER BY created_at_ms ASC').all(filters.artifactId).map(proofEventFromRow);
  }
  return db.prepare('SELECT * FROM proof_events ORDER BY created_at_ms ASC').all().map(proofEventFromRow);
}

export function insertMemoryRef(db: TraceLayerDb, memoryRef: MemoryRef): MemoryRef {
  db.prepare(`
    INSERT INTO memory_refs (memory_ref_id, run_id, provider, label, description, ref_uri, ref_hash_sha256, access_level, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    memoryRef.memoryRefId,
    memoryRef.runId,
    memoryRef.provider,
    memoryRef.label,
    memoryRef.description ?? null,
    memoryRef.refUri ?? null,
    memoryRef.refHashSha256 ?? null,
    memoryRef.accessLevel,
    memoryRef.createdAtMs,
  );
  return memoryRef;
}

export function listMemoryRefs(db: TraceLayerDb, runId: string): MemoryRef[] {
  return db.prepare('SELECT * FROM memory_refs WHERE run_id = ? ORDER BY created_at_ms ASC').all(runId).map(memoryRefFromRow);
}

export function insertDelegateEvent(db: TraceLayerDb, event: DelegateEvent): DelegateEvent {
  db.prepare(`
    INSERT INTO delegate_events (delegate_event_id, project_id, run_id, artifact_id, owner_address, delegate_address, action, scope, policy_hash_sha256, receipt_tx_digest, receipt_object_id, status, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.delegateEventId,
    event.projectId,
    event.runId ?? null,
    event.artifactId ?? null,
    event.ownerAddress,
    event.delegateAddress,
    event.action,
    event.scope,
    event.policyHashSha256 ?? null,
    event.receiptTxDigest ?? null,
    event.receiptObjectId ?? null,
    event.status,
    event.createdAtMs,
  );
  return event;
}

export function assembleReplayData(db: TraceLayerDb, runId: string): ReplayContext {
  const run = getAgentRun(db, runId);
  if (run === undefined) throw new Error(`run not found: ${runId}`);
  return assembleReplayContext({
    runId,
    taskInputPreview: run.inputPreview,
    ...(run.inputHashSha256 ? { inputHashSha256: run.inputHashSha256 } : {}),
    previousRunIds: run.previousRunIds,
    memoryRefs: listMemoryRefs(db, runId),
    artifactRefs: listArtifacts(db, runId),
    proofEvents: listProofEvents(db, { runId }),
  });
}

function requireArtifact(db: TraceLayerDb, artifactId: string): ArtifactRef {
  const artifact = getArtifact(db, artifactId);
  if (artifact === undefined) throw new Error(`artifact not found: ${artifactId}`);
  return artifact;
}

function addColumnIfMissing(db: TraceLayerDb, table: string, column: string, type: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column/i.test(error.message)) throw error;
  }
}

function agentRunFromRow(row: Row): AgentRun {
  return omitUndefined<AgentRun>({
    runId: string(row.run_id),
    projectId: string(row.project_id),
    agentId: string(row.agent_id),
    agentVersion: optionalString(row.agent_version),
    ownerAddress: string(row.owner_address),
    status: string(row.status) as AgentRun['status'],
    taskSummary: string(row.task_summary),
    inputPreview: string(row.input_preview),
    inputHashSha256: optionalString(row.input_hash_sha256),
    outputSummary: optionalString(row.output_summary),
    artifactManifestHashSha256: optionalString(row.artifact_manifest_hash_sha256),
    previousRunIds: json.parse<string[]>(row.previous_run_ids_json, []),
    startedAtMs: number(row.started_at_ms),
    completedAtMs: optionalNumber(row.completed_at_ms),
    walrusNetwork: string(row.walrus_network),
    suiNetwork: string(row.sui_network),
    errorSummary: optionalString(row.error_summary),
  });
}

function artifactFromRow(row: Row): ArtifactRef {
  return omitUndefined<ArtifactRef>({
    artifactId: string(row.artifact_id),
    runId: string(row.run_id),
    ownerAddress: string(row.owner_address),
    artifactType: string(row.artifact_type) as ArtifactRef['artifactType'],
    contentType: string(row.content_type),
    byteLength: number(row.byte_length),
    sha256: string(row.sha256),
    blobId: optionalString(row.blob_id),
    blobObjectId: optionalString(row.blob_object_id),
    walrusNetwork: string(row.walrus_network),
    epochs: optionalNumber(row.epochs),
    deletable: optionalBool(row.deletable),
    state: string(row.state) as ArtifactRef['state'],
    uploadStatus: string(row.upload_status) as ArtifactRef['uploadStatus'],
    verificationStatus: string(row.verification_status) as ArtifactRef['verificationStatus'],
    anchorMode: optionalString(row.anchor_mode) as ArtifactRef['anchorMode'],
    signerAddress: optionalString(row.signer_address),
    claimedOwnerAddress: optionalString(row.claimed_owner_address),
    onChainOwnerAddress: optionalString(row.on_chain_owner_address),
    serviceSigned: optionalBool(row.service_signed),
    anchorObjectId: optionalString(row.anchor_object_id),
    anchorTxDigest: optionalString(row.anchor_tx_digest),
    rawWalrusResponse: json.parse<ArtifactRef['rawWalrusResponse']>(row.raw_walrus_response_json, undefined),
    textPreview: optionalString(row.text_preview),
    createdAtMs: number(row.created_at_ms),
    uploadedAtMs: optionalNumber(row.uploaded_at_ms),
    verifiedAtMs: optionalNumber(row.verified_at_ms),
    anchoredAtMs: optionalNumber(row.anchored_at_ms),
  });
}

function proofEventFromRow(row: Row): ProofEvent {
  return omitUndefined<ProofEvent>({
    proofEventId: string(row.proof_event_id),
    correlationId: string(row.correlation_id),
    projectId: string(row.project_id),
    runId: optionalString(row.run_id),
    artifactId: optionalString(row.artifact_id),
    delegateEventId: optionalString(row.delegate_event_id),
    type: string(row.type) as ProofEvent['type'],
    status: string(row.status) as ProofEvent['status'],
    mode: string(row.mode) as ProofEvent['mode'],
    anchorMode: optionalString(row.anchor_mode) as ProofEvent['anchorMode'],
    signerAddress: optionalString(row.signer_address),
    claimedOwnerAddress: optionalString(row.claimed_owner_address),
    onChainOwnerAddress: optionalString(row.on_chain_owner_address),
    dryRun: optionalBool(row.dry_run),
    recorded: optionalBool(row.recorded),
    summary: string(row.summary),
    walrusBlobId: optionalString(row.walrus_blob_id),
    suiObjectId: optionalString(row.sui_object_id),
    suiTxDigest: optionalString(row.sui_tx_digest),
    hashSha256: optionalString(row.hash_sha256),
    metadata: json.parse<ProofEvent['metadata']>(row.metadata_json, {}),
    createdAtMs: number(row.created_at_ms),
  });
}

function memoryRefFromRow(row: Row): MemoryRef {
  return omitUndefined<MemoryRef>({
    memoryRefId: string(row.memory_ref_id),
    runId: string(row.run_id),
    provider: string(row.provider) as MemoryRef['provider'],
    label: string(row.label),
    description: optionalString(row.description),
    refUri: optionalString(row.ref_uri),
    refHashSha256: optionalString(row.ref_hash_sha256),
    accessLevel: string(row.access_level) as MemoryRef['accessLevel'],
    createdAtMs: number(row.created_at_ms),
  });
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('expected string database value');
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function number(value: unknown): number {
  if (typeof value !== 'number') throw new Error('expected number database value');
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function boolToDb(value: boolean | undefined): number | null {
  return value === undefined ? null : value ? 1 : 0;
}

function optionalBool(value: unknown): boolean | undefined {
  return typeof value === 'number' ? value === 1 : undefined;
}

function omitUndefined<T>(value: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
