export type JsonTokenKind = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace';

export type JsonToken = {
  kind: JsonTokenKind;
  value: string;
};

export function formatJsonForCodeBlock(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

export function jsonCopyText(value: unknown): string {
  return formatJsonForCodeBlock(value);
}

export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let index = 0;

  while (index < text.length) {
    const current = text[index];
    if (current === undefined) break;

    if (/\s/.test(current)) {
      const start = index;
      while (index < text.length && /\s/.test(text[index] ?? '')) index += 1;
      tokens.push({ kind: 'whitespace', value: text.slice(start, index) });
      continue;
    }

    if ('{}[]:,'.includes(current)) {
      tokens.push({ kind: 'punctuation', value: current });
      index += 1;
      continue;
    }

    if (current === '"') {
      const end = readJsonStringEnd(text, index);
      const value = text.slice(index, end);
      tokens.push({ kind: isJsonKey(text, end) ? 'key' : 'string', value });
      index = end;
      continue;
    }

    const numberMatch = text.slice(index).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch?.[0]) {
      tokens.push({ kind: 'number', value: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }

    if (text.startsWith('true', index) || text.startsWith('false', index)) {
      const value = text.startsWith('true', index) ? 'true' : 'false';
      tokens.push({ kind: 'boolean', value });
      index += value.length;
      continue;
    }

    if (text.startsWith('null', index)) {
      tokens.push({ kind: 'null', value: 'null' });
      index += 4;
      continue;
    }

    tokens.push({ kind: 'string', value: current });
    index += 1;
  }

  return tokens;
}

function readJsonStringEnd(text: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const current = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (current === '\\') {
      escaped = true;
      continue;
    }
    if (current === '"') return index + 1;
  }
  return text.length;
}

function isJsonKey(text: string, afterString: number): boolean {
  let index = afterString;
  while (index < text.length && /\s/.test(text[index] ?? '')) index += 1;
  return text[index] === ':';
}
