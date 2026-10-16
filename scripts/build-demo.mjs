import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import autoprefixer from 'autoprefixer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'demo-dist');
await fs.mkdir(out, { recursive: true });
const result = await build({
  absWorkingDir: root, entryPoints: ['demo/main.tsx'], outdir: out,
  entryNames: 'assets/app-[hash]', assetNames: 'assets/[name]-[hash]',
  bundle: true, minify: true, metafile: true, jsx: 'automatic', format: 'esm',
  platform: 'browser', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
});
if (Object.keys(result.metafile.inputs).some((p) => /@prisma|src\/lib\/db\./.test(p.replaceAll('\\', '/')))) {
  throw new Error('A database dependency was included in the static demo.');
}
const entry = Object.entries(result.metafile.outputs).find(([, v]) => v.entryPoint === 'demo/main.tsx');
if (!entry) throw new Error('Demo entry point was not built.');
const asset = (p) => '/' + path.relative(out, path.resolve(root, p)).replaceAll('\\', '/');
const config = loadConfig(path.join(root, 'tailwind.config.ts'));
config.content = [path.join(root, 'demo/**/*.{ts,tsx}'), path.join(root, 'src/components/{RichText,Explanation}.tsx')];
const styles = await postcss([tailwindcss(config), autoprefixer]).process(
  await fs.readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') },
);
await fs.writeFile(path.join(out, 'styles.css'), styles.css);
await fs.writeFile(path.join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kenny Math Challenge</title><meta name="description" content="Try 30 Grade 5 maths tests, practice, progress and question-bank tools. Browser-only demo.">
${entry[1].cssBundle ? `<link rel="stylesheet" href="${asset(entry[1].cssBundle)}">` : ''}<link rel="stylesheet" href="/styles.css">
</head><body><div id="root"></div><noscript>Please enable JavaScript to try Kenny Math.</noscript><script type="module" src="${asset(entry[0])}"></script></body></html>`);
console.log('Static demo built in demo-dist. No database, API server or environment variables required.');
