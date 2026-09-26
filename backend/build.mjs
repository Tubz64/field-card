// Bundles each Lambda into dist/<name>/index.mjs. Terraform zips that folder
// (infra/modules/api), so the output must be deterministic: no timestamps,
// no minification (readable stack traces in CloudWatch).
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });

await build({
  entryPoints: { 'api/index': 'src/api/index.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  // Some AWS SDK dependencies still call require(); give ESM bundles one.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'info',
});
