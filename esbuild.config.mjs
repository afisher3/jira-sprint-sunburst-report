import * as esbuild from 'esbuild';

// Build main CLI
await esbuild.build({
  entryPoints: ['src/cli.ts', 'src/discover-fields.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  sourcemap: true,
  minify: false,
  packages: 'external'
});

console.log('Build complete: dist/cli.js, dist/discover-fields.js');
