import { describe, expect, it } from 'vitest';
import { parseModelArtifactOutput } from './model-artifact.js';

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

describe('model artifact parsing', () => {
  it('parses valid artifact JSON and returns canonical JSON text', () => {
    const result = parseModelArtifactOutput(JSON.stringify(validArtifact));

    expect(result.artifact.title).toBe(validArtifact.title);
    expect(result.artifact.chainOfThoughtIncluded).toBe(false);
    expect(JSON.parse(result.artifactJsonText)).toEqual(validArtifact);
  });

  it('parses fenced JSON output', () => {
    const result = parseModelArtifactOutput('```json\n' + JSON.stringify(validArtifact) + '\n```');

    expect(result.artifact.artifactMarkdown).toContain('Supply-chain risk');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseModelArtifactOutput('{not json')).toThrow('model output must be valid JSON');
  });

  it('rejects missing markdown and private chain-of-thought flags', () => {
    expect(() => parseModelArtifactOutput(JSON.stringify({ ...validArtifact, artifactMarkdown: '' }))).toThrow('artifactMarkdown is required');
    expect(() => parseModelArtifactOutput(JSON.stringify({ ...validArtifact, chainOfThoughtIncluded: true }))).toThrow('chainOfThoughtIncluded must be false');
  });

  it('rejects model-supplied proof identifiers and secret-like keys', () => {
    expect(() => parseModelArtifactOutput(JSON.stringify({ ...validArtifact, anchorTxDigest: '8saULAKLqh3nixQFm8aszUyQA5LW1XiYQCWdaav6oLWJ' }))).toThrow('model artifact must not include public proof identifier key anchorTxDigest');
    expect(() => parseModelArtifactOutput(JSON.stringify({ ...validArtifact, provider: { token: 'not-a-real-token' } }))).toThrow('model artifact must not include secret-like key token');
  });
});
