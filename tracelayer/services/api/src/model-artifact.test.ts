import { describe, expect, it } from 'vitest';
import { validateLiveModelArtifactJsonText } from './model-artifact.js';

const validArtifact = {
  title: 'Supply-chain risk summary',
  summary: 'Summarizes observable dependency risk from the user-provided task.',
  taskUnderstanding: 'Review package metadata and produce a concise markdown report.',
  artifactType: 'markdown_report',
  artifactMarkdown: '# Supply-chain risk summary\n\nNo private chain-of-thought is included.',
  memoryRefs: [
    {
      label: 'User task',
      summary: 'The user asked for a dependency risk summary.',
      sourceType: 'user_input',
    },
  ],
  replayNotes: ['Used only observable task input and generated output.'],
  riskNotes: ['Requires human review before operational use.'],
  chainOfThoughtIncluded: false,
};

describe('validateLiveModelArtifactJsonText', () => {
  it('accepts the Phase 5 model artifact schema and preserves exact submitted bytes', () => {
    const artifactJsonText = JSON.stringify(validArtifact, null, 2);

    const result = validateLiveModelArtifactJsonText(artifactJsonText);

    expect(result.artifact.title).toBe(validArtifact.title);
    expect(result.artifact.chainOfThoughtIncluded).toBe(false);
    expect(new TextDecoder().decode(result.bytes)).toBe(artifactJsonText);
    expect(result.bytes.byteLength).toBe(new TextEncoder().encode(artifactJsonText).byteLength);
  });

  it('rejects private chain-of-thought inclusion', () => {
    const artifactJsonText = JSON.stringify({ ...validArtifact, chainOfThoughtIncluded: true });

    expect(() => validateLiveModelArtifactJsonText(artifactJsonText)).toThrow('chainOfThoughtIncluded must be false');
  });

  it('rejects empty artifact markdown', () => {
    const artifactJsonText = JSON.stringify({ ...validArtifact, artifactMarkdown: '   ' });

    expect(() => validateLiveModelArtifactJsonText(artifactJsonText)).toThrow('artifactMarkdown is required');
  });

  it('rejects model-supplied public proof identifiers recursively', () => {
    const artifactJsonText = JSON.stringify({
      ...validArtifact,
      memoryRefs: [
        {
          label: 'Bad reference',
          summary: 'Tries to smuggle proof identifiers.',
          sourceType: 'tool_note',
          blobId: 'hD_YDFkdI8yTI0ZnRa_BEiEArOU8HY3SokY4T9Qg5sk',
        },
      ],
    });

    expect(() => validateLiveModelArtifactJsonText(artifactJsonText)).toThrow('model artifact must not include public proof identifier key blobId');
  });

  it('rejects secret-like keys recursively', () => {
    const artifactJsonText = JSON.stringify({
      ...validArtifact,
      riskNotes: ['No secrets should be present.'],
      provider: { apiKey: 'sk-test-value' },
    });

    expect(() => validateLiveModelArtifactJsonText(artifactJsonText)).toThrow('model artifact must not include secret-like key apiKey');
  });
});
