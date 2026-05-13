const allowedStaticRoutes = new Map([
  ['GET health', '/health'],
  ['GET api/live-demo/capabilities', '/api/live-demo/capabilities'],
  ['GET api/proxy-diagnostics', '/api/proxy-diagnostics'],
  ['POST api/dev/recorded-walrus-artifact', '/api/dev/recorded-walrus-artifact'],
  ['POST api/live-demo/model-artifact-run', '/api/live-demo/model-artifact-run'],
]);

const allowedArtifactActions = new Set(['upload', 'verify', 'anchor']);
const artifactIdPattern = /^artifact_[A-Za-z0-9_-]+$/;
const runIdPattern = /^run_[A-Za-z0-9_-]+$/;

export function hasSafeTraceLayerProxySegments(path: string[]): boolean {
  return path.length > 0 && path.every((segment) => segment.length > 0 && segment !== '..');
}

export function allowedTraceLayerProxyPath(method: string, path: string[]): string | undefined {
  const staticPath = allowedStaticRoutes.get(`${method} ${path.join('/')}`);
  if (staticPath !== undefined) return staticPath;

  const artifactPath = allowedArtifactPath(method, path);
  if (artifactPath !== undefined) return artifactPath;

  return allowedReplayPath(method, path);
}

function allowedArtifactPath(method: string, path: string[]): string | undefined {
  if (method !== 'POST' || path.length !== 4) return undefined;
  const [api, artifacts, artifactId, action] = path;
  if (api !== 'api' || artifacts !== 'artifacts' || artifactId === undefined || action === undefined) return undefined;
  if (!artifactIdPattern.test(artifactId) || !allowedArtifactActions.has(action)) return undefined;
  return `/api/artifacts/${artifactId}/${action}`;
}

function allowedReplayPath(method: string, path: string[]): string | undefined {
  if (method !== 'POST' || path.length !== 3) return undefined;
  const [api, replay, runId] = path;
  if (api !== 'api' || replay !== 'replay' || runId === undefined) return undefined;
  if (!runIdPattern.test(runId)) return undefined;
  return `/api/replay/${runId}`;
}
