const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function shortMiddle(value: string | undefined, head = 10, tail = 6): string {
  if (value === undefined || value.length <= head + tail + 8) return value ?? 'missing';
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function formatDateTime(timestampMs: number | string | undefined): string {
  if (timestampMs === undefined) return 'missing';
  const timestamp = typeof timestampMs === 'string' ? Number.parseInt(timestampMs, 10) : timestampMs;
  if (!Number.isFinite(timestamp)) return 'invalid timestamp';
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(timestamp).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} UTC`;
}
