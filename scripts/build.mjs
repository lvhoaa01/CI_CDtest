import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(root, 'dist');
const version = process.env.APP_VERSION ?? process.env.npm_package_version ?? 'local';
const commit = process.env.COMMIT_SHA ?? 'development';

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  cp(resolve(root, 'src'), resolve(outputDirectory, 'src'), { recursive: true }),
  cp(resolve(root, 'public'), resolve(outputDirectory, 'public'), { recursive: true }),
]);

await writeFile(
  resolve(outputDirectory, 'build-info.json'),
  `${JSON.stringify({ version, commit, builtAt: new Date().toISOString() }, null, 2)}\n`,
);

console.log(`Built version ${version} (${commit}) into dist/`);
