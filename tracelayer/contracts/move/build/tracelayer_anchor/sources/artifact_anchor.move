module tracelayer_anchor::artifact_anchor;

use sui::event;

const E_RUN_ID_TOO_LONG: u64 = 1;
const E_BLOB_ID_TOO_LONG: u64 = 2;
const E_ARTIFACT_HASH_LENGTH: u64 = 3;
const E_ARTIFACT_TYPE_TOO_LONG: u64 = 4;

const MAX_RUN_ID_BYTES: u64 = 64;
const MAX_BLOB_ID_BYTES: u64 = 256;
const ARTIFACT_HASH_BYTES: u64 = 32;
const MAX_ARTIFACT_TYPE_BYTES: u64 = 32;
const SCHEMA_VERSION: u64 = 1;

public struct ArtifactAnchor has key {
    id: UID,
    owner: address,
    run_id: vector<u8>,
    blob_id: vector<u8>,
    artifact_hash: vector<u8>,
    artifact_type: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}

public struct ArtifactAnchored has copy, drop {
    anchor_id: ID,
    owner: address,
    run_id: vector<u8>,
    blob_id: vector<u8>,
    artifact_hash: vector<u8>,
    artifact_type: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}

public entry fun anchor_artifact(
    run_id: vector<u8>,
    blob_id: vector<u8>,
    artifact_hash: vector<u8>,
    artifact_type: vector<u8>,
    created_at_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(vector::length(&run_id) <= MAX_RUN_ID_BYTES, E_RUN_ID_TOO_LONG);
    assert!(vector::length(&blob_id) <= MAX_BLOB_ID_BYTES, E_BLOB_ID_TOO_LONG);
    assert!(vector::length(&artifact_hash) == ARTIFACT_HASH_BYTES, E_ARTIFACT_HASH_LENGTH);
    assert!(vector::length(&artifact_type) <= MAX_ARTIFACT_TYPE_BYTES, E_ARTIFACT_TYPE_TOO_LONG);

    let owner = tx_context::sender(ctx);
    let anchor = ArtifactAnchor {
        id: object::new(ctx),
        owner,
        run_id,
        blob_id,
        artifact_hash,
        artifact_type,
        created_at_ms,
        schema_version: SCHEMA_VERSION,
    };

    event::emit(ArtifactAnchored {
        anchor_id: object::id(&anchor),
        owner,
        run_id: anchor.run_id,
        blob_id: anchor.blob_id,
        artifact_hash: anchor.artifact_hash,
        artifact_type: anchor.artifact_type,
        created_at_ms: anchor.created_at_ms,
        schema_version: anchor.schema_version,
    });

    transfer::transfer(anchor, owner);
}
