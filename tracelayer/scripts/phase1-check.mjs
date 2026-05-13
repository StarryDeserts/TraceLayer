import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const command of ['pnpm typecheck', 'pnpm test', 'pnpm check:walrus-boundary']) {
  const result = spawnSync(command, { cwd: workspaceRoot, shell: true, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
