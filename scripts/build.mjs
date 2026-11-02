import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectory = resolve('.build-tmp');
mkdirSync(temporaryDirectory, { recursive: true });
const environment = { ...process.env, TMP: temporaryDirectory,
  TEMP: temporaryDirectory, TMPDIR: temporaryDirectory };

for (const binary of ['node_modules/typescript/bin/tsc', 'node_modules/vite/bin/vite.js']) {
  const args = binary.includes('typescript') ? ['-b'] : ['build'];
  const result = spawnSync(process.execPath, [resolve(binary), ...args], {
    stdio: 'inherit', env: environment,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
