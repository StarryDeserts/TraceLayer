import { describe, expect, it } from 'vitest';
import { formatJsonForCodeBlock, jsonCopyText, tokenizeJson } from './JsonCodeBlock.helpers.js';

describe('JsonCodeBlock helpers', () => {
  it('pretty-prints valid JSON strings with two-space indentation', () => {
    const result = formatJsonForCodeBlock('{"title":"TraceLayer","ok":true,"count":2}');

    expect(result).toBe([
      '{',
      '  "title": "TraceLayer",',
      '  "ok": true,',
      '  "count": 2',
      '}',
    ].join('\n'));
  });

  it('pretty-prints JSON-compatible values', () => {
    const result = formatJsonForCodeBlock({ nested: { value: null }, list: [1, false] });

    expect(result).toBe([
      '{',
      '  "nested": {',
      '    "value": null',
      '  },',
      '  "list": [',
      '    1,',
      '    false',
      '  ]',
      '}',
    ].join('\n'));
  });

  it('uses the displayed JSON text as copy text', () => {
    const value = '{"runId":"run_phase_6_1","chainOfThoughtIncluded":false}';

    expect(jsonCopyText(value)).toBe(formatJsonForCodeBlock(value));
  });

  it('tokenizes keys, strings, numbers, booleans, null, and punctuation', () => {
    const tokens = tokenizeJson('{\n  "key": "value",\n  "n": 12,\n  "flag": false,\n  "empty": null\n}');

    expect(tokens.map((token) => token.kind)).toEqual([
      'punctuation', 'whitespace',
      'key', 'punctuation', 'whitespace', 'string', 'punctuation', 'whitespace',
      'key', 'punctuation', 'whitespace', 'number', 'punctuation', 'whitespace',
      'key', 'punctuation', 'whitespace', 'boolean', 'punctuation', 'whitespace',
      'key', 'punctuation', 'whitespace', 'null', 'whitespace',
      'punctuation',
    ]);
  });
});
