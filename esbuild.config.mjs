import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/**/*','config/schema.ts'],
  bundle: false,
  platform: 'node',
  target: 'node20',
    outdir: 'dist',
  sourcemap: true,
  minify: false,
});

console.log('Build complete: dist/cli.js, dist/discover-fields.js, dist/lambda-handler.js');
